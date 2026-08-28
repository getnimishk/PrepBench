# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

import math
from collections import defaultdict
from datetime import datetime, date, timedelta, UTC
from typing import List, Optional, Dict

from sqlalchemy.orm import Session

from app.core.exceptions import ResourceNotFoundException, InvalidExamStateException
from app.models.roadmap import (
    Roadmap, RoadmapPhase, RoadmapTopic, RoadmapResource, RoadmapTopicStatus,
)
from app.repositories.roadmap_repository import RoadmapRepository
from app.schemas.roadmap import (
    RoadmapCreate, RoadmapUpdate, RoadmapProgress,
    RoadmapSummaryResponse, RoadmapDetailResponse,
    RoadmapPhaseCreate, RoadmapPhaseUpdate, RoadmapPhaseResponse,
    RoadmapTopicCreate, RoadmapTopicUpdate, RoadmapTopicResponse,
    RoadmapResourceResponse,
    RoadmapSchedule, RoadmapScheduleItem, RoadmapPhaseScheduleItem,
)


def _utc_now_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class RoadmapService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = RoadmapRepository(db)

    # ==================================================== state invariant

    @staticmethod
    def _reconcile_topic_state(topic: RoadmapTopic) -> None:
        """
        Keep `status` and `progress_percentage` from contradicting each other,
        and drop timestamps the status rules out.

        The source spreadsheet carries both as independent columns, which lets
        a row read "Completed" at 40%. Keeping both is still right -- a
        four-hour topic can genuinely be half-done, and "never opened" is not
        the same as "started, no progress yet" -- so coherence is enforced here
        instead. This is the single write path for topic state; every mutation
        (manual edit, import, bulk update) routes through it.

        Deliberately does NOT invent timestamps -- see _stamp_transition_times.
        """
        if topic.status == RoadmapTopicStatus.COMPLETED:
            topic.progress_percentage = 100

        elif topic.status == RoadmapTopicStatus.NOT_STARTED:
            topic.progress_percentage = 0
            topic.started_at = None
            topic.completed_at = None

        elif topic.status == RoadmapTopicStatus.IN_PROGRESS:
            # 100% while "in progress" is the contradiction that starts drift;
            # clamp rather than silently promoting to completed, because the
            # caller asked for in_progress explicitly.
            if topic.progress_percentage >= 100:
                topic.progress_percentage = 99
            elif topic.progress_percentage < 0:
                topic.progress_percentage = 0
            topic.completed_at = None

        # SKIPPED keeps whatever progress it had; it is excluded from every
        # aggregate anyway, and preserving the number means un-skipping
        # restores where you actually were.

    @staticmethod
    def _stamp_transition_times(topic: RoadmapTopic) -> None:
        """
        Record when a topic actually started/finished, for interactive edits.

        Split out from _reconcile_topic_state so that importing a spreadsheet
        which already says "Completed" but carries no completion date does not
        get stamped with today's date -- that would assert you finished it
        today, which is false, and the Gantt would draw an "actual" bar in the
        wrong place. An import leaves those nulls alone; a real status change
        made in the app is a genuine event and gets a real timestamp.
        """
        now = _utc_now_naive()
        if topic.status == RoadmapTopicStatus.COMPLETED:
            if topic.completed_at is None:
                topic.completed_at = now
            if topic.started_at is None:
                topic.started_at = topic.completed_at
        elif topic.status == RoadmapTopicStatus.IN_PROGRESS:
            if topic.started_at is None:
                topic.started_at = now

    @classmethod
    def _apply_topic_update(cls, topic: RoadmapTopic, update: RoadmapTopicUpdate) -> None:
        """
        Apply a PATCH, then reconcile.

        `exclude_unset` matters: an omitted field must be left alone, while an
        explicitly-null one clears the value. Without it, PATCHing only
        `status` would wipe evidence_notes.
        """
        data = update.model_dump(exclude_unset=True)

        status_given = "status" in data
        progress_given = "progress_percentage" in data

        for field, value in data.items():
            setattr(topic, field, value)

        # A bare progress edit implies the status, so the two stay consistent
        # whichever one the UI happens to send.
        if progress_given and not status_given and data.get("progress_percentage") is not None:
            pct = data["progress_percentage"]
            if pct >= 100:
                topic.status = RoadmapTopicStatus.COMPLETED
            elif pct > 0:
                topic.status = RoadmapTopicStatus.IN_PROGRESS
            elif topic.status != RoadmapTopicStatus.SKIPPED:
                topic.status = RoadmapTopicStatus.NOT_STARTED

        cls._reconcile_topic_state(topic)
        cls._stamp_transition_times(topic)

    # ======================================================= progress math

    @staticmethod
    def build_progress(topics: List[RoadmapTopic]) -> RoadmapProgress:
        counts: Dict[RoadmapTopicStatus, int] = defaultdict(int)
        for topic in topics:
            counts[topic.status] += 1

        # Skipped topics leave the denominator entirely -- material you already
        # know shouldn't pin the roadmap below 100% forever.
        countable = [t for t in topics if t.status != RoadmapTopicStatus.SKIPPED]
        completed = [t for t in countable if t.status == RoadmapTopicStatus.COMPLETED]

        completion_percentage: Optional[float] = None
        if countable:
            completion_percentage = round(len(completed) / len(countable) * 100, 1)

        # All-or-nothing: an hours figure derived from only those topics that
        # happen to carry an estimate is a confidently wrong number, so it is
        # reported only when every countable topic has one.
        hours_percentage: Optional[float] = None
        total_estimated_hours: Optional[float] = None
        completed_estimated_hours: Optional[float] = None

        if countable and all(t.estimated_hours is not None for t in countable):
            total_estimated_hours = round(sum(t.estimated_hours for t in countable), 2)
            completed_estimated_hours = round(sum(t.estimated_hours for t in completed), 2)
            if total_estimated_hours > 0:
                hours_percentage = round(completed_estimated_hours / total_estimated_hours * 100, 1)

        return RoadmapProgress(
            total_topics=len(topics),
            not_started_count=counts[RoadmapTopicStatus.NOT_STARTED],
            in_progress_count=counts[RoadmapTopicStatus.IN_PROGRESS],
            completed_count=counts[RoadmapTopicStatus.COMPLETED],
            skipped_count=counts[RoadmapTopicStatus.SKIPPED],
            completion_percentage=completion_percentage,
            hours_percentage=hours_percentage,
            total_estimated_hours=total_estimated_hours,
            completed_estimated_hours=completed_estimated_hours,
        )

    # ========================================================= serialisers

    @staticmethod
    def _summary_fields(roadmap: Roadmap) -> dict:
        return dict(
            id=roadmap.id,
            title=roadmap.title,
            description=roadmap.description,
            source_filename=roadmap.source_filename,
            start_date=roadmap.start_date,
            weekly_hours_budget=roadmap.weekly_hours_budget,
            is_archived=roadmap.is_archived,
            created_at=roadmap.created_at,
            updated_at=roadmap.updated_at,
        )

    def to_summary(self, roadmap: Roadmap, topics: Optional[List[RoadmapTopic]] = None) -> RoadmapSummaryResponse:
        if topics is None:
            topics = self.repo.list_topics_ordered(roadmap.id)
        return RoadmapSummaryResponse(
            **self._summary_fields(roadmap),
            progress=self.build_progress(topics),
        )

    def to_detail(self, roadmap: Roadmap) -> RoadmapDetailResponse:
        topics = self.repo.list_topics_ordered(roadmap.id)
        phases = [
            RoadmapPhaseResponse(
                id=phase.id,
                roadmap_id=phase.roadmap_id,
                name=phase.name,
                order_index=phase.order_index,
                topics=[
                    RoadmapTopicResponse.model_validate(t)
                    for t in sorted(phase.topics, key=lambda t: (t.order_index, t.id))
                ],
            )
            for phase in sorted(roadmap.phases, key=lambda p: (p.order_index, p.id))
        ]
        resources = [
            RoadmapResourceResponse.model_validate(r)
            for r in sorted(roadmap.resources, key=lambda r: (r.order_index, r.id))
        ]
        return RoadmapDetailResponse(
            **self._summary_fields(roadmap),
            progress=self.build_progress(topics),
            phases=phases,
            resources=resources,
        )

    # ============================================================== queries

    def list_roadmaps(self, include_archived: bool = False) -> List[RoadmapSummaryResponse]:
        roadmaps = self.repo.list_roadmaps(include_archived)
        if not roadmaps:
            return []

        # One extra query for every roadmap's topics, grouped in memory, rather
        # than a progress query per roadmap.
        all_topics = self.repo.list_topics_for_roadmaps([r.id for r in roadmaps])
        by_roadmap: Dict[int, List[RoadmapTopic]] = defaultdict(list)
        for topic in all_topics:
            by_roadmap[topic.roadmap_id].append(topic)

        return [self.to_summary(r, by_roadmap.get(r.id, [])) for r in roadmaps]

    def get_roadmap_or_404(self, roadmap_id: int) -> Roadmap:
        roadmap = self.repo.get_roadmap(roadmap_id)
        if not roadmap:
            raise ResourceNotFoundException("Roadmap", roadmap_id)
        return roadmap

    def get_detail(self, roadmap_id: int) -> RoadmapDetailResponse:
        return self.to_detail(self.get_roadmap_or_404(roadmap_id))

    # ============================================================ mutations

    def create_roadmap(self, req: RoadmapCreate) -> RoadmapDetailResponse:
        roadmap = Roadmap(
            title=req.title,
            description=req.description,
            start_date=req.start_date,
            weekly_hours_budget=req.weekly_hours_budget,
        )
        saved = self.repo.create_roadmap(roadmap)
        return self.to_detail(self.repo.get_roadmap(saved.id))

    def update_roadmap(self, roadmap_id: int, req: RoadmapUpdate) -> RoadmapDetailResponse:
        roadmap = self.get_roadmap_or_404(roadmap_id)
        for field, value in req.model_dump(exclude_unset=True).items():
            setattr(roadmap, field, value)
        self.repo.save(roadmap)
        return self.to_detail(self.repo.get_roadmap(roadmap_id))

    def delete_roadmap(self, roadmap_id: int) -> None:
        self.repo.delete_roadmap(self.get_roadmap_or_404(roadmap_id))

    # -------------------------------------------------------------- phases

    def add_phase(self, roadmap_id: int, req: RoadmapPhaseCreate) -> RoadmapPhaseResponse:
        self.get_roadmap_or_404(roadmap_id)
        phase = RoadmapPhase(
            roadmap_id=roadmap_id,
            name=req.name,
            order_index=req.order_index if req.order_index is not None
            else self.repo.next_phase_order_index(roadmap_id),
        )
        saved = self.repo.add_phase(phase)
        return RoadmapPhaseResponse(
            id=saved.id, roadmap_id=saved.roadmap_id, name=saved.name,
            order_index=saved.order_index, topics=[],
        )

    def _get_phase_or_404(self, roadmap_id: int, phase_id: int) -> RoadmapPhase:
        phase = self.repo.get_phase(phase_id)
        if not phase or phase.roadmap_id != roadmap_id:
            raise ResourceNotFoundException("RoadmapPhase", phase_id)
        return phase

    def update_phase(self, roadmap_id: int, phase_id: int, req: RoadmapPhaseUpdate) -> RoadmapPhaseResponse:
        phase = self._get_phase_or_404(roadmap_id, phase_id)
        for field, value in req.model_dump(exclude_unset=True).items():
            setattr(phase, field, value)
        self.repo.save(phase)
        return RoadmapPhaseResponse(
            id=phase.id, roadmap_id=phase.roadmap_id, name=phase.name,
            order_index=phase.order_index,
            topics=[RoadmapTopicResponse.model_validate(t)
                    for t in sorted(phase.topics, key=lambda t: (t.order_index, t.id))],
        )

    def delete_phase(self, roadmap_id: int, phase_id: int) -> None:
        self.repo.delete_phase(self._get_phase_or_404(roadmap_id, phase_id))

    # -------------------------------------------------------------- topics

    def add_topic(self, roadmap_id: int, req: RoadmapTopicCreate) -> RoadmapTopicResponse:
        self.get_roadmap_or_404(roadmap_id)
        phase = self._get_phase_or_404(roadmap_id, req.phase_id)

        topic = RoadmapTopic(
            roadmap_id=roadmap_id,          # always derived from the phase's
            phase_id=phase.id,              # roadmap, never taken from input
            title=req.title,
            learning_objective=req.learning_objective,
            success_criteria=req.success_criteria,
            estimated_hours=req.estimated_hours,
            order_index=req.order_index if req.order_index is not None
            else self.repo.next_topic_order_index(phase.id),
            status=RoadmapTopicStatus.NOT_STARTED,
            progress_percentage=0,
        )
        self._reconcile_topic_state(topic)
        return RoadmapTopicResponse.model_validate(self.repo.add_topic(topic))

    def _get_topic_or_404(self, roadmap_id: int, topic_id: int) -> RoadmapTopic:
        topic = self.repo.get_topic(topic_id)
        if not topic or topic.roadmap_id != roadmap_id:
            raise ResourceNotFoundException("RoadmapTopic", topic_id)
        return topic

    def update_topic(self, roadmap_id: int, topic_id: int, req: RoadmapTopicUpdate) -> RoadmapTopicResponse:
        topic = self._get_topic_or_404(roadmap_id, topic_id)

        if req.phase_id is not None and req.phase_id != topic.phase_id:
            # Validate the destination belongs to the same roadmap, otherwise a
            # topic could be moved under another roadmap's phase and end up
            # with roadmap_id and phase_id pointing at different roadmaps.
            self._get_phase_or_404(roadmap_id, req.phase_id)

        self._apply_topic_update(topic, req)
        return RoadmapTopicResponse.model_validate(self.repo.save(topic))

    def delete_topic(self, roadmap_id: int, topic_id: int) -> None:
        self.repo.delete_topic(self._get_topic_or_404(roadmap_id, topic_id))

    # ============================================================= schedule

    def build_schedule(self, roadmap_id: int) -> RoadmapSchedule:
        """
        Project a Gantt timeline from estimated hours and a weekly budget.

        The source material has no planned dates -- only estimates and actuals
        -- and nobody is going to hand-enter 45 date pairs, so the timeline is
        derived. Remaining work is projected forward from *today* rather than
        from the roadmap's original start date: as you slip, the chart should
        show where you will actually land instead of a forecast anchored to a
        date months in the past. Completed topics keep their real dates, so the
        past is history and the future is a live forecast.

        Every way this can fail to be computable returns a reason instead of a
        fabricated schedule.
        """
        roadmap = self.get_roadmap_or_404(roadmap_id)
        topics = self.repo.list_topics_ordered(roadmap_id)

        phase_names = {p.id: p.name for p in roadmap.phases}

        def unavailable(reason: str) -> RoadmapSchedule:
            return RoadmapSchedule(
                schedule_available=False,
                reason=reason,
                start_date=roadmap.start_date,
                weekly_hours_budget=roadmap.weekly_hours_budget,
                unschedulable_topic_count=sum(
                    1 for t in topics
                    if t.estimated_hours is None and t.status != RoadmapTopicStatus.SKIPPED
                ),
            )

        if not topics:
            return unavailable("no_topics")
        if roadmap.start_date is None:
            return unavailable("no_start_date")
        if not roadmap.weekly_hours_budget or roadmap.weekly_hours_budget <= 0:
            return unavailable("no_weekly_budget")
        if all(t.estimated_hours is None for t in topics):
            return unavailable("no_time_estimates")

        # Spread the weekly budget evenly rather than assuming a 5-day study
        # week -- guessing which days someone studies would be inventing detail
        # the roadmap never supplied.
        hours_per_day = roadmap.weekly_hours_budget / 7.0

        today = _utc_now_naive().date()
        cursor: date = max(roadmap.start_date, today)

        items: List[RoadmapScheduleItem] = []
        unschedulable = 0

        for topic in topics:
            common = dict(
                topic_id=topic.id,
                phase_id=topic.phase_id,
                phase_name=phase_names.get(topic.phase_id, ""),
                title=topic.title,
                status=topic.status,
                estimated_hours=topic.estimated_hours,
            )

            if topic.status == RoadmapTopicStatus.SKIPPED:
                items.append(RoadmapScheduleItem(**common, schedule_status="skipped"))
                continue

            if topic.status == RoadmapTopicStatus.COMPLETED:
                # Already done: real dates when we have them, no bar when we
                # don't, and either way it consumes none of the future budget.
                items.append(RoadmapScheduleItem(
                    **common,
                    schedule_status="actual",
                    start=topic.started_at.date() if topic.started_at else None,
                    end=topic.completed_at.date() if topic.completed_at else None,
                ))
                continue

            if topic.estimated_hours is None:
                unschedulable += 1
                items.append(RoadmapScheduleItem(**common, schedule_status="unschedulable"))
                continue

            remaining_hours = topic.estimated_hours * (100 - topic.progress_percentage) / 100.0
            days = max(1, math.ceil(remaining_hours / hours_per_day)) if hours_per_day > 0 else 1

            # An in-progress topic is already underway, so anchor its bar to
            # when it actually started if that is earlier than the cursor.
            bar_start = cursor
            if topic.status == RoadmapTopicStatus.IN_PROGRESS and topic.started_at:
                bar_start = min(topic.started_at.date(), cursor)

            bar_end = cursor + timedelta(days=days - 1)
            items.append(RoadmapScheduleItem(
                **common, schedule_status="projected", start=bar_start, end=bar_end,
            ))
            cursor = bar_end + timedelta(days=1)

        phases = self._aggregate_phase_schedule(roadmap, items)

        dated_ends = [i.end for i in items if i.end is not None]
        return RoadmapSchedule(
            schedule_available=True,
            reason=None,
            start_date=roadmap.start_date,
            weekly_hours_budget=roadmap.weekly_hours_budget,
            projected_end_date=max(dated_ends) if dated_ends else None,
            unschedulable_topic_count=unschedulable,
            items=items,
            phases=phases,
        )

    @staticmethod
    def _aggregate_phase_schedule(
        roadmap: Roadmap, items: List[RoadmapScheduleItem]
    ) -> List[RoadmapPhaseScheduleItem]:
        """Collapse topic bars into one bar per phase for the default view."""
        by_phase: Dict[int, List[RoadmapScheduleItem]] = defaultdict(list)
        for item in items:
            by_phase[item.phase_id].append(item)

        aggregated: List[RoadmapPhaseScheduleItem] = []
        for phase in sorted(roadmap.phases, key=lambda p: (p.order_index, p.id)):
            phase_items = by_phase.get(phase.id, [])
            starts = [i.start for i in phase_items if i.start]
            ends = [i.end for i in phase_items if i.end]

            if any(i.schedule_status == "projected" for i in phase_items):
                status = "projected"
            elif any(i.schedule_status == "actual" for i in phase_items):
                status = "actual"
            elif phase_items and all(i.schedule_status == "skipped" for i in phase_items):
                status = "skipped"
            else:
                status = "unschedulable"

            aggregated.append(RoadmapPhaseScheduleItem(
                phase_id=phase.id,
                phase_name=phase.name,
                start=min(starts) if starts else None,
                end=max(ends) if ends else None,
                schedule_status=status,
            ))
        return aggregated
