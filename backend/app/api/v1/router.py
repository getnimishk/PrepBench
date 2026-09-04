# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from fastapi import APIRouter
from app.api.v1 import questions, exams, analytics, imports, export, settings, system_design, design_review, recordings, interview_questions, roadmaps, llm

api_router = APIRouter()

api_router.include_router(questions.router)
api_router.include_router(exams.router)
api_router.include_router(analytics.router)
api_router.include_router(imports.router)
api_router.include_router(export.router)
api_router.include_router(settings.router)
api_router.include_router(system_design.router)
api_router.include_router(design_review.router)
api_router.include_router(recordings.router)
api_router.include_router(interview_questions.router)
api_router.include_router(roadmaps.router)
api_router.include_router(llm.router)
