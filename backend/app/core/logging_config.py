import logging
import sys
from pathlib import Path
from logging.handlers import RotatingFileHandler

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
LOGS_DIR = PROJECT_ROOT / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE_PATH = LOGS_DIR / "exam_simulator.log"

class SafeRotatingFileHandler(RotatingFileHandler):
    """Windows-safe RotatingFileHandler that silently catches WinError 32 during log rotation."""
    def doRollover(self):
        try:
            super().doRollover()
        except PermissionError:
            pass

def setup_logging():
    # Logs persist and grow across restarts, bounded by SafeRotatingFileHandler's
    # own rotation (20 MB x 3 backups) below — they are intentionally NOT wiped on
    # startup, since doing so on every restart previously destroyed the exact
    # evidence needed to diagnose issues that only manifest on the live server.
    log_format = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s"
    )
    
    file_handler = SafeRotatingFileHandler(
        LOG_FILE_PATH,
        maxBytes=20 * 1024 * 1024, # 20 MB
        backupCount=3,
        encoding="utf-8",
        delay=True
    )
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(log_format)
    
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(log_format)
    
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)
    
    logger = logging.getLogger("exam_simulator")
    logger.setLevel(logging.INFO)
    
    sqlalchemy_logger = logging.getLogger("sqlalchemy.engine")
    sqlalchemy_logger.setLevel(logging.WARNING)
    sqlalchemy_logger.addHandler(file_handler)
    
    uvicorn_logger = logging.getLogger("uvicorn")
    uvicorn_logger.setLevel(logging.INFO)
    uvicorn_logger.addHandler(file_handler)
    
    logger.info(f"Persistent log file initialized at: {LOG_FILE_PATH}")
    return logger

logger = setup_logging()
