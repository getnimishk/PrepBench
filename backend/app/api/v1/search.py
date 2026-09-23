# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.search import SearchResponse
from app.services.search_service import SearchService

router = APIRouter(prefix="/search", tags=["Search"])


@router.get("", response_model=SearchResponse)
def search(
    q: Annotated[str, Query(min_length=1, max_length=200, description="The text to find, matched literally.")],
    subject_id: Annotated[Optional[int], Query(
        description=(
            "The preparation to search in. Omit to search every preparation. "
            "Recordings belong to no preparation and are searched either way."
        ),
    )] = None,
    limit: Annotated[int, Query(ge=1, le=50, description="Most results listed per kind; totals count all.")] = 6,
    db: Session = Depends(get_db),
):
    """Questions, study guide sections, roadmaps, roadmap topics and recordings that match."""
    return SearchService(db).search(q, subject_id=subject_id, limit=limit)
