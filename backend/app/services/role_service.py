# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Roles from a job description, and the diagnostic (skills plan §8, D8/D9).

Three rules live here, because a client can't be trusted to keep them:

1. A requirement links only to a Skill preparation, and only when the learner
   sent that link. Nothing here guesses one.
2. A diagnostic answers questions that exist: every `question_ref` resolves to
   a shipped pack version's diagnostic question or written scenario lens, and
   every "covered" index is one of that question's points.
3. The first attempt fixes the question set and the lens. A retake must send
   the same questions in the same lens, or the before/after table would compare
   two different tests.
"""
import re
from typing import List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.content import packs as pack_store
from app.core.exceptions import InvalidExamStateException, ResourceNotFoundException
from app.models.role import Role, RoleDiagnosticAttempt, RoleRequirement
from app.models.subject import Subject, SubjectKind
from app.schemas.role import (
    DiagnosticCreate,
    DiagnosticResponse,
    RoleCreate,
    RoleRequirementIn,
    RoleRequirementResponse,
    RoleResponse,
    RoleSummary,
    RoleUpdate,
)

_DIAGNOSTIC_REF = re.compile(r"^(?P<pack>[^@/]+)@(?P<version>\d+)/diagnostic/(?P<id>[^/]+)$")
_SCENARIO_REF = re.compile(
    r"^(?P<pack>[^@/]+)@(?P<version>\d+)/scenario/(?P<id>[^/]+)/lens/(?P<lens>po|pm|dm|em)$"
)


def _points_for(question_ref: str) -> Tuple[Optional[List[str]], Optional[str]]:
    """The key points a question_ref names, and its lens (scenario questions only).

    (None, None) when the ref names nothing that ships.
    """
    m = _DIAGNOSTIC_REF.match(question_ref)
    if m:
        pack = pack_store.get(m["pack"], int(m["version"]))
        if pack is None:
            return None, None
        q = next((q for q in pack.diagnostic_questions if q.id == m["id"]), None)
        return (list(q.points), None) if q else (None, None)
    m = _SCENARIO_REF.match(question_ref)
    if m:
        pack = pack_store.get(m["pack"], int(m["version"]))
        if pack is None:
            return None, None
        scenario = next(
            (s for level in pack.scenario_levels for s in level.scenarios if s.id == m["id"]), None
        )
        lens = ((scenario.content or {}).get("lenses") or {}).get(m["lens"]) if scenario else None
        points = ((lens or {}).get("sayIt") or {}).get("points")
        return (list(points), m["lens"]) if isinstance(points, list) else (None, None)
    return None, None


class RoleService:
    def __init__(self, db: Session):
        self.db = db

    # ---- reads ----------------------------------------------------------

    def list_roles(self, include_archived: bool = False) -> List[RoleSummary]:
        query = self.db.query(Role)
        if not include_archived:
            query = query.filter(Role.is_archived.is_(False))
        roles = query.order_by(Role.created_at.desc(), Role.id.desc()).all()
        diagnostic_counts = dict(
            self.db.query(RoleDiagnosticAttempt.role_id, func.count(RoleDiagnosticAttempt.id))
            .group_by(RoleDiagnosticAttempt.role_id).all()
        )
        # Counted in one query rather than by loading every role's requirements.
        requirement_counts = {
            role_id: (total, linked)
            for role_id, total, linked in self.db.query(
                RoleRequirement.role_id,
                func.count(RoleRequirement.id),
                func.count(RoleRequirement.subject_id),
            ).group_by(RoleRequirement.role_id).all()
        }
        return [
            RoleSummary(
                id=r.id, name=r.name, interview_date=r.interview_date, lens=r.lens,
                is_archived=bool(r.is_archived), created_at=r.created_at, updated_at=r.updated_at,
                requirement_count=requirement_counts.get(r.id, (0, 0))[0],
                linked_count=requirement_counts.get(r.id, (0, 0))[1],
                diagnostic_count=diagnostic_counts.get(r.id, 0),
            )
            for r in roles
        ]

    def get_role(self, role_id: int) -> RoleResponse:
        return self._to_response(self._require(role_id))

    def list_diagnostics(self, role_id: int) -> List[DiagnosticResponse]:
        role = self._require(role_id)
        return [DiagnosticResponse.model_validate(a) for a in role.diagnostics]

    # ---- writes ---------------------------------------------------------

    def create_role(self, req: RoleCreate) -> RoleResponse:
        role = Role(
            name=req.name,
            interview_date=req.interview_date,
            job_description=req.job_description,
            lens=req.lens,
            is_archived=False,
        )
        role.requirements = self._build_requirements(req.requirements)
        self.db.add(role)
        self.db.commit()
        self.db.refresh(role)
        return self._to_response(role)

    def update_role(self, role_id: int, req: RoleUpdate) -> RoleResponse:
        role = self._require(role_id)
        changes = req.model_dump(exclude_unset=True)
        if "name" in changes and changes["name"] is not None:
            role.name = changes["name"]
        if "interview_date" in changes:
            role.interview_date = changes["interview_date"]
        if changes.get("job_description") is not None:
            role.job_description = changes["job_description"]
        if changes.get("lens") is not None:
            if role.diagnostics and changes["lens"] != role.diagnostics[0].lens:
                # The lens only chooses the diagnostic's questions; once it has
                # been taken, changing it would make the next retake
                # incomparable -- so the role keeps the lens it was diagnosed in.
                raise InvalidExamStateException(
                    "The diagnostic was taken as this lens. Changing it would make a retake "
                    "compare different questions, so it stays as it is."
                )
            role.lens = changes["lens"]
        if changes.get("is_archived") is not None:
            role.is_archived = changes["is_archived"]
        self.db.commit()
        self.db.refresh(role)
        return self._to_response(role)

    def replace_requirements(self, role_id: int, requirements: List[RoleRequirementIn]) -> RoleResponse:
        role = self._require(role_id)
        role.requirements = self._build_requirements(requirements)
        self.db.commit()
        self.db.refresh(role)
        return self._to_response(role)

    def delete_role(self, role_id: int) -> None:
        """The role, its requirements and its diagnostics. Preparations are untouched."""
        role = self._require(role_id)
        self.db.delete(role)
        self.db.commit()

    def add_diagnostic(self, role_id: int, req: DiagnosticCreate) -> DiagnosticResponse:
        role = self._require(role_id)
        refs = [item.question_ref for item in req.items]
        if len(set(refs)) != len(refs):
            raise InvalidExamStateException("A question appears twice in this attempt.")

        for item in req.items:
            points, lens = _points_for(item.question_ref)
            if points is None:
                raise InvalidExamStateException(
                    f"{item.question_ref!r} isn't a question in any shipped content pack."
                )
            if lens is not None and lens != req.lens:
                raise InvalidExamStateException(
                    f"{item.question_ref!r} is the {lens} version of a question, but this attempt "
                    f"is answered as {req.lens}."
                )
            if any(i < 0 or i >= len(points) for i in item.covered) or len(set(item.covered)) != len(item.covered):
                raise InvalidExamStateException(
                    f"The points covered for {item.question_ref!r} aren't points of that question."
                )

        first = role.diagnostics[0] if role.diagnostics else None
        if first is not None:
            if req.lens != first.lens:
                raise InvalidExamStateException(
                    f"A retake is answered as the first attempt was ({first.lens}), so the two "
                    "can be compared."
                )
            if sorted(refs) != sorted(i["question_ref"] for i in first.items):
                raise InvalidExamStateException(
                    "A retake asks the same questions as the first attempt, so before and after "
                    "compare like with like. This one asks different ones."
                )

        items = [item.model_dump() for item in req.items]
        if first is not None:
            # Whether a question fit a requirement was decided when the set was
            # chosen; a retake keeps that label rather than taking the client's.
            fits = {i["question_ref"]: i.get("fits_requirement", False) for i in first.items}
            for item in items:
                item["fits_requirement"] = fits[item["question_ref"]]
        attempt = RoleDiagnosticAttempt(role_id=role.id, lens=req.lens, items=items)
        if first is None:
            role.lens = req.lens
        self.db.add(attempt)
        self.db.commit()
        self.db.refresh(attempt)
        return DiagnosticResponse.model_validate(attempt)

    # ---- helpers --------------------------------------------------------

    def _build_requirements(self, items: List[RoleRequirementIn]) -> List[RoleRequirement]:
        ids = {i.subject_id for i in items if i.subject_id is not None}
        if ids:
            found = {s.id: s for s in self.db.query(Subject).filter(Subject.id.in_(ids)).all()}
            missing = ids - set(found)
            if missing:
                raise ResourceNotFoundException("Subject", sorted(missing)[0])
            not_skills = [s.name for s in found.values() if s.kind != SubjectKind.SKILL]
            if not_skills:
                raise InvalidExamStateException(
                    f"Requirements link to Skill preparations; {not_skills[0]!r} is a certification."
                )
        return [
            RoleRequirement(order_index=i, text=item.text, kind=item.kind, subject_id=item.subject_id)
            for i, item in enumerate(items)
        ]

    def _to_response(self, role: Role) -> RoleResponse:
        return RoleResponse(
            id=role.id, name=role.name, interview_date=role.interview_date,
            job_description=role.job_description or "", lens=role.lens,
            is_archived=bool(role.is_archived), created_at=role.created_at, updated_at=role.updated_at,
            requirements=[
                RoleRequirementResponse(
                    id=r.id, order_index=r.order_index, text=r.text, kind=r.kind,
                    subject_id=r.subject_id, subject_name=r.subject.name if r.subject else None,
                )
                for r in role.requirements
            ],
            diagnostic_count=len(role.diagnostics),
        )

    def _require(self, role_id: int) -> Role:
        role = self.db.get(Role, role_id)
        if role is None:
            raise ResourceNotFoundException("Role", role_id)
        return role
