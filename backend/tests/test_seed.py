import random
import re

import pytest
from sqlalchemy import func, select

from app.core.security import verify_password
from app.db.base import utc_now
from app.models import Incident, IncidentEvent, User
from app.models.enums import IncidentEventType, IncidentStatus
from scripts.fake_data import generate_incident_data, generate_plate
from scripts.seed import DEMO_PASSWORD, ensure_seed_allowed, seed

MERCOSUL_PLATE = re.compile(r"^[A-Z]{3}\d[A-Z]\d{2}$")


def test_generated_plates_follow_mercosul_format():
    rng = random.Random(42)

    for _ in range(500):
        assert MERCOSUL_PLATE.match(generate_plate(rng))


def test_generated_incident_fits_database_columns():
    rng = random.Random(42)

    for _ in range(500):
        data = generate_incident_data(rng, utc_now())
        assert len(data["title"]) <= 120
        assert len(data["vehicle_plate"]) <= 8
        assert len(data["state"]) == 2
        assert data["km"] >= 0


def test_seed_creates_demo_analysts_and_incidents(db):
    result = seed(db, incident_count=100, rng=random.Random(1))

    assert result.incidents == 100
    assert db.scalar(select(func.count(Incident.id))) == 100

    analysts = db.scalars(select(User)).all()
    assert len(analysts) == 3
    assert all(verify_password(DEMO_PASSWORD, analyst.password_hash) for analyst in analysts)


def test_seed_lifecycle_data_is_consistent(db):
    now = utc_now()
    seed(db, incident_count=100, rng=random.Random(7), now=now)

    incidents = db.scalars(select(Incident)).unique().all()
    statuses = {incident.status for incident in incidents}
    assert statuses == set(IncidentStatus), "o seed deve cobrir todos os status"

    for incident in incidents:
        event_types = [event.type for event in incident.events]
        assert event_types[0] == IncidentEventType.CREATED
        assert incident.reported_at <= now

        if incident.status == IncidentStatus.OPEN:
            assert incident.assigned_to_id is None
            assert event_types == [IncidentEventType.CREATED]
        else:
            assert incident.assigned_to_id is not None
            assert IncidentEventType.CLAIMED in event_types

        if incident.status in (IncidentStatus.CLOSED, IncidentStatus.INCONCLUSIVE):
            assert incident.resolution_note
            assert event_types[-1] == IncidentEventType.STATUS_CHANGED


def test_seed_can_run_again_without_duplicating_analysts(db):
    seed(db, incident_count=10, rng=random.Random(1))
    seed(db, incident_count=20, rng=random.Random(2))

    created_events = select(func.count(IncidentEvent.id)).where(
        IncidentEvent.type == IncidentEventType.CREATED
    )
    assert db.scalar(select(func.count(User.id))) == 3
    assert db.scalar(select(func.count(Incident.id))) == 20
    assert db.scalar(created_events) == 20


def test_seed_is_blocked_in_production_by_default():
    with pytest.raises(SystemExit):
        ensure_seed_allowed("production", allow_production=False)

    ensure_seed_allowed("production", allow_production=True)
    ensure_seed_allowed("development", allow_production=False)
