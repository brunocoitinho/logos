import os

# Precisa vir antes de qualquer import de "app": as configurações e o engine do banco
# são criados no import, e os testes devem usar o banco logos_test, nunca o de desenvolvimento.
os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "mysql+pymysql://logos:logos@localhost:3307/logos_test"
)
# Custo mínimo do bcrypt nos testes: a segurança do hash não é o que está sendo testado.
os.environ["BCRYPT_ROUNDS"] = "4"

from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.rate_limit import login_rate_limiter
from app.core.security import create_access_token
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import User
from tests.factories import TEST_PASSWORD, create_user

BACKEND_DIR = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session", autouse=True)
def database() -> Iterator[None]:
    """Recria o esquema do zero com as migrações reais, uma vez por execução.

    Usar as migrações (e não create_all) garante que os testes rodam contra o mesmo
    esquema que vai para produção.
    """
    with engine.begin() as connection:
        Base.metadata.drop_all(connection)
        connection.execute(text("DROP TABLE IF EXISTS alembic_version"))

    alembic_config = Config(BACKEND_DIR / "alembic.ini")
    alembic_config.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"])
    alembic_config.attributes["configure_logger"] = False
    command.upgrade(alembic_config, "head")

    yield


@pytest.fixture(autouse=True)
def clean_tables() -> Iterator[None]:
    """Apaga os dados depois de cada teste.

    Não dá para usar "transação com rollback" por teste: os testes de concorrência abrem
    várias conexões, e cada uma só enxerga dados já confirmados (commit) no banco.
    """
    yield
    with engine.begin() as connection:
        for table in reversed(Base.metadata.sorted_tables):
            connection.execute(table.delete())
    login_rate_limiter.reset()


@pytest.fixture
def db() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def analyst(db: Session) -> User:
    return create_user(db, name="Ana Souza", email="ana@logos.test", password=TEST_PASSWORD)


def auth_headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


@pytest.fixture
def client(analyst: User) -> TestClient:
    """Cliente já autenticado como um analista: a maioria dos testes não é sobre login."""
    return TestClient(app, headers=auth_headers(analyst))


@pytest.fixture
def anonymous_client() -> TestClient:
    return TestClient(app)
