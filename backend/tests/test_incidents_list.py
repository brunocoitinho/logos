from datetime import timedelta

import pytest

from app.db.base import utc_now
from app.models.enums import Criticality, IncidentCategory, IncidentStatus
from tests.factories import create_incident


def titles(response) -> list[str]:
    return [item["title"] for item in response.json()["items"]]


# F1 — filtros por criticidade, categoria e combinações
def test_filter_by_criticality(client, db):
    create_incident(db, title="Alta", criticality=Criticality.HIGH)
    create_incident(db, title="Média", criticality=Criticality.MEDIUM)
    create_incident(db, title="Baixa", criticality=Criticality.LOW)

    response = client.get("/api/incidents", params={"criticality": "HIGH"})

    assert titles(response) == ["Alta"]


def test_filter_accepts_multiple_values(client, db):
    create_incident(db, title="Alta", criticality=Criticality.HIGH)
    create_incident(db, title="Média", criticality=Criticality.MEDIUM)
    create_incident(db, title="Baixa", criticality=Criticality.LOW)

    response = client.get("/api/incidents", params={"criticality": ["HIGH", "LOW"]})

    assert sorted(titles(response)) == ["Alta", "Baixa"]


def test_filter_combines_criticality_and_category(client, db):
    create_incident(
        db,
        title="Alta com vítimas",
        criticality=Criticality.HIGH,
        category=IncidentCategory.ACCIDENT_WITH_VICTIMS,
    )
    create_incident(
        db,
        title="Alta mecânica",
        criticality=Criticality.HIGH,
        category=IncidentCategory.MECHANICAL_FAILURE,
    )
    create_incident(
        db,
        title="Baixa com vítimas",
        criticality=Criticality.LOW,
        category=IncidentCategory.ACCIDENT_WITH_VICTIMS,
    )

    response = client.get(
        "/api/incidents", params={"criticality": "HIGH", "category": "ACCIDENT_WITH_VICTIMS"}
    )

    assert titles(response) == ["Alta com vítimas"]
    assert response.json()["total"] == 1


# F2 — ordem exata de prioridade (PRD §4.1)
def test_list_orders_by_priority_rule(client, db):
    now = utc_now()

    def create(title, status, criticality, category, minutes_ago):
        create_incident(
            db,
            title=title,
            status=status,
            criticality=criticality,
            category=category,
            reported_at=now - timedelta(minutes=minutes_ago),
        )

    open_, investigating = IncidentStatus.OPEN, IncidentStatus.INVESTIGATING
    high, medium = Criticality.HIGH, Criticality.MEDIUM
    victims = IncidentCategory.ACCIDENT_WITH_VICTIMS
    mechanical = IncidentCategory.MECHANICAL_FAILURE

    # Criados fora de ordem de propósito.
    create("6 investigando alta", investigating, high, victims, 90)
    create("5 aberto média", open_, medium, victims, 120)
    create("4 aberto alta mecânica", open_, high, mechanical, 200)
    create("2 aberto alta vítimas antigo", open_, high, victims, 60)
    create("3 aberto alta vítimas recente", open_, high, victims, 5)
    create("1 aberto alta vítimas mais antigo", open_, high, victims, 300)

    response = client.get("/api/incidents")

    assert titles(response) == [
        "1 aberto alta vítimas mais antigo",
        "2 aberto alta vítimas antigo",
        "3 aberto alta vítimas recente",
        "4 aberto alta mecânica",
        "5 aberto média",
        "6 investigando alta",
    ]


# F3 — filtro padrão de gestão por exceção
def test_default_list_shows_only_open_and_investigating(client, db):
    for status in IncidentStatus:
        create_incident(db, title=status.value, status=status)

    response = client.get("/api/incidents")

    assert sorted(titles(response)) == ["INVESTIGATING", "OPEN"]


def test_closed_incidents_are_listed_when_requested(client, db):
    create_incident(db, title="Fechado", status=IncidentStatus.CLOSED)

    response = client.get("/api/incidents", params={"status": "CLOSED"})

    assert titles(response) == ["Fechado"]


def test_deleted_incidents_never_appear(client, db):
    create_incident(db, title="Excluído", deleted_at=utc_now())

    all_statuses = [status.value for status in IncidentStatus]
    response = client.get("/api/incidents", params={"status": all_statuses})

    assert titles(response) == []
    assert client.get("/api/incidents/summary").json()["by_status"]["OPEN"] == 0


# F4 — contadores do resumo
def test_summary_counts_match_data(client, db):
    create_incident(db, status=IncidentStatus.OPEN, criticality=Criticality.HIGH)
    create_incident(db, status=IncidentStatus.OPEN, criticality=Criticality.HIGH)
    create_incident(db, status=IncidentStatus.OPEN, criticality=Criticality.LOW)
    create_incident(db, status=IncidentStatus.INVESTIGATING, criticality=Criticality.MEDIUM)
    create_incident(db, status=IncidentStatus.CLOSED, criticality=Criticality.HIGH)

    summary = client.get("/api/incidents/summary").json()

    assert summary["by_status"] == {"OPEN": 3, "INVESTIGATING": 1, "CLOSED": 1, "INCONCLUSIVE": 0}
    assert summary["open_by_criticality"] == {"HIGH": 2, "MEDIUM": 0, "LOW": 1}
    assert summary["investigating_by_criticality"] == {"HIGH": 0, "MEDIUM": 1, "LOW": 0}


def test_summary_of_empty_database_is_all_zeros(client):
    summary = client.get("/api/incidents/summary").json()

    assert set(summary["by_status"].values()) == {0}


# F5 — limites de paginação e parâmetros inválidos
@pytest.mark.parametrize(
    "params",
    [
        {"limit": 0},
        {"limit": 201},
        {"limit": -5},
        {"offset": -1},
        # Regressão: encontrado pelo Schemathesis; o offset 2^64 chegava ao MySQL e gerava 500.
        {"offset": 18446744073709551616},
        {"offset": 1_000_001},
        {"limit": "muitos"},
        {"criticality": "URGENTE"},
        {"statuz": "OPEN"},
        {"q": "x" * 101},
    ],
)
def test_list_rejects_invalid_query_params(client, params):
    response = client.get("/api/incidents", params=params)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_pagination_returns_total_and_requested_page(client, db):
    for number in range(5):
        create_incident(db, title=f"Incidente {number}")

    response = client.get("/api/incidents", params={"limit": 2, "offset": 2})

    body = response.json()
    assert body["total"] == 5
    assert len(body["items"]) == 2
    assert (body["limit"], body["offset"]) == (2, 2)


# Busca textual
def test_search_matches_title_plate_and_city(client, db):
    create_incident(db, title="Neblina na serra", vehicle_plate="AAA1A11", city="Petrópolis")
    create_incident(db, title="Pneu furado", vehicle_plate="BBB2B22", city="Resende")

    assert titles(client.get("/api/incidents", params={"q": "neblina"})) == ["Neblina na serra"]
    assert titles(client.get("/api/incidents", params={"q": "BBB2"})) == ["Pneu furado"]
    assert titles(client.get("/api/incidents", params={"q": "Petrópolis"})) == ["Neblina na serra"]


def test_search_treats_wildcards_as_text(client, db):
    create_incident(db, title="Pneu furado")

    response = client.get("/api/incidents", params={"q": "%"})

    assert titles(response) == []


# Detalhe
def test_get_incident_by_id(client, db):
    incident = create_incident(db, title="Detalhe")

    response = client.get(f"/api/incidents/{incident.id}")

    assert response.status_code == 200
    assert response.json()["title"] == "Detalhe"


# V4 — id inexistente / inválido
def test_get_unknown_incident_returns_404(client):
    response = client.get("/api/incidents/999999")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


@pytest.mark.parametrize("bad_id", ["abc", "0", "-1", "1.5", "2147483648", "18446744073709551616"])
def test_get_with_invalid_id_returns_422(client, bad_id):
    response = client.get(f"/api/incidents/{bad_id}")

    assert response.status_code == 422


def test_get_deleted_incident_returns_404(client, db):
    incident = create_incident(db, deleted_at=utc_now())

    assert client.get(f"/api/incidents/{incident.id}").status_code == 404
