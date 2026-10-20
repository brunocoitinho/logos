import logging
import time
from collections.abc import Callable, Iterator
from typing import Any

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

logger = logging.getLogger("logos")

settings = get_settings()

# Espera antes da 2ª e da 3ª tentativa de conexão.
CONNECT_RETRY_DELAYS_SECONDS = (0.2, 0.5)

engine = create_engine(
    settings.database_url,
    # Testa a conexão antes de usar: descarta conexões que o MySQL encerrou
    # (queda de rede, reinício do banco) em vez de devolver erro ao usuário.
    pool_pre_ping=True,
    # Renova conexões antes do wait_timeout do MySQL fechá-las do lado do servidor.
    pool_recycle=1800,
    pool_size=10,
    max_overflow=20,
    # Tempo máximo esperando uma conexão livre no pool.
    pool_timeout=10,
    connect_args={
        # Falhar rápido se o banco estiver lento ou fora, em vez de travar a requisição.
        "connect_timeout": 3,
        "read_timeout": 15,
        "write_timeout": 15,
    },
)


def connect_with_retry(
    dialect: Any,
    connection_record: Any,
    cargs: tuple,
    cparams: dict,
    sleep: Callable[[float], None] = time.sleep,
) -> Any:
    """Abre a conexão com até 3 tentativas, para absorver oscilações curtas do banco.

    Repetir aqui é seguro: nenhum comando SQL foi executado ainda. Comandos que falham
    no meio NÃO são repetidos automaticamente, porque uma escrita poderia ser duplicada.
    """
    attempts = len(CONNECT_RETRY_DELAYS_SECONDS) + 1
    for attempt in range(1, attempts + 1):
        try:
            return dialect.connect(*cargs, **cparams)
        except dialect.loaded_dbapi.OperationalError as error:
            if attempt == attempts:
                raise
            delay = CONNECT_RETRY_DELAYS_SECONDS[attempt - 1]
            logger.warning("Falha ao conectar no banco (tentativa %s): %s", attempt, error)
            sleep(delay)
    raise RuntimeError("inalcançável")  # pragma: no cover


def enable_connect_retry(target_engine: Engine) -> None:
    event.listen(target_engine, "do_connect", connect_with_retry)


enable_connect_retry(engine)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """Abre uma sessão por requisição e garante o fechamento ao final."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
