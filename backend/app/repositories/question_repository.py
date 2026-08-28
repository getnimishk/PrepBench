# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from app.models.question import Question
from app.models.option import QuestionOption
from app.schemas.question import QuestionCreate, QuestionUpdate, QuestionFilter

class QuestionRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, question_id: int) -> Optional[Question]:
        return self.db.query(Question).filter(Question.id == question_id).first()

    def get_distinct_filters(self) -> dict:
        certifications = [r[0] for r in self.db.query(Question.certification).distinct().all() if r[0]]
        domains = [r[0] for r in self.db.query(Question.domain).distinct().all() if r[0]]
        topics = [r[0] for r in self.db.query(Question.topic).distinct().all() if r[0]]
        difficulties = [r[0].value if hasattr(r[0], 'value') else str(r[0]) for r in self.db.query(Question.difficulty).distinct().all() if r[0]]
        return {
            "certifications": sorted(list(set(certifications))),
            "domains": sorted(list(set(domains))),
            "topics": sorted(list(set(topics))),
            "difficulties": sorted(list(set(difficulties))),
        }

    def get_all(self, skip: int = 0, limit: int = 100, filter_params: Optional[QuestionFilter] = None) -> List[Question]:
        query = self.db.query(Question)
        if filter_params:
            if filter_params.keyword:
                kw = f"%{filter_params.keyword}%"
                query = query.filter(or_(
                    Question.text.ilike(kw),
                    Question.domain.ilike(kw),
                    Question.topic.ilike(kw),
                    Question.certification.ilike(kw)
                ))
            if filter_params.domain:
                query = query.filter(Question.domain == filter_params.domain)
            if filter_params.topic:
                query = query.filter(Question.topic == filter_params.topic)
            if filter_params.certification:
                query = query.filter(Question.certification == filter_params.certification)
            if filter_params.difficulty:
                query = query.filter(Question.difficulty == filter_params.difficulty)
            if filter_params.is_reviewed is not None:
                query = query.filter(Question.is_reviewed == filter_params.is_reviewed)
        return query.order_by(Question.id.desc()).offset(skip).limit(limit).all()

    def count(self, filter_params: Optional[QuestionFilter] = None) -> int:
        query = self.db.query(func.count(Question.id))
        if filter_params:
            if filter_params.keyword:
                kw = f"%{filter_params.keyword}%"
                query = query.filter(or_(
                    Question.text.ilike(kw),
                    Question.domain.ilike(kw),
                    Question.topic.ilike(kw),
                    Question.certification.ilike(kw)
                ))
            if filter_params.domain:
                query = query.filter(Question.domain == filter_params.domain)
            if filter_params.topic:
                query = query.filter(Question.topic == filter_params.topic)
            if filter_params.certification:
                query = query.filter(Question.certification == filter_params.certification)
            if filter_params.difficulty:
                query = query.filter(Question.difficulty == filter_params.difficulty)
            if filter_params.is_reviewed is not None:
                query = query.filter(Question.is_reviewed == filter_params.is_reviewed)
        return query.scalar() or 0

    def create(self, obj_in: QuestionCreate) -> Question:
        db_obj = Question(
            text=obj_in.text,
            question_type=obj_in.question_type,
            difficulty=obj_in.difficulty,
            domain=obj_in.domain,
            topic=obj_in.topic,
            subtopic=obj_in.subtopic,
            certification=obj_in.certification,
            source=obj_in.source,
            tags=obj_in.tags,
            code_snippet=obj_in.code_snippet,
            case_study_text=obj_in.case_study_text,
            image_url=obj_in.image_url,
            explanation=obj_in.explanation,
            reference_url=obj_in.reference_url
        )
        self.db.add(db_obj)
        self.db.flush()
        
        for idx, opt in enumerate(obj_in.options):
            option_db = QuestionOption(
                question_id=db_obj.id,
                option_text=opt.option_text,
                is_correct=opt.is_correct,
                explanation_why_incorrect=opt.explanation_why_incorrect,
                order_index=opt.order_index if opt.order_index is not None else idx
            )
            self.db.add(option_db)
        
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    def update(self, question_id: int, obj_in: QuestionUpdate) -> Optional[Question]:
        db_obj = self.get_by_id(question_id)
        if not db_obj:
            return None
        
        update_data = obj_in.model_dump(exclude_unset=True)
        options_data = update_data.pop("options", None)
        
        for field, value in update_data.items():
            setattr(db_obj, field, value)
            
        if options_data is not None:
            # Delete old options and recreate
            self.db.query(QuestionOption).filter(QuestionOption.question_id == question_id).delete()
            for idx, opt in enumerate(options_data):
                option_db = QuestionOption(
                    question_id=question_id,
                    option_text=opt["option_text"],
                    is_correct=opt.get("is_correct", False),
                    explanation_why_incorrect=opt.get("explanation_why_incorrect"),
                    order_index=opt.get("order_index", idx)
                )
                self.db.add(option_db)

        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    def delete(self, question_id: int) -> bool:
        db_obj = self.get_by_id(question_id)
        if db_obj:
            self.db.delete(db_obj)
            self.db.commit()
            return True
        return False

    def bulk_delete(self, ids: List[int]) -> int:
        from app.models.exam_answer import ExamAnswer
        from app.models.note_bookmark import UserNote, Bookmark
        from app.models.spaced_repetition import SpacedRepetition

        if not ids:
            return 0

        self.db.query(QuestionOption).filter(QuestionOption.question_id.in_(ids)).delete(synchronize_session=False)
        self.db.query(ExamAnswer).filter(ExamAnswer.question_id.in_(ids)).delete(synchronize_session=False)
        self.db.query(UserNote).filter(UserNote.question_id.in_(ids)).delete(synchronize_session=False)
        self.db.query(Bookmark).filter(Bookmark.question_id.in_(ids)).delete(synchronize_session=False)
        self.db.query(SpacedRepetition).filter(SpacedRepetition.question_id.in_(ids)).delete(synchronize_session=False)
        count = self.db.query(Question).filter(Question.id.in_(ids)).delete(synchronize_session=False)
        self.db.commit()
        return count

    def clear_all(self) -> int:
        from app.models.exam_answer import ExamAnswer
        from app.models.note_bookmark import UserNote, Bookmark
        from app.models.spaced_repetition import SpacedRepetition

        self.db.query(QuestionOption).delete(synchronize_session=False)
        self.db.query(ExamAnswer).delete(synchronize_session=False)
        self.db.query(UserNote).delete(synchronize_session=False)
        self.db.query(Bookmark).delete(synchronize_session=False)
        self.db.query(SpacedRepetition).delete(synchronize_session=False)
        count = self.db.query(Question).delete(synchronize_session=False)
        self.db.commit()
        return count

    # ---- reads used when composing an exam ---------------------------
    #
    # ExamEngine used to build these against self.db directly. The *decisions*
    # -- which certification tokens are meaningful, what counts as a weak topic
    # -- stay in the service; only the query lives here.

    def get_all_unpaginated(self) -> List[Question]:
        """Every question. Used as the fallback when a filter matches nothing."""
        return self.db.query(Question).all()

    def get_by_ids(self, ids: List[int]) -> List[Question]:
        if not ids:
            return []
        return self.db.query(Question).filter(Question.id.in_(ids)).all()

    def find_for_exam(
        self,
        certification_conditions: Optional[list] = None,
        topics: Optional[List[str]] = None,
        difficulties: Optional[List[str]] = None,
        restrict_to_ids: Optional[List[int]] = None,
        restrict_to_topics: Optional[List[str]] = None,
    ) -> List[Question]:
        """
        Candidate questions for a new exam.

        Takes prepared filter pieces rather than the request object, so the
        repository stays unaware of exam modes and the service keeps the rules
        about what those modes mean.
        """
        query = self.db.query(Question)

        if certification_conditions:
            query = query.filter(or_(*certification_conditions))
        if topics:
            query = query.filter(Question.topic.in_(topics))
        if difficulties:
            query = query.filter(Question.difficulty.in_(difficulties))
        if restrict_to_topics:
            query = query.filter(Question.topic.in_(restrict_to_topics))
        if restrict_to_ids:
            query = query.filter(Question.id.in_(restrict_to_ids))

        return query.all()

    def count_options_for_questions(self, ids: List[int]) -> int:
        """Total option rows across the given questions, for import verification."""
        if not ids:
            return 0
        return (
            self.db.query(func.count(QuestionOption.id))
            .filter(QuestionOption.question_id.in_(ids))
            .scalar() or 0
        )

    def all_question_texts(self) -> List[str]:
        """Every question's text, for duplicate detection during import."""
        return [row[0] for row in self.db.query(Question.text).all()]
