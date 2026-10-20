from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import DUMMY_PASSWORD_HASH, verify_password
from app.models import User


def authenticate(db: Session, email: str, password: str) -> User | None:
    """Devolve o usuário se e-mail e senha conferem; None caso contrário.

    Quando o e-mail não existe, a senha é verificada contra um hash fictício: o tempo de
    resposta fica igual ao de uma senha errada e não revela quais e-mails existem.
    """
    user = db.scalar(select(User).where(User.email == email))
    password_hash = user.password_hash if user else DUMMY_PASSWORD_HASH
    password_ok = verify_password(password, password_hash)
    return user if user and password_ok else None
