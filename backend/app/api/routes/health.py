from fastapi import APIRouter

from app.api.deps import SettingsDep
from app.schemas.health import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health_check(settings: SettingsDep) -> HealthResponse:
    """Indica se a API está no ar. Usado pelo monitor de uptime e pelo deploy."""
    return HealthResponse(status="ok", environment=settings.environment)
