from functools import lru_cache
from pathlib import Path

# pyrefly: ignore [missing-import]
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BACKEND_DIR / ".env"


class Settings(BaseSettings):
    app_name: str = "breif2reel Backend"
    api_v1_prefix: str = "/api/v1"
    database_url: str
    team_api_key: str
    scheduler_secret: str = ""
    backend_cors_origins: str = "http://localhost:5173"
    groq_api_key: str | None = None
    gemini_api_key: str | None = None
    fal_key: str | None = None
    hf_token: str | None = None
    colab_video_api_url: str | None = None
    hf_space_id: str | None = None
    video_provider: str = "inference_service"
    video_inference_url: str | None = None
    video_inference_api_key: str | None = None
    video_model: str = "ltx-video"
    video_gpu_profile: str = "Consumption-GPU-NC8as-T4"
    video_width: int = 720
    video_height: int = 1280
    video_fps: int = 24
    video_duration_seconds: int = 10
    video_num_frames: int = 241
    video_num_steps: int = 30
    video_request_timeout_seconds: int = 900
    video_storage_provider: str = "azure_blob"
    video_storage_connection_string: str | None = None
    video_storage_container: str = "generated-videos"

    model_config = SettingsConfigDict(
        env_file=(str(ENV_FILE), ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

@lru_cache
def get_settings() -> Settings:
    return Settings()
