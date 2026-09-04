# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The vocabulary the rest of the app speaks to the LLM layer in.

Three things were fused together in the per-service constants this package
replaces: *who* runs the model (vendor), *which* model, and *what the task
actually needs* (capability). Separating them is what makes the layer
vendor-agnostic -- a feature service names a task, and nothing above the
adapter row knows a vendor exists.
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, FrozenSet, Optional


class Capability(str, Enum):
    """What a provider can be asked to do, independent of who provides it."""

    TEXT_JSON = "text_json"        # prompt in, JSON object out
    AUDIO_JSON = "audio_json"      # audio + prompt in, JSON object out
    EMBEDDING = "embedding"        # text in, vector out
    TRANSCRIPTION = "transcription"  # audio in, text out (Whisper; not yet implemented)


class LLMTask(str, Enum):
    """Every AI-backed operation in PrepBench, named once."""

    CONTENT_VALIDATION = "content_validation"
    INTERVIEW_QUESTION_GEN = "interview_question_gen"
    SYSTEM_DESIGN_PROMPT_GEN = "system_design_prompt_gen"
    SYSTEM_DESIGN_GRADING = "system_design_grading"
    DESIGN_REVIEW_GRADING = "design_review_grading"
    RECORDING_ANALYSIS = "recording_analysis"
    EMBEDDING = "embedding"


@dataclass(frozen=True)
class TaskSpec:
    """
    What a task needs and how long it is allowed to take.

    Two timeouts, not one: local inference on CPU runs roughly 5-20x slower
    than a cloud call, so the single hardcoded number each call site used to
    carry cannot serve both. The cloud values below are exactly the ones those
    call sites used, so nothing changes for existing cloud users.
    """

    capability: Capability
    cloud_timeout: float
    local_timeout: float


TASK_SPECS: Dict[LLMTask, TaskSpec] = {
    LLMTask.CONTENT_VALIDATION:       TaskSpec(Capability.TEXT_JSON, 15.0, 120.0),
    LLMTask.INTERVIEW_QUESTION_GEN:   TaskSpec(Capability.TEXT_JSON, 20.0, 180.0),
    LLMTask.SYSTEM_DESIGN_PROMPT_GEN: TaskSpec(Capability.TEXT_JSON, 20.0, 180.0),
    LLMTask.SYSTEM_DESIGN_GRADING:    TaskSpec(Capability.TEXT_JSON, 25.0, 300.0),
    # One narrow question against a short justification, so it needs far less
    # headroom than grading a whole architecture answer.
    LLMTask.DESIGN_REVIEW_GRADING:    TaskSpec(Capability.TEXT_JSON, 20.0, 180.0),
    LLMTask.RECORDING_ANALYSIS:       TaskSpec(Capability.AUDIO_JSON, 45.0, 600.0),
    LLMTask.EMBEDDING:                TaskSpec(Capability.EMBEDDING, 10.0, 60.0),
}


def utc_now_naive_safe():
    """
    Naive-UTC 'now', matching how every timestamp in this app is stored.

    Here rather than in core.timeutils because the LLM package is imported by
    services that must not pull in the analytics helpers.
    """
    from datetime import datetime, UTC

    return datetime.now(UTC).replace(tzinfo=None)


@dataclass(frozen=True)
class Connection:
    """
    A resolved, ready-to-use provider: profile facts merged with the user's
    configuration and the credential already looked up.

    Adapters read this and never touch settings, the database, or the
    environment -- which is what keeps them pure enough to test from fixtures.
    """

    provider_name: str          # user-facing label, e.g. "Gemini (from .env)"
    profile_key: str            # entry in llm_profiles.json
    adapter_key: str            # which wire protocol
    base_url: str
    auth: dict
    api_key: Optional[str]
    is_local: bool
    supports_json_mode: bool
    capabilities: FrozenSet[Capability]
    model_discovery: Optional[str] = None

    def supports(self, capability: Capability) -> bool:
        return capability in self.capabilities


@dataclass
class LLMRequest:
    """One unit of work, expressed without reference to any vendor."""

    capability: Capability
    model: str
    prompt: str = ""
    json_mode: bool = True

    # AUDIO_JSON only
    media_bytes: Optional[bytes] = None
    media_mime: Optional[str] = None

    # EMBEDDING only
    input_text: Optional[str] = None


@dataclass
class HttpRequestSpec:
    """
    What an adapter produces instead of performing the call itself.

    Returning a description of the request rather than making it keeps every
    adapter a pure function, so the whole vendor matrix is unit-testable from
    recorded fixtures with no network and no mocking library.
    """

    method: str
    url: str
    json_body: dict
    headers: Dict[str, str] = field(default_factory=dict)


@dataclass
class LLMResult:
    """
    The outcome of a task. Mirrors the never-raises,
    (parsed_or_None, error_or_None) contract the previous llm_client used, and
    adds the provenance the UI needs once more than one provider can exist.

    `status` distinguishes the two failure modes the app has always treated
    differently: "unavailable" means nothing was configured or the provider
    cannot do this task -- honest absence, not a failure -- while "error"
    means a configured provider was asked and did not deliver.
    """

    status: str                       # "ok" | "unavailable" | "error"
    data: Optional[dict] = None
    vector: Optional[list] = None     # EMBEDDING only
    error: Optional[str] = None
    provider_name: Optional[str] = None
    model: Optional[str] = None
    latency_ms: Optional[int] = None

    @property
    def ok(self) -> bool:
        return self.status == "ok"

    @property
    def unavailable(self) -> bool:
        return self.status == "unavailable"

    def as_tuple(self):
        """
        (data, error) in the shape the previous call sites already handle.

        Lets each feature service adopt the gateway without restructuring its
        error branches in the same change.
        """
        return self.data, self.error
