from datetime import datetime
from fastapi.testclient import TestClient

from app.main import app
from app.services import recording_analysis_service as ras_module
from app.models.practice_recording import PracticeRecording
from app.models.recording_analysis import RecordingAnalysis
from app.models.interview_question import InterviewQuestion, InterviewRoundType

client = TestClient(app)


def _fake_question(round_type: InterviewRoundType, question_text="Q") -> InterviewQuestion:
    return InterviewQuestion(id=1, round_type=round_type, question_text=question_text, is_ai_generated=False)


def _fake_analysis(
    recording_id: int,
    communication_scores: list,
    content_scores: list,
    interview_question,
    created_at: datetime,
) -> RecordingAnalysis:
    recording = PracticeRecording(
        id=recording_id, title="t", file_path="x.webm", mime_type="audio/webm",
        file_size_bytes=10, interview_question_id=(interview_question.id if interview_question else None),
    )
    recording.interview_question = interview_question

    analysis = RecordingAnalysis(
        id=recording_id, recording_id=recording_id, provider="gemini",
        analysis_status="analyzed",
        communication_scores=communication_scores,
        content_scores=content_scores,
        created_at=created_at,
    )
    analysis.recording = recording
    return analysis


def test_recording_analytics_separates_content_from_delivery_correctly(monkeypatch):
    """A linked (behavioral) recording contributes to both content and
    delivery for its round; a freeform recording contributes to delivery
    only and must never pollute avg_content_score_pct for any round."""
    from app.repositories.recording_repository import RecordingAnalysisRepository

    behavioral_q = _fake_question(InterviewRoundType.BEHAVIORAL)

    linked = _fake_analysis(
        recording_id=1,
        communication_scores=[{"category": "Clarity", "score": 8, "max_score": 10, "feedback": ""}],
        content_scores=[{"category": "STAR Structure", "score": 4, "max_score": 10, "feedback": ""}],
        interview_question=behavioral_q,
        created_at=datetime(2026, 1, 1),
    )
    freeform = _fake_analysis(
        recording_id=2,
        communication_scores=[{"category": "Clarity", "score": 6, "max_score": 10, "feedback": ""}],
        content_scores=[],
        interview_question=None,
        created_at=datetime(2026, 1, 2),
    )

    monkeypatch.setattr(
        RecordingAnalysisRepository, "get_all_analyzed_ordered_by_date", lambda self: [linked, freeform]
    )
    monkeypatch.setattr(
        "app.repositories.recording_repository.PracticeRecordingRepository.count", lambda self: 2
    )

    res = client.get("/api/v1/recordings/analytics")
    assert res.status_code == 200
    body = res.json()

    assert body["analyzed_count"] == 2
    behavioral = next(r for r in body["by_round"] if r["round_type"] == "behavioral")
    assert behavioral["attempt_count"] == 1
    assert behavioral["avg_content_score_pct"] == 40.0  # 4/10 * 100
    assert behavioral["avg_delivery_score_pct"] == 80.0  # 8/10 * 100 (only the linked one)

    # Delivery trend includes BOTH recordings (delivery is always computable).
    assert len(body["delivery_trend"]) == 2

    # The freeform recording must not create a phantom round entry or corrupt
    # any round's content average.
    for r in body["by_round"]:
        if r["round_type"] != "behavioral":
            assert r["attempt_count"] == 0
            assert r["avg_content_score_pct"] is None

    assert body["weakest_content_category"]["category"] == "STAR Structure"
    assert body["weakest_content_category"]["avg_score_pct"] == 40.0


def test_recording_analytics_by_round_only_counts_analyzed_recordings(monkeypatch):
    """An un-analyzed recording must never appear in a round's attempt_count
    -- the repository method this reads from already filters to
    analysis_status == 'analyzed', so this asserts the service doesn't
    somehow also count un-analyzed ones from elsewhere."""
    from app.repositories.recording_repository import RecordingAnalysisRepository

    hr_q = _fake_question(InterviewRoundType.HR_SCREENING)
    only_analyzed = _fake_analysis(
        recording_id=1,
        communication_scores=[{"category": "Clarity", "score": 9, "max_score": 10, "feedback": ""}],
        content_scores=[{"category": "Professionalism", "score": 9, "max_score": 10, "feedback": ""}],
        interview_question=hr_q,
        created_at=datetime(2026, 1, 1),
    )

    # Simulates: a second HR-screening recording exists but was never
    # analyzed -- get_all_analyzed_ordered_by_date() (already filtered at the
    # DB level) simply wouldn't return it, so the fake list here correctly
    # only contains the one that was actually analyzed.
    monkeypatch.setattr(
        RecordingAnalysisRepository, "get_all_analyzed_ordered_by_date", lambda self: [only_analyzed]
    )
    monkeypatch.setattr(
        "app.repositories.recording_repository.PracticeRecordingRepository.count", lambda self: 2
    )

    res = client.get("/api/v1/recordings/analytics")
    assert res.status_code == 200
    body = res.json()

    assert body["total_recordings"] == 2  # includes the un-analyzed one
    assert body["analyzed_count"] == 1    # but only 1 was actually analyzed

    hr = next(r for r in body["by_round"] if r["round_type"] == "hr_screening")
    assert hr["attempt_count"] == 1


def test_recording_analytics_empty_state_returns_zeros_not_error(monkeypatch):
    from app.repositories.recording_repository import RecordingAnalysisRepository

    monkeypatch.setattr(RecordingAnalysisRepository, "get_all_analyzed_ordered_by_date", lambda self: [])
    monkeypatch.setattr(
        "app.repositories.recording_repository.PracticeRecordingRepository.count", lambda self: 0
    )

    res = client.get("/api/v1/recordings/analytics")
    assert res.status_code == 200
    body = res.json()
    assert body["total_recordings"] == 0
    assert body["analyzed_count"] == 0
    assert body["by_round"] == []
    assert body["delivery_trend"] == []
    assert body["weakest_content_category"] is None
