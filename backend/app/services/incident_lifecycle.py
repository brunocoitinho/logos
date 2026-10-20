"""Ciclo de vida do incidente: assumir, liberar, fechar, marcar como inconclusivo e reabrir.

Máquina de estados (PRD §4.2):

    ABERTO ──assumir──► EM INVESTIGAÇÃO ──encerrar──► FECHADO | INCONCLUSIVO
       ▲                     │                               │
       └──────liberar────────┘                               │
       └──────────────────────reabrir────────────────────────┘
"""

from collections.abc import Sequence

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.errors import ForbiddenError, InvalidTransitionError
from app.db.base import utc_now
from app.models import Incident, IncidentEvent, User
from app.models.enums import IncidentEventType, IncidentStatus
from app.schemas.incident import ReleaseRequest, TransitionRequest
from app.services.incidents import commit_or_conflict, conflict_error, ensure_version, get_incident

STATUS_LABELS = {
    IncidentStatus.OPEN: "Aberto",
    IncidentStatus.INVESTIGATING: "Em Investigação",
    IncidentStatus.CLOSED: "Fechado",
    IncidentStatus.INCONCLUSIVE: "Inconclusivo",
}

RESOLUTION_STATUSES = {IncidentStatus.CLOSED, IncidentStatus.INCONCLUSIVE}

# Transições feitas pela ação "transition". Assumir e liberar têm ações próprias.
ALLOWED_TRANSITIONS = {
    (IncidentStatus.INVESTIGATING, IncidentStatus.CLOSED),
    (IncidentStatus.INVESTIGATING, IncidentStatus.INCONCLUSIVE),
    (IncidentStatus.CLOSED, IncidentStatus.OPEN),
    (IncidentStatus.INCONCLUSIVE, IncidentStatus.OPEN),
}


def claim_incident(db: Session, incident_id: int, user: User) -> Incident:
    """Assume o incidente de forma atômica.

    Ler o status e depois gravar deixaria uma janela em que dois analistas leem "Aberto"
    ao mesmo tempo. Aqui a checagem e a gravação são um único UPDATE condicional: o MySQL
    trava a linha durante o comando, então, se dez analistas clicarem juntos, só um
    UPDATE encontra a linha ainda aberta. Os outros afetam zero linhas e recebem 409.
    """
    now = utc_now()
    result = db.execute(
        update(Incident)
        .where(
            Incident.id == incident_id,
            Incident.deleted_at.is_(None),
            Incident.status == IncidentStatus.OPEN,
            Incident.assigned_to_id.is_(None),
        )
        .values(
            status=IncidentStatus.INVESTIGATING,
            assigned_to_id=user.id,
            assigned_at=now,
            updated_at=now,
            version=Incident.version + 1,
        )
        .execution_options(synchronize_session=False)
    )

    if result.rowcount == 1:
        db.add(
            IncidentEvent(
                incident_id=incident_id,
                user_id=user.id,
                type=IncidentEventType.CLAIMED,
                from_status=IncidentStatus.OPEN,
                to_status=IncidentStatus.INVESTIGATING,
                created_at=now,
            )
        )
        db.commit()
        db.expire_all()
        return get_incident(db, incident_id)

    # Ninguém foi alterado: descobrir o motivo para responder com clareza.
    db.rollback()
    incident = get_incident(db, incident_id)  # 404 se não existe

    if incident.status == IncidentStatus.INVESTIGATING:
        if incident.assigned_to_id == user.id:
            return incident  # duplo clique de quem já é o responsável: nada a fazer
        owner = incident.assigned_to.name if incident.assigned_to else "Outro analista"
        raise conflict_error(incident, f"{owner} assumiu este incidente antes de você.")

    raise InvalidTransitionError(
        f"Só incidentes abertos podem ser assumidos. "
        f"Status atual: {STATUS_LABELS[incident.status]}."
    )


def release_incident(db: Session, incident_id: int, user: User, data: ReleaseRequest) -> Incident:
    """Devolve o incidente à fila (Aberto, sem responsável)."""
    incident = get_incident(db, incident_id)
    ensure_version(incident, data.version)

    if incident.status != IncidentStatus.INVESTIGATING:
        raise InvalidTransitionError("Só incidentes em investigação podem ser liberados.")
    _ensure_assignee(incident, user, "liberar")

    incident.status = IncidentStatus.OPEN
    incident.assigned_to = None
    incident.assigned_at = None
    incident.events.append(
        IncidentEvent(
            type=IncidentEventType.RELEASED,
            user_id=user.id,
            from_status=IncidentStatus.INVESTIGATING,
            to_status=IncidentStatus.OPEN,
            note=data.note,
        )
    )
    commit_or_conflict(db, incident_id)
    return incident


def transition_incident(
    db: Session, incident_id: int, user: User, data: TransitionRequest
) -> Incident:
    """Encerra (Fechado/Inconclusivo) ou reabre o incidente."""
    incident = get_incident(db, incident_id)
    # A versão vem primeiro: se o estado mudou, a tela do analista está desatualizada,
    # e o mais útil é devolver o estado atual (409) antes de julgar a transição.
    ensure_version(incident, data.version)

    current, target = incident.status, data.to_status
    if (current, target) not in ALLOWED_TRANSITIONS:
        raise InvalidTransitionError(_invalid_transition_message(current, target))

    if target in RESOLUTION_STATUSES:
        _ensure_assignee(incident, user, "encerrar")
        incident.status = target
        incident.resolution_note = data.note
        event_type = IncidentEventType.STATUS_CHANGED
    else:
        # Reabrir: qualquer analista pode; o incidente volta para a fila sem responsável.
        incident.status = IncidentStatus.OPEN
        incident.assigned_to = None
        incident.assigned_at = None
        incident.resolution_note = None
        event_type = IncidentEventType.REOPENED

    incident.events.append(
        IncidentEvent(
            type=event_type,
            user_id=user.id,
            from_status=current,
            to_status=incident.status,
            note=data.note,
        )
    )
    commit_or_conflict(db, incident_id)
    return incident


def list_events(db: Session, incident_id: int) -> Sequence[IncidentEvent]:
    get_incident(db, incident_id)  # 404 se não existe
    return db.scalars(
        select(IncidentEvent)
        .where(IncidentEvent.incident_id == incident_id)
        .order_by(IncidentEvent.created_at, IncidentEvent.id)
    ).all()


def _ensure_assignee(incident: Incident, user: User, action: str) -> None:
    if incident.assigned_to_id != user.id:
        owner = incident.assigned_to.name if incident.assigned_to else "o responsável"
        raise ForbiddenError(f"Somente o responsável ({owner}) pode {action} este incidente.")


def _invalid_transition_message(current: IncidentStatus, target: IncidentStatus) -> str:
    if target == IncidentStatus.INVESTIGATING:
        return "Para investigar um incidente, use a ação Assumir."
    if current == IncidentStatus.INVESTIGATING and target == IncidentStatus.OPEN:
        return "Para devolver o incidente à fila, use a ação Liberar."
    if current == target:
        return f"O incidente já está com status {STATUS_LABELS[current]}."
    return f"Não é possível mudar de {STATUS_LABELS[current]} para {STATUS_LABELS[target]}."
