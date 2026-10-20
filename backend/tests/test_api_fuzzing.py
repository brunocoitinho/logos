"""V5 — testes baseados em propriedades (Schemathesis).

O Schemathesis lê o OpenAPI que o FastAPI gera e dispara, para cada endpoint, centenas de
requisições com dados válidos e inválidos (textos enormes, tipos errados, valores fora dos
limites, campos faltando). Em vez de testar casos escolhidos a dedo, verifica propriedades
que devem valer para QUALQUER entrada:

- nenhuma requisição causa erro 500;
- dado inválido é sempre recusado (4xx), nunca aceito em silêncio;
- toda resposta segue o formato documentado no Swagger.

Na primeira rodada pesada, encontrou um bug real: `GET /api/incidents?offset=2^64` chegava
ao MySQL e gerava erro 500. Corrigido com limite máximo no offset (e em ids e versões);
o caso virou teste de regressão em test_incidents_list.py.
"""

import os

import pytest
import schemathesis
from hypothesis import HealthCheck, settings
from schemathesis.checks import (
    negative_data_rejection,
    not_a_server_error,
    response_schema_conformance,
)

from app.main import app
from app.models.enums import IncidentStatus
from tests.conftest import auth_headers
from tests.factories import create_incident

schema = schemathesis.openapi.from_asgi("/openapi.json", app)

CHECKS = [not_a_server_error, negative_data_rejection, response_schema_conformance]


@pytest.fixture
def existing_incidents(db, analyst):
    """Incidentes com ids baixos, que o gerador tende a usar: assim os endpoints de detalhe,
    edição e ciclo de vida são exercitados de verdade, e não só respondem 404."""
    create_incident(db, id=1)
    create_incident(db, id=2, status=IncidentStatus.INVESTIGATING, assigned_to_id=analyst.id)
    create_incident(db, id=3, status=IncidentStatus.CLOSED, assigned_to_id=analyst.id)


@schema.parametrize()
@settings(
    # 40 exemplos por endpoint no dia a dia; rodada pesada: FUZZ_EXAMPLES=200
    max_examples=int(os.environ.get("FUZZ_EXAMPLES", "40")),
    deadline=None,
    # As fixtures são criadas uma vez por endpoint, não por exemplo gerado: é o esperado aqui.
    suppress_health_check=[HealthCheck.function_scoped_fixture, HealthCheck.too_slow],
)
def test_api_never_breaks_on_unexpected_input(case, analyst, existing_incidents):
    case.call_and_validate(headers=auth_headers(analyst), checks=CHECKS)
