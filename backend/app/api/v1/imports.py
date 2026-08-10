from typing import List
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.import_export import ImportResult
from app.schemas.question import QuestionCreate
from app.schemas.question_validation import QuestionValidationReport
from app.services.import_service import ImportService

router = APIRouter(prefix="/imports", tags=["Imports"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB limit

@router.post("/validate", response_model=QuestionValidationReport)
async def validate_file_import(
    file: UploadFile = File(...),
    validate_content: bool = False,
    db: Session = Depends(get_db)
):
    service = ImportService(db)
    filename = file.filename if file.filename else "file.txt"
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds maximum limit of 10 MB."
        )
    try:
        return service.validate_file(filename, contents, validate_content=validate_content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse import file for validation: {str(e)}"
        )

@router.post("/confirm", response_model=ImportResult)
def confirm_import(questions: List[QuestionCreate], db: Session = Depends(get_db)):
    service = ImportService(db)
    return service.import_validated_batch(questions)

@router.post("/file", response_model=ImportResult)
async def import_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    service = ImportService(db)
    filename = file.filename.lower() if file.filename else ""
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds maximum limit of 10 MB."
        )

    try:
        if filename.endswith(".json"):
            return service.import_from_json(contents.decode("utf-8"))
        elif filename.endswith(".md") or filename.endswith(".markdown"):
            return service.import_from_markdown(contents.decode("utf-8"))
        elif filename.endswith(".csv"):
            return service.import_from_csv(contents)
        elif filename.endswith(".xlsx") or filename.endswith(".xls"):
            return service.import_from_excel(contents)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type for '{file.filename}'. Supported formats: .json, .md, .markdown, .csv, .xlsx, .xls"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to import file: {str(e)}"
        )

@router.post("/auto-refine-batch", response_model=List[QuestionCreate])
def auto_refine_batch(questions: List[QuestionCreate], db: Session = Depends(get_db)):
    service = ImportService(db)
    return service.refine_question_batch(questions)

@router.post("/batch-research")
def batch_research_import(questions: List[QuestionCreate], db: Session = Depends(get_db)):
    from app.services.content_validator import ContentValidator
    validator = ContentValidator()
    results = []
    for idx, q in enumerate(questions):
        opts = [{"option_text": opt.option_text, "is_correct": opt.is_correct} for opt in (q.options or [])]
        res = validator.research_question(
            question_id=idx + 1,
            question_text=q.text,
            options=opts
        )
        results.append(res)
    return results

@router.post("/repair")
async def repair_file_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    service = ImportService(db)
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds maximum limit of 10 MB."
        )
    try:
        md_text = contents.decode("utf-8")
        repaired_md = service.repair_markdown_content(md_text)
        from fastapi.responses import Response
        return Response(
            content=repaired_md,
            media_type="text/markdown",
            headers={"Content-Disposition": f"attachment; filename=repaired_{file.filename or 'questions.md'}"}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to repair question file: {str(e)}"
        )
