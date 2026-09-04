# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The built-in subjects.

A certification subject carries a real exam profile -- pass mark, question
count, duration -- taken from the certification body, because those three
numbers are what make readiness computable. A skill subject carries none,
and consequently can never be reported as ready.

Databricks ships as a skill rather than a certification deliberately: the
exam exists, but PrepBench has no Databricks questions yet, so claiming an
exam profile would promise a mock it cannot assemble.

Reconciled through app/utils/seed_ledger.py, so a subject added by a later
version reaches an existing install and one deleted by hand stays deleted.
"""
from sqlalchemy.orm import Session

from app.models.subject import SubjectKind
from app.repositories.subject_repository import SubjectRepository
from app.utils.seed_ledger import seed_missing_content

SEED_NAMESPACE = "subject"

SEED_SUBJECTS = [
    {
        "name": "Scrum / PSM I",
        "slug": "psm-i",
        "kind": SubjectKind.CERTIFICATION,
        # Matches Question.certification exactly, which is how 700-odd
        # existing questions resolve to this subject with no migration.
        "certification": "PSM I - Professional Scrum Master",
        "pass_mark": 85.0,
        "exam_question_count": 80,
        "exam_minutes": 60,
        "display_order": 10,
    },
    {
        "name": "Databricks Data Platform",
        "slug": "databricks",
        "kind": SubjectKind.SKILL,
        "certification": None,
        "pass_mark": None,
        "exam_question_count": None,
        "exam_minutes": None,
        "display_order": 20,
    },
    {
        "name": "System Design",
        "slug": "system-design",
        "kind": SubjectKind.SKILL,
        "certification": None,
        "pass_mark": None,
        "exam_question_count": None,
        "exam_minutes": None,
        "display_order": 30,
    },
]

_BY_NAME = {s["name"]: s for s in SEED_SUBJECTS}


def seed_subjects(db: Session) -> int:
    """Add every built-in subject this install has not been offered before."""
    repo = SubjectRepository(db)

    def create(name: str) -> None:
        repo.create(**_BY_NAME[name])

    return seed_missing_content(
        db,
        namespace=SEED_NAMESPACE,
        keys=list(_BY_NAME.keys()),
        bank_is_empty=repo.count() == 0,
        create=create,
    )
