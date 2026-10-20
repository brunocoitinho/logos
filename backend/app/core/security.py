import bcrypt


def hash_password(password: str) -> str:
    """Gera o hash bcrypt da senha. O salt aleatório fica embutido no próprio hash."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
