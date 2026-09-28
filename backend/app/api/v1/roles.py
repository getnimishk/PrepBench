# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import List

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.role import (
    DiagnosticCreate,
    DiagnosticResponse,
    RoleCreate,
    RoleRequirementsReplace,
    RoleResponse,
    RoleSummary,
    RoleUpdate,
)
from app.services.role_service import RoleService

router = APIRouter(prefix="/roles", tags=["Roles"])


@router.get("", response_model=List[RoleSummary])
def list_roles(include_archived: bool = Query(False), db: Session = Depends(get_db)):
    """Jobs the learner is preparing for. No readiness: a role has no mocks."""
    return RoleService(db).list_roles(include_archived=include_archived)


@router.post("", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def create_role(req: RoleCreate, db: Session = Depends(get_db)):
    """A role from a job description, with the requirements the learner confirmed."""
    return RoleService(db).create_role(req)


@router.get("/{role_id}", response_model=RoleResponse)
def get_role(role_id: int, db: Session = Depends(get_db)):
    return RoleService(db).get_role(role_id)


@router.put("/{role_id}", response_model=RoleResponse)
def update_role(role_id: int, req: RoleUpdate, db: Session = Depends(get_db)):
    return RoleService(db).update_role(role_id, req)


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(role_id: int, db: Session = Depends(get_db)):
    """The role, its requirements and its diagnostics. Preparations are untouched."""
    RoleService(db).delete_role(role_id)


@router.put("/{role_id}/requirements", response_model=RoleResponse)
def replace_requirements(role_id: int, req: RoleRequirementsReplace, db: Session = Depends(get_db)):
    """Replace the requirement list, including the Skill links the learner confirmed."""
    return RoleService(db).replace_requirements(role_id, req.requirements)


@router.get("/{role_id}/diagnostics", response_model=List[DiagnosticResponse])
def list_diagnostics(role_id: int, db: Session = Depends(get_db)):
    """Every attempt, oldest first: the first is "before", the latest "after"."""
    return RoleService(db).list_diagnostics(role_id)


@router.post("/{role_id}/diagnostics", response_model=DiagnosticResponse, status_code=status.HTTP_201_CREATED)
def add_diagnostic(role_id: int, req: DiagnosticCreate, db: Session = Depends(get_db)):
    """Record an attempt. A retake must ask the first attempt's questions, as its lens."""
    return RoleService(db).add_diagnostic(role_id, req)
