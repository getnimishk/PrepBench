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
