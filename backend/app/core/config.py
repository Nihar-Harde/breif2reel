from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "breif2reel Backend"
    api_v1_prefix: str = "/api/v1"
    database_url: str
    team_api_key: str
    scheduler_secret: str = ""
    backend_cors_origins: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)


@lru_cache
def get_settings() -> Settings:
    return Settings()

