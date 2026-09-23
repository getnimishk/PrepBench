# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Where the learner's data is, and what this build does with it.

Read from the database connection actually in use, never from the default path
in config: a server started against another file (the browser tests do exactly
that) must report that file, or the screen describing "your data" describes
someone else's.
"""
import platform
import sqlite3
from datetime import datetime, UTC
from pathlib import Path
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import RECORDINGS_DIR, settings
from app.models.exam_answer import ExamAnswer
from app.models.exam_session import ExamSession
from app.models.question import Question
from app.models.subject import Subject
from app.repositories.subject_repository import session_belongs_to
from app.schemas.system import (
    AboutReport,
    DatabaseFile,
    DataLeaving,
    PreparationStorage,
    ProviderUse,
    RecordingsFolder,
    ReviewScheduleRules,
    StorageReport,
)
from app.services.sm2_service import SM2Service


def _mtime(path: Path) -> Optional[datetime]:
    try:
        return datetime.fromtimestamp(path.stat().st_mtime, UTC).replace(tzinfo=None)
    except OSError:
        return None


def _size(path: Path) -> Optional[int]:
    try:
        return path.stat().st_size
    except OSError:
        return None


class SystemService:
    def __init__(self, db: Session):
        self.db = db

    # ---- the database file ---------------------------------------------

    def _database(self) -> DatabaseFile:
        url = self.db.get_bind().url
        engine = url.get_backend_name()
        if engine != "sqlite" or not url.database or url.database == ":memory:":
            return DatabaseFile(engine=engine)
        path = Path(url.database).resolve()
        wal = path.with_name(path.name + "-wal")
        modified = [m for m in (_mtime(path), _mtime(wal)) if m is not None]
        return DatabaseFile(
            engine=engine,
            path=str(path),
            size_bytes=_size(path),
            wal_bytes=_size(wal),
            modified_at=max(modified) if modified else None,
            backup_supported=path.exists(),
        )

    def database_file(self) -> DatabaseFile:
        """The database this server is using, measured on disk."""
        return self._database()

    def recordings_folder(self) -> RecordingsFolder:
        files, total = 0, 0
        if RECORDINGS_DIR.exists():
            for item in RECORDINGS_DIR.rglob("*"):
                if item.is_file():
                    files += 1
                    total += _size(item) or 0
        return RecordingsFolder(path=str(RECORDINGS_DIR.resolve()), files=files, size_bytes=total)

    def storage(self) -> StorageReport:
        from app.core.database import Base

        counts = {}
        for name in (
            "subjects", "questions", "exam_sessions", "exam_answers", "roadmaps", "roadmap_topics",
            "practice_recordings", "interview_sessions", "system_design_attempts",
            "design_review_attempts", "learning_attempts", "spaced_repetition",
        ):
            table = Base.metadata.tables.get(name)
            if table is not None:
                counts[name] = self.db.query(func.count()).select_from(table).scalar() or 0

        preparations: List[PreparationStorage] = []
        for subject in self.db.query(Subject).order_by(Subject.display_order, Subject.id).all():
            preparations.append(PreparationStorage(
                subject_id=subject.id,
                name=subject.name,
                is_archived=bool(subject.is_archived),
                questions=self.db.query(func.count(Question.id))
                .filter(Question.subject_id == subject.id).scalar() or 0,
                sessions=self.db.query(func.count(ExamSession.id))
                .filter(session_belongs_to(subject)).scalar() or 0,
                answers=self.db.query(func.count(ExamAnswer.id))
                .join(Question, Question.id == ExamAnswer.question_id)
                .filter(Question.subject_id == subject.id).scalar() or 0,
            ))

        return StorageReport(
            database=self._database(),
            counts=counts,
            unassigned_questions=self.db.query(func.count(Question.id))
            .filter(Question.subject_id.is_(None)).scalar() or 0,
            recordings=self.recordings_folder(),
            preparations=preparations,
        )

    def backup_to(self, destination: Path) -> None:
        """A consistent copy of the live database, written to `destination`.

        SQLite's online backup API rather than copying the file: a copy taken
        while the server writes can catch a page half-written, and the recent
        writes still sitting in the WAL would be missing from it.
        """
        database = self._database()
        if database.engine != "sqlite" or not database.backup_supported:
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail="Backups are only available for a SQLite database file.",
            )
        raw = self.db.get_bind().raw_connection()
        try:
            source = getattr(raw, "driver_connection", None) or raw.connection
            target = sqlite3.connect(str(destination))
            try:
                source.backup(target)
            finally:
                target.close()
        finally:
            raw.close()

    # ---- about ------------------------------------------------------------

    def about(self) -> AboutReport:
        from app.llm.secrets import ENV_SCHEME, FILE_SCHEME, KEYRING_SCHEME
        from app.models.llm_config import LLMProviderConfig
        from app.services.llm_config_service import LLMConfigService

        service = LLMConfigService(self.db)
        providers = service.list_providers()
        tasks = service.list_tasks()

        by_id = {p.id: p for p in providers}
        uses: List[ProviderUse] = []
        for p in providers:
            uses.append(ProviderUse(
                name=p.name, is_local=p.is_local, is_enabled=p.is_enabled,
                tasks=[t.label for t in tasks if t.resolved_provider_id == p.id],
            ))
        leaving = [
            DataLeaving(task=t.label, provider=t.resolved_provider_name or "")
            for t in tasks
            if t.is_available and t.resolved_provider_id in by_id and not by_id[t.resolved_provider_id].is_local
        ]
        # A provider found only in the environment (GEMINI_API_KEY with no row)
        # is still a cloud route.
        leaving.extend(
            DataLeaving(task=t.label, provider=t.resolved_provider_name or "")
            for t in tasks
            if t.is_available and t.resolved_provider_id is None and t.resolved_provider_name
        )

        schemes = set()
        for row in self.db.query(LLMProviderConfig.api_key_ref).filter(LLMProviderConfig.api_key_ref.isnot(None)):
            ref = row[0] or ""
            if ref.startswith(KEYRING_SCHEME):
                schemes.add("keyring")
            elif ref.startswith(FILE_SCHEME):
                schemes.add("file")
            elif ref.startswith(ENV_SCHEME):
                schemes.add("env")

        database = self._database()
        return AboutReport(
            version=settings.VERSION,
            python_version=platform.python_version(),
            platform=f"{platform.system()} {platform.release()}".strip(),
            database_engine=database.engine,
            database_path=database.path,
            recordings_path=str(RECORDINGS_DIR.resolve()),
            telemetry=False,
            providers=uses,
            data_leaving=leaving,
            key_storage=sorted(schemes),
            license="PolyForm Noncommercial License 1.0.0",
        )

    def review_schedule(self) -> ReviewScheduleRules:
        from app.services.spaced_review_service import GRADE_QUALITY

        return ReviewScheduleRules(
            algorithm="SM-2",
            starting_ease=SM2Service.STARTING_EASE,
            minimum_ease=SM2Service.MINIMUM_EASE,
            first_interval_days=SM2Service.FIRST_INTERVAL_DAYS,
            second_interval_days=SM2Service.SECOND_INTERVAL_DAYS,
            passing_quality=SM2Service.PASSING_QUALITY,
            grades=dict(GRADE_QUALITY),
        )
