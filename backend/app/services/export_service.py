# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from sqlalchemy.orm import Session
from app.repositories.exam_repository import ExamRepository
from app.utils.pdf_generator import generate_exam_pdf_report
from app.utils.excel_generator import generate_exam_excel_report
from app.core.exceptions import ResourceNotFoundException

class ExportService:
    def __init__(self, db: Session):
        self.db = db
        self.exam_repo = ExamRepository(db)

    def export_pdf(self, session_id: int) -> bytes:
        session = self.exam_repo.get_session_by_id(session_id)
        if not session:
            raise ResourceNotFoundException("ExamSession", session_id)
        return generate_exam_pdf_report(session)

    def export_excel(self, session_id: int) -> bytes:
        session = self.exam_repo.get_session_by_id(session_id)
        if not session:
            raise ResourceNotFoundException("ExamSession", session_id)
        return generate_exam_excel_report(session)
