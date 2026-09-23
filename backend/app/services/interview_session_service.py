# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Interview sessions: a round, a few questions, least-practised first.

Selection is deterministic -- fewest takes first, then longest since practised,
then bank order -- so the questions the setup page previews are the questions the
session asks. A take is a PracticeRecording with session_id set; a retake is
another one, and the session's report reads the latest take of each question.
"""
from datetime import UTC, datetime
from typing import List, Optional

from sqlalchemy.orm import Session

from app.core.exceptions import InvalidExamStateException, ResourceNotFoundException
from app.models.interview_question import InterviewQuestion, InterviewRoundType
from app.models.interview_session import InterviewSession
from app.models.practice_recording import PracticeRecording
from app.services.interview_question_service import ROUND_TYPE_LABELS, practice_counts
from app.services.interview_rounds import rule_for
from app.services.recording_analysis_service import RecordingAnalysisService


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _label(round_type: str) -> str:
    try:
        return ROUND_TYPE_LABELS[InterviewRoundType(round_type)]
    except ValueError:
        return round_type


class InterviewSessionService:
    def __init__(self, db: Session):
        self.db = db

    # ---- choosing the questions -------------------------------------------------

    def plan(self, round_type: InterviewRoundType, category: Optional[str], count: int) -> List[dict]:
        query = self.db.query(InterviewQuestion).filter(InterviewQuestion.round_type == round_type)
        if category:
            query = query.filter(InterviewQuestion.category == category)
        questions = query.order_by(InterviewQuestion.id.asc()).all()
        counts = practice_counts(self.db, [q.id for q in questions])

        def order(q):
            taken, last = counts.get(q.id, (0, None))
            # Never practised sorts before any date; then oldest practice first.
            return (taken, last is not None, last or datetime.min, q.id)

        # In real interviews, general sessions start with an introduction/elevator pitch
        # (e.g. "Tell me about yourself" / "Walk me through your background").
        # If an introduction question exists for this round and the session is not
        # narrowed to a specific category, place the least-practised intro question first.
        if not category and count > 0:
            intro_qs = [q for q in questions if (q.category or "").lower() == "introduction"]
            if intro_qs:
                sorted_intro = sorted(intro_qs, key=order)
                chosen_intro = sorted_intro[0]
                remaining_qs = [q for q in questions if q.id != chosen_intro.id]
                sorted_remaining = sorted(remaining_qs, key=order)
                chosen = [chosen_intro] + sorted_remaining[:count - 1]
            else:
                chosen = sorted(questions, key=order)[:count]
        else:
            chosen = sorted(questions, key=order)[:count]
        return [
            {
                "id": q.id,
                "question_text": q.question_text,
                "category": q.category,
                "practice_count": counts.get(q.id, (0, None))[0],
                "last_practised_at": counts.get(q.id, (0, None))[1],
            }
            for q in chosen
        ]

    def create(self, round_type: InterviewRoundType, category: Optional[str], count: int, thinking: bool) -> dict:
        planned = self.plan(round_type, category, count)
        if not planned:
            where = f" in {category}" if category else ""
            raise InvalidExamStateException(
                f"There are no {_label(round_type.value)} questions{where} yet. "
                "Import some into the question library, or write one."
            )
        session = InterviewSession(
            round_type=round_type.value,
            category=category or None,
            question_ids=[q["id"] for q in planned],
            thinking_seconds=rule_for(round_type.value)["thinking_seconds"] if thinking else 0,
            created_at=_now(),
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return self.get(session.id)

    # ---- reading one ---------------------------------------------------------------

    def _session(self, session_id: int) -> InterviewSession:
        session = self.db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
        if session is None:
            raise ResourceNotFoundException("InterviewSession", session_id)
        return session

    def get(self, session_id: int) -> dict:
        session = self._session(session_id)
        ids = list(session.question_ids or [])
        questions = {
            q.id: q for q in self.db.query(InterviewQuestion).filter(InterviewQuestion.id.in_(ids)).all()
        } if ids else {}
        counts = practice_counts(self.db, ids)
        takes = (
            self.db.query(PracticeRecording)
            .filter(PracticeRecording.session_id == session.id)
            .order_by(PracticeRecording.created_at.asc(), PracticeRecording.id.asc())
            .all()
        )
        rule = rule_for(session.round_type)

        out_questions = []
        for qid in ids:
            q = questions.get(qid)
            if q is None:
                # Deleted from the library since the session began. Its takes
                # keep the recording; the question itself cannot be shown.
                continue
            taken, last = counts.get(qid, (0, None))
            out_questions.append({
                "id": q.id,
                "question_text": q.question_text,
                "category": q.category,
                "practice_count": taken,
                "last_practised_at": last,
                "takes": [self._take(r) for r in takes if r.interview_question_id == qid],
            })

        return {
            "id": session.id,
            "round_type": session.round_type,
            "round_label": _label(session.round_type),
            "category": session.category,
            "thinking_seconds": session.thinking_seconds,
            "target_min_seconds": rule["target_seconds"][0],
            "target_max_seconds": rule["target_seconds"][1],
            "plan_prompt": rule["plan_prompt"],
            "listening_for": rule["listening_for"],
            "created_at": session.created_at,
            "ended_at": session.ended_at,
            "questions": out_questions,
        }

    @staticmethod
    def _take(recording: PracticeRecording) -> dict:
        analysis = recording.analysis
        analysed = analysis is not None and analysis.analysis_status == "analyzed"
        return {
            "recording_id": recording.id,
            "interview_question_id": recording.interview_question_id,
            "duration_seconds": recording.duration_seconds,
            "created_at": recording.created_at,
            "analysis_status": analysis.analysis_status if analysis is not None else None,
            "content_percent": RecordingAnalysisService._avg_pct(analysis.content_scores or []) if analysed else None,
            "delivery_percent": RecordingAnalysisService._avg_pct(analysis.communication_scores or []) if analysed else None,
        }

    def finish(self, session_id: int) -> dict:
        session = self._session(session_id)
        if session.ended_at is None:
            session.ended_at = _now()
            self.db.commit()
        return self.get(session_id)

    # ---- the report ----------------------------------------------------------------------

    def report(self, session_id: int) -> dict:
        data = self.get(session_id)
        latest = {}
        for q in data["questions"]:
            if q["takes"]:
                latest[q["id"]] = q["takes"][-1]

        recordings = {
            r.id: r for r in self.db.query(PracticeRecording)
            .filter(PracticeRecording.id.in_([t["recording_id"] for t in latest.values()]))
            .all()
        } if latest else {}

        analysed = [t for t in latest.values() if t["analysis_status"] == "analyzed"]
        content = [t["content_percent"] for t in analysed if t["content_percent"] is not None]
        delivery = [t["delivery_percent"] for t in analysed if t["delivery_percent"] is not None]

        # The weakest rubric category across the analysed answers, by its average.
        by_category: dict = {}
        for take in analysed:
            analysis = recordings[take["recording_id"]].analysis
            for score in analysis.content_scores or []:
                max_score = float(score.get("max_score", 10.0)) or 10.0
                by_category.setdefault(score.get("category"), []).append(
                    float(score.get("score", 0)) / max_score * 100.0
                )
        weakest = None
        if by_category:
            name, values = min(by_category.items(), key=lambda kv: (sum(kv[1]) / len(kv[1]), kv[0] or ""))
            weakest = (name, round(sum(values) / len(values), 1))

        reason = None
        if latest and not analysed:
            statuses = {t["analysis_status"] for t in latest.values()}
            if "unavailable" in statuses:
                reason = "No AI provider that can analyse audio is set up, so these answers are saved but not graded."
            elif "error" in statuses:
                reason = "Analysis failed for these answers. They are saved; run the analysis again from each answer."
            else:
                reason = "These answers have not been analysed yet."

        return {
            "session": data,
            "total_questions": len(data["questions"]),
            "answered": len(latest),
            "analysed": len(analysed),
            "spoken_seconds": sum(t["duration_seconds"] or 0 for t in latest.values()),
            "content_percent": round(sum(content) / len(content), 1) if content else None,
            "delivery_percent": round(sum(delivery) / len(delivery), 1) if delivery else None,
            "weakest_category": weakest[0] if weakest else None,
            "weakest_category_percent": weakest[1] if weakest else None,
            "not_graded_reason": reason,
        }
