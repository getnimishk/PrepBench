# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import List, Optional, Set
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func
from app.models.design_review import DesignReview, DesignOption, DesignReviewAttempt
from app.schemas.design_review import DesignReviewCreate, DesignReviewFilter


class DesignReviewRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, review_id: int) -> Optional[DesignReview]:
        return (
            self.db.query(DesignReview)
            .options(joinedload(DesignReview.options))
            .filter(DesignReview.id == review_id)
            .first()
        )

    def _apply_filters(self, query, filter_params: Optional[DesignReviewFilter]):
        if not filter_params:
            return query
        if filter_params.domain:
            query = query.filter(DesignReview.domain == filter_params.domain)
        if filter_params.axis_label:
            query = query.filter(DesignReview.axis_label == filter_params.axis_label)
        if filter_params.difficulty:
            query = query.filter(DesignReview.difficulty == filter_params.difficulty)
        if filter_params.keyword:
            kw = f"%{filter_params.keyword}%"
            query = query.filter(or_(
                DesignReview.title.ilike(kw),
                DesignReview.brief.ilike(kw),
            ))
        return query

    def get_all(
        self,
        skip: int = 0,
        limit: int = 100,
        filter_params: Optional[DesignReviewFilter] = None,
    ) -> List[DesignReview]:
        query = self._apply_filters(self.db.query(DesignReview), filter_params)
        return query.order_by(DesignReview.id.asc()).offset(skip).limit(limit).all()

    def count(self, filter_params: Optional[DesignReviewFilter] = None) -> int:
        query = self._apply_filters(self.db.query(func.count(DesignReview.id)), filter_params)
        return query.scalar() or 0

    def create(self, obj_in: DesignReviewCreate) -> DesignReview:
        """The review and both its options in one commit.

        A review with one option written is not a smaller review, it is a
        broken one -- so the two options are never a separate transaction.
        """
        review = DesignReview(
            title=obj_in.title,
            brief=obj_in.brief,
            domain=obj_in.domain,
            difficulty=obj_in.difficulty,
            deciding_axis=obj_in.deciding_axis,
            axis_label=obj_in.axis_label,
            reveal=obj_in.reveal,
            elicit_answer=obj_in.elicit_answer,
            concepts=list(obj_in.concepts),
            options=[
                DesignOption(
                    label=o.label,
                    name=o.name,
                    summary=o.summary,
                    flow=[s.model_dump() for s in o.flow],
                    key_choices=list(o.key_choices),
                    holds_when=o.holds_when,
                    breaks_when=o.breaks_when,
                    rough_cost=o.rough_cost,
                )
                for o in obj_in.options
            ],
        )
        self.db.add(review)
        self.db.commit()
        self.db.refresh(review)
        return review

    def get_existing_titles(self) -> Set[str]:
        return {r[0] for r in self.db.query(DesignReview.title).all() if r[0]}

    def get_distinct_axes(self) -> List[str]:
        rows = self.db.query(DesignReview.axis_label).distinct().all()
        return sorted({r[0] for r in rows if r[0]})

    def get_distinct_domains(self) -> List[str]:
        rows = self.db.query(DesignReview.domain).distinct().all()
        return sorted({r[0] for r in rows if r[0]})


class DesignReviewAttemptRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, attempt: DesignReviewAttempt) -> DesignReviewAttempt:
        self.db.add(attempt)
        self.db.commit()
        self.db.refresh(attempt)
        return attempt

    def get_by_id(self, attempt_id: int) -> Optional[DesignReviewAttempt]:
        return (
            self.db.query(DesignReviewAttempt)
            .options(joinedload(DesignReviewAttempt.review))
            .filter(DesignReviewAttempt.id == attempt_id)
            .first()
        )

    def get_all(self, skip: int = 0, limit: int = 100) -> List[DesignReviewAttempt]:
        return (
            self.db.query(DesignReviewAttempt)
            .options(joinedload(DesignReviewAttempt.review))
            .order_by(DesignReviewAttempt.id.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def count(self) -> int:
        return self.db.query(func.count(DesignReviewAttempt.id)).scalar() or 0

    def get_latest_for_review(self, review_id: int) -> Optional[DesignReviewAttempt]:
        """The most recent attempt at one review, so reopening it can show what
        the learner said last time beside the reveal."""
        return (
            self.db.query(DesignReviewAttempt)
            .filter(DesignReviewAttempt.review_id == review_id)
            .order_by(DesignReviewAttempt.id.desc())
            .first()
        )

    def get_graded_with_review(self) -> List[DesignReviewAttempt]:
        """Graded attempts with their review eager-loaded, so grouping by axis
        does not fire a query per attempt."""
        return (
            self.db.query(DesignReviewAttempt)
            .options(joinedload(DesignReviewAttempt.review))
            .filter(DesignReviewAttempt.grading_status == "graded")
            .order_by(DesignReviewAttempt.created_at.asc())
            .all()
        )

    def get_attempted_review_ids(self) -> Set[int]:
        rows = self.db.query(DesignReviewAttempt.review_id).distinct().all()
        return {r[0] for r in rows if r[0] is not None}
