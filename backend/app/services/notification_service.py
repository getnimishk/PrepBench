# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Notifications: only what changes what you should do next.

Computed from the evidence on every read and never stored, like the daily goals.
A stored "you have 8 reviews due" is one missed update away from lying, and a
notification that has to be marked read after the reviews are done is asking the
learner to do the bookkeeping. These clear themselves when the thing is done.

There are no streaks and no encouragement. A notification that cannot change
what someone does next should not exist.
"""
from datetime import timedelta
from typing import List

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.timeutils import utc_now_naive
from app.models.question import Question
from app.models.roadmap import Roadmap
from app.repositories.settings_repository import SettingsRepository
from app.repositories.subject_repository import SubjectRepository
from app.schemas.notifications import Notification, NotificationList
from app.schemas.settings import AppSettingsSchema
from app.services import readiness as readiness_rules

# A question imported this long ago and still unreviewed is worth a mention...
IMPORT_AUDIT_AFTER = timedelta(hours=48)
# ...and one older than this was not a recent import: it is the bank.
IMPORT_AUDIT_WINDOW = timedelta(days=30)

_ORDER = {"warning": 0, "attention": 1}


def _plural(n: int, one: str, many: str) -> str:
    return one if n == 1 else many


class NotificationService:
    def __init__(self, db: Session):
        self.db = db
        self.subjects = SubjectRepository(db)

    def list(self) -> NotificationList:
        from app.services.home_service import HomeService

        triggers = AppSettingsSchema.model_validate(
            SettingsRepository(self.db).get_or_create()
        ).notification_triggers
        home = HomeService(self.db)
        now = utc_now_naive()
        items: List[Notification] = []

        for subject in self.subjects.get_all(include_archived=False):
            if triggers["review_due"]:
                misses = home.unreviewed_count(subject)
                if misses:
                    items.append(Notification(
                        id=f"review_misses:{subject.id}", trigger="review_due", severity="attention",
                        title="Misses to review",
                        detail=f"{misses} wrong {_plural(misses, 'answer', 'answers')} from your "
                               f"{subject.name} mocks {_plural(misses, 'has', 'have')} not been reviewed.",
                        subject_id=subject.id, subject_name=subject.name, count=misses,
                        action_label="Review", action_path="/review",
                    ))
                due = home.due_for_review_count(subject)
                if due:
                    items.append(Notification(
                        id=f"review_due:{subject.id}", trigger="review_due", severity="attention",
                        title="Due for review",
                        detail=f"{due} {subject.name} {_plural(due, 'question is', 'questions are')} "
                               "due on the review schedule.",
                        subject_id=subject.id, subject_name=subject.name, count=due,
                        action_label="Start review", action_path="/practice/spaced",
                    ))

            mocks = self.subjects.get_mock_results(subject)
            if mocks and (triggers["mock_below_pass"] or triggers["evidence_stale"]):
                verdict = readiness_rules.compute(
                    mocks, pass_mark=subject.pass_mark, has_exam_profile=subject.has_exam_profile,
                )
                latest = mocks[-1]
                if (
                    triggers["mock_below_pass"]
                    and subject.pass_mark is not None
                    and latest.score_pct < subject.pass_mark
                ):
                    items.append(Notification(
                        id=f"mock_below_pass:{subject.id}:{latest.session_id}", trigger="mock_below_pass",
                        severity="warning", title="Latest mock below the pass mark",
                        detail=f"Your latest {subject.name} mock scored {latest.score_pct:.0f}% "
                               f"against a {subject.pass_mark:.0f}% pass mark.",
                        subject_id=subject.id, subject_name=subject.name,
                        action_label="Review the mock", action_path=f"/exam-review/{latest.session_id}",
                    ))
                stale = next((b for b in verdict.blockers if b.kind == readiness_rules.BLOCKER_STALE), None)
                if triggers["evidence_stale"] and stale is not None:
                    items.append(Notification(
                        id=f"evidence_stale:{subject.id}", trigger="evidence_stale", severity="warning",
                        title="Readiness is out of date",
                        detail=f"Your last {subject.name} mock was {stale.value:.0f} days ago. "
                               f"Readiness only counts mocks from the last {stale.target:.0f} days.",
                        subject_id=subject.id, subject_name=subject.name,
                        action_label="Take a mock", action_path=f"/exam-setup?kind=mock&subject={subject.id}",
                    ))

            if triggers["import_unreviewed"]:
                pending = (
                    self.db.query(func.count(Question.id))
                    .filter(
                        Question.subject_id == subject.id,
                        Question.is_reviewed.is_(False),
                        Question.created_at <= now - IMPORT_AUDIT_AFTER,
                        Question.created_at >= now - IMPORT_AUDIT_WINDOW,
                    )
                    .scalar()
                ) or 0
                if pending:
                    items.append(Notification(
                        id=f"import_unreviewed:{subject.id}", trigger="import_unreviewed", severity="attention",
                        title="Imported questions not reviewed",
                        detail=f"{pending} {_plural(pending, 'question', 'questions')} added to {subject.name} "
                               "in the last 30 days have sat unreviewed for more than two days.",
                        subject_id=subject.id, subject_name=subject.name, count=pending,
                        action_label="Open Question Bank", action_path="/question-bank",
                    ))

        if triggers["roadmap_slipping"]:
            items.extend(self._slipping_roadmaps())

        items.sort(key=lambda n: (_ORDER.get(n.severity, 9), n.subject_name or "", n.id))
        return NotificationList(items=items)

    def _slipping_roadmaps(self) -> List[Notification]:
        """A roadmap projected to finish after its preparation's exam date."""
        from app.services.roadmap_service import RoadmapService

        out: List[Notification] = []
        roadmaps = (
            self.db.query(Roadmap)
            .filter(Roadmap.subject_id.isnot(None), Roadmap.is_archived.is_(False))
            .all()
        )
        for roadmap in roadmaps:
            subject = self.subjects.get_by_id(roadmap.subject_id)
            if subject is None or subject.target_exam_date is None or subject.is_archived:
                continue
            schedule = RoadmapService(self.db).build_schedule(roadmap.id)
            end = schedule.projected_end_date
            if not schedule.schedule_available or end is None or end <= subject.target_exam_date:
                continue
            out.append(Notification(
                id=f"roadmap_slipping:{roadmap.id}", trigger="roadmap_slipping", severity="warning",
                title="Roadmap finishes after the exam",
                detail=f"At {schedule.weekly_hours_budget:g} hours a week, {roadmap.title} is projected to "
                       f"finish on {end:%d %b %Y}, after your {subject.name} exam on "
                       f"{subject.target_exam_date:%d %b %Y}.",
                subject_id=subject.id, subject_name=subject.name,
                # The editor, as the prototype has it: what changes a projected
                # finish is the weekly budget or the shape of the plan.
                action_label="Edit plan", action_path=f"/roadmaps/{roadmap.id}/edit",
            ))
        return out
