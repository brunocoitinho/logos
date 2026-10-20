import os

# Precisa vir antes de qualquer import de "app": as configurações e o engine do banco
# são criados no import, e os testes devem usar o banco logos_test, nunca o de desenvolvimento.
os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "mysql+pymysql://logos:logos@localhost:3307/logos_test"
)

from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app

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


@pytest.fixture
def db() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
