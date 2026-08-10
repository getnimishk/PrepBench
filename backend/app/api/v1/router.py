from fastapi import APIRouter
from app.api.v1 import questions, exams, analytics, imports, export, settings

api_router = APIRouter()

api_router.include_router(questions.router)
api_router.include_router(exams.router)
api_router.include_router(analytics.router)
api_router.include_router(imports.router)
api_router.include_router(export.router)
api_router.include_router(settings.router)
