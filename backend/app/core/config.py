from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    resultado_api_dir: str = str(Path(__file__).parents[3] / "resultado_api")
    minio_endpoint: str = "minio:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin123"
    minio_bucket_name: str = "face-analysis"
    minio_use_ssl: bool = False

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
