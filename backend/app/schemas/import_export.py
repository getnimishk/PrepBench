# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import List, Optional
from pydantic import BaseModel

class ImportResult(BaseModel):
    success_count: int
    failed_count: int
    total_processed: int
    errors: List[str] = []

class ExportRequest(BaseModel):
    format: str # "pdf", "excel", "csv"
    session_id: Optional[int] = None
