# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""Where the learner's data actually is, and what this build does with it."""
from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel


class DatabaseFile(BaseModel):
    engine: str
    # The file the running server reads and writes. None for a database that is
    # not a file (another engine, or in memory).
    path: Optional[str] = None
    size_bytes: Optional[int] = None
    # SQLite's write-ahead log, which holds recent writes until a checkpoint.
    wal_bytes: Optional[int] = None
    modified_at: Optional[datetime] = None
    backup_supported: bool = False


class RecordingsFolder(BaseModel):
    path: str
    files: int
    size_bytes: int


class PreparationStorage(BaseModel):
    subject_id: int
    name: str
    is_archived: bool
    questions: int
    sessions: int
    answers: int


class StorageReport(BaseModel):
    database: DatabaseFile
    counts: Dict[str, int]
    unassigned_questions: int
    recordings: RecordingsFolder
    preparations: List[PreparationStorage]


class ProviderUse(BaseModel):
    name: str
    is_local: bool
    is_enabled: bool
    tasks: List[str]


class DataLeaving(BaseModel):
    task: str
    provider: str


class AboutReport(BaseModel):
    version: str
    python_version: str
    platform: str
    database_engine: str
    database_path: Optional[str] = None
    recordings_path: str
    # PrepBench contains no analytics or crash reporting. Reported rather than
    # asserted in copy, so a build that ever added some would have to say so here.
    telemetry: bool = False
    providers: List[ProviderUse]
    # Tasks that would send data off this machine right now: the ones routed to
    # an enabled cloud provider.
    data_leaving: List[DataLeaving]
    # How configured API keys are held: keyring, file, or env. Never the keys.
    key_storage: List[str]
    license: str


class ReviewScheduleRules(BaseModel):
    algorithm: str
    starting_ease: float
    minimum_ease: float
    first_interval_days: int
    second_interval_days: int
    passing_quality: int
    grades: Dict[str, int]
