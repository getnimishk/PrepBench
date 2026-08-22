from typing import Any, Dict, List
from sqlalchemy.orm import Session
from app.repositories.question_repository import QuestionRepository
from app.services.question_validator import QuestionValidator


class IntegrityCheckService:
    """Read-only comparison between a reference question-bank source file and the
    live database. Formalizes the ad-hoc scripts used to diagnose the import
    option-loss bug into a reusable, repeatable check — matches questions by
    normalized text (not database id, which a pre-import source file has no
    knowledge of), reusing the same normalization the app's own duplicate
    detection already relies on for consistency.
    """

    def __init__(self, db: Session):
        self.db = db
        self.repo = QuestionRepository(db)

    def compare_against_source(self, source_questions: List[dict]) -> Dict[str, Any]:
        """source_questions: parsed JSON list, same shape as a question-bank
        import file (each item at minimum has 'text' and 'options' keys, where
        each option has an 'option_text' key)."""
        db_questions = self.repo.get_all_unpaginated()
        db_by_norm_text = {
            QuestionValidator._normalize(q.text): q for q in db_questions
        }

        missing_questions: List[dict] = []
        option_mismatches: List[dict] = []
        matched_norm_texts = set()

        for sq in source_questions:
            norm = QuestionValidator._normalize(sq.get("text", ""))
            dbq = db_by_norm_text.get(norm)
            if dbq is None:
                missing_questions.append({
                    "source_id": sq.get("id"),
                    "text": (sq.get("text") or "")[:120],
                })
                continue
            matched_norm_texts.add(norm)

            src_options = sq.get("options", [])
            db_option_texts = {opt.option_text for opt in dbq.options}
            missing_options = [
                opt.get("option_text", "") for opt in src_options
                if opt.get("option_text", "") not in db_option_texts
            ]
            if missing_options:
                option_mismatches.append({
                    "db_id": dbq.id,
                    "source_id": sq.get("id"),
                    "text": (sq.get("text") or "")[:120],
                    "expected_option_count": len(src_options),
                    "actual_option_count": len(db_option_texts),
                    "missing_options": missing_options,
                })

        extra_questions = [
            {"db_id": q.id, "text": q.text[:120]}
            for norm, q in db_by_norm_text.items()
            if norm not in matched_norm_texts
        ]

        return {
            "source_total": len(source_questions),
            "db_total": len(db_questions),
            "missing_questions": missing_questions,
            "extra_questions": extra_questions,
            "option_mismatches": option_mismatches,
            "is_clean": not missing_questions and not option_mismatches,
        }
