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
    
    # Defaults
    DEFAULT_PASSING_PERCENTAGE: float = 95.0
    DEFAULT_EXAM_DURATION_MINUTES: int = 60
    DEFAULT_QUESTIONS_PER_EXAM: int = 80
    
    class Config:
        case_sensitive = True
        env_file = str(BASE_DIR / ".env")

settings = Settings()
