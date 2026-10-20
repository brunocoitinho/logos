from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

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
        "connect_timeout": 5,
        "read_timeout": 15,
        "write_timeout": 15,
    },
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """Abre uma sessão por requisição e garante o fechamento ao final."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
