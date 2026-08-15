import os
from typing import Optional
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

class Settings(BaseSettings):
    PROJECT_NAME: str = "PrepBench"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    LOG_LEVEL: str = "DEBUG"
    
    # Optional Gemini API Key for Content Validation & Vector Embedding RAG
    GEMINI_API_KEY: Optional[str] = None

    # SQLite Database Configuration
    DATABASE_PATH: Path = DATA_DIR / "exam_simulator.db"
    SQLALCHEMY_DATABASE_URI: str = f"sqlite:///{DATABASE_PATH}"
    
    # Default Question Bank Path (falls back to the repo-local copy in app/data)
    DEFAULT_QUESTION_BANK_PATH: Path = BASE_DIR / "app" / "data" / "PSM_I_Question_Bank.json"

    # NOTE: exam defaults (passing percentage, duration, question count) are
    # deliberately NOT configured here. They live in the AppSettings row and
    # are editable from the Settings page, which is the single source of truth
    # the app actually reads. Env vars for them existed but nothing consumed
    # them, so setting one silently did nothing.

    class Config:
        case_sensitive = True
        env_file = str(BASE_DIR / ".env")

settings = Settings()
