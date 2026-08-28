# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Lightweight import for the Interview Practice question bank.

Deliberately much smaller than the main Question Bank's import_service.py --
interview questions have no options, no correct-answer keys, no explanations
to parse/validate, just question text + round + optional category. Reusing
the MCQ import machinery would mean stripping out most of what it does, so
this is purpose-built instead.
"""
import csv
import io
import json
from typing import List, Optional
from sqlalchemy.orm import Session

from app.repositories.interview_question_repository import InterviewQuestionRepository
from app.schemas.interview_question import InterviewQuestionCreate, InterviewQuestionImportResult
from app.models.interview_question import InterviewRoundType

_QUESTION_KEYS = ("question_text", "question", "text")
_ROUND_KEYS = ("round_type", "round")


def _normalize_round_type(raw: Optional[str]) -> Optional[InterviewRoundType]:
    if not raw:
        return None
    candidate = str(raw).strip().lower().replace(" ", "_").replace("-", "_")
    try:
        return InterviewRoundType(candidate)
    except ValueError:
        return None


class InterviewQuestionImportService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = InterviewQuestionRepository(db)

    def parse_and_import(
        self,
        content_bytes: bytes,
        filename: str,
        default_round_type: InterviewRoundType,
        default_category: Optional[str] = None,
    ) -> InterviewQuestionImportResult:
        fname = filename.lower()
        if fname.endswith(".json"):
            rows = self._parse_json(content_bytes)
        elif fname.endswith(".csv"):
            rows = self._parse_csv(content_bytes)
        else:
            rows = self._parse_plain_text(content_bytes)

        return self._import_rows(rows, default_round_type, default_category)

    def _parse_json(self, content_bytes: bytes) -> List[dict]:
        try:
            data = json.loads(content_bytes.decode("utf-8"))
        except Exception as e:
            return [{"__error__": f"Could not parse JSON: {e}"}]
        if isinstance(data, dict) and "questions" in data:
            data = data["questions"]
        if not isinstance(data, list):
            return [{"__error__": "JSON root must be an array (or an object with a 'questions' array)."}]

        rows = []
        for item in data:
            if not isinstance(item, dict):
                rows.append({"__error__": f"Skipped non-object item: {item!r}"})
                continue
            question_text = next((item[k] for k in _QUESTION_KEYS if item.get(k)), None)
            round_type = next((item[k] for k in _ROUND_KEYS if item.get(k)), None)
            category = item.get("category")
            rows.append({"question_text": question_text, "round_type": round_type, "category": category})
        return rows

    def _parse_csv(self, content_bytes: bytes) -> List[dict]:
        try:
            text = content_bytes.decode("utf-8-sig")
        except Exception as e:
            return [{"__error__": f"Could not decode CSV as UTF-8: {e}"}]

        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames:
            return [{"__error__": "CSV has no header row."}]
        # Case-insensitive header lookup.
        field_map = {f.strip().lower(): f for f in reader.fieldnames}

        def _get(row: dict, keys) -> Optional[str]:
            for k in keys:
                actual = field_map.get(k)
                if actual and row.get(actual):
                    return row[actual]
            return None

        rows = []
        for row in reader:
            rows.append({
                "question_text": _get(row, _QUESTION_KEYS),
                "round_type": _get(row, _ROUND_KEYS),
                "category": _get(row, ("category",)),
            })
        return rows

    def _parse_plain_text(self, content_bytes: bytes) -> List[dict]:
        try:
            text = content_bytes.decode("utf-8")
        except Exception as e:
            return [{"__error__": f"Could not decode text as UTF-8: {e}"}]

        rows = []
        for line in text.splitlines():
            line = line.strip()
            if not line:
                continue
            rows.append({"question_text": line, "round_type": None, "category": None})
        return rows

    def _import_rows(
        self,
        rows: List[dict],
        default_round_type: InterviewRoundType,
        default_category: Optional[str],
    ) -> InterviewQuestionImportResult:
        imported = 0
        skipped = 0
        errors: List[str] = []

        for idx, row in enumerate(rows, start=1):
            if "__error__" in row:
                skipped += 1
                errors.append(f"Row {idx}: {row['__error__']}")
                continue

            question_text = (row.get("question_text") or "").strip()
            if not question_text:
                skipped += 1
                errors.append(f"Row {idx}: empty question text, skipped.")
                continue

            raw_round = row.get("round_type")
            if raw_round:
                # Present but must be a recognized round -- an invalid value
                # is skipped outright rather than silently substituted, since
                # silently reassigning someone's question to the wrong round
                # is worse than just telling them to fix the row.
                round_type = _normalize_round_type(raw_round)
                if not round_type:
                    skipped += 1
                    errors.append(f"Row {idx}: unrecognized round_type '{raw_round}', skipped.")
                    continue
            else:
                # Missing entirely -- fall back to the round selected in the
                # import form, no error (this is the expected path for plain
                # text and for JSON/CSV rows that don't specify a round).
                round_type = default_round_type

            category = row.get("category") or default_category

            self.repo.create(InterviewQuestionCreate(
                round_type=round_type,
                question_text=question_text,
                category=category,
                is_ai_generated=False,
            ))
            imported += 1

        return InterviewQuestionImportResult(imported_count=imported, skipped_count=skipped, errors=errors)
