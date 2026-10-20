import json
import random
import urllib.error

import pytest

from app.schemas.incident import IncidentCreate
from scripts.simulate_trucks import LoginRejectedError, build_payload, run


def http_error(code: int) -> urllib.error.HTTPError:
    return urllib.error.HTTPError("http://api", code, "erro", hdrs=None, fp=None)


class FakeApiClient:
    """Substitui a API real: cada chamada consome a próxima resposta (ou erro) programada."""

    def __init__(self, logins=None, creations=None):
        self.logins = list(logins or ["token-1"])
        self.creations = list(creations or [])
        self.login_calls = 0
        self.tokens_used = []

    def login(self, email, password):
        self.login_calls += 1
        result = self.logins.pop(0) if len(self.logins) > 1 else self.logins[0]
        if isinstance(result, Exception):
            raise result
        return result

    def create_incident(self, token, payload):
        self.tokens_used.append(token)
        result = self.creations.pop(0) if self.creations else None
        if isinstance(result, Exception):
            raise result
        return {"id": len(self.tokens_used), **payload}


def run_fake(client, count):
    return run(
        client,
        "frota@logos.demo",
        "senha",
        0,
        count,
        random.Random(1),
        sleep=lambda _: None,
        log=lambda _: None,
    )


def test_payload_is_valid_for_the_api():
    rng = random.Random(3)

    for _ in range(200):
        payload = build_payload(rng)
        json.dumps(payload)  # serializável
        IncidentCreate.model_validate(payload)  # aceito pela validação da API


def test_sends_requested_number_of_incidents():
    client = FakeApiClient()

    assert run_fake(client, count=3) == 3
    assert client.login_calls == 1


def test_keeps_trying_when_api_is_unavailable():
    client = FakeApiClient(creations=[urllib.error.URLError("conexão recusada"), http_error(503)])

    assert run_fake(client, count=2) == 2
    assert len(client.tokens_used) == 4


def test_logs_in_again_when_token_expires():
    client = FakeApiClient(logins=["token-antigo", "token-novo"], creations=[None, http_error(401)])

    assert run_fake(client, count=2) == 2
    assert client.login_calls == 2
    assert client.tokens_used == ["token-antigo", "token-antigo", "token-novo"]


def test_stops_when_credentials_are_rejected():
    client = FakeApiClient(logins=[http_error(401)])

    with pytest.raises(LoginRejectedError):
        run_fake(client, count=1)
