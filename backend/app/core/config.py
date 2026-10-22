from functools import lru_cache
from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_JWT_SECRET = "dev-secret-apenas-para-desenvolvimento-local"


class Settings(BaseSettings):
    """Configurações lidas de variáveis de ambiente (ou do arquivo .env)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Logos API"
    environment: Literal["development", "test", "production"] = "development"
    api_prefix: str = "/api"

    database_url: str = "mysql+pymysql://logos:logos@localhost:3307/logos"

    # Lista separada por vírgula, ex.: "http://localhost:5173,https://logos.startbc.online"
    cors_origins: str = "http://localhost:5173"
    # Padrão opcional para origens dinâmicas, como as prévias de PR da Vercel
    # (ex.: r"https://logos-[a-z0-9-]+-brunocoitinhos-projects\.vercel\.app").
    cors_origin_regex: str | None = None

    jwt_secret: str = DEV_JWT_SECRET
    jwt_algorithm: str = "HS256"
    # Um turno de trabalho do analista.
    jwt_expiration_minutes: int = 480

    # Custo do bcrypt: 12 em produção; os testes usam um valor baixo para rodar rápido.
    bcrypt_rounds: int = 12

    # Proteção contra força bruta no login.
    login_max_failures: int = 5
    login_window_seconds: int = 300

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @field_validator("cors_origin_regex")
    @classmethod
    def empty_regex_means_none(cls, value: str | None) -> str | None:
        # "CORS_ORIGIN_REGEX=" sem valor no .env significa "sem padrão", não um regex vazio.
        if value is None or not value.strip():
            return None
        return value.strip()

    @model_validator(mode="after")
    def require_real_secret_in_production(self) -> "Settings":
        if self.environment == "production" and (
            self.jwt_secret == DEV_JWT_SECRET or len(self.jwt_secret) < 32
        ):
            raise ValueError("JWT_SECRET precisa ser definido (32+ caracteres) em produção")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
