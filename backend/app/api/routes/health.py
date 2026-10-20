from fastapi import APIRouter, Response, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.deps import DbDep, SettingsDep
from app.schemas.health import HealthResponse

router = APIRouter(tags=["health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    responses={503: {"model": HealthResponse, "description": "API no ar, banco indisponível"}},
)
def health_check(response: Response, db: DbDep, settings: SettingsDep) -> HealthResponse:
    """Indica se a API e o banco estão no ar. Usado pelo monitor de uptime e pelo deploy.

    Responde 503 quando o banco está fora, para o monitor alertar mesmo com a API de pé.
    """
    try:
        db.execute(text("SELECT 1"))
        database = "up"
    except SQLAlchemyError:
        database = "down"
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return HealthResponse(
        status="ok" if database == "up" else "degraded",
        database=database,
        environment=settings.environment,
    )
