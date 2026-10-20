from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field


def _normalize_email(value: object) -> object:
    return value.strip().lower() if isinstance(value, str) else value


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: Annotated[str, BeforeValidator(_normalize_email), Field(min_length=3, max_length=255)]
    # Limite do bcrypt: só os primeiros 72 bytes contam.
    password: Annotated[str, Field(min_length=1, max_length=72)]


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int = Field(description="Validade do token em segundos")
    user: UserRead
