# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import List, Optional
from sqlalchemy.orm import Session, load_only, lazyload
from sqlalchemy import or_, func
from app.core.text_match import LIKE_ESCAPE, contains_pattern
from app.models.question import Question
from app.models.option import QuestionOption
from app.schemas.question import QuestionCreate, QuestionUpdate, QuestionFilter

class QuestionRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, question_id: int) -> Optional[Question]:
        return self.db.query(Question).filter(Question.id == question_id).first()

    def get_distinct_filters(self, subject_id: Optional[int] = None) -> dict:
        """The values each filter can take, for one preparation when named.

        Unscoped, a PSM I drill offered every topic in every bank, and choosing
        a Databricks topic produced a drill that matched nothing.
        """
        def distinct(column):
            query = self.db.query(column).distinct()
            if subject_id is not None:
                query = query.filter(Question.subject_id == subject_id)
            return query.all()

        certifications = [r[0] for r in distinct(Question.certification) if r[0]]
        domains = [r[0] for r in distinct(Question.domain) if r[0]]
        topics = [r[0] for r in distinct(Question.topic) if r[0]]
        difficulties = [r[0].value if hasattr(r[0], 'value') else str(r[0]) for r in distinct(Question.difficulty) if r[0]]
        return {
            "certifications": sorted(list(set(certifications))),
            "domains": sorted(list(set(domains))),
            "topics": sorted(list(set(topics))),
            "difficulties": sorted(list(set(difficulties))),
        }

    @staticmethod
    def _apply_filters(query, filter_params: Optional[QuestionFilter]):
        """The listing filters, in one place for the page and its count.

        These were written out twice, once in get_all and once in count. Two
        copies of a filter set is a page and a total that disagree as soon as
        anyone adds a filter to one of them -- "1 of 340 questions" over a table
        of twelve, with nothing obviously wrong in either function. Adding
        subject_id would have made a third copy, so it is one now.
        """
        if not filter_params:
            return query
        if filter_params.keyword:
            # Literal: a % or _ in what was typed is that character. Global search
            # counts questions through this same filter, so its "see all N in the
            # Question Bank" and the bank's own total are the same number.
            kw = contains_pattern(filter_params.keyword)
            query = query.filter(or_(
                Question.text.ilike(kw, escape=LIKE_ESCAPE),
                Question.domain.ilike(kw, escape=LIKE_ESCAPE),
                Question.topic.ilike(kw, escape=LIKE_ESCAPE),
                Question.certification.ilike(kw, escape=LIKE_ESCAPE)
            ))
        if filter_params.domain:
            query = query.filter(Question.domain == filter_params.domain)
        if filter_params.topic:
            query = query.filter(Question.topic == filter_params.topic)
        if filter_params.certification:
            query = query.filter(Question.certification == filter_params.certification)
        if filter_params.subject_id is not None:
            query = query.filter(Question.subject_id == filter_params.subject_id)
        if filter_params.difficulty:
            query = query.filter(Question.difficulty == filter_params.difficulty)
        if filter_params.question_type:
            query = query.filter(Question.question_type == filter_params.question_type)
        if filter_params.is_reviewed is not None:
            query = query.filter(Question.is_reviewed == filter_params.is_reviewed)
        if filter_params.outcome:
            # The same definition the status column and the practice previews use.
            from app.services.question_evidence import outcome_criterion
            query = query.filter(outcome_criterion(filter_params.outcome))
        return query

    def get_all(self, skip: int = 0, limit: int = 100, filter_params: Optional[QuestionFilter] = None) -> List[Question]:
        query = self._apply_filters(self.db.query(Question), filter_params)
        return query.order_by(Question.id.desc()).offset(skip).limit(limit).all()

    def count(self, filter_params: Optional[QuestionFilter] = None) -> int:
        query = self._apply_filters(self.db.query(func.count(Question.id)), filter_params)
        return query.scalar() or 0

    def resolve_subject_id(self, certification: Optional[str]) -> Optional[int]:
        """The subject whose certification string is exactly this one, if any.

        Exact equality, never a token or substring match. This is the same rule
        the subject_id migration backfills with, and keeping write-time and
        migration-time identical is the point: a question created today and one
        imported last month end up owned by the same preparation.

        The looser match is what allowed a Databricks question into a PSM I
        mock, so it is not offered here even as a fallback. A certification
        string that matches no subject leaves the question unowned, which is a
        truthful answer.

        Two subjects claiming the same certification string is ambiguous by
        definition, and picking the lower id would be a coin toss dressed up as
        a decision. That case returns None and logs, so the question is visibly
        unowned rather than invisibly owned by whichever row was inserted
        first. `Subject.certification` is not unique in the schema and cannot be
        made so without rebuilding the table, so this is where the ambiguity has
        to be handled.
        """
        if not (certification and certification.strip()):
            return None
        from app.models.subject import Subject

        cert = certification.strip()
        rows = (
            self.db.query(Subject.id)
            .filter(Subject.certification == cert)
            .limit(2)
            .all()
        )
        if not rows:
            return None
        if len(rows) > 1:
            from app.core.logging_config import logger
            logger.warning(
                f"Certification {cert!r} is claimed by more than one preparation, "
                "so a question carrying it cannot be attributed to either. It is "
                "stored unowned. Give each preparation a distinct certification "
                "name to resolve this."
            )
            return None
        return rows[0][0]

    def create(self, obj_in: QuestionCreate) -> Question:
        subject_id = obj_in.subject_id
        if subject_id is None:
            subject_id = self.resolve_subject_id(obj_in.certification)

        db_obj = Question(
            text=obj_in.text,
            question_type=obj_in.question_type,
            difficulty=obj_in.difficulty,
            domain=obj_in.domain,
            topic=obj_in.topic,
            subtopic=obj_in.subtopic,
            certification=obj_in.certification,
            subject_id=subject_id,
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
        from app.models.spaced_repetition import SpacedRepetition

        if not ids:
            return 0

        self.db.query(QuestionOption).filter(QuestionOption.question_id.in_(ids)).delete(synchronize_session=False)
        self.db.query(ExamAnswer).filter(ExamAnswer.question_id.in_(ids)).delete(synchronize_session=False)
        self.db.query(SpacedRepetition).filter(SpacedRepetition.question_id.in_(ids)).delete(synchronize_session=False)
        count = self.db.query(Question).filter(Question.id.in_(ids)).delete(synchronize_session=False)
        self.db.commit()
        return count

    def clear_all(self) -> int:
        from app.models.exam_answer import ExamAnswer
        from app.models.spaced_repetition import SpacedRepetition

        self.db.query(QuestionOption).delete(synchronize_session=False)
        self.db.query(ExamAnswer).delete(synchronize_session=False)
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
        """Every question, for the integrity check that compares the bank
        against its source file.

        No longer the fallback for an exam whose filter matched nothing --
        create_exam refuses that outright rather than quietly widening it.
        """
        return self.db.query(Question).all()

    def get_by_ids(self, ids: List[int]) -> List[Question]:
        if not ids:
            return []
        return self.db.query(Question).filter(Question.id.in_(ids)).all()

    def find_for_exam(
        self,
        subject_id: Optional[int] = None,
        certification_conditions: Optional[list] = None,
        topics: Optional[List[str]] = None,
        domains: Optional[List[str]] = None,
        difficulties: Optional[List[str]] = None,
        restrict_to_ids: Optional[List[int]] = None,
        restrict_to_topics: Optional[List[str]] = None,
    ) -> List[Question]:
        """
        Candidate questions for a new exam.

        Takes prepared filter pieces rather than the request object, so the
        repository stays unaware of exam modes and the service keeps the rules
        about what those modes mean.

        Only what choosing a paper reads -- the id and the domain -- is loaded.
        The whole matching bank comes back here to draw eighty from, and loading
        every question with its options (joined by default) turned a 5,000
        question bank into 25,000 objects and most of two seconds before the
        mock could start. The runner fetches the drawn questions in full itself.
        """
        query = self.db.query(Question).options(
            load_only(Question.id, Question.domain, Question.topic, Question.difficulty),
            lazyload(Question.options),
        )

        # Preparation scope, when the caller named one. An indexed integer
        # equality, and exclusive: a question bound to no preparation, or to a
        # different one, is not a candidate. The service decides when to pass
        # this; the repository only runs it.
        if subject_id is not None:
            query = query.filter(Question.subject_id == subject_id)
        if certification_conditions:
            query = query.filter(or_(*certification_conditions))
        if topics:
            query = query.filter(Question.topic.in_(topics))
        # Domain, not topic, is the unit the exam blueprint and readiness both
        # use. The topic column holds several hundred near-duplicate strings
        # ("SM facilitating", "SM as facilitator", "Scrum Master facilitation
        # ...") averaging three questions each, so it can identify a question
        # but cannot select a meaningful set of them.
        if domains:
            query = query.filter(Question.domain.in_(domains))
        if difficulties:
            query = query.filter(Question.difficulty.in_(difficulties))
        if restrict_to_topics:
            query = query.filter(Question.topic.in_(restrict_to_topics))
        if restrict_to_ids:
            query = query.filter(Question.id.in_(restrict_to_ids))

        return query.all()

    def count_for_subject(self, subject_id: int) -> int:
        """How many questions this preparation owns.

        Used to tell "your filters were too narrow" apart from "this
        preparation has no question bank at all", which are different problems
        with different answers.
        """
        return (
            self.db.query(func.count(Question.id))
            .filter(Question.subject_id == subject_id)
            .scalar() or 0
        )

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
