"""
test_sm2_service.py

Coverage for app/services/sm2_service.py -- the SM-2 spaced-repetition
scheduling algorithm used to compute each question's next review date.
Previously untested despite backing the "Spaced Repetition" exam mode and
being invoked on every answered question (ExamEngine.save_answer).
"""

import uuid
import pytest
from datetime import timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.services.sm2_service import SM2Service
from app.models.spaced_repetition import SpacedRepetition
from app.models.exam_answer import ConfidenceLevel
from tests.conftest import TestingSessionLocal

client = TestClient(app)


def _make_question_id() -> int:
    """A real, persisted question id -- spaced_repetition.question_id has an
    enforced foreign key (PRAGMA foreign_keys=ON), so a fabricated id would
    fail at the database level rather than exercising SM2Service's own logic.
    """
    res = client.post(
        "/api/v1/questions",
        json={
            "text": f"SM2 test question {uuid.uuid4().hex}",
            "question_type": "single_choice",
            "options": [{"option_text": "A", "is_correct": True, "order_index": 0}],
        },
    )
    assert res.status_code == 201
    return res.json()["id"]


class TestCalculateQualityScore:
    def test_incorrect_with_high_confidence_scores_lowest(self):
        assert SM2Service.calculate_quality_score(False, ConfidenceLevel.HIGH) == 1

    @pytest.mark.parametrize("confidence", [ConfidenceLevel.MEDIUM, ConfidenceLevel.LOW, ConfidenceLevel.NOT_SET])
    def test_incorrect_with_lower_confidence_scores_two(self, confidence):
        assert SM2Service.calculate_quality_score(False, confidence) == 2

    def test_correct_with_high_confidence_scores_five(self):
        assert SM2Service.calculate_quality_score(True, ConfidenceLevel.HIGH) == 5

    def test_correct_with_medium_confidence_scores_four(self):
        assert SM2Service.calculate_quality_score(True, ConfidenceLevel.MEDIUM) == 4

    @pytest.mark.parametrize("confidence", [ConfidenceLevel.LOW, ConfidenceLevel.NOT_SET])
    def test_correct_with_low_or_unset_confidence_scores_three(self, confidence):
        assert SM2Service.calculate_quality_score(True, confidence) == 3


class TestUpdateItem:
    def test_first_correct_review_creates_item_with_one_day_interval(self):
        qid = _make_question_id()
        db = TestingSessionLocal()
        try:
            item = SM2Service.update_item(db, qid, True, ConfidenceLevel.HIGH)
            assert item.repetition == 1
            assert item.interval_days == 1
            # quality 5 -> ease-factor delta of exactly +0.1 off the SM-2 default of 2.5.
            assert item.ease_factor == pytest.approx(2.6)
            assert item.next_review_date == item.last_reviewed_at + timedelta(days=1)
        finally:
            db.close()

    def test_second_consecutive_correct_review_jumps_interval_to_six_days(self):
        qid = _make_question_id()
        db = TestingSessionLocal()
        try:
            SM2Service.update_item(db, qid, True, ConfidenceLevel.HIGH)
            item = SM2Service.update_item(db, qid, True, ConfidenceLevel.HIGH)
            assert item.repetition == 2
            assert item.interval_days == 6
            assert item.ease_factor == pytest.approx(2.7)
        finally:
            db.close()

    def test_third_consecutive_correct_review_uses_ease_factor_formula(self):
        qid = _make_question_id()
        db = TestingSessionLocal()
        try:
            SM2Service.update_item(db, qid, True, ConfidenceLevel.HIGH)
            SM2Service.update_item(db, qid, True, ConfidenceLevel.HIGH)
            item = SM2Service.update_item(db, qid, True, ConfidenceLevel.HIGH)
            assert item.repetition == 3
            # round(previous_interval(6) * new_ease_factor(2.8))
            assert item.interval_days == 17
            assert item.ease_factor == pytest.approx(2.8)
        finally:
            db.close()

    def test_failed_review_resets_repetition_and_interval_even_after_progress(self):
        qid = _make_question_id()
        db = TestingSessionLocal()
        try:
            SM2Service.update_item(db, qid, True, ConfidenceLevel.HIGH)
            SM2Service.update_item(db, qid, True, ConfidenceLevel.HIGH)  # now at repetition=2, interval=6

            item = SM2Service.update_item(db, qid, False, ConfidenceLevel.LOW)
            assert item.repetition == 0
            assert item.interval_days == 1
            # quality=2 (incorrect, non-high confidence) -> ease-factor delta of -0.32
            assert item.ease_factor == pytest.approx(2.7 - 0.32)
        finally:
            db.close()

    def test_ease_factor_never_drops_below_the_1_3_floor(self):
        qid = _make_question_id()
        db = TestingSessionLocal()
        try:
            # Three consecutive wrong-with-high-confidence answers (quality=1,
            # delta -0.54 each) drive 2.5 -> 1.96 -> 1.42 -> below 1.3.
            SM2Service.update_item(db, qid, False, ConfidenceLevel.HIGH)
            SM2Service.update_item(db, qid, False, ConfidenceLevel.HIGH)
            item = SM2Service.update_item(db, qid, False, ConfidenceLevel.HIGH)
            assert item.ease_factor == pytest.approx(1.3)
        finally:
            db.close()

    def test_repeated_calls_update_the_same_row_rather_than_creating_duplicates(self):
        qid = _make_question_id()
        db = TestingSessionLocal()
        try:
            SM2Service.update_item(db, qid, True, ConfidenceLevel.HIGH)
            second = SM2Service.update_item(db, qid, True, ConfidenceLevel.MEDIUM)

            rows = db.query(SpacedRepetition).filter(SpacedRepetition.question_id == qid).all()
            # len(rows) == 1 alone would hold even if update_item were broken --
            # question_id is a unique DB column, so a duplicate insert would
            # raise IntegrityError rather than produce a second row. Assert the
            # single row actually reflects the *second* call's outcome (not
            # left over from the first) to prove it was updated in place.
            assert len(rows) == 1
            assert rows[0].id == second.id
            assert rows[0].repetition == 2
            assert rows[0].interval_days == 6
            assert rows[0].ease_factor == pytest.approx(2.6)
        finally:
            db.close()
