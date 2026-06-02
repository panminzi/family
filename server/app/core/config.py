from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    app_name: str = "cartoon-family"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    secret_key: str = "change-me"
    access_token_expire_minutes: int = 60 * 24 * 7

    database_url: str = "postgresql+psycopg://family:family_pass@localhost:5432/family"
    redis_url: str = "redis://localhost:6379/0"

    upload_dir: str = "uploads"
    max_upload_mb: int = 20

    ai_base_url: str = "https://api.openai.com/v1"
    ai_api_key: str = ""
    ai_model_text: str = "gpt-4o-mini"
    ai_model_image: str = "gpt-image-1"

    meal_times: str = "08:00,12:30,18:30"
    scheduler_timezone: str = "Asia/Shanghai"

    @property
    def meal_time_list(self) -> List[str]:
        return [t.strip() for t in self.meal_times.split(",") if t.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
