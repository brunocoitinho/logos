from typing import Annotated

from fastapi import APIRouter, Depends, Header, Path, Query, Response, status

from app.api.deps import CurrentUser, DbDep, get_current_user
from app.schemas.errors import ErrorResponse
from app.schemas.incident import (
    IncidentCreate,
    IncidentEventRead,
    IncidentFilters,
    IncidentList,
    IncidentRead,
    IncidentSummary,
    IncidentUpdate,
    ReleaseRequest,
    TransitionRequest,
)
from app.services import incident_lifecycle
from app.services import incidents as incident_service

UNAUTHORIZED = {401: {"model": ErrorResponse, "description": "Token ausente, inválido ou expirado"}}

# Todas as rotas de incidentes exigem login.
router = APIRouter(
    prefix="/incidents",
    tags=["incidents"],
    dependencies=[Depends(get_current_user)],
    responses=UNAUTHORIZED,
)

IncidentId = Annotated[int, Path(ge=1)]

NOT_FOUND = {404: {"model": ErrorResponse, "description": "Incidente não encontrado"}}
CONFLICT = {
    409: {
        "model": ErrorResponse,
        "description": "Versão desatualizada: outra pessoa alterou o incidente. "
        "O corpo traz o estado atual em error.details.current.",
    }
}


@router.get("", response_model=IncidentList)
def list_incidents(filters: Annotated[IncidentFilters, Query()], db: DbDep) -> IncidentList:
    """Lista ordenada por prioridade. Sem filtro de status, traz Aberto + Em Investigação."""
    items, total = incident_service.list_incidents(db, filters)
    return IncidentList(
        items=[IncidentRead.model_validate(item) for item in items],
        total=total,
        limit=filters.limit,
        offset=filters.offset,
    )


# Declarada antes de /{incident_id} para "summary" não ser lido como um id.
@router.get("/summary", response_model=IncidentSummary)
def get_summary(db: DbDep) -> IncidentSummary:
    return incident_service.get_summary(db)


@router.get("/{incident_id}", response_model=IncidentRead, responses=NOT_FOUND)
def get_incident(incident_id: IncidentId, db: DbDep) -> IncidentRead:
    return IncidentRead.model_validate(incident_service.get_incident(db, incident_id))


IdempotencyKey = Annotated[
    str | None,
    Header(
        alias="Idempotency-Key",
        min_length=8,
        max_length=64,
        pattern=r"^[A-Za-z0-9_-]+$",
        description="Chave única por incidente. Reenviar com a mesma chave não duplica.",
    ),
]


@router.post(
    "",
    response_model=IncidentRead,
    status_code=status.HTTP_201_CREATED,
    responses={200: {"model": IncidentRead, "description": "Reenvio: incidente já existia"}},
)
def create_incident(
    data: IncidentCreate,
    response: Response,
    db: DbDep,
    current_user: CurrentUser,
    idempotency_key: IdempotencyKey = None,
) -> IncidentRead:
    incident, created = incident_service.create_incident(
        db, data, user_id=current_user.id, idempotency_key=idempotency_key
    )
    if not created:
        response.status_code = status.HTTP_200_OK
        response.headers["Idempotent-Replayed"] = "true"
    return IncidentRead.model_validate(incident)


@router.patch("/{incident_id}", response_model=IncidentRead, responses={**NOT_FOUND, **CONFLICT})
def update_incident(
    incident_id: IncidentId, data: IncidentUpdate, db: DbDep, current_user: CurrentUser
) -> IncidentRead:
    incident = incident_service.update_incident(db, incident_id, data, user_id=current_user.id)
    return IncidentRead.model_validate(incident)


@router.delete(
    "/{incident_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**NOT_FOUND, **CONFLICT},
)
def delete_incident(
    incident_id: IncidentId,
    version: Annotated[int, Query(ge=1, description="Versão que o cliente leu")],
    db: DbDep,
    current_user: CurrentUser,
) -> Response:
    incident_service.delete_incident(db, incident_id, version, user_id=current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Ciclo de vida -----------------------------------------------------------------------

FORBIDDEN = {403: {"model": ErrorResponse, "description": "Somente o responsável pode agir"}}
INVALID_TRANSITION = {
    422: {"model": ErrorResponse, "description": "Transição não permitida a partir do status atual"}
}


@router.post(
    "/{incident_id}/claim",
    response_model=IncidentRead,
    responses={
        **NOT_FOUND,
        409: {"model": ErrorResponse, "description": "Outro analista assumiu antes"},
        **INVALID_TRANSITION,
    },
)
def claim_incident(incident_id: IncidentId, db: DbDep, current_user: CurrentUser) -> IncidentRead:
    """Assume o incidente (Aberto → Em Investigação). Atômico: só um analista vence."""
    incident = incident_lifecycle.claim_incident(db, incident_id, current_user)
    return IncidentRead.model_validate(incident)


@router.post(
    "/{incident_id}/release",
    response_model=IncidentRead,
    responses={**NOT_FOUND, **CONFLICT, **FORBIDDEN, **INVALID_TRANSITION},
)
def release_incident(
    incident_id: IncidentId, data: ReleaseRequest, db: DbDep, current_user: CurrentUser
) -> IncidentRead:
    """Devolve o incidente à fila (Em Investigação → Aberto). Só o responsável."""
    incident = incident_lifecycle.release_incident(db, incident_id, current_user, data)
    return IncidentRead.model_validate(incident)


@router.post(
    "/{incident_id}/transition",
    response_model=IncidentRead,
    responses={**NOT_FOUND, **CONFLICT, **FORBIDDEN, **INVALID_TRANSITION},
)
def transition_incident(
    incident_id: IncidentId, data: TransitionRequest, db: DbDep, current_user: CurrentUser
) -> IncidentRead:
    """Encerra (Fechado/Inconclusivo, só o responsável) ou reabre (qualquer analista)."""
    incident = incident_lifecycle.transition_incident(db, incident_id, current_user, data)
    return IncidentRead.model_validate(incident)


@router.get("/{incident_id}/events", response_model=list[IncidentEventRead], responses=NOT_FOUND)
def list_incident_events(incident_id: IncidentId, db: DbDep) -> list[IncidentEventRead]:
    """Histórico do incidente, do mais antigo para o mais recente."""
    events = incident_lifecycle.list_events(db, incident_id)
    return [IncidentEventRead.model_validate(event) for event in events]
