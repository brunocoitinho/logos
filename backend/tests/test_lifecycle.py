from itertools import product

import pytest
from sqlalchemy import select

from app.models import IncidentEvent
from app.models.enums import IncidentEventType, IncidentStatus
from app.services.incident_lifecycle import ALLOWED_TRANSITIONS
from tests.factories import create_incident, create_user

OPEN = IncidentStatus.OPEN
INVESTIGATING = IncidentStatus.INVESTIGATING
CLOSED = IncidentStatus.CLOSED
INCONCLUSIVE = IncidentStatus.INCONCLUSIVE


@pytest.fixture
def other_analyst(db):
    return create_user(db, name="Bruno Costa", email="bruno@logos.test")


def investigating_incident(db, owner, **overrides):
    return create_incident(db, status=INVESTIGATING, assigned_to_id=owner.id, **overrides)


def transition(client, incident, to_status, note="Guincho removeu o veículo.", version=None):
    return client.post(
        f"/api/incidents/{incident.id}/transition",
        json={"version": version or incident.version, "to_status": to_status, "note": note},
    )


def event_types(db, incident_id):
    return db.scalars(
        select(IncidentEvent.type)
        .where(IncidentEvent.incident_id == incident_id)
        .order_by(IncidentEvent.id)
    ).all()


# --- Assumir -----------------------------------------------------------------------------


def test_claim_moves_to_investigating_and_assigns_analyst(client, db, analyst):
    incident = create_incident(db)

    response = client.post(f"/api/incidents/{incident.id}/claim")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "INVESTIGATING"
    assert body["assigned_to"] == {"id": analyst.id, "name": "Ana Souza"}
    assert body["assigned_at"] is not None
    assert body["version"] == 2
    assert event_types(db, incident.id) == [IncidentEventType.CLAIMED]


def test_second_analyst_claiming_gets_409_with_owner_name(client, client_for, db, other_analyst):
    incident = create_incident(db)
    client.post(f"/api/incidents/{incident.id}/claim")

    response = client_for(other_analyst).post(f"/api/incidents/{incident.id}/claim")

    assert response.status_code == 409
    error = response.json()["error"]
    assert error["message"] == "Ana Souza assumiu este incidente antes de você."
    assert error["details"]["current"]["assigned_to"]["name"] == "Ana Souza"


def test_double_click_on_claim_is_harmless(client, db):
    incident = create_incident(db)

    first = client.post(f"/api/incidents/{incident.id}/claim")
    second = client.post(f"/api/incidents/{incident.id}/claim")

    assert first.status_code == second.status_code == 200
    assert second.json()["version"] == 2
    assert event_types(db, incident.id) == [IncidentEventType.CLAIMED]


@pytest.mark.parametrize("status", [CLOSED, INCONCLUSIVE])
def test_claim_requires_open_incident(client, db, status):
    incident = create_incident(db, status=status)

    response = client.post(f"/api/incidents/{incident.id}/claim")

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_TRANSITION"


def test_claim_unknown_incident_returns_404(client):
    assert client.post("/api/incidents/999999/claim").status_code == 404


# --- Liberar -----------------------------------------------------------------------------


def test_release_returns_incident_to_queue(client, db, analyst):
    incident = investigating_incident(db, analyst)

    response = client.post(
        f"/api/incidents/{incident.id}/release",
        json={"version": 1, "note": "Fim do turno"},
    )

    assert response.status_code == 200
    body = response.json()
    assert (body["status"], body["assigned_to"], body["assigned_at"]) == ("OPEN", None, None)
    assert event_types(db, incident.id) == [IncidentEventType.RELEASED]


def test_only_owner_can_release(client_for, db, analyst, other_analyst):
    incident = investigating_incident(db, analyst)

    response = client_for(other_analyst).post(
        f"/api/incidents/{incident.id}/release", json={"version": 1}
    )

    assert response.status_code == 403
    assert "Ana Souza" in response.json()["error"]["message"]


def test_release_requires_investigating_status(client, db):
    incident = create_incident(db)

    response = client.post(f"/api/incidents/{incident.id}/release", json={"version": 1})

    assert response.status_code == 422


# --- Encerrar e reabrir ------------------------------------------------------------------


def test_owner_closes_incident_with_resolution_note(client, db, analyst):
    incident = investigating_incident(db, analyst)

    response = transition(client, incident, "CLOSED", note="Guincho removeu o veículo.")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "CLOSED"
    assert body["resolution_note"] == "Guincho removeu o veículo."
    assert body["assigned_to"]["id"] == analyst.id, "quem encerrou continua registrado"
    assert client.get("/api/incidents").json()["total"] == 0, "sai da fila padrão"


# C4 — só o responsável encerra
def test_non_owner_cannot_close(client_for, db, analyst, other_analyst):
    incident = investigating_incident(db, analyst)

    response = transition(client_for(other_analyst), incident, "CLOSED")

    assert response.status_code == 403


# L3 — nota obrigatória
@pytest.mark.parametrize("payload_note", [None, "", "ok"])
def test_closing_requires_meaningful_note(client, db, analyst, payload_note):
    incident = investigating_incident(db, analyst)
    payload = {"version": 1, "to_status": "CLOSED"}
    if payload_note is not None:
        payload["note"] = payload_note

    response = client.post(f"/api/incidents/{incident.id}/transition", json=payload)

    assert response.status_code == 422


@pytest.mark.parametrize("status", [CLOSED, INCONCLUSIVE])
def test_any_analyst_can_reopen(client_for, db, analyst, other_analyst, status):
    incident = create_incident(
        db, status=status, assigned_to_id=analyst.id, resolution_note="Resolvido"
    )

    response = transition(
        client_for(other_analyst), incident, "OPEN", note="Motorista ligou de novo"
    )

    assert response.status_code == 200
    body = response.json()
    assert (body["status"], body["assigned_to"], body["resolution_note"]) == ("OPEN", None, None)
    assert event_types(db, incident.id) == [IncidentEventType.REOPENED]


# L1 — todas as transições válidas
@pytest.mark.parametrize(("from_status", "to_status"), sorted(ALLOWED_TRANSITIONS))
def test_valid_transitions_are_recorded(client, db, analyst, from_status, to_status):
    incident = create_incident(db, status=from_status, assigned_to_id=analyst.id)

    response = transition(client, incident, to_status.value)

    assert response.status_code == 200
    event = db.scalar(select(IncidentEvent).where(IncidentEvent.incident_id == incident.id))
    assert (event.from_status, event.to_status, event.user_id) == (
        from_status,
        to_status,
        analyst.id,
    )


# L2 — todas as combinações fora da tabela, geradas automaticamente
INVALID_TRANSITIONS = sorted(set(product(IncidentStatus, IncidentStatus)) - ALLOWED_TRANSITIONS)


@pytest.mark.parametrize(("from_status", "to_status"), INVALID_TRANSITIONS)
def test_invalid_transitions_are_rejected(client, db, analyst, from_status, to_status):
    # O analista é o responsável: a recusa só pode vir da regra de transição.
    incident = create_incident(db, status=from_status, assigned_to_id=analyst.id)

    response = transition(client, incident, to_status.value)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_TRANSITION"
    assert event_types(db, incident.id) == []


def test_invalid_transition_messages_point_to_the_right_action(client, db, analyst):
    open_incident = create_incident(db)
    investigating = investigating_incident(db, analyst)

    to_investigating = transition(client, open_incident, "INVESTIGATING")
    back_to_open = transition(client, investigating, "OPEN")

    assert "Assumir" in to_investigating.json()["error"]["message"]
    assert "Liberar" in back_to_open.json()["error"]["message"]


# C3 — duas transições com a mesma versão
def test_second_transition_with_same_version_gets_409(client, db, analyst):
    incident = investigating_incident(db, analyst)

    first = transition(client, incident, "CLOSED", version=1)
    second = transition(client, incident, "INCONCLUSIVE", version=1)

    assert first.status_code == 200
    assert second.status_code == 409
    assert second.json()["error"]["details"]["current"]["status"] == "CLOSED"


def test_stale_version_is_reported_before_invalid_transition(client, db, analyst):
    """Tela desatualizada: o analista recebe o estado novo (409), não um 422 confuso."""
    incident = investigating_incident(db, analyst)
    transition(client, incident, "CLOSED", version=1)

    response = transition(client, incident, "CLOSED", version=1)

    assert response.status_code == 409


# --- Histórico ---------------------------------------------------------------------------


def test_events_endpoint_returns_full_history_in_order(client, client_for, db, other_analyst):
    created = client.post(
        "/api/incidents",
        json={
            "title": "Neblina na serra",
            "category": "ADVERSE_WEATHER",
            "criticality": "MEDIUM",
            "vehicle_plate": "ABC1D23",
            "highway": "BR-040",
            "km": 80,
            "city": "Petrópolis",
            "state": "RJ",
        },
    ).json()
    incident_id = created["id"]
    client.post(f"/api/incidents/{incident_id}/claim")
    client.post(
        f"/api/incidents/{incident_id}/transition",
        json={"version": 2, "to_status": "CLOSED", "note": "Neblina dissipou."},
    )
    client_for(other_analyst).post(
        f"/api/incidents/{incident_id}/transition",
        json={"version": 3, "to_status": "OPEN", "note": "Voltou a fechar o tempo."},
    )

    events = client.get(f"/api/incidents/{incident_id}/events").json()

    assert [(event["type"], event["user"]["name"]) for event in events] == [
        ("CREATED", "Ana Souza"),
        ("CLAIMED", "Ana Souza"),
        ("STATUS_CHANGED", "Ana Souza"),
        ("REOPENED", "Bruno Costa"),
    ]
    assert events[2]["note"] == "Neblina dissipou."
    assert events[1]["created_at"].endswith("Z")


def test_events_of_unknown_incident_returns_404(client):
    assert client.get("/api/incidents/999999/events").status_code == 404
