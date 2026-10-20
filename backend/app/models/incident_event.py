from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, Index, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, PreciseDateTime, enum_values, utc_now
from app.models.enums import IncidentEventType, IncidentStatus
from app.models.user import User

if TYPE_CHECKING:
    from app.models.incident import Incident


class IncidentEvent(Base):
    """Histórico de um incidente: quem fez o quê e quando."""

    __tablename__ = "incident_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id", ondelete="CASCADE"))
    # Nulo quando a ação vem do sistema (ex.: simulador de caminhões).
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    type: Mapped[IncidentEventType] = mapped_column(
        Enum(IncidentEventType, name="incident_event_type", values_callable=enum_values)
    )
    from_status: Mapped[IncidentStatus | None] = mapped_column(
        Enum(IncidentStatus, name="incident_status", values_callable=enum_values)
    )
    to_status: Mapped[IncidentStatus | None] = mapped_column(
        Enum(IncidentStatus, name="incident_status", values_callable=enum_values)
    )
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(PreciseDateTime, default=utc_now)

    user: Mapped[User | None] = relationship(lazy="joined")
    incident: Mapped["Incident"] = relationship(back_populates="events")

    __table_args__ = (
        Index("ix_incident_events_incident_id_created_at", "incident_id", "created_at"),
    )
