# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Create, update and delete payloads for preparations.

The read shapes (`SubjectResponse`, `SubjectWithReadiness`) stay in
`app/api/v1/subjects.py` where they were, alongside the readiness block they
assemble. Only the write shapes are here, because they carry rules.
"""
from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.subject import SubjectKind


class SubjectCreate(BaseModel):
    """A new preparation.

    `slug` is absent on purpose: the server derives it from the name. A client
    should not have to invent a URL-safe identity, and two clients inventing
    them differently is a bug waiting for a second caller.
    """

    name: str = Field(min_length=1, max_length=150)
    kind: SubjectKind
    description: Optional[str] = Field(default=None, max_length=300)

    # The string that binds questions to this preparation. Exact-match only,
    # everywhere -- see QuestionRepository.resolve_subject_id.
    certification: Optional[str] = Field(default=None, max_length=150)

    pass_mark: Optional[float] = Field(default=None, ge=0, le=100)
    exam_question_count: Optional[int] = Field(default=None, ge=1)
    exam_minutes: Optional[int] = Field(default=None, ge=1)
    target_exam_date: Optional[date] = None
    display_order: int = Field(default=100, ge=0)

    @model_validator(mode="after")
    def _exam_profile_matches_the_kind(self):
        """A certification arrives with its whole exam profile, or not at all.

        `Subject.has_exam_profile` needs all three, and ExamEngine refuses a mock
        without it. A certification missing one is a row that cannot do the only
        thing a certification exists for, so it is refused at the door rather
        than created and discovered later.

        A skill is refused the fields outright: `readiness` reports a skill as
        uncomputable rather than zero *because* it has no pass mark, and storing
        one would be a number that can never be measured against.
        """
        if self.kind == SubjectKind.CERTIFICATION:
            missing = [
                label
                for label, value in (
                    ("pass mark", self.pass_mark),
                    ("question count", self.exam_question_count),
                    ("time limit", self.exam_minutes),
                )
                if value is None
            ]
            if missing:
                raise ValueError(
                    "A certification needs its full exam profile before it can be "
                    f"measured against. Missing: {', '.join(missing)}. These come "
                    "from the official exam."
                )
        else:
            present = [
                label
                for label, value in (
                    ("pass mark", self.pass_mark),
                    ("question count", self.exam_question_count),
                    ("time limit", self.exam_minutes),
                )
                if value is not None
            ]
            if present:
                raise ValueError(
                    f"A skill has no exam, so it cannot carry {', '.join(present)}. "
                    "Progress on a skill is measured by attempts and analysed "
                    "answers, not against a pass mark. Create it as a "
                    "certification if it has a real paper."
                )
        return self


class SubjectUpdate(BaseModel):
    """Every field optional; omitted fields are left alone.

    `slug` cannot be changed and is not offered. It is the preparation's stable
    identity -- a slug that moves when the name is edited breaks every link
    anyone kept. The name is the label; the slug is the identity.

    `kind` is not offered either. Switching a certification to a skill would
    strand its pass mark and orphan the mock evidence measured against it, and
    switching the other way would require an exam profile this payload cannot
    validate as a set. Delete and recreate is the honest path.
    """

    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    description: Optional[str] = Field(default=None, max_length=300)
    certification: Optional[str] = Field(default=None, max_length=150)
    pass_mark: Optional[float] = Field(default=None, ge=0, le=100)
    exam_question_count: Optional[int] = Field(default=None, ge=1)
    exam_minutes: Optional[int] = Field(default=None, ge=1)
    target_exam_date: Optional[date] = None
    display_order: Optional[int] = Field(default=None, ge=0)
    is_archived: Optional[bool] = None


class SubjectDeleteRequest(BaseModel):
    """Typing the name is the confirmation, as the prototype specifies.

    A destructive, irreversible action reached by one click is a destructive
    action that happens by accident.
    """

    confirm_name: str = Field(min_length=1)


class SubjectDeleteResult(BaseModel):
    """What was actually destroyed, and what was only unlinked.

    Returned so a surface can report the truth rather than a rehearsed sentence.
    The prototype's danger zone promises "permanently removes N questions, M
    mocks and all review state"; these are those numbers, after the fact.
    """

    deleted_subject_id: int
    deleted_subject_name: str
    questions_deleted: int
    exam_sessions_deleted: int
    roadmaps_unlinked: int
    learning_attempts_unlinked: int

    model_config = ConfigDict(from_attributes=True)


class SubjectCreateResult(BaseModel):
    """The new preparation, plus how many existing questions it adopted.

    Reported because it is the difference between a preparation that works and
    one that looks empty: a learner who imported a bank first and added the
    preparation second needs to see that the two found each other.
    """

    subject_id: int
    slug: str
    questions_adopted: int
