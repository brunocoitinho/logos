import pytest
from sqlalchemy import select

from app.models import IncidentEvent
from app.models.enums import IncidentEventType


def valid_payload(**overrides) -> dict:
    payload = {
        "title": "Pneu furado no acostamento",
        "description": "Motorista aguarda socorro.",
        "category": "MECHANICAL_FAILURE",
        "criticality": "LOW",
        "vehicle_plate": "ABC1D23",
        "highway": "BR-116",
        "km": 152.4,
        "city": "Resende",
        "state": "RJ",
    }
    return payload | overrides


def assert_validation_error(response, field: str) -> None:
    assert response.status_code == 422
    body = response.json()["error"]
    assert body["code"] == "VALIDATION_ERROR"
    assert field in [item["field"] for item in body["details"]["fields"]]


def test_create_incident_returns_201_open_at_version_1(client, db):
    response = client.post("/api/incidents", json=valid_payload())

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "OPEN"
    assert body["version"] == 1
    assert body["assigned_to"] is None
    assert body["km"] == 152.4
    assert body["reported_at"].endswith("Z"), "datas saem em UTC explícito"

    events = db.scalars(select(IncidentEvent)).all()
    assert [event.type for event in events] == [IncidentEventType.CREATED]


def test_create_normalizes_plate_highway_and_state(client):
    response = client.post(
        "/api/incidents",
        json=valid_payload(vehicle_plate="abc-1d23", highway="br-116", state="rj"),
    )

    body = response.json()
    assert (body["vehicle_plate"], body["highway"], body["state"]) == ("ABC1D23", "BR-116", "RJ")


def test_create_accepts_old_plate_format(client):
    response = client.post("/api/incidents", json=valid_payload(vehicle_plate="ABC1234"))

    assert response.status_code == 201


def test_create_converts_reported_at_to_utc(client):
    response = client.post(
        "/api/incidents", json=valid_payload(reported_at="2026-10-20T08:00:00-03:00")
    )

    assert response.json()["reported_at"] == "2026-10-20T11:00:00Z"


# V1 — valores fora dos enums
@pytest.mark.parametrize(
    ("field", "value"),
    [("category", "ALIEN_INVASION"), ("criticality", "URGENTE"), ("category", "")],
)
def test_create_rejects_values_outside_enums(client, field, value):
    response = client.post("/api/incidents", json=valid_payload(**{field: value}))

    assert_validation_error(response, field)


# V2 — campos extras, limites e formatos
def test_create_rejects_unknown_fields(client):
    """Impede, por exemplo, criar um incidente já "Fechado" ou com responsável."""
    response = client.post("/api/incidents", json=valid_payload(status="CLOSED"))

    assert_validation_error(response, "status")


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("title", "ab"),
        ("title", "x" * 121),
        ("title", "   "),
        ("description", "x" * 2001),
        ("vehicle_plate", "1234ABC"),
        ("vehicle_plate", "ABCD123"),
        ("highway", "Rodovia 116"),
        ("state", "XX"),
        ("km", -1),
        ("km", 10000),
        ("km", 12.34),
        ("city", "A"),
    ],
)
def test_create_rejects_invalid_values(client, field, value):
    response = client.post("/api/incidents", json=valid_payload(**{field: value}))

    assert_validation_error(response, field)


def test_create_rejects_reported_at_in_the_future(client):
    response = client.post("/api/incidents", json=valid_payload(reported_at="2099-01-01T00:00:00Z"))

    assert_validation_error(response, "reported_at")


@pytest.mark.parametrize("missing", ["title", "category", "criticality", "vehicle_plate", "km"])
def test_create_requires_mandatory_fields(client, missing):
    payload = valid_payload()
    del payload[missing]

    response = client.post("/api/incidents", json=payload)

    assert_validation_error(response, missing)


# V3 — entradas malformadas não derrubam a API nem vazam detalhes internos
@pytest.mark.parametrize(
    "raw_body",
    ['{"title": "Pneu",', "", "null", "[]", '"texto"', "not json at all"],
)
def test_create_handles_malformed_body(client, raw_body):
    response = client.post(
        "/api/incidents", content=raw_body, headers={"Content-Type": "application/json"}
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert "Traceback" not in response.text


def test_create_rejects_wrong_types(client):
    response = client.post(
        "/api/incidents", json=valid_payload(km="cento e vinte", title=["lista"])
    )

    assert response.status_code == 422
    fields = {item["field"] for item in response.json()["error"]["details"]["fields"]}
    assert {"km", "title"} <= fields
