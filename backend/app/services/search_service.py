# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
One search box over everything a preparation holds.

Search used to exist only inside the Question Bank and the interview library, so
finding where a concept was written about meant guessing which screen it lived on.

Scoping follows the rules each area already has, rather than a new one:

  Questions  the preparation's own, through the Question Bank's own filter, so
             "see all N in the Question Bank" lands on exactly N.
  Guides,    the preparation's roadmaps plus the roadmaps linked to no
  roadmaps,  preparation, which the roadmap list also shows (labelled) rather
  topics     than hides. Archived roadmaps are left out, as the list leaves them.
  Recordings every take, whichever preparation is picked: a recording belongs
             to no preparation, and filing it under one would be invented.
"""
import re
from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.exceptions import InvalidExamStateException, ResourceNotFoundException
from app.core.text_match import LIKE_ESCAPE, contains_pattern
from app.models.interview_question import InterviewQuestion
from app.models.practice_recording import PracticeRecording
from app.models.recording_analysis import RecordingAnalysis
from app.models.roadmap import Roadmap, RoadmapPhase, RoadmapTopic, TopicGuideSection
from app.models.subject import Subject
from app.repositories.question_repository import QuestionRepository
from app.repositories.subject_repository import SubjectRepository
from app.schemas.question import QuestionFilter
from app.schemas.search import (
    GuideSectionHit,
    GuideSectionResults,
    QuestionHit,
    QuestionResults,
    RecordingHit,
    RecordingResults,
    RoadmapHit,
    RoadmapResults,
    SearchResponse,
    TopicHit,
    TopicResults,
)

EXCERPT_BEFORE = 60
EXCERPT_LENGTH = 180


def excerpt(text: Optional[str], query: str) -> Optional[str]:
    """The stretch of `text` around the first match, on one line.

    From the start of the text when the query is not in it (the match was in a
    title), trimmed at word boundaries and marked with an ellipsis where cut.
    """
    if not text:
        return None
    flat = re.sub(r"\s+", " ", text).strip()
    at = flat.lower().find(query.lower())
    start = 0 if at <= EXCERPT_BEFORE else at - EXCERPT_BEFORE
    if start > 0:
        space = flat.find(" ", start)
        start = space + 1 if 0 <= space < at else start
    end = min(len(flat), start + EXCERPT_LENGTH)
    if end < len(flat):
        space = flat.rfind(" ", start, end)
        end = space if space > max(at + len(query), start) else end
    piece = flat[start:end].strip()
    return f"{'…' if start > 0 else ''}{piece}{'…' if end < len(flat) else ''}"


class SearchService:
    def __init__(self, db: Session):
        self.db = db

    def search(self, query: str, subject_id: Optional[int] = None, limit: int = 6) -> SearchResponse:
        text = query.strip()
        if not text:
            raise InvalidExamStateException("Nothing to search for: the search was blank.")

        subject: Optional[Subject] = None
        if subject_id is not None:
            subject = SubjectRepository(self.db).get_by_id(subject_id)
            if subject is None:
                raise ResourceNotFoundException("Subject", subject_id)

        pattern = contains_pattern(text)
        return SearchResponse(
            query=text,
            subject_id=subject.id if subject else None,
            subject_name=subject.name if subject else None,
            questions=self._questions(text, subject, limit),
            guides=self._guide_sections(text, pattern, subject, limit),
            roadmaps=self._roadmaps(pattern, subject, limit),
            topics=self._topics(pattern, subject, limit),
            recordings=self._recordings(pattern, limit),
        )

    # ------------------------------------------------------------ scoping

    @staticmethod
    def _roadmap_scope(query, subject: Optional[Subject]):
        query = query.filter(Roadmap.is_archived.is_(False))
        if subject is not None:
            query = query.filter(or_(Roadmap.subject_id == subject.id, Roadmap.subject_id.is_(None)))
        return query

    @staticmethod
    def _matches(pattern: str, *columns):
        return or_(*(column.ilike(pattern, escape=LIKE_ESCAPE) for column in columns))

    # ----------------------------------------------------------- the kinds

    def _questions(self, text: str, subject: Optional[Subject], limit: int) -> QuestionResults:
        repo = QuestionRepository(self.db)
        filters = QuestionFilter(keyword=text, subject_id=subject.id if subject else None)
        return QuestionResults(
            total=repo.count(filters),
            items=[
                QuestionHit(
                    id=q.id,
                    text=q.text,
                    domain=q.domain,
                    topic=q.topic,
                    difficulty=getattr(q.difficulty, "value", str(q.difficulty)),
                )
                for q in repo.get_all(skip=0, limit=limit, filter_params=filters)
            ],
        )

    def _guide_sections(
        self, text: str, pattern: str, subject: Optional[Subject], limit: int
    ) -> GuideSectionResults:
        query = self._roadmap_scope(
            self.db.query(TopicGuideSection, RoadmapTopic, Roadmap)
            .join(RoadmapTopic, RoadmapTopic.id == TopicGuideSection.topic_id)
            .join(Roadmap, Roadmap.id == RoadmapTopic.roadmap_id)
            .filter(self._matches(
                pattern,
                TopicGuideSection.title,
                TopicGuideSection.body,
                TopicGuideSection.example,
                TopicGuideSection.common_mistake,
            )),
            subject,
        )
        total = query.with_entities(func.count(TopicGuideSection.id)).scalar() or 0
        rows = (
            query.order_by(Roadmap.title, Roadmap.id, RoadmapTopic.order_index, RoadmapTopic.id,
                           TopicGuideSection.order_index, TopicGuideSection.id)
            .limit(limit)
            .all()
        )
        items = []
        for section, topic, roadmap in rows:
            # Excerpt from whichever part holds the match, the body when none does.
            source = next(
                (part for part in (section.body, section.example, section.common_mistake)
                 if part and text.lower() in part.lower()),
                section.body,
            )
            items.append(GuideSectionHit(
                section_id=section.id,
                title=section.title,
                excerpt=excerpt(source, text),
                written_by=section.source,
                read=section.read_at is not None,
                topic_id=topic.id,
                topic_title=topic.title,
                roadmap_id=roadmap.id,
                roadmap_title=roadmap.title,
            ))
        return GuideSectionResults(total=total, items=items)

    def _roadmaps(self, pattern: str, subject: Optional[Subject], limit: int) -> RoadmapResults:
        query = self._roadmap_scope(
            self.db.query(Roadmap).filter(self._matches(pattern, Roadmap.title, Roadmap.description)),
            subject,
        )
        total = query.with_entities(func.count(Roadmap.id)).scalar() or 0
        roadmaps = query.order_by(Roadmap.title, Roadmap.id).limit(limit).all()
        ids = [r.id for r in roadmaps]
        phases = dict(
            self.db.query(RoadmapPhase.roadmap_id, func.count(RoadmapPhase.id))
            .filter(RoadmapPhase.roadmap_id.in_(ids)).group_by(RoadmapPhase.roadmap_id).all()
        ) if ids else {}
        topics = dict(
            self.db.query(RoadmapTopic.roadmap_id, func.count(RoadmapTopic.id))
            .filter(RoadmapTopic.roadmap_id.in_(ids)).group_by(RoadmapTopic.roadmap_id).all()
        ) if ids else {}
        return RoadmapResults(
            total=total,
            items=[
                RoadmapHit(
                    id=r.id,
                    title=r.title,
                    phase_count=phases.get(r.id, 0),
                    topic_count=topics.get(r.id, 0),
                    linked=r.subject_id is not None,
                )
                for r in roadmaps
            ],
        )

    def _topics(self, pattern: str, subject: Optional[Subject], limit: int) -> TopicResults:
        query = self._roadmap_scope(
            self.db.query(RoadmapTopic, RoadmapPhase, Roadmap)
            .join(RoadmapPhase, RoadmapPhase.id == RoadmapTopic.phase_id)
            .join(Roadmap, Roadmap.id == RoadmapTopic.roadmap_id)
            .filter(self._matches(
                pattern,
                RoadmapTopic.title,
                RoadmapTopic.learning_objective,
                RoadmapTopic.success_criteria,
            )),
            subject,
        )
        total = query.with_entities(func.count(RoadmapTopic.id)).scalar() or 0
        rows = (
            query.order_by(Roadmap.title, Roadmap.id, RoadmapPhase.order_index, RoadmapTopic.order_index,
                           RoadmapTopic.id)
            .limit(limit)
            .all()
        )
        return TopicResults(
            total=total,
            items=[
                TopicHit(
                    id=topic.id,
                    title=topic.title,
                    status=getattr(topic.status, "value", str(topic.status)),
                    phase_name=phase.name,
                    roadmap_id=roadmap.id,
                    roadmap_title=roadmap.title,
                )
                for topic, phase, roadmap in rows
            ],
        )

    def _recordings(self, pattern: str, limit: int) -> RecordingResults:
        # Transcripts are the longest text in the database -- twenty thousand
        # characters a take is ordinary -- so they are matched once: every
        # matching id in order, counted here, and only the page read in full.
        # Counting and listing as two queries read every transcript twice.
        ordered = [
            row.id for row in (
                self.db.query(PracticeRecording.id)
                .outerjoin(InterviewQuestion, InterviewQuestion.id == PracticeRecording.interview_question_id)
                .outerjoin(RecordingAnalysis, RecordingAnalysis.recording_id == PracticeRecording.id)
                .filter(self._matches(
                    pattern,
                    PracticeRecording.title,
                    PracticeRecording.plan_note,
                    InterviewQuestion.question_text,
                    RecordingAnalysis.transcript,
                ))
                .order_by(PracticeRecording.created_at.desc(), PracticeRecording.id.desc())
                .all()
            )
        ]
        page = ordered[:limit]
        found = {
            recording.id: (recording, question_text, analysis_status)
            for recording, question_text, analysis_status in (
                self.db.query(PracticeRecording, InterviewQuestion.question_text, RecordingAnalysis.analysis_status)
                .outerjoin(InterviewQuestion, InterviewQuestion.id == PracticeRecording.interview_question_id)
                .outerjoin(RecordingAnalysis, RecordingAnalysis.recording_id == PracticeRecording.id)
                .filter(PracticeRecording.id.in_(page))
                .all()
            )
        } if page else {}
        rows = [found[recording_id] for recording_id in page if recording_id in found]
        return RecordingResults(
            total=len(ordered),
            items=[
                RecordingHit(
                    id=recording.id,
                    title=recording.title,
                    question_text=question_text,
                    created_at=recording.created_at,
                    duration_seconds=recording.duration_seconds,
                    analysis_status=analysis_status,
                )
                for recording, question_text, analysis_status in rows
            ],
        )
