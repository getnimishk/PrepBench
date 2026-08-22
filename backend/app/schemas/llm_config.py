from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class ProfileInfo(BaseModel):
    """An installable provider type, from the profile catalogue."""

    key: str
    label: str
    adapter: str
    capabilities: List[str]
    is_local: Optional[bool]          # None = inferred from the URL the user enters
    requires_api_key: bool
    base_url: Optional[str]           # None = the user must supply one
    default_models: dict = Field(default_factory=dict)
    setup_guide: Optional[str] = None


class ProviderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    profile_key: str
    base_url: Optional[str] = None
    api_key: Optional[str] = None     # write-only; stored via llm.secrets
    default_text_model: Optional[str] = None
    default_audio_model: Optional[str] = None
    default_embedding_model: Optional[str] = None
    is_enabled: bool = True


class ProviderUpdate(BaseModel):
    """
    PATCH semantics via exclude_unset, matching the rest of this app.

    api_key has three distinct states and they must stay distinguishable:
    absent leaves the stored key alone, a string replaces it, and an empty
    string clears it.
    """

    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    default_text_model: Optional[str] = None
    default_audio_model: Optional[str] = None
    default_embedding_model: Optional[str] = None
    is_enabled: Optional[bool] = None


class ProviderResponse(BaseModel):
    """
    What the UI sees. Deliberately has no field that could carry the key
    itself -- only whether one exists and its last four characters.
    """

    id: int
    name: str
    profile_key: str
    profile_label: Optional[str] = None
    adapter: Optional[str] = None
    base_url: Optional[str] = None
    effective_base_url: Optional[str] = None
    is_local: bool = False
    capabilities: List[str] = Field(default_factory=list)

    has_api_key: bool = False
    api_key_hint: Optional[str] = None
    api_key_is_from_env: bool = False

    default_text_model: Optional[str] = None
    default_audio_model: Optional[str] = None
    default_embedding_model: Optional[str] = None

    is_enabled: bool = True
    last_verified_at: Optional[datetime] = None
    last_verify_error: Optional[str] = None
    last_latency_ms: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class VerifyResult(BaseModel):
    """
    The outcome of actually talking to the provider.

    `readiness` is the honest summary the user acts on: an open port proves
    nothing, so this reflects a real completion round-trip.
    """

    ok: bool
    readiness: str                    # "ready" | "slow" | "unreachable" | "error"
    message: str
    latency_ms: Optional[int] = None
    detected_models: List[str] = Field(default_factory=list)
    resolved_model: Optional[str] = None
    returned_valid_json: Optional[bool] = None


class TaskBindingInfo(BaseModel):
    """One task, what it needs, and who currently answers it."""

    task: str
    label: str
    capability: str
    bound_provider_id: Optional[int] = None
    bound_model: Optional[str] = None
    resolved_provider_id: Optional[int] = None
    resolved_provider_name: Optional[str] = None
    resolved_model: Optional[str] = None
    is_available: bool = False
    unavailable_reason: Optional[str] = None
    cloud_timeout_seconds: float = 0
    local_timeout_seconds: float = 0


class TaskBindingUpdate(BaseModel):
    provider_id: Optional[int] = None   # None = fall back to automatic resolution
    model: Optional[str] = None


class DetectedRunner(BaseModel):
    """A local model server found listening on a well-known port."""

    profile_key: str
    label: str
    base_url: str
    models: List[str] = Field(default_factory=list)
    already_configured: bool = False


class ModelListResponse(BaseModel):
    models: List[str] = Field(default_factory=list)
    error: Optional[str] = None


class SystemInfo(BaseModel):
    """
    What this machine can handle. Every figure is nullable: an unmeasurable
    machine reports "unknown" rather than a fabricated number, and the UI says
    so instead of recommending blind.
    """

    os_family: str
    total_ram_gb: Optional[float] = None
    available_ram_gb: Optional[float] = None
    usable_for_model_gb: Optional[float] = None


class LocalModelOption(BaseModel):
    id: str
    label: str
    parameters_b: float
    quantisation: str
    download_gb: float
    ram_required_gb: float
    licence: str
    licence_commercial_ok: bool
    sweet_spot: bool = False
    summary: str
    download_url: str
    good_for: List[str] = Field(default_factory=list)
    weak_at: List[str] = Field(default_factory=list)

    # Two different questions: `fits` is about the machine and is stable,
    # `fits_now` is about this moment and tells the user to close some apps.
    # None on either means the machine's memory could not be measured.
    fits: Optional[bool] = None
    fits_now: Optional[bool] = None
    fit_note: str = ""
    recommended: bool = False


class RunnerInfo(BaseModel):
    key: str
    label: str
    summary: str
    download_url: str
    default_port: int
    pull_style: str
    steps: dict = Field(default_factory=dict)


class LauncherRequest(BaseModel):
    runner_key: str
    model_file: str
    port: Optional[int] = None
    ctx_size: int = 4096
    os_family: Optional[str] = None


class LauncherScript(BaseModel):
    filename: str
    content: str
    command: str
    os_family: str
    port: Optional[int] = None
