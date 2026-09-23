# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The person using this copy of PrepBench, and what they have done in it.

There is no account behind this. PrepBench runs on one machine for one person
and nothing signs in, so the profile is a name and an email to show, and a set of
counts read from the practice data itself -- never a figure kept on the side,
which could drift from the evidence it claims to summarise.
"""
from datetime import date, datetime
from typing import Optional, Tuple

from sqlalchemy import func, select, union
from sqlalchemy.orm import Session

from app.models.design_review import DesignReviewAttempt
from app.models.exam_answer import ExamAnswer
from app.models.exam_session import ExamSession, ExamStatus
from app.models.interview_session import InterviewSession
from app.models.learning_attempt import LearningAttempt
from app.models.practice_recording import PracticeRecording
from app.models.question import Question
from app.models.review_check import ReviewCheck
from app.models.roadmap import RoadmapTopic, RoadmapTopicStatus, TopicDemonstration, TopicGuideSection
from app.models.spaced_repetition import SpacedRepetition
from app.models.subject import Subject
from app.models.system_design_attempt import SystemDesignAttempt
from app.repositories.settings_repository import SettingsRepository
from app.repositories.subject_repository import LEARNER, MOCK
from app.schemas.profile import (
    ProfileResponse,
    ProfileStats,
    ProfileStorage,
    ProfileTimezone,
    ProfileUpdate,
)
from app.services.system_service import SystemService


def machine_timezone() -> ProfileTimezone:
    now = datetime.now().astimezone()
    offset = now.utcoffset()
    return ProfileTimezone(
        name=now.tzname() or "Local time",
        utc_offset_minutes=int(offset.total_seconds() // 60) if offset is not None else 0,
    )


class ProfileService:
    def __init__(self, db: Session):
        self.db = db
        self.settings = SettingsRepository(db)

    def get(self) -> ProfileResponse:
        row = self.settings.get_or_create()
        system = SystemService(self.db)
        database = system.database_file()
        days, since = self._active_days()
        return ProfileResponse(
            display_name=row.display_name,
            email=row.email,
            timezone=machine_timezone(),
            stats=ProfileStats(
                preparations=self.db.query(func.count(Subject.id))
                .filter(Subject.is_archived.is_(False)).scalar() or 0,
                questions=self.db.query(func.count(Question.id)).scalar() or 0,
                mocks_taken=self.db.query(func.count(ExamSession.id)).filter(
                    ExamSession.session_kind == MOCK,
                    ExamSession.source == LEARNER,
                    ExamSession.status == ExamStatus.COMPLETED,
                ).scalar() or 0,
                days_active=days,
                active_since=since,
                interview_answers=self.db.query(func.count(PracticeRecording.id)).scalar() or 0,
                study_hours=(
                    round(self.db.query(func.sum(RoadmapTopic.estimated_hours)).filter(
                        RoadmapTopic.status == RoadmapTopicStatus.COMPLETED,
                        RoadmapTopic.estimated_hours.is_not(None),
                    ).scalar() or 0.0, 1)
                ),
            ),
            storage=ProfileStorage(
                database_bytes=(
                    (database.size_bytes or 0) + (database.wal_bytes or 0)
                    if database.size_bytes is not None
                    else None
                ),
                recordings_bytes=system.recordings_folder().size_bytes,
            ),
        )

    def update(self, update: ProfileUpdate) -> ProfileResponse:
        row = self.settings.get_or_create()
        for field, value in update.model_dump(exclude_unset=True).items():
            setattr(row, field, value)
        self.db.commit()
        return self.get()

    def _active_days(self) -> Tuple[int, Optional[date]]:
        """Distinct local calendar days with recorded activity, and the first of them.

        Counted in the database with SQLite's `localtime`, which reads the same
        machine clock the rest of the app keeps days by: stored timestamps are
        naive UTC, and a practice session at 01:00 belongs to the day it happened
        on here, not to yesterday in Greenwich. Only the learner's own sessions
        count; sample and test papers are not days anyone was active.
        """

        def day(column):
            return func.date(column, "localtime").label("day")

        learner_sessions = ExamSession.source == LEARNER
        days = union(
            select(day(ExamSession.start_time)).where(learner_sessions),
            select(day(ExamAnswer.first_answered_at))
            .join(ExamSession, ExamSession.id == ExamAnswer.session_id)
            .where(learner_sessions),
            select(day(TopicDemonstration.created_at)),
            select(day(TopicGuideSection.read_at)),
            select(day(PracticeRecording.created_at)),
            select(day(InterviewSession.created_at)),
            select(day(SystemDesignAttempt.created_at)),
            select(day(DesignReviewAttempt.created_at)),
            select(day(ReviewCheck.created_at)),
            select(day(LearningAttempt.started_at)),
            select(day(SpacedRepetition.last_reviewed_at)),
        ).subquery()
        count, first = self.db.execute(
            select(func.count(days.c.day), func.min(days.c.day)).where(days.c.day.is_not(None))
        ).one()
        return int(count or 0), date.fromisoformat(first) if first else None
