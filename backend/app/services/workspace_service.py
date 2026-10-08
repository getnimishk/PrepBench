# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Workspace: where the learner's own work is.

"Where does the learner create, investigate, inspect, compare and keep useful
artifacts?" -- answered from what the features already keep: lab runs, scenario
case notes, prepared interview answers, recordings, topic guides and notes, and
(for work that belongs to no preparation) system design answers, design review
calls and Chart Sandbox runs. Each item links back to where it lives, to be
continued there.

A read model: it writes nothing and stores nothing. Something is listed only when
the learner made something -- an attempt needs at least a committed prediction;
a visited page is not work.

Scope: a preparation id, or None for work that belongs to no preparation. See
portfolio_sources for what owns what.
"""
from typing import Dict, List, Optional

from sqlalchemy.orm import Session, joinedload

from app.models.design_review import DesignReviewAttempt
from app.models.interview_question import InterviewQuestion
from app.models.practice_recording import PracticeRecording
from app.models.roadmap import Roadmap, RoadmapTopic, TopicGuideSection
from app.models.system_design_attempt import SystemDesignAttempt
from app.models.system_design_draft import SystemDesignDraft
from app.repositories.learning_attempt_repository import LearningAttemptRepository
from app.schemas.workspace import WorkspaceItem, WorkspaceResponse
from app.services.portfolio_sources import (
    adf_runs, classify, excerpt, latest, question_owned_by, roadmap_owned_by,
)

_STAGES = ("predict", "reason", "apply", "retrieve")
_SYSTEM_DESIGN_STATUS = {"graded": "Graded", "not_graded": "Not graded", "unavailable": "Not graded",
                         "error": "Grading failed"}


class WorkspaceService:
    def __init__(self, db: Session):
        self.db = db

    def workspace(self, subject_id: Optional[int]) -> WorkspaceResponse:
        items: List[WorkspaceItem] = []
        items += self._learning(subject_id)
        items += self._interview(subject_id)
        items += self._roadmap(subject_id)
        if subject_id is None:
            # These formats have no owner, so they belong to no preparation's workspace.
            items += self._unowned_formats()
        items.sort(key=lambda i: (i.updated_at is not None, i.updated_at), reverse=True)
        return WorkspaceResponse(subject_id=subject_id, items=items)

    # ---- learning attempts: labs, scenarios, the Chart Sandbox --------------------------------

    def _learning(self, subject_id: Optional[int]) -> List[WorkspaceItem]:
        rows = [(a, classify(a)) for a in LearningAttemptRepository(self.db).list_in_scope(subject_id)]
        out: List[WorkspaceItem] = []

        for (track, run), stages in adf_runs(rows).items():
            predict = stages.get("predict")
            if predict is None or predict.committed_at is None:
                continue
            kind = classify(predict)
            finished = sum(1 for s in _STAGES if stages.get(s) is not None and stages[s].completed_at)
            out.append(WorkspaceItem(
                id=f"lab_run:{predict.subject_id}:{track}:{run}",
                kind="lab_run", source="learning_lab", title=kind.title, context=f"Run {run}",
                excerpt=excerpt(predict.explanation_text),
                detail=f"{finished} of 4 graded stages finished",
                href=kind.href,
                updated_at=latest(*(x for s in stages.values() for x in (s.completed_at, s.committed_at, s.started_at))),
                ref={"track": track, "run": run},
            ))

        for attempt, kind in rows:
            if attempt.committed_at is None or kind.family in ("adf_lab", "scenario_check", "other"):
                continue
            when = latest(attempt.completed_at, attempt.committed_at, attempt.started_at)
            if kind.family == "lakehouse":
                out.append(WorkspaceItem(
                    id=f"attempt:{attempt.attempt_uid}", kind="lakehouse_challenge", source="learning_lab",
                    title=kind.title, excerpt=excerpt(attempt.explanation_text),
                    detail="Result recorded" if attempt.completed_at else "Prediction committed",
                    href=kind.href, updated_at=when, ref=kind.ref,
                ))
            elif kind.family == "scenario_lens":
                out.append(WorkspaceItem(
                    id=f"attempt:{attempt.attempt_uid}", kind="scenario_notes", source="scenarios",
                    title=kind.title, context=f"{kind.ref['role'].upper()} lens",
                    excerpt=excerpt(attempt.explanation_text), detail="Case notes committed",
                    href=kind.href, updated_at=when, ref=kind.ref,
                ))
            elif kind.family == "chart_sandbox":
                out.append(WorkspaceItem(
                    id=f"attempt:{attempt.attempt_uid}", kind="sandbox_run", source="learning_lab",
                    title=kind.title, excerpt=excerpt(attempt.explanation_text),
                    detail="Result recorded" if attempt.completed_at else "Prediction committed",
                    href=kind.href, updated_at=when, ref=kind.ref,
                ))
        return out

    # ---- interview: prepared answers and recordings -------------------------------------------

    def _interview(self, subject_id: Optional[int]) -> List[WorkspaceItem]:
        out: List[WorkspaceItem] = []
        questions = (
            self.db.query(InterviewQuestion)
            .filter(question_owned_by(subject_id), InterviewQuestion.prepared_answer.isnot(None))
            .all()
        )
        for q in questions:
            if not (q.prepared_answer or "").strip():
                continue
            points = len(q.key_talking_points or [])
            out.append(WorkspaceItem(
                id=f"interview_answer:{q.id}", kind="interview_answer", source="interview",
                title=excerpt(q.question_text, 140) or "Interview question",
                excerpt=excerpt(q.prepared_answer),
                detail=f"{points} key talking point{'' if points == 1 else 's'}" if points else None,
                href="/interview-practice/library", updated_at=q.created_at,
            ))

        recordings = self.db.query(PracticeRecording).outerjoin(PracticeRecording.interview_question)
        if subject_id is None:
            recordings = recordings.filter(
                (PracticeRecording.interview_question_id.is_(None)) | question_owned_by(None)
            )
        else:
            recordings = recordings.filter(question_owned_by(subject_id))
        for r in recordings.options(joinedload(PracticeRecording.analysis)).all():
            analysed = r.analysis is not None and r.analysis.analysis_status == "analyzed"
            out.append(WorkspaceItem(
                id=f"recording:{r.id}", kind="recording", source="interview",
                title=r.title or "Practice recording",
                context=excerpt(r.interview_question.question_text, 140) if r.interview_question else None,
                excerpt=excerpt(r.plan_note),
                detail="AI analysis available" if analysed else "Not analysed",
                href=f"/recordings/{r.id}", updated_at=r.created_at,
            ))
        return out

    # ---- roadmap: topic guides and notes ------------------------------------------------------

    def _roadmap(self, subject_id: Optional[int]) -> List[WorkspaceItem]:
        out: List[WorkspaceItem] = []
        sections = roadmap_owned_by(
            self.db.query(TopicGuideSection, RoadmapTopic, Roadmap)
            .join(RoadmapTopic, TopicGuideSection.topic_id == RoadmapTopic.id)
            .join(Roadmap, RoadmapTopic.roadmap_id == Roadmap.id),
            subject_id,
        ).all()
        by_topic: Dict[int, dict] = {}
        for section, topic, roadmap in sections:
            entry = by_topic.setdefault(topic.id, {"topic": topic, "roadmap": roadmap, "learner": 0, "course": 0,
                                                   "ai": 0, "at": None, "first": None})
            # Each provenance counted as itself: a course lesson is not the learner's
            # writing, and an AI draft is neither (Phase 7, D2).
            entry[section.source if section.source in ("learner", "course", "ai") else "learner"] += 1
            entry["at"] = latest(entry["at"], section.updated_at, section.edited_at, section.created_at)
            entry["first"] = entry["first"] or section.title
        for topic_id, e in by_topic.items():
            parts = []
            if e["learner"]:
                parts.append(f"{e['learner']} written by you")
            if e["course"]:
                parts.append(f"{e['course']} course lesson{'' if e['course'] == 1 else 's'}")
            if e["ai"]:
                parts.append(f"{e['ai']} AI draft{'' if e['ai'] == 1 else 's'}")
            total = e["learner"] + e["course"] + e["ai"]
            out.append(WorkspaceItem(
                id=f"topic_guide:{topic_id}", kind="topic_guide", source="roadmap",
                title=e["topic"].title, context=e["roadmap"].title,
                excerpt=excerpt(e["first"]),
                detail=f"{total} section{'' if total == 1 else 's'}: " + ", ".join(parts),
                href=f"/roadmaps/{e['roadmap'].id}/topics/{topic_id}/guide", updated_at=e["at"],
            ))

        notes = roadmap_owned_by(
            self.db.query(RoadmapTopic, Roadmap)
            .join(Roadmap, RoadmapTopic.roadmap_id == Roadmap.id)
            .filter(RoadmapTopic.evidence_notes.isnot(None)),
            subject_id,
        ).all()
        for topic, roadmap in notes:
            if not (topic.evidence_notes or "").strip():
                continue
            out.append(WorkspaceItem(
                id=f"topic_note:{topic.id}", kind="topic_note", source="roadmap",
                title=topic.title, context=roadmap.title, excerpt=excerpt(topic.evidence_notes),
                href=f"/roadmaps/{roadmap.id}/topics/{topic.id}", updated_at=topic.updated_at,
            ))
        return out

    # ---- formats with no owner: shown only with no preparation --------------------------------

    def _unowned_formats(self) -> List[WorkspaceItem]:
        out: List[WorkspaceItem] = []
        for a in self.db.query(SystemDesignAttempt).options(joinedload(SystemDesignAttempt.prompt)).all():
            out.append(WorkspaceItem(
                id=f"system_design:{a.id}", kind="system_design_answer", source="interview",
                title=a.prompt.title if a.prompt else "System design answer",
                excerpt=excerpt(a.answer_text),
                detail=f"Submitted · {_SYSTEM_DESIGN_STATUS.get(a.grading_status, 'Not graded')}",
                href=f"/system-design/attempts/{a.id}", updated_at=a.created_at,
            ))
        for d in self.db.query(SystemDesignDraft).options(joinedload(SystemDesignDraft.prompt)).all():
            out.append(WorkspaceItem(
                id=f"system_design_draft:{d.id}", kind="system_design_answer", source="interview",
                title=d.prompt.title if d.prompt else "System design draft",
                excerpt=excerpt(d.answer_text), detail="Draft, not submitted",
                href=f"/system-design/{d.prompt_id}/answer", updated_at=latest(d.updated_at, d.created_at),
            ))
        for r in self.db.query(DesignReviewAttempt).options(joinedload(DesignReviewAttempt.review)).all():
            choice = {"A": "Chose A", "B": "Chose B"}.get(r.choice, "Asked first")
            out.append(WorkspaceItem(
                id=f"design_review:{r.id}", kind="design_review_call", source="interview",
                title=r.review.title if r.review else "Design review",
                excerpt=excerpt(r.justification), detail=choice,
                href=f"/design-reviews/{r.review_id}", updated_at=r.created_at,
            ))
        return out
