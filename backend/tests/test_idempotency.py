import pytest
from sqlalchemy import func, select

from app.models import Incident, IncidentEvent

PAYLOAD = {
    "title": "Pneu furado",
    "category": "MECHANICAL_FAILURE",
    "criticality": "LOW",
    "vehicle_plate": "ABC1D23",
    "highway": "BR-116",
    "km": 10,
    "city": "Resende",
    "state": "RJ",
}


def post(client, key=None):
    headers = {"Idempotency-Key": key} if key else {}
    return client.post("/api/incidents", json=PAYLOAD, headers=headers)


# C6 — reenvio com a mesma chave
def test_retry_with_same_key_returns_existing_incident(client, db):
    first = post(client, "envio-000001")
    retry = post(client, "envio-000001")

    assert first.status_code == 201
    assert retry.status_code == 200
    assert retry.headers["Idempotent-Replayed"] == "true"
    assert retry.json()["id"] == first.json()["id"]
    assert db.scalar(select(func.count(Incident.id))) == 1
    assert db.scalar(select(func.count(IncidentEvent.id))) == 1


def test_different_keys_create_different_incidents(client, db):
    post(client, "envio-000001")
    post(client, "envio-000002")

    assert db.scalar(select(func.count(Incident.id))) == 2


def test_without_key_every_post_creates_an_incident(client, db):
    post(client)
    post(client)

    assert db.scalar(select(func.count(Incident.id))) == 2


@pytest.mark.parametrize("bad_key", ["curta", "com espaco 123", "x" * 65, "chave/com/barra"])
def test_invalid_idempotency_key_is_rejected(client, bad_key):
    response = post(client, bad_key)

    assert response.status_code == 422
