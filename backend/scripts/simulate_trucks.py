"""Simula caminhões enviando incidentes para a API, como faria a telemetria da frota.

Uso (na pasta backend/, com a API rodando):
    python -m scripts.simulate_trucks                        # API local, a cada 8 s, sem parar
    python -m scripts.simulate_trucks --interval 3 --count 10
    python -m scripts.simulate_trucks --api-url https://logos-api.startbc.online

Usa a conta da telemetria criada pelo seed. Se a API cair, continua tentando;
se o token expirar, faz login de novo.
"""

import argparse
import json
import random
import time
import urllib.error
import urllib.request
import uuid
from collections.abc import Callable
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any

from scripts.fake_data import generate_incident_data
from scripts.seed import DEMO_PASSWORD, FLEET_ACCOUNT


class LoginRejectedError(Exception):
    """Credenciais da telemetria recusadas: tentar de novo não adianta."""


def build_payload(rng: random.Random) -> dict[str, Any]:
    """Corpo do POST /api/incidents. Sem reported_at: a API usa o momento do recebimento."""
    data = generate_incident_data(rng, reported_at=datetime.now())
    del data["reported_at"]
    return {key: _to_json_value(value) for key, value in data.items()}


def _to_json_value(value: Any) -> Any:
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, Decimal):
        return float(value)
    return value


class ApiClient:
    def __init__(self, base_url: str, timeout_seconds: float = 10) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    def login(self, email: str, password: str) -> str:
        response = self._request("POST", "/api/auth/login", {"email": email, "password": password})
        return response["access_token"]

    def create_incident(
        self, token: str, payload: dict[str, Any], idempotency_key: str
    ) -> dict[str, Any]:
        return self._request(
            "POST", "/api/incidents", payload, token, {"Idempotency-Key": idempotency_key}
        )

    def _request(
        self,
        method: str,
        path: str,
        body: dict[str, Any],
        token: str | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        headers = {"Content-Type": "application/json", **(extra_headers or {})}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        request = urllib.request.Request(
            self.base_url + path,
            data=json.dumps(body).encode("utf-8"),
            headers=headers,
            method=method,
        )
        with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
            return json.loads(response.read())


def run(
    client: ApiClient,
    email: str,
    password: str,
    interval_seconds: float,
    count: int | None,
    rng: random.Random,
    sleep: Callable[[float], None] = time.sleep,
    log: Callable[[str], None] = print,
) -> int:
    """Envia incidentes até atingir `count` (None = sem parar). Devolve quantos foram aceitos."""
    token: str | None = None
    sent = 0
    # Incidente ainda não confirmado pela API. Em caso de falha, é reenviado com a MESMA
    # chave: se a API chegou a gravar (e só a resposta se perdeu), não haverá duplicata.
    pending: tuple[str, dict[str, Any]] | None = None

    while count is None or sent < count:
        try:
            if token is None:
                token = _login(client, email, password)
            if pending is None:
                pending = (uuid.uuid4().hex, build_payload(rng))
            idempotency_key, payload = pending
            incident = client.create_incident(token, payload, idempotency_key)
            pending = None
            sent += 1
            log(
                f"[{datetime.now():%H:%M:%S}] #{incident['id']} {incident['criticality']:<6} "
                f"{incident['title']} ({incident['highway']} km {incident['km']}, "
                f"{incident['city']}/{incident['state']})"
            )
        except urllib.error.HTTPError as error:
            if error.code == 401:
                log("Token expirado ou inválido. Fazendo login novamente.")
                token = None
                continue
            log(f"API recusou o envio (HTTP {error.code}). Tentando de novo.")
        except (urllib.error.URLError, TimeoutError) as error:
            log(f"API indisponível ({error}). Tentando de novo em {interval_seconds} s.")

        if count is None or sent < count:
            sleep(interval_seconds)

    return sent


def _login(client: ApiClient, email: str, password: str) -> str:
    try:
        return client.login(email, password)
    except urllib.error.HTTPError as error:
        if error.code == 401:
            raise LoginRejectedError(f"Login recusado para {email}. Rodou o seed?") from None
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description="Simulador de caminhões do Logos.")
    # 127.0.0.1 e não "localhost": no Windows, "localhost" tenta IPv6 primeiro e cada
    # requisição espera ~2 s antes de cair para o IPv4 em que o uvicorn escuta.
    parser.add_argument("--api-url", default="http://127.0.0.1:8000")
    parser.add_argument("--email", default=FLEET_ACCOUNT[1])
    parser.add_argument("--password", default=DEMO_PASSWORD)
    parser.add_argument("--interval", type=float, default=8, help="segundos entre envios")
    parser.add_argument("--count", type=int, default=None, help="quantidade (padrão: sem fim)")
    args = parser.parse_args()

    print(f"Enviando incidentes para {args.api_url} a cada {args.interval} s. Ctrl+C para parar.")
    try:
        run(
            ApiClient(args.api_url),
            args.email,
            args.password,
            args.interval,
            args.count,
            random.Random(),
        )
    except LoginRejectedError as error:
        raise SystemExit(str(error)) from None
    except KeyboardInterrupt:
        print("\nSimulador encerrado.")


if __name__ == "__main__":
    main()
