from fastapi import APIRouter, Request

from app.api.deps import CurrentUser, DbDep, SettingsDep
from app.core.errors import TooManyRequestsError, UnauthorizedError
from app.core.rate_limit import login_rate_limiter
from app.core.security import create_access_token
from app.schemas.auth import LoginRequest, TokenResponse, UserRead
from app.schemas.errors import ErrorResponse
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/login",
    response_model=TokenResponse,
    responses={
        401: {"model": ErrorResponse, "description": "E-mail ou senha inválidos"},
        429: {"model": ErrorResponse, "description": "Muitas tentativas; ver header Retry-After"},
    },
)
def login(data: LoginRequest, request: Request, db: DbDep, settings: SettingsDep) -> TokenResponse:
    client_ip = request.client.host if request.client else "unknown"
    limiter_key = f"{client_ip}:{data.email}"

    wait_seconds = login_rate_limiter.retry_after(limiter_key)
    if wait_seconds:
        raise TooManyRequestsError(
            f"Muitas tentativas de login. Tente novamente em {wait_seconds} segundos.",
            headers={"Retry-After": str(wait_seconds)},
        )

    user = auth_service.authenticate(db, data.email, data.password)
    if user is None:
        login_rate_limiter.register_failure(limiter_key)
        # Mesma mensagem para e-mail inexistente e senha errada.
        raise UnauthorizedError("E-mail ou senha inválidos.")

    login_rate_limiter.reset(limiter_key)
    return TokenResponse(
        access_token=create_access_token(user.id),
        expires_in=settings.jwt_expiration_minutes * 60,
        user=UserRead.model_validate(user),
    )


@router.get("/me", response_model=UserRead)
def me(current_user: CurrentUser) -> UserRead:
    return UserRead.model_validate(current_user)
