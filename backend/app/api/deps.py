from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.errors import UnauthorizedError
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models import User

SettingsDep = Annotated[Settings, Depends(get_settings)]
DbDep = Annotated[Session, Depends(get_db)]

# auto_error=False: a ausência do token gera o nosso 401 padronizado, não o erro do FastAPI.
bearer_scheme = HTTPBearer(auto_error=False, description="Token obtido em /api/auth/login")


def get_current_user(
    db: DbDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> User:
    if credentials is None:
        raise UnauthorizedError("Autenticação necessária.")

    user_id = decode_access_token(credentials.credentials)
    # O usuário pode ter sido removido depois de o token ser emitido.
    user = db.get(User, user_id) if user_id is not None else None
    if user is None:
        raise UnauthorizedError()
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
