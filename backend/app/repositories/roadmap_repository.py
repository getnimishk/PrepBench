# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import List, Optional
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.models.roadmap import Roadmap, RoadmapPhase, RoadmapTopic, RoadmapResource


class RoadmapRepository:
    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------ roadmaps

    def list_roadmaps(self, include_archived: bool = False) -> List[Roadmap]:
        query = self.db.query(Roadmap)
        if not include_archived:
            query = query.filter(Roadmap.is_archived.is_(False))
        return query.order_by(Roadmap.created_at.desc(), Roadmap.id.desc()).all()

    def get_roadmap(self, roadmap_id: int) -> Optional[Roadmap]:
        """
        Eager-loads the whole tree. The detail endpoint always renders phases,
        their topics, and resources together, so loading them lazily would mean
        one query per phase on a 10-phase roadmap.
        """
        return (
            self.db.query(Roadmap)
            .options(
                selectinload(Roadmap.phases).selectinload(RoadmapPhase.topics),
                selectinload(Roadmap.resources),
            )
            .filter(Roadmap.id == roadmap_id)
            .first()
        )

    def create_roadmap(self, roadmap: Roadmap) -> Roadmap:
        self.db.add(roadmap)
        self.db.commit()
        self.db.refresh(roadmap)
        return roadmap

    def save(self, obj):
        """Commit a mutated, already-attached ORM object."""
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def delete_roadmap(self, roadmap: Roadmap) -> None:
        self.db.delete(roadmap)
        self.db.commit()

    # -------------------------------------------------------------- phases

    def get_phase(self, phase_id: int) -> Optional[RoadmapPhase]:
        return self.db.query(RoadmapPhase).filter(RoadmapPhase.id == phase_id).first()

    def list_phases(self, roadmap_id: int) -> List[RoadmapPhase]:
        return (
            self.db.query(RoadmapPhase)
            .filter(RoadmapPhase.roadmap_id == roadmap_id)
            .order_by(RoadmapPhase.order_index, RoadmapPhase.id)
            .all()
        )

    def next_phase_order_index(self, roadmap_id: int) -> int:
        current_max = (
            self.db.query(func.max(RoadmapPhase.order_index))
            .filter(RoadmapPhase.roadmap_id == roadmap_id)
            .scalar()
        )
        return 0 if current_max is None else current_max + 1

    def add_phase(self, phase: RoadmapPhase) -> RoadmapPhase:
        self.db.add(phase)
        self.db.commit()
        self.db.refresh(phase)
        return phase

    def delete_phase(self, phase: RoadmapPhase) -> None:
        self.db.delete(phase)
        self.db.commit()

    # -------------------------------------------------------------- topics

    def get_topic(self, topic_id: int) -> Optional[RoadmapTopic]:
        return self.db.query(RoadmapTopic).filter(RoadmapTopic.id == topic_id).first()

    def list_topics_ordered(self, roadmap_id: int) -> List[RoadmapTopic]:
        """
        Curriculum order: phase first, then position within the phase.

        This is the canonical traversal for both progress and schedule
        derivation -- the schedule in particular consumes the weekly budget
        strictly in this sequence, so it must not vary between callers.
        """
        return (
            self.db.query(RoadmapTopic)
            .join(RoadmapPhase, RoadmapTopic.phase_id == RoadmapPhase.id)
            .filter(RoadmapTopic.roadmap_id == roadmap_id)
            .order_by(RoadmapPhase.order_index, RoadmapTopic.order_index, RoadmapTopic.id)
            .all()
        )

    def list_topics_for_roadmaps(self, roadmap_ids: List[int]) -> List[RoadmapTopic]:
        """
        Every topic across several roadmaps in one query, so the list endpoint
        can compute per-roadmap progress without issuing a query per roadmap.
        Unordered on purpose -- progress math is order-independent.
        """
        if not roadmap_ids:
            return []
        return (
            self.db.query(RoadmapTopic)
            .filter(RoadmapTopic.roadmap_id.in_(roadmap_ids))
            .all()
        )

    def next_topic_order_index(self, phase_id: int) -> int:
        current_max = (
            self.db.query(func.max(RoadmapTopic.order_index))
            .filter(RoadmapTopic.phase_id == phase_id)
            .scalar()
        )
        return 0 if current_max is None else current_max + 1

    def add_topic(self, topic: RoadmapTopic) -> RoadmapTopic:
        self.db.add(topic)
        self.db.commit()
        self.db.refresh(topic)
        return topic

    def delete_topic(self, topic: RoadmapTopic) -> None:
        self.db.delete(topic)
        self.db.commit()

    # ----------------------------------------------------------- resources

    def add_resource(self, resource: RoadmapResource) -> RoadmapResource:
        self.db.add(resource)
        self.db.commit()
        self.db.refresh(resource)
        return resource

    def list_resources(self, roadmap_id: int) -> List[RoadmapResource]:
        return (
            self.db.query(RoadmapResource)
            .filter(RoadmapResource.roadmap_id == roadmap_id)
            .order_by(RoadmapResource.order_index, RoadmapResource.id)
            .all()
        )

    # ------------------------------------------------------------ bulk add

    def bulk_add(self, objects: list) -> None:
        """
        Stage many rows without committing -- the import path builds the whole
        roadmap tree and commits once, so a failure part-way through rolls the
        entire import back rather than leaving a half-built roadmap.
        """
        self.db.add_all(objects)
        self.db.flush()
