"""Regras de negócio dos incidentes. As rotas só recebem a requisição e devolvem a resposta."""

from collections.abc import Sequence

from sqlalchemy import ColumnElement, case, func, or_, select
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import StaleDataError

from app.core.errors import ConflictError, NotFoundError
from app.db.base import utc_now
from app.models import Incident, IncidentEvent
from app.models.enums import Criticality, IncidentCategory, IncidentEventType, IncidentStatus
from app.schemas.incident import (
    CriticalityCount,
    IncidentCreate,
    IncidentFilters,
    IncidentRead,
    IncidentSummary,
    IncidentUpdate,
)

# Ordem de prioridade da lista (PRD §4.1): quem vem primeiro em cada critério.
STATUS_PRIORITY = [
    IncidentStatus.OPEN,
    IncidentStatus.INVESTIGATING,
    IncidentStatus.CLOSED,
    IncidentStatus.INCONCLUSIVE,
]
CRITICALITY_PRIORITY = [Criticality.HIGH, Criticality.MEDIUM, Criticality.LOW]
CATEGORY_PRIORITY = [
    IncidentCategory.ACCIDENT_WITH_VICTIMS,
    IncidentCategory.VEHICLE_ACCIDENT,
    IncidentCategory.ROAD_BLOCKED,
    IncidentCategory.ADVERSE_WEATHER,
    IncidentCategory.MECHANICAL_FAILURE,
]

CONFLICT_MESSAGE = "Este incidente foi alterado por outra pessoa. Os dados foram atualizados."


def _rank(column, ordered_values: list) -> ColumnElement[int]:
    """CASE que transforma um valor na sua posição de prioridade (0 = mais urgente)."""
    whens = [(column == value, position) for position, value in enumerate(ordered_values)]
    return case(*whens, else_=len(ordered_values))


PRIORITY_ORDER = (
    _rank(Incident.status, STATUS_PRIORITY),
    _rank(Incident.criticality, CRITICALITY_PRIORITY),
    _rank(Incident.category, CATEGORY_PRIORITY),
    Incident.reported_at.asc(),  # quem espera há mais tempo primeiro
    Incident.id.asc(),  # desempate estável entre requisições
)


def _filter_conditions(filters: IncidentFilters) -> list[ColumnElement[bool]]:
    conditions: list[ColumnElement[bool]] = [Incident.deleted_at.is_(None)]
    if filters.status:
        conditions.append(Incident.status.in_(filters.status))
    if filters.criticality:
        conditions.append(Incident.criticality.in_(filters.criticality))
    if filters.category:
        conditions.append(Incident.category.in_(filters.category))
    if filters.q:
        # autoescape: "%" e "_" digitados pelo usuário são tratados como texto, não curinga.
        searchable = (
            Incident.title,
            Incident.description,
            Incident.vehicle_plate,
            Incident.highway,
            Incident.city,
        )
        conditions.append(
            or_(*(field.contains(filters.q, autoescape=True) for field in searchable))
        )
    return conditions


def list_incidents(db: Session, filters: IncidentFilters) -> tuple[Sequence[Incident], int]:
    conditions = _filter_conditions(filters)
    total = db.scalar(select(func.count(Incident.id)).where(*conditions)) or 0
    items = db.scalars(
        select(Incident)
        .where(*conditions)
        .order_by(*PRIORITY_ORDER)
        .limit(filters.limit)
        .offset(filters.offset)
    ).all()
    return items, total


def get_incident(db: Session, incident_id: int) -> Incident:
    incident = db.get(Incident, incident_id)
    if incident is None or incident.deleted_at is not None:
        raise NotFoundError("Incidente não encontrado.")
    return incident


def create_incident(db: Session, data: IncidentCreate, user_id: int | None = None) -> Incident:
    incident = Incident(**data.model_dump(exclude_none=True), status=IncidentStatus.OPEN)
    incident.events.append(
        IncidentEvent(
            type=IncidentEventType.CREATED, user_id=user_id, to_status=IncidentStatus.OPEN
        )
    )
    db.add(incident)
    db.commit()
    return incident


def update_incident(
    db: Session, incident_id: int, data: IncidentUpdate, user_id: int | None = None
) -> Incident:
    incident = get_incident(db, incident_id)
    _ensure_version(incident, data.version)

    changed = {
        field: value for field, value in data.changes().items() if getattr(incident, field) != value
    }
    if not changed:
        return incident

    for field, value in changed.items():
        setattr(incident, field, value)
    incident.events.append(
        IncidentEvent(
            type=IncidentEventType.UPDATED,
            user_id=user_id,
            note=f"Campos alterados: {', '.join(sorted(changed))}",
        )
    )
    _commit_or_conflict(db, incident_id)
    return incident


def delete_incident(
    db: Session, incident_id: int, version: int, user_id: int | None = None
) -> None:
    """Exclusão lógica: o registro some da operação, mas o histórico é preservado."""
    incident = get_incident(db, incident_id)
    _ensure_version(incident, version)

    incident.deleted_at = utc_now()
    incident.events.append(IncidentEvent(type=IncidentEventType.DELETED, user_id=user_id))
    _commit_or_conflict(db, incident_id)


def get_summary(db: Session) -> IncidentSummary:
    rows = db.execute(
        select(Incident.status, Incident.criticality, func.count(Incident.id))
        .where(Incident.deleted_at.is_(None))
        .group_by(Incident.status, Incident.criticality)
    ).all()

    by_status = dict.fromkeys(IncidentStatus, 0)
    open_by_criticality = CriticalityCount()
    investigating_by_criticality = CriticalityCount()
    for status, criticality, count in rows:
        by_status[status] += count
        if status == IncidentStatus.OPEN:
            setattr(open_by_criticality, criticality.value, count)
        elif status == IncidentStatus.INVESTIGATING:
            setattr(investigating_by_criticality, criticality.value, count)

    return IncidentSummary(
        by_status=by_status,
        open_by_criticality=open_by_criticality,
        investigating_by_criticality=investigating_by_criticality,
    )


def _conflict(incident: Incident) -> ConflictError:
    current = IncidentRead.model_validate(incident).model_dump(mode="json")
    return ConflictError(CONFLICT_MESSAGE, details={"current": current})


def _ensure_version(incident: Incident, expected_version: int) -> None:
    """Primeira barreira: o cliente enviou a versão que leu, e ela já não é a atual."""
    if incident.version != expected_version:
        raise _conflict(incident)


def _commit_or_conflict(db: Session, incident_id: int) -> None:
    """Segunda barreira: outra gravação aconteceu entre a leitura e o commit.

    O SQLAlchemy grava com "WHERE version = <lida>"; se nenhuma linha for afetada,
    lança StaleDataError, e a resposta vira 409 com o estado atual do incidente.
    """
    try:
        db.commit()
    except StaleDataError:
        db.rollback()
        raise _conflict(get_incident(db, incident_id)) from None
