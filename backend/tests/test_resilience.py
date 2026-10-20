"""Resiliência do backend quando o banco está fora ou oscilando (R1–R3)."""

import pytest
from sqlalchemy import event
from sqlalchemy.exc import OperationalError

from app.db.session import (
    CONNECT_RETRY_DELAYS_SECONDS,
    connect_with_retry,
    engine,
    get_db,
)
from app.main import app


class UnavailableDatabaseSession:
    """Sessão que falha como o SQLAlchemy falha quando não consegue falar com o MySQL."""

    def _fail(self, *args, **kwargs):
        raise OperationalError("SELECT 1", {}, Exception("Can't connect to MySQL server"))

    execute = scalar = scalars = get = _fail

    def close(self):
        pass


def unavailable_db():
    yield UnavailableDatabaseSession()


@pytest.fixture
def database_down():
    app.dependency_overrides[get_db] = unavailable_db
    yield
    app.dependency_overrides.pop(get_db, None)


# R1 — banco fora do ar
def test_database_outage_returns_503_in_standard_format(client, database_down):
    response = client.get("/api/incidents")

    assert response.status_code == 503
    assert response.headers["Retry-After"] == "5"
    error = response.json()["error"]
    assert error["code"] == "SERVICE_UNAVAILABLE"
    assert "MySQL" not in error["message"], "detalhe interno não vaza"


# R3 — health check reporta o banco
def test_health_reports_database_up(anonymous_client):
    response = anonymous_client.get("/api/health")

    assert response.status_code == 200
    assert response.json()["database"] == "up"


def test_health_reports_database_down_with_503(anonymous_client, database_down):
    response = anonymous_client.get("/api/health")

    assert response.status_code == 503
    assert response.json() == {"status": "degraded", "database": "down", "environment": "test"}


# R2 — falha transitória de conexão
class FakeDBAPIError(Exception):
    pass


class FakeDialect:
    """Simula o driver do MySQL: falha nas primeiras `failures` tentativas de conexão."""

    class loaded_dbapi:  # noqa: N801  (mesmo nome do atributo do SQLAlchemy)
        OperationalError = FakeDBAPIError

    def __init__(self, failures):
        self.failures = failures
        self.attempts = 0

    def connect(self, *args, **kwargs):
        self.attempts += 1
        if self.attempts <= self.failures:
            raise FakeDBAPIError("Lost connection to MySQL server")
        return "conexão"


def test_connection_succeeds_after_transient_failures():
    dialect = FakeDialect(failures=2)
    waits = []

    connection = connect_with_retry(dialect, None, (), {}, sleep=waits.append)

    assert connection == "conexão"
    assert dialect.attempts == 3
    assert waits == list(CONNECT_RETRY_DELAYS_SECONDS), "espera crescente entre tentativas"


def test_connection_gives_up_after_last_attempt():
    dialect = FakeDialect(failures=10)

    with pytest.raises(FakeDBAPIError):
        connect_with_retry(dialect, None, (), {}, sleep=lambda _: None)

    assert dialect.attempts == len(CONNECT_RETRY_DELAYS_SECONDS) + 1


def test_retry_is_enabled_on_the_application_engine():
    assert event.contains(engine, "do_connect", connect_with_retry)
