# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.export_service import ExportService

router = APIRouter(prefix="/export", tags=["Exports"])

@router.get("/pdf/{session_id}")
def export_pdf(session_id: int, db: Session = Depends(get_db)):
    service = ExportService(db)
    pdf_bytes = service.export_pdf(session_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=exam_report_{session_id}.pdf"}
    )

@router.get("/excel/{session_id}")
def export_excel(session_id: int, db: Session = Depends(get_db)):
    service = ExportService(db)
    excel_bytes = service.export_excel(session_id)
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=exam_report_{session_id}.xlsx"}
    )
