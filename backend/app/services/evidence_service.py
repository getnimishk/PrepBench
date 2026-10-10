# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Evidence: what the record shows the learner has demonstrated, and how strongly.

"What proves that this learner has actually demonstrated this capability?" Not a
progress dashboard, and not readiness -- "Am I ready to pass?" stays with the
Certification readiness engine, decided from full mocks only.

Every item is read from a persisted row and given one level:

  activity      started, not finished
  completed     finished, but not graded correct -- wrong, not graded, or
                judged only by the learner (self) or by AI
  demonstrated  a graded outcome was correct: against the model, the answer
                key, or a full mock's pass mark
  evidenced     demonstrated, and a persisted artifact supports it -- the
                learner applied it to a changed constraint (transfer), or
                recorded their own explanation

Self-assessed and AI-assessed work is never above completed: neither is
validated. A mock is never above demonstrated, and no item states a readiness
verdict. Drills, question-bank browsing and page visits are not evidence and are
not listed. Rules: docs/implementation/PHASE-6-CONTRACT.md §5.

A read model: nothing is written or stored. Scope as in portfolio_sources.
"""
from typing import Dict, List, Optional

from sqlalchemy.orm import Session, joinedload

from app.models.design_review import DesignReviewAttempt
from app.models.exam_session import ExamSession, ExamStatus
from app.models.learning_attempt import LearningAttempt
from app.models.practice_recording import PracticeRecording
from app.models.roadmap import Roadmap, RoadmapTopic, TopicDemonstration
from app.models.subject import Subject
from app.models.system_design_attempt import SystemDesignAttempt
from app.repositories.learning_attempt_repository import LearningAttemptRepository
from app.repositories.subject_repository import LEARNER, MOCK, session_belongs_to
from app.schemas.evidence import EvidenceCounts, EvidenceItem, EvidenceResponse
from app.services.portfolio_sources import AttemptKind, classify, latest, question_owned_by, roadmap_owned_by

# What each ADF lab stage checks, in the lab's own terms.
_ADF_STAGE = {
    "predict": ("Predict", "Prediction checked against the model's outcome"),
    "reason": ("Reason", "Diagnosis checked against the cause the model found"),
    "apply": ("Apply", "Change checked against the changed constraint, by running the model"),
    "retrieve": ("Retrieve", "Recall answer checked against the experiment's answer"),
}
_SELF_GRADE = {"yes": "yes", "partial": "partly", "not_yet": "not yet"}


def _level(attempt: LearningAttempt) -> str:
    """A learning attempt's level, from the server's own record of it."""
    if attempt.completed_at is None:
        return "activity"
    if attempt.correct is not True:
        return "completed"
    if attempt.transfer is True or (attempt.explanation_text or "").strip():
        return "evidenced"
    return "demonstrated"


def _support(attempt: LearningAttempt) -> List[str]:
    """What, besides a correct answer, the record holds."""
    out = []
    if attempt.transfer is True:
        out.append("applied to a changed constraint")
    if (attempt.explanation_text or "").strip():
        out.append("your explanation is recorded (not graded)")
    return out


class EvidenceService:
    def __init__(self, db: Session):
        self.db = db

    def evidence(self, subject: Optional[Subject]) -> EvidenceResponse:
        subject_id = subject.id if subject is not None else None
        items: List[EvidenceItem] = []
        items += self._learning(subject_id)
        items += self._demonstrations(subject_id)
        items += self._recordings(subject_id)
        if subject is not None:
            items += self._mocks(subject)
        else:
            # These formats have no owner, so they are no preparation's evidence.
            items += self._unowned_formats()
        items.sort(key=lambda i: (i.at is not None, i.at), reverse=True)
        counts = EvidenceCounts()
        for item in items:
            setattr(counts, item.level, getattr(counts, item.level) + 1)
        return EvidenceResponse(subject_id=subject_id, counts=counts, items=items)

    # ---- learning attempts ---------------------------------------------------------------------

    def _learning(self, subject_id: Optional[int]) -> List[EvidenceItem]:
        out: List[EvidenceItem] = []
        for attempt in LearningAttemptRepository(self.db).list_in_scope(subject_id):
            kind = classify(attempt)
            if attempt.committed_at is None and attempt.completed_at is None:
                continue  # opened, nothing done: not even activity worth listing
            out.append(self._attempt_item(attempt, kind))
        return out

    def _attempt_item(self, attempt: LearningAttempt, kind: AttemptKind) -> EvidenceItem:
        level = _level(attempt)
        at = latest(attempt.completed_at, attempt.committed_at, attempt.started_at)
        base = dict(id=f"attempt:{attempt.attempt_uid}", level=level, href=kind.href, at=at, ref=kind.ref)

        if kind.family == "adf_lab":
            stage, check = _ADF_STAGE.get(kind.stage or "", ("Stage", "Checked against the model"))
            return EvidenceItem(**base, source="learning_lab", kind="lab_stage", assessed_by="model",
                                title=kind.title, demonstrates=f"{stage} · run {kind.ref['run']}",
                                basis=self._basis(attempt, check))
        if kind.family == "lakehouse":
            observed = attempt.observed or {}
            engine = isinstance(observed, dict) and observed.get("source") != "simulation" and "ok" in observed
            if attempt.challenge_id.startswith("lakehouse.d."):
                # Station D (P1-2): the learner claims a defect and cites an engine result; the claim is
                # checked against the pack's planted defects. It was never a prediction.
                check = "Defect claim checked against the pack's planted defects, with the engine result you cited"
            elif engine:
                check = "Prediction checked against what the real Delta engine did"
            else:
                check = "Prediction checked against the model's simulation"
            return EvidenceItem(**base, source="learning_lab", kind="lakehouse_challenge", assessed_by="model",
                                title=kind.title, demonstrates="Lakehouse Lab challenge",
                                basis=self._basis(attempt, check))
        if kind.family == "scenario_check":
            return EvidenceItem(**base, source="scenarios", kind="scenario_check", assessed_by="answer_key",
                                title=kind.title, demonstrates=f"Check question {int(kind.ref['check']) + 1}",
                                basis=self._basis(attempt, "Answer checked against the scenario's answer key"))
        if kind.family == "scenario_lens":
            basis = ("Case notes committed; the debrief compares them with the experts' view and is not graded"
                     if attempt.completed_at else "Case notes started, not committed")
            return EvidenceItem(**base, source="scenarios", kind="scenario_lens", assessed_by="not_assessed",
                                title=kind.title, demonstrates=f"{kind.ref['role'].upper()} lens", basis=basis)
        if kind.family == "chart_sandbox":
            return EvidenceItem(**base, source="learning_lab", kind="sandbox_prediction", assessed_by="model",
                                title=kind.title, demonstrates="Chart Sandbox prediction",
                                basis=self._basis(attempt, "Prediction checked against the simulation"))
        return EvidenceItem(**base, source="learning_lab", kind="learning_attempt", assessed_by="model",
                            title=kind.title, demonstrates=None,
                            basis=self._basis(attempt, "Answer checked by the activity that recorded it"))

    @staticmethod
    def _basis(attempt: LearningAttempt, check: str) -> str:
        if attempt.completed_at is None:
            return "Prediction committed; not finished yet"
        if attempt.correct is None:
            return f"{check}: no verdict was recorded"
        if attempt.correct is False:
            return f"{check}: not correct"
        support = _support(attempt)
        return f"{check}: correct" + (f"; {', '.join(support)}" if support else "")

    # ---- roadmap: topic demonstrations ---------------------------------------------------------

    def _demonstrations(self, subject_id: Optional[int]) -> List[EvidenceItem]:
        rows = roadmap_owned_by(
            self.db.query(TopicDemonstration, RoadmapTopic, Roadmap)
            .join(RoadmapTopic, TopicDemonstration.topic_id == RoadmapTopic.id)
            .join(Roadmap, RoadmapTopic.roadmap_id == Roadmap.id),
            subject_id,
        ).all()
        return [
            EvidenceItem(
                id=f"topic_demonstration:{d.id}", source="roadmap", kind="topic_demonstration",
                level="completed", assessed_by="self", title=topic.title, demonstrates=roadmap.title,
                basis=(f"Written demonstration, self-graded '{_SELF_GRADE.get(d.self_grade, d.self_grade)}'. "
                       "Self-assessment is not verified, so it does not count as demonstrated"),
                href=f"/roadmaps/{roadmap.id}/topics/{topic.id}/demonstrate", at=d.created_at,
            )
            for d, topic, roadmap in rows
        ]

    # ---- interview: recordings ------------------------------------------------------------------

    def _recordings(self, subject_id: Optional[int]) -> List[EvidenceItem]:
        query = self.db.query(PracticeRecording).outerjoin(PracticeRecording.interview_question)
        if subject_id is None:
            query = query.filter((PracticeRecording.interview_question_id.is_(None)) | question_owned_by(None))
        else:
            query = query.filter(question_owned_by(subject_id))
        out: List[EvidenceItem] = []
        for r in query.options(joinedload(PracticeRecording.analysis)).all():
            analysed = r.analysis is not None and r.analysis.analysis_status == "analyzed"
            out.append(EvidenceItem(
                id=f"recording:{r.id}", source="interview", kind="recording", level="completed",
                assessed_by="ai" if analysed else "not_assessed", title=r.title or "Practice recording",
                demonstrates=r.interview_question.question_text[:140] if r.interview_question else None,
                basis=("Spoken answer recorded; an AI analysis is available, which is not a verified grade"
                       if analysed else "Spoken answer recorded; not analysed"),
                href=f"/recordings/{r.id}", at=r.created_at,
            ))
        return out

    # ---- certification: full mocks only ---------------------------------------------------------

    def _mocks(self, subject: Subject) -> List[EvidenceItem]:
        sessions = (
            self.db.query(ExamSession)
            .filter(ExamSession.status == ExamStatus.COMPLETED, ExamSession.source == LEARNER,
                    ExamSession.session_kind == MOCK, session_belongs_to(subject))
            .all()
        )
        out: List[EvidenceItem] = []
        # The preparation's pass mark -- the one the readiness engine judges every mock by
        # (readiness.py) -- not the mark a session stored when it was sat. Evidence must not
        # call a mock passed that Certification calls failed, or the other way round.
        pass_mark = subject.pass_mark
        for s in sessions:
            score = s.score_percentage
            if score is None:
                level, basis = "completed", "Full mock finished; not scored"
            elif pass_mark is None:
                level, basis = "completed", f"Scored {score:.0f}% on a full mock; no pass mark is set, so it is not judged"
            elif score >= pass_mark:
                level, basis = "demonstrated", f"Scored {score:.0f}% on a full mock, at or above the {pass_mark:.0f}% pass mark"
            else:
                level, basis = "completed", f"Scored {score:.0f}% on a full mock, below the {pass_mark:.0f}% pass mark"
            out.append(EvidenceItem(
                id=f"mock:{s.id}", source="certification", kind="mock_exam", level=level, assessed_by="exam",
                title=s.title or "Full mock", demonstrates="Exam performance under timed conditions",
                basis=basis + ". Readiness to pass is decided on Certification, not here",
                href=f"/exam-review/{s.id}", at=s.end_time or s.start_time,
            ))
        return out

    # ---- formats with no owner: shown only with no preparation ---------------------------------

    def _unowned_formats(self) -> List[EvidenceItem]:
        out: List[EvidenceItem] = []
        for a in self.db.query(SystemDesignAttempt).options(joinedload(SystemDesignAttempt.prompt)).all():
            graded = a.grading_status == "graded"
            out.append(EvidenceItem(
                id=f"system_design:{a.id}", source="interview", kind="system_design", level="completed",
                assessed_by="ai" if graded else "not_assessed",
                title=a.prompt.title if a.prompt else "System design answer", demonstrates="System design answer",
                basis=("Answer submitted; graded by AI, which is not a verified grade" if graded
                       else "Answer submitted; not graded"),
                href=f"/system-design/attempts/{a.id}", at=a.created_at,
            ))
        verdicts: Dict[str, str] = {"named": "named the deciding axis", "partial": "partly named the deciding axis",
                                    "missed": "missed the deciding axis"}
        for r in self.db.query(DesignReviewAttempt).options(joinedload(DesignReviewAttempt.review)).all():
            graded = r.grading_status == "graded" and r.axis_verdict
            out.append(EvidenceItem(
                id=f"design_review:{r.id}", source="interview", kind="design_review", level="completed",
                assessed_by="ai" if graded else "not_assessed",
                title=r.review.title if r.review else "Design review", demonstrates="Design review call",
                basis=(f"Call made; AI judged it {verdicts.get(r.axis_verdict, r.axis_verdict)}, which is not a verified grade"
                       if graded else "Call made; not graded"),
                href=f"/design-reviews/{r.review_id}", at=r.created_at,
            ))
        return out
