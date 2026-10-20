import pytest
from sqlalchemy import select

from app.core.errors import ConflictError
from app.db.session import SessionLocal
from app.models import Incident, IncidentEvent
from app.models.enums import IncidentEventType
from app.schemas.incident import IncidentUpdate
from app.services.incidents import update_incident
from tests.factories import create_incident


def test_patch_updates_fields_and_increments_version(client, db):
    incident = create_incident(db, title="Pneu furado")

    response = client.patch(
        f"/api/incidents/{incident.id}",
        json={"version": 1, "title": "Pneu furado - socorro a caminho", "criticality": "MEDIUM"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Pneu furado - socorro a caminho"
    assert body["criticality"] == "MEDIUM"
    assert body["version"] == 2

    event = db.scalar(select(IncidentEvent).where(IncidentEvent.type == IncidentEventType.UPDATED))
    assert event.note == "Campos alterados: criticality, title"


def test_patch_can_clear_description(client, db):
    incident = create_incident(db)

    response = client.patch(
        f"/api/incidents/{incident.id}", json={"version": 1, "description": None}
    )

    assert response.status_code == 200
    assert response.json()["description"] is None


def test_patch_without_real_changes_keeps_version(client, db):
    incident = create_incident(db, title="Mesmo título")

    response = client.patch(
        f"/api/incidents/{incident.id}", json={"version": 1, "title": "Mesmo título"}
    )

    assert response.json()["version"] == 1


# C2 — versão desatualizada
def test_patch_with_stale_version_returns_409_with_current_state(client, db):
    incident = create_incident(db, title="Original")
    client.patch(f"/api/incidents/{incident.id}", json={"version": 1, "title": "Analista A"})

    # Analista B ainda está com a versão 1 na tela.
    response = client.patch(
        f"/api/incidents/{incident.id}", json={"version": 1, "title": "Analista B"}
    )

    assert response.status_code == 409
    error = response.json()["error"]
    assert error["code"] == "CONFLICT"
    assert error["details"]["current"]["title"] == "Analista A"
    assert error["details"]["current"]["version"] == 2

    db.expire_all()
    assert db.get(Incident, incident.id).title == "Analista A"


def test_write_between_read_and_commit_is_detected(db):
    """Segunda barreira: a versão confere na leitura, mas outra gravação ocorre antes do commit."""
    incident = create_incident(db, title="Original")  # a sessão "db" guarda a versão 1

    other_analyst = SessionLocal()
    try:
        other_analyst.get(Incident, incident.id).title = "Gravado por outra conexão"
        other_analyst.commit()  # banco agora está na versão 2
    finally:
        other_analyst.close()

    with pytest.raises(ConflictError) as conflict:
        update_incident(db, incident.id, IncidentUpdate(version=1, title="Tentativa atrasada"))

    assert conflict.value.details["current"]["version"] == 2
    assert conflict.value.details["current"]["title"] == "Gravado por outra conexão"


@pytest.mark.parametrize(
    "payload",
    [
        {"title": "Sem versão"},
        {"version": 1},
        {"version": 0, "title": "Versão inválida"},
        {"version": 1, "status": "CLOSED"},
        {"version": 1, "assigned_to_id": 1},
        {"version": 1, "title": None},
        {"version": 1, "title": "Ok", "km": None},
    ],
)
def test_patch_rejects_invalid_payloads(client, db, payload):
    incident = create_incident(db)

    response = client.patch(f"/api/incidents/{incident.id}", json=payload)

    assert response.status_code == 422


def test_patch_unknown_incident_returns_404(client):
    response = client.patch("/api/incidents/999999", json={"version": 1, "title": "Nada"})

    assert response.status_code == 404


def test_delete_hides_incident_and_keeps_history(client, db):
    incident = create_incident(db)

    response = client.delete(f"/api/incidents/{incident.id}", params={"version": 1})

    assert response.status_code == 204
    assert client.get(f"/api/incidents/{incident.id}").status_code == 404
    assert client.get("/api/incidents").json()["total"] == 0

    db.expire_all()
    assert db.get(Incident, incident.id).deleted_at is not None
    event_types = db.scalars(select(IncidentEvent.type)).all()
    assert IncidentEventType.DELETED in event_types


# C5 — exclusão com versão antiga
def test_delete_with_stale_version_returns_409(client, db):
    incident = create_incident(db)
    client.patch(f"/api/incidents/{incident.id}", json={"version": 1, "title": "Editado"})

    response = client.delete(f"/api/incidents/{incident.id}", params={"version": 1})

    assert response.status_code == 409
    assert client.get(f"/api/incidents/{incident.id}").status_code == 200


def test_delete_requires_version(client, db):
    incident = create_incident(db)

    response = client.delete(f"/api/incidents/{incident.id}")

    assert response.status_code == 422


def test_delete_twice_returns_404(client, db):
    incident = create_incident(db)
    client.delete(f"/api/incidents/{incident.id}", params={"version": 1})

    response = client.delete(f"/api/incidents/{incident.id}", params={"version": 2})

    assert response.status_code == 404
