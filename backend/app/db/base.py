from datetime import UTC, datetime

from sqlalchemy import DateTime, MetaData
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import DeclarativeBase

# Nomes previsíveis para índices e constraints, para as migrações do Alembic
# gerarem sempre os mesmos nomes em qualquer ambiente.
NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

# DATETIME com microssegundos no MySQL: eventos no mesmo segundo ficam em ordem correta.
PreciseDateTime = DateTime().with_variant(mysql.DATETIME(fsp=6), "mysql")


def enum_values(enum_class: type) -> list[str]:
    """Faz o SQLAlchemy gravar o valor do enum (ex.: "HIGH") no banco."""
    return [member.value for member in enum_class]


def utc_now() -> datetime:
    """Momento atual em UTC, sem fuso (o DATETIME do MySQL não guarda fuso)."""
    return datetime.now(UTC).replace(tzinfo=None)


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
