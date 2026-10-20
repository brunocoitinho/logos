"""Concorrência real: várias threads, cada uma com seu cliente HTTP e sua conexão com o MySQL.

A `threading.Barrier` segura todas as threads até a última ficar pronta e então as libera
juntas, para que as requisições cheguem ao banco praticamente no mesmo instante.
"""

import threading
from collections import Counter

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.main import app
from app.models import Incident, IncidentEvent
from app.models.enums import IncidentEventType, IncidentStatus
from tests.conftest import auth_headers
from tests.factories import create_incident, create_user

ANALYSTS = 10


def run_simultaneously(actions):
    """Executa as funções em threads liberadas ao mesmo tempo; devolve os resultados."""
    barrier = threading.Barrier(len(actions))
    results = [None] * len(actions)

    def worker(index, action):
        barrier.wait()
        results[index] = action()

    threads = [
        threading.Thread(target=worker, args=(index, action))
        for index, action in enumerate(actions)
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=30)
    return results


# C1 — o cenário central do case
@pytest.mark.parametrize("round_number", range(3))
def test_ten_analysts_claiming_at_once_have_a_single_winner(db, round_number):
    analysts = [create_user(db) for _ in range(ANALYSTS)]
    incident = create_incident(db, title="Acidente com vítimas na BR-116")
    clients = [TestClient(app, headers=auth_headers(analyst)) for analyst in analysts]

    responses = run_simultaneously(
        [lambda c=client: c.post(f"/api/incidents/{incident.id}/claim") for client in clients]
    )

    status_codes = Counter(response.status_code for response in responses)
    assert status_codes == {200: 1, 409: ANALYSTS - 1}

    winner = next(response.json() for response in responses if response.status_code == 200)
    db.expire_all()
    saved = db.get(Incident, incident.id)
    assert saved.status == IncidentStatus.INVESTIGATING
    assert saved.assigned_to_id == winner["assigned_to"]["id"]
    assert saved.version == 2

    claims = db.scalar(
        select(func.count(IncidentEvent.id)).where(
            IncidentEvent.incident_id == incident.id,
            IncidentEvent.type == IncidentEventType.CLAIMED,
        )
    )
    assert claims == 1, "só o vencedor registra o evento"

    # Todos os perdedores sabem quem venceu.
    winner_name = winner["assigned_to"]["name"]
    for response in responses:
        if response.status_code == 409:
            assert response.json()["error"]["message"].startswith(winner_name)


def test_simultaneous_edits_keep_only_one_version(db):
    analysts = [create_user(db) for _ in range(5)]
    incident = create_incident(db, title="Original")
    clients = [TestClient(app, headers=auth_headers(analyst)) for analyst in analysts]

    responses = run_simultaneously(
        [
            lambda c=client, n=number: c.patch(
                f"/api/incidents/{incident.id}", json={"version": 1, "title": f"Versão {n}"}
            )
            for number, client in enumerate(clients)
        ]
    )

    assert Counter(response.status_code for response in responses) == {200: 1, 409: 4}
    db.expire_all()
    assert db.get(Incident, incident.id).version == 2


# C6 — reenvios simultâneos com a mesma chave não duplicam
def test_simultaneous_retries_with_same_idempotency_key_create_one_incident(db, analyst):
    client = TestClient(app, headers=auth_headers(analyst))
    payload = {
        "title": "Pneu furado",
        "category": "MECHANICAL_FAILURE",
        "criticality": "LOW",
        "vehicle_plate": "ABC1D23",
        "highway": "BR-116",
        "km": 10,
        "city": "Resende",
        "state": "RJ",
    }
    headers = {"Idempotency-Key": "caminhao-42-envio-0001"}

    responses = run_simultaneously(
        [lambda: client.post("/api/incidents", json=payload, headers=headers)] * 5
    )

    assert sorted(response.status_code for response in responses) == [200, 200, 200, 200, 201]
    assert len({response.json()["id"] for response in responses}) == 1
    assert db.scalar(select(func.count(Incident.id))) == 1
