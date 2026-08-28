# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import Base, engine, apply_lightweight_migrations, SessionLocal
from app.api.v1.router import api_router
from app.core.logging_config import logger
from app.utils.seed_system_design_prompts import seed_system_design_prompts_if_empty
from app.utils.seed_interview_questions import seed_interview_questions_if_empty
from app.llm.bootstrap import import_env_provider_if_absent

# Create DB Tables
Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Modern FastAPI lifespan handler replacing deprecated @app.on_event('startup')."""
    logger.info("Initializing database and applying migrations...")
    apply_lightweight_migrations()

    db = SessionLocal()
    try:
        seeded = seed_system_design_prompts_if_empty(db)
        if seeded:
            logger.info(f"Seeded {seeded} built-in system design prompts.")

        seeded_questions = seed_interview_questions_if_empty(db)
        if seeded_questions:
            logger.info(f"Seeded {seeded_questions} built-in interview questions.")

        # Turns a pre-existing GEMINI_API_KEY into a visible provider row, once.
        import_env_provider_if_absent(db)
    finally:
        db.close()

    yield  # Application runs here
    logger.info("Exam Simulator shutting down.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# Enable CORS for local Vite frontend dev server and desktop shells
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "tauri://localhost",
        "http://tauri.localhost"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request, call_next):
    logger.debug(f"--> Incoming Request: {request.method} {request.url.path}")
    response = await call_next(request)
    logger.debug(f"<-- Response Status: {response.status_code} for {request.method} {request.url.path}")
    return response

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    return {
        "status": "online",
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs_url": "/docs",
    }
