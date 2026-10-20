from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, PreciseDateTime, enum_values, utc_now
from app.models.enums import Criticality, IncidentCategory, IncidentStatus
from app.models.user import User

if TYPE_CHECKING:
    from app.models.incident_event import IncidentEvent


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text)

    category: Mapped[IncidentCategory] = mapped_column(
        Enum(IncidentCategory, name="incident_category", values_callable=enum_values)
    )
    criticality: Mapped[Criticality] = mapped_column(
        Enum(Criticality, name="criticality", values_callable=enum_values)
    )
    status: Mapped[IncidentStatus] = mapped_column(
        Enum(IncidentStatus, name="incident_status", values_callable=enum_values),
        default=IncidentStatus.OPEN,
    )

    vehicle_plate: Mapped[str] = mapped_column(String(8))
    highway: Mapped[str] = mapped_column(String(20))
    km: Mapped[Decimal] = mapped_column(Numeric(6, 1))
    city: Mapped[str] = mapped_column(String(100))
    state: Mapped[str] = mapped_column(String(2))
    reported_at: Mapped[datetime] = mapped_column(PreciseDateTime, default=utc_now)

    assigned_to_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    assigned_at: Mapped[datetime | None] = mapped_column(PreciseDateTime)
    resolution_note: Mapped[str | None] = mapped_column(Text)

    # Optimistic locking: o SQLAlchemy inclui "WHERE version = <versão lida>" em todo
    # UPDATE/DELETE e incrementa o valor. Se outro analista gravou antes, nenhuma linha
    # é afetada e o SQLAlchemy lança StaleDataError, que a API transforma em 409 Conflict.
    version: Mapped[int] = mapped_column(nullable=False)

    created_at: Mapped[datetime] = mapped_column(PreciseDateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(PreciseDateTime, default=utc_now, onupdate=utc_now)
    deleted_at: Mapped[datetime | None] = mapped_column(PreciseDateTime)

    assigned_to: Mapped[User | None] = relationship(lazy="joined")
    events: Mapped[list["IncidentEvent"]] = relationship(
        back_populates="incident",
        order_by="IncidentEvent.created_at",
        cascade="all, delete-orphan",
        # O banco já apaga os eventos (ON DELETE CASCADE); o SQLAlchemy não precisa carregá-los.
        passive_deletes=True,
    )

    __mapper_args__ = {"version_id_col": version}

    __table_args__ = (
        # Filtro padrão da tela: status + criticidade.
        Index("ix_incidents_status_criticality", "status", "criticality"),
        Index("ix_incidents_category", "category"),
        Index("ix_incidents_reported_at", "reported_at"),
    )
