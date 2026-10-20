from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configurações lidas de variáveis de ambiente (ou do arquivo .env)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Logos API"
    environment: Literal["development", "test", "production"] = "development"
    api_prefix: str = "/api"

    database_url: str = "mysql+pymysql://logos:logos@localhost:3307/logos"

    # Lista separada por vírgula, ex.: "http://localhost:5173,https://logos.startbc.online"
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
