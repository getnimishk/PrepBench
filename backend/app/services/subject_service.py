# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Creating, editing and deleting preparations.

Preparations were seed-only until now: `seed_subjects.py` put three in and there
was no way to add a fourth. The prototype puts "+ Add preparation" in the picker
on every screen, so this is the gap that blocked it.

Three rules live here rather than in the schema, because each needs the database
to answer:

  * a certification string may be claimed by only one preparation
  * a new preparation adopts the unowned questions that already carry its
    certification string
  * deleting destroys questions and evidence; archiving destroys nothing
"""
import re
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from app.core.exceptions import (
    ConflictException,
    InvalidExamStateException,
    ResourceNotFoundException,
)
from app.core.logging_config import logger
from app.models.exam_session import ExamSession
from app.models.learning_attempt import LearningAttempt
from app.models.question import Question
from app.models.roadmap import Roadmap
from app.models.subject import Subject
from app.repositories.subject_repository import SubjectRepository
from app.schemas.subject import (
    SubjectCreate,
    SubjectCreateResult,
    SubjectDeleteResult,
    SubjectUpdate,
)


def slugify(name: str) -> str:
    """A URL-safe stem for a preparation name.

    Falls back to "preparation" rather than an empty string: a name of only
    punctuation is unusual but not invalid, and an empty slug would collide with
    the next one and violate a unique constraint a long way from the cause.
    """
    stem = re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")
    return (stem or "preparation")[:70]


class SubjectService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = SubjectRepository(db)

    # ---- create ---------------------------------------------------------

    def create(self, req: SubjectCreate) -> Tuple[Subject, SubjectCreateResult]:
        if self.repo.get_by_name(req.name):
            raise ConflictException(
                f"A preparation called {req.name!r} already exists. Names are how "
                "preparations are told apart in the picker, so they have to be "
                "distinct."
            )

        certification = (req.certification or "").strip() or None
        if certification:
            self._refuse_a_claimed_certification(certification)

        subject = self.repo.create(
            name=req.name.strip(),
            slug=self._unique_slug(req.name),
            kind=req.kind,
            description=(req.description or None),
            certification=certification,
            pass_mark=req.pass_mark,
            exam_question_count=req.exam_question_count,
            exam_minutes=req.exam_minutes,
            target_exam_date=req.target_exam_date,
            display_order=req.display_order,
        )

        adopted = self._adopt_unowned_questions(subject)

        return subject, SubjectCreateResult(
            subject_id=subject.id, slug=subject.slug, questions_adopted=adopted
        )

    def _unique_slug(self, name: str) -> str:
        """Derived from the name, de-duplicated with a numeric suffix.

        Derived once, on create, and never regenerated when the name changes --
        see SubjectUpdate. The name is the label; the slug is the identity.
        """
        base = slugify(name)
        taken = self.repo.slugs_starting_with(base)
        if base not in taken:
            return base
        n = 2
        while f"{base}-{n}" in taken:
            n += 1
        return f"{base}-{n}"

    def _refuse_a_claimed_certification(
        self, certification: str, exclude_id: Optional[int] = None
    ) -> None:
        """One certification string, one preparation.

        Not a database constraint: adding UNIQUE to an existing SQLite column
        means rebuilding the table, which this project's forward-only migration
        strategy does not do. So the ambiguous state is made unreachable here
        instead.

        Why it has to be unreachable at all: question ownership is resolved by
        exact certification match, and with two claimants
        QuestionRepository.resolve_subject_id refuses to attribute anything while
        the Phase 2 backfill skips those rows. Both are correct -- choosing would
        be a coin toss decided by insertion order -- but the learner just sees
        questions that belong to nothing. Better to refuse the second claim than
        to keep explaining the consequence.
        """
        holder = self.repo.get_by_certification(certification, exclude_id=exclude_id)
        if holder is not None:
            raise ConflictException(
                f"{holder.name!r} already uses the certification "
                f"{certification!r}. Two preparations sharing one certification "
                "means a question carrying it cannot be attributed to either, so "
                "its questions would belong to neither. Use a distinct "
                "certification name."
            )

    def _adopt_unowned_questions(self, subject: Subject) -> int:
        """Bind questions that already carry this certification and have no owner.

        The case that makes creating a preparation useful rather than ceremonial:
        the learner imported a bank first and is adding the preparation it belongs
        to second. Without this the new preparation is empty and the bank is
        invisible to it.

        Two limits, both deliberate. Exact equality, never a token match -- the
        token match is what put a Databricks question in a PSM I mock. And only
        `subject_id IS NULL`, so this can never take a question that another
        preparation already owns.
        """
        if not subject.certification:
            return 0

        adopted = (
            self.db.query(Question)
            .filter(
                Question.subject_id.is_(None),
                Question.certification == subject.certification,
            )
            .update({Question.subject_id: subject.id}, synchronize_session=False)
        )
        self.db.commit()
        if adopted:
            logger.info(
                f"Preparation {subject.name!r} adopted {adopted} existing "
                f"question(s) already carrying {subject.certification!r}."
            )
        return adopted

    # ---- update ---------------------------------------------------------

    def update(self, subject_id: int, req: SubjectUpdate) -> Subject:
        subject = self._require(subject_id)
        changes = req.model_dump(exclude_unset=True)

        new_name = changes.get("name")
        if new_name and new_name.strip() != subject.name:
            clash = self.repo.get_by_name(new_name.strip())
            if clash is not None and clash.id != subject.id:
                raise ConflictException(
                    f"A preparation called {new_name.strip()!r} already exists."
                )
            changes["name"] = new_name.strip()

        if "certification" in changes:
            certification = (changes["certification"] or "").strip() or None
            if certification:
                self._refuse_a_claimed_certification(certification, exclude_id=subject.id)
            changes["certification"] = certification

        # A skill must not acquire an exam profile through the back door. The
        # create schema validates the pair as a set; an update arrives one field
        # at a time, so the check has to look at the stored kind.
        if subject.kind.value == "skill":
            offered = [
                label
                for label, field in (
                    ("pass mark", "pass_mark"),
                    ("question count", "exam_question_count"),
                    ("time limit", "exam_minutes"),
                )
                if changes.get(field) is not None
            ]
            if offered:
                raise InvalidExamStateException(
                    f"{subject.name!r} is a skill, so it has no exam to measure "
                    f"against and cannot carry {', '.join(offered)}."
                )

        for field, value in changes.items():
            setattr(subject, field, value)
        return self.repo.save(subject)

    # ---- delete ---------------------------------------------------------

    def delete(self, subject_id: int, confirm_name: str) -> SubjectDeleteResult:
        """Destroy a preparation, its questions and its evidence.

        Irreversible, and there is no backup mechanism in this application, so
        the name must be typed exactly -- as the prototype's danger zone
        specifies. Archiving is the reversible option and is a separate action.

        The cascade is explicit rather than left to `ondelete`. Every subject_id
        in this schema is SET NULL, which is right for accidental unlinking and
        wrong for this: the learner asked for the questions to go. Doing it here
        also means the counts can be returned, so the surface reports what
        happened instead of a rehearsed sentence.
        """
        subject = self._require(subject_id)

        if confirm_name.strip() != subject.name:
            raise InvalidExamStateException(
                "The name did not match, so nothing was deleted. Type "
                f"{subject.name!r} exactly to confirm."
            )

        name = subject.name

        # Questions first: their options, exam answers and spaced-repetition
        # rows come with them through relationship cascades, and review_checks
        # hang off the answers.
        owned = self.db.query(Question).filter(Question.subject_id == subject.id).all()
        questions_deleted = len(owned)
        for question in owned:
            self.db.delete(question)

        sessions = (
            self.db.query(ExamSession).filter(ExamSession.subject_id == subject.id).all()
        )
        exam_sessions_deleted = len(sessions)
        for session in sessions:
            self.db.delete(session)

        # Unlinked, NOT deleted. The prototype's delete copy names questions,
        # mocks and review state -- it makes no claim on roadmaps, and a roadmap
        # is separately imported content. It reappears in the "not linked to a
        # preparation" group rather than vanishing.
        roadmaps_unlinked = (
            self.db.query(Roadmap)
            .filter(Roadmap.subject_id == subject.id)
            .update({Roadmap.subject_id: None}, synchronize_session=False)
        )
        learning_attempts_unlinked = (
            self.db.query(LearningAttempt)
            .filter(LearningAttempt.subject_id == subject.id)
            .update({LearningAttempt.subject_id: None}, synchronize_session=False)
        )

        self.db.flush()
        self.repo.delete(subject)

        logger.info(
            f"Deleted preparation {name!r}: {questions_deleted} question(s), "
            f"{exam_sessions_deleted} exam session(s). Unlinked "
            f"{roadmaps_unlinked} roadmap(s) and {learning_attempts_unlinked} "
            f"learning attempt(s)."
        )

        return SubjectDeleteResult(
            deleted_subject_id=subject_id,
            deleted_subject_name=name,
            questions_deleted=questions_deleted,
            exam_sessions_deleted=exam_sessions_deleted,
            roadmaps_unlinked=roadmaps_unlinked,
            learning_attempts_unlinked=learning_attempts_unlinked,
        )

    def _require(self, subject_id: int) -> Subject:
        subject = self.repo.get_by_id(subject_id)
        if subject is None:
            raise ResourceNotFoundException("Subject", subject_id)
        return subject
