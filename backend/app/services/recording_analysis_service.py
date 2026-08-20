from typing import List, Optional
from sqlalchemy.orm import Session

from app.core.exceptions import ResourceNotFoundException
from app.core.config import DATA_DIR
from app.core.logging_config import logger
from app.repositories.recording_repository import PracticeRecordingRepository, RecordingAnalysisRepository
from app.repositories.interview_question_repository import InterviewQuestionRepository
from app.services.recording_analysis_providers import get_analysis_provider, list_providers, QuestionContext
from app.services.interview_question_service import ROUND_TYPE_LABELS
from app.models.interview_question import InterviewRoundType
from app.schemas.recording import (
    RecordingAnalysisResponse,
    RecordingCommunicationScore,
    RecordingAnalytics,
    RoundAnalyticsItem,
    WeakestContentCategory,
)
from app.schemas.analytics import ScoreTrendPoint

RECORDINGS_DIR = DATA_DIR / "recordings"

# Every failure/unavailable path persists this exact shape -- empty scores,
# no fabricated content -- kept as one constant so every early-return below
# stays byte-for-byte consistent (this is what earlier "no fabrication" bugs
# elsewhere in this app came from: two call sites drifting apart over time).
_EMPTY_RESULT_FIELDS = dict(
    transcript=None,
    communication_scores=[],
    filler_word_count=None,
    summary=None,
    content_scores=[],
    content_summary=None,
)


class RecordingAnalysisService:
    def __init__(self, db: Session):
        self.db = db
        self.recording_repo = PracticeRecordingRepository(db)
        self.analysis_repo = RecordingAnalysisRepository(db)
        self.question_repo = InterviewQuestionRepository(db)

    def list_providers(self) -> list:
        return list_providers(db=self.db)

    def analyze_recording(self, recording_id: int, provider_name: Optional[str] = None) -> RecordingAnalysisResponse:
        recording = self.recording_repo.get_by_id(recording_id)
        if not recording:
            raise ResourceNotFoundException("PracticeRecording", recording_id)

        file_path = RECORDINGS_DIR / recording.file_path
        if not file_path.exists():
            raise ResourceNotFoundException("PracticeRecording file on disk", recording_id)

        try:
            provider = get_analysis_provider(provider_name, db=self.db)
        except ValueError as e:
            saved = self.analysis_repo.upsert(
                recording_id,
                provider=provider_name,
                analysis_status="error",
                analysis_error=str(e),
                **_EMPTY_RESULT_FIELDS,
            )
            return RecordingAnalysisResponse.model_validate(saved)

        if not provider.is_available():
            saved = self.analysis_repo.upsert(
                recording_id,
                provider=provider.name,
                analysis_status="unavailable",
                analysis_error=(
                    f"Provider '{provider.name}' cannot analyse recordings right now. "
                    "No configured AI provider supports audio analysis."
                ),
                **_EMPTY_RESULT_FIELDS,
            )
            return RecordingAnalysisResponse.model_validate(saved)

        # Only build question context (and therefore only request content
        # grading) when this recording is linked to a real interview
        # question. A freeform/"General Practice" recording (no link) must
        # get exactly today's delivery-only behavior -- this is the
        # backward-compatibility guarantee.
        question_context: Optional[QuestionContext] = None
        if recording.interview_question_id is not None:
            question = self.question_repo.get_by_id(recording.interview_question_id)
            if question:
                question_context = {
                    "round_type": question.round_type.value if hasattr(question.round_type, "value") else str(question.round_type),
                    "question_text": question.question_text,
                }

        audio_bytes = file_path.read_bytes()
        parsed, error_msg = provider.analyze(audio_bytes, recording.mime_type, question_context)

        if not parsed or error_msg:
            logger.warning(f"Recording analysis failed (provider={provider.name}): {error_msg}")
            saved = self.analysis_repo.upsert(
                recording_id,
                provider=provider.name,
                analysis_status="error",
                analysis_error=error_msg or "Unknown analysis error",
                **_EMPTY_RESULT_FIELDS,
            )
            return RecordingAnalysisResponse.model_validate(saved)

        communication_scores = self._parse_scores(parsed.get("communication_scores"))
        filler_count = parsed.get("filler_word_count")
        try:
            filler_count = int(filler_count) if filler_count is not None else None
        except (TypeError, ValueError):
            filler_count = None

        # content_scores only get parsed/persisted if a question was attached
        # -- if question_context was None, we never asked the provider for
        # content grading in the first place, so parsed.get("content_scores")
        # should be empty/absent, but defensively re-derive from
        # question_context rather than trusting the LLM's response shape.
        content_scores = self._parse_scores(parsed.get("content_scores")) if question_context else []
        content_summary = str(parsed.get("content_summary") or "") if question_context and parsed.get("content_summary") else None

        saved = self.analysis_repo.upsert(
            recording_id,
            provider=provider.name,
            analysis_status="analyzed",
            analysis_error=None,
            transcript=str(parsed.get("transcript") or ""),
            communication_scores=[s.model_dump() for s in communication_scores],
            filler_word_count=filler_count,
            summary=str(parsed.get("summary") or ""),
            content_scores=[s.model_dump() for s in content_scores],
            content_summary=content_summary,
        )
        return RecordingAnalysisResponse.model_validate(saved)

    def _parse_scores(self, raw) -> List[RecordingCommunicationScore]:
        if not isinstance(raw, list):
            return []
        out = []
        for item in raw:
            if not isinstance(item, dict):
                continue
            try:
                max_score = float(item.get("max_score", 10.0))
                score = max(0.0, min(max_score, float(item.get("score", 0.0))))
                out.append(RecordingCommunicationScore(
                    category=str(item.get("category", "Unknown")),
                    score=score,
                    max_score=max_score,
                    feedback=str(item.get("feedback", "")),
                ))
            except (TypeError, ValueError):
                continue
        return out

    def get_analysis(self, recording_id: int) -> Optional[RecordingAnalysisResponse]:
        obj = self.analysis_repo.get_by_recording_id(recording_id)
        if not obj:
            return None
        return RecordingAnalysisResponse.model_validate(obj)

    # ---- Analytics -------------------------------------------------------

    @staticmethod
    def _avg_pct(scores: list) -> Optional[float]:
        """Average (score/max_score) across a list of {score, max_score} dicts,
        scaled to 0-100. None for an empty list -- never fabricate a percentage
        for a recording/round with nothing graded."""
        if not scores:
            return None
        ratios = [
            (float(s.get("score", 0)) / float(s.get("max_score", 10.0))) * 100.0
            for s in scores if float(s.get("max_score", 10.0)) > 0
        ]
        return round(sum(ratios) / len(ratios), 1) if ratios else None

    def get_analytics(self) -> RecordingAnalytics:
        total_recordings = self.recording_repo.count()
        analyzed = self.analysis_repo.get_all_analyzed_ordered_by_date()  # oldest-first

        if not analyzed:
            return RecordingAnalytics(
                total_recordings=total_recordings,
                analyzed_count=0,
                by_round=[],
                delivery_trend=[],
                weakest_content_category=None,
            )

        # Per-round accumulators, seeded with all 4 round types so every round
        # appears in the response even with zero recordings (attempt_count=0,
        # avg scores None) -- lets the frontend render a full 4-card grid
        # without conditionally hiding rounds nobody has practiced yet.
        round_content_scores: dict = {rt.value: [] for rt in InterviewRoundType}
        round_delivery_pcts: dict = {rt.value: [] for rt in InterviewRoundType}
        round_counts: dict = {rt.value: 0 for rt in InterviewRoundType}

        # Content-category accumulation across ALL rounds combined, to find
        # the single weakest category app-wide.
        category_sums: dict = {}
        category_counts: dict = {}
        category_round: dict = {}

        delivery_trend: List[ScoreTrendPoint] = []
        running_delivery: List[float] = []

        for a in analyzed:
            recording = a.recording
            question = recording.interview_question if recording else None
            round_type = question.round_type.value if question else None

            delivery_pct = self._avg_pct(a.communication_scores or [])
            if delivery_pct is not None:
                running_delivery.append(delivery_pct)
                rolling = sum(running_delivery[-5:]) / len(running_delivery[-5:])
                delivery_trend.append(ScoreTrendPoint(
                    date=a.created_at.strftime("%b %d"),
                    score=delivery_pct,
                    rolling_avg=round(rolling, 1),
                    exam_title=ROUND_TYPE_LABELS.get(question.round_type, "General Practice") if question else "General Practice",
                ))

            if round_type is not None:
                round_counts[round_type] += 1
                if delivery_pct is not None:
                    round_delivery_pcts[round_type].append(delivery_pct)
                if a.content_scores:
                    round_content_scores[round_type].append(self._avg_pct(a.content_scores))
                    for c in a.content_scores:
                        name = c.get("category")
                        if not name:
                            continue
                        pct = (float(c.get("score", 0)) / float(c.get("max_score", 10.0))) * 100.0 if float(c.get("max_score", 10.0)) > 0 else None
                        if pct is None:
                            continue
                        category_sums[name] = category_sums.get(name, 0.0) + pct
                        category_counts[name] = category_counts.get(name, 0) + 1
                        category_round.setdefault(name, round_type)

        by_round = []
        for rt in InterviewRoundType:
            content_list = [v for v in round_content_scores[rt.value] if v is not None]
            delivery_list = round_delivery_pcts[rt.value]
            by_round.append(RoundAnalyticsItem(
                round_type=rt.value,
                round_label=ROUND_TYPE_LABELS[rt],
                attempt_count=round_counts[rt.value],
                avg_content_score_pct=round(sum(content_list) / len(content_list), 1) if content_list else None,
                avg_delivery_score_pct=round(sum(delivery_list) / len(delivery_list), 1) if delivery_list else None,
            ))

        weakest_content_category = None
        if category_sums:
            weakest_name = min(category_sums, key=lambda n: category_sums[n] / category_counts[n])
            weakest_round = category_round[weakest_name]
            weakest_content_category = WeakestContentCategory(
                category=weakest_name,
                round_label=ROUND_TYPE_LABELS.get(InterviewRoundType(weakest_round), weakest_round),
                avg_score_pct=round(category_sums[weakest_name] / category_counts[weakest_name], 1),
            )

        return RecordingAnalytics(
            total_recordings=total_recordings,
            analyzed_count=len(analyzed),
            by_round=by_round,
            delivery_trend=delivery_trend,
            weakest_content_category=weakest_content_category,
        )
