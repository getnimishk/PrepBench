from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.llm_config import (
    DetectedRunner,
    LauncherRequest,
    LauncherScript,
    LocalModelOption,
    ModelListResponse,
    ProfileInfo,
    ProviderCreate,
    ProviderResponse,
    ProviderUpdate,
    RunnerInfo,
    SystemInfo,
    TaskBindingInfo,
    TaskBindingUpdate,
    VerifyResult,
)
from app.services.llm_config_service import LLMConfigService

router = APIRouter(prefix="/llm", tags=["AI Providers"])


# Static segments are declared before any parameterised ones, matching the
# ordering convention the roadmaps router already follows -- otherwise
# /llm/providers/detect would be captured by /llm/providers/{provider_id}.

@router.get("/profiles", response_model=List[ProfileInfo])
def list_profiles(db: Session = Depends(get_db)):
    """Provider types that can be added, built-in plus any user-supplied ones."""
    return LLMConfigService(db).list_profiles()


@router.get("/local/detect", response_model=List[DetectedRunner])
def detect_local_runners(db: Session = Depends(get_db)):
    """
    Look for a model server already running on this machine.

    Loopback only and only when asked -- never at startup, so the offline-first
    guarantee holds.
    """
    return LLMConfigService(db).detect_local_runners()


@router.get("/system-info", response_model=SystemInfo)
def get_system_info(db: Session = Depends(get_db)):
    """
    What this machine can run. Read locally from the OS; nothing is reported
    anywhere, and unmeasurable figures come back null rather than guessed.
    """
    return LLMConfigService(db).get_system_info()


@router.get("/local/models", response_model=List[LocalModelOption])
def list_local_models(ram_gb: float = None, db: Session = Depends(get_db)):
    """
    The model catalogue, annotated with whether this machine can run each one.

    `ram_gb` overrides the measured value, so the UI can preview
    recommendations for a different machine.
    """
    return LLMConfigService(db).list_local_models(ram_gb)


@router.get("/local/runners", response_model=List[RunnerInfo])
def list_runners(db: Session = Depends(get_db)):
    return LLMConfigService(db).list_runners()


@router.get("/local/runners/{key}", response_model=RunnerInfo)
def get_runner(key: str, db: Session = Depends(get_db)):
    return LLMConfigService(db).get_runner(key)


@router.post("/local/launcher", response_model=LauncherScript)
def build_launcher(req: LauncherRequest, db: Session = Depends(get_db)):
    """
    Generate a start script for the user to save and run themselves.

    Returns the text only. PrepBench never writes an executable to disk and
    never launches a model server -- see llm/local_setup.py for why.
    """
    return LLMConfigService(db).build_launcher(req)


@router.get("/tasks", response_model=List[TaskBindingInfo])
def list_tasks(db: Session = Depends(get_db)):
    return LLMConfigService(db).list_tasks()


@router.put("/tasks/{task}", response_model=TaskBindingInfo)
def set_task_binding(task: str, req: TaskBindingUpdate, db: Session = Depends(get_db)):
    return LLMConfigService(db).set_task_binding(task, req)


@router.get("/providers", response_model=List[ProviderResponse])
def list_providers(db: Session = Depends(get_db)):
    return LLMConfigService(db).list_providers()


@router.post("/providers", response_model=ProviderResponse, status_code=status.HTTP_201_CREATED)
def create_provider(req: ProviderCreate, db: Session = Depends(get_db)):
    return LLMConfigService(db).create_provider(req)


@router.get("/providers/{provider_id}", response_model=ProviderResponse)
def get_provider(provider_id: int, db: Session = Depends(get_db)):
    return LLMConfigService(db).get_provider(provider_id)


@router.patch("/providers/{provider_id}", response_model=ProviderResponse)
def update_provider(provider_id: int, req: ProviderUpdate, db: Session = Depends(get_db)):
    return LLMConfigService(db).update_provider(provider_id, req)


@router.delete("/providers/{provider_id}", status_code=status.HTTP_200_OK)
def delete_provider(provider_id: int, db: Session = Depends(get_db)):
    LLMConfigService(db).delete_provider(provider_id)
    return {"status": "success", "deleted_id": provider_id}


@router.post("/providers/{provider_id}/verify", response_model=VerifyResult)
def verify_provider(provider_id: int, db: Session = Depends(get_db)):
    """
    Actually talk to the provider.

    Runs a real completion rather than a connectivity check: an open port does
    not prove the weights are loaded or the key is valid.
    """
    return LLMConfigService(db).verify_provider(provider_id)


@router.get("/providers/{provider_id}/models", response_model=ModelListResponse)
def list_provider_models(provider_id: int, db: Session = Depends(get_db)):
    return LLMConfigService(db).list_models(provider_id)
