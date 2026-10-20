from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Response, status

from app.api.deps import CurrentUser, DbDep, get_current_user
from app.schemas.errors import ErrorResponse
from app.schemas.incident import (
    IncidentCreate,
    IncidentFilters,
    IncidentList,
    IncidentRead,
    IncidentSummary,
    IncidentUpdate,
)
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


@router.post("", response_model=IncidentRead, status_code=status.HTTP_201_CREATED)
def create_incident(data: IncidentCreate, db: DbDep, current_user: CurrentUser) -> IncidentRead:
    incident = incident_service.create_incident(db, data, user_id=current_user.id)
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
