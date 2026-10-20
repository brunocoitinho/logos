import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import DataError, StatementError
from sqlalchemy.orm.exc import StaleDataError

from app.db.session import SessionLocal
from app.models import Incident, IncidentEvent
from app.models.enums import IncidentEventType, IncidentStatus
from tests.factories import create_incident, create_user


def test_new_incident_starts_open_at_version_1(db):
    incident = create_incident(db)

    assert incident.status == IncidentStatus.OPEN
    assert incident.version == 1


def test_each_update_increments_version(db):
    incident = create_incident(db)

    incident.title = "Pneu furado - motorista aguardando socorro"
    db.commit()

    assert incident.version == 2


def test_stale_write_is_rejected(db):
    """Base do controle de concorrência: quem grava com versão antiga é recusado."""
    incident_id = create_incident(db).id

    analyst_a = SessionLocal()
    analyst_b = SessionLocal()
    try:
        # Os dois analistas abrem o mesmo incidente (ambos veem a versão 1).
        incident_seen_by_a = analyst_a.get(Incident, incident_id)
        incident_seen_by_b = analyst_b.get(Incident, incident_id)

        # A grava primeiro: versão passa para 2.
        incident_seen_by_a.status = IncidentStatus.INVESTIGATING
        analyst_a.commit()

        # B tenta gravar a partir da versão 1, que já não existe.
        incident_seen_by_b.status = IncidentStatus.CLOSED
        with pytest.raises(StaleDataError):
            analyst_b.commit()
    finally:
        analyst_a.close()
        analyst_b.close()

    db.expire_all()
    saved = db.get(Incident, incident_id)
    assert saved.status == IncidentStatus.INVESTIGATING
    assert saved.version == 2


def test_database_rejects_unknown_enum_value(db):
    """Mesmo se a validação da API falhar, o banco não aceita status inválido."""
    incident = create_incident(db)

    with pytest.raises((DataError, StatementError)):
        db.execute(
            text("UPDATE incidents SET status = 'HACKED' WHERE id = :id"), {"id": incident.id}
        )
    db.rollback()


def test_deleting_incident_removes_its_events(db):
    analyst = create_user(db)
    incident = create_incident(db)
    db.add(
        IncidentEvent(incident_id=incident.id, user_id=analyst.id, type=IncidentEventType.CREATED)
    )
    db.commit()

    db.delete(incident)
    db.commit()

    assert db.scalars(select(IncidentEvent)).all() == []


def test_deleting_user_keeps_incident_unassigned(db):
    analyst = create_user(db)
    incident = create_incident(db, assigned_to_id=analyst.id)

    db.delete(analyst)
    db.commit()
    db.expire_all()

    assert db.get(Incident, incident.id).assigned_to_id is None
