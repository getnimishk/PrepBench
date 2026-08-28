# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Provider management: the service behind the Settings UI.

Everything the user can do to configuration lives here -- list what can be
installed, add/edit/remove a provider, prove one actually works, and route
individual tasks.
"""
import time
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.exceptions import ResourceNotFoundException
from app.core.logging_config import logger
from app.llm import local_setup
from app.llm import profiles as profile_store
from app.llm import secrets
from app.llm import system_info
from app.llm.adapters import get_adapter
from app.llm.gateway import LLMGateway
from app.llm.transport import get_json, get_shared_client
from app.llm.types import TASK_SPECS, Capability, LLMRequest, LLMTask
from app.repositories.llm_repository import LLMConfigRepository
from app.schemas.llm_config import (
    DetectedRunner,
    LauncherRequest,
    LauncherScript,
    LocalModelOption,
    ModelListResponse,
    ProfileInfo,
    RunnerInfo,
    SystemInfo,
    ProviderCreate,
    ProviderResponse,
    ProviderUpdate,
    TaskBindingInfo,
    TaskBindingUpdate,
    VerifyResult,
)

TASK_LABELS = {
    LLMTask.SYSTEM_DESIGN_GRADING: "System Design grading",
    LLMTask.SYSTEM_DESIGN_PROMPT_GEN: "System Design prompt generation",
    LLMTask.INTERVIEW_QUESTION_GEN: "Interview question generation",
    LLMTask.RECORDING_ANALYSIS: "Interview recording analysis",
    LLMTask.CONTENT_VALIDATION: "Question content validation",
    LLMTask.EMBEDDING: "Semantic search indexing",
}

# Ports probed by local detection, in the order a user is most likely to have
# them. Loopback only, and only when the user asks -- the offline-first promise
# means nothing here may run at startup.
LOCAL_PROBE_TARGETS = [
    ("llamafile", "http://localhost:8080/v1"),
    ("ollama", "http://localhost:11434/v1"),
    ("lmstudio", "http://localhost:1234/v1"),
]

# A round-trip slower than this is usable but will feel bad for grading, and
# the user should be told before they discover it mid-exam-review.
SLOW_LATENCY_MS = 30_000

VERIFY_PROMPT = 'Reply with exactly this JSON and nothing else: {"ok": true}'


class LLMConfigService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = LLMConfigRepository(db)
        self.gateway = LLMGateway(db)

    # ---- Profiles ----------------------------------------------------

    def list_profiles(self) -> List[ProfileInfo]:
        out = []
        for key, profile in profile_store.load_profiles().items():
            auth_style = (profile.get("auth") or {}).get("style", "none")
            out.append(ProfileInfo(
                key=key,
                label=profile.get("label", key),
                adapter=profile.get("adapter", ""),
                capabilities=[c.value for c in profile_store.profile_capabilities(profile)],
                is_local=profile.get("is_local"),
                requires_api_key=auth_style not in ("none", "optional_bearer"),
                base_url=profile.get("base_url"),
                default_models=profile.get("default_models") or {},
                setup_guide=profile.get("setup_guide"),
            ))
        # Local options first: they are the ones we want a privacy-minded user
        # to see before the cloud ones.
        return sorted(out, key=lambda p: (p.is_local is not True, p.label))

    # ---- Providers ---------------------------------------------------

    def _to_response(self, row) -> ProviderResponse:
        profile = profile_store.get_profile(row.profile_key) or {}
        has_key, hint = secrets.describe_secret(row.api_key_ref)
        effective_base_url = row.base_url or profile.get("base_url")

        return ProviderResponse(
            id=row.id,
            name=row.name,
            profile_key=row.profile_key,
            profile_label=profile.get("label", row.profile_key),
            adapter=profile.get("adapter"),
            base_url=row.base_url,
            effective_base_url=effective_base_url,
            is_local=profile_store.infer_is_local(profile, effective_base_url),
            capabilities=[c.value for c in profile_store.profile_capabilities(profile)],
            has_api_key=has_key,
            api_key_hint=hint,
            api_key_is_from_env=secrets.is_env_ref(row.api_key_ref),
            default_text_model=row.default_text_model,
            default_audio_model=row.default_audio_model,
            default_embedding_model=row.default_embedding_model,
            is_enabled=row.is_enabled,
            last_verified_at=row.last_verified_at,
            last_verify_error=row.last_verify_error,
            last_latency_ms=row.last_latency_ms,
        )

    def list_providers(self) -> List[ProviderResponse]:
        return [self._to_response(r) for r in self.repo.list_providers()]

    def get_provider(self, provider_id: int) -> ProviderResponse:
        row = self.repo.get_provider(provider_id)
        if not row:
            raise ResourceNotFoundException("LLMProviderConfig", provider_id)
        return self._to_response(row)

    def _validate_profile_and_url(self, profile_key: str, base_url: Optional[str]) -> dict:
        profile = profile_store.get_profile(profile_key)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown provider type {profile_key!r}.",
            )
        if not (base_url or profile.get("base_url")):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{profile.get('label', profile_key)} needs a server address.",
            )
        return profile

    def create_provider(self, req: ProviderCreate) -> ProviderResponse:
        self._validate_profile_and_url(req.profile_key, req.base_url)

        if self.repo.get_provider_by_name(req.name):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A provider named {req.name!r} already exists.",
            )

        api_key_ref = secrets.store_secret(req.api_key) if req.api_key else None

        row = self.repo.create_provider(
            name=req.name,
            profile_key=req.profile_key,
            base_url=req.base_url or None,
            api_key_ref=api_key_ref,
            default_text_model=req.default_text_model or None,
            default_audio_model=req.default_audio_model or None,
            default_embedding_model=req.default_embedding_model or None,
            is_enabled=req.is_enabled,
        )
        logger.info(f"Added LLM provider {row.name!r} ({row.profile_key}).")
        return self._to_response(row)

    def update_provider(self, provider_id: int, req: ProviderUpdate) -> ProviderResponse:
        row = self.repo.get_provider(provider_id)
        if not row:
            raise ResourceNotFoundException("LLMProviderConfig", provider_id)

        changes = req.model_dump(exclude_unset=True)

        if "name" in changes:
            clash = self.repo.get_provider_by_name(changes["name"])
            if clash and clash.id != provider_id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"A provider named {changes['name']!r} already exists.",
                )

        # api_key is write-only and three-state: absent leaves it, a value
        # replaces it, an empty string clears it.
        if "api_key" in changes:
            new_key = changes.pop("api_key")
            if new_key:
                if secrets.is_env_ref(row.api_key_ref):
                    # Do not silently take over an environment-managed key --
                    # storing a copy would leave two sources of truth.
                    row.api_key_ref = secrets.store_secret(new_key)
                else:
                    row.api_key_ref = secrets.store_secret(new_key, existing_ref=row.api_key_ref)
            else:
                if not secrets.is_env_ref(row.api_key_ref):
                    secrets.delete_secret(row.api_key_ref)
                row.api_key_ref = None

        if "base_url" in changes:
            self._validate_profile_and_url(row.profile_key, changes["base_url"])

        for field, value in changes.items():
            setattr(row, field, value)

        self.repo.commit()
        return self._to_response(row)

    def delete_provider(self, provider_id: int) -> None:
        row = self.repo.get_provider(provider_id)
        if not row:
            raise ResourceNotFoundException("LLMProviderConfig", provider_id)

        # Remove the credential too: leaving it behind would accumulate
        # unreferenced secrets that nothing can ever clean up.
        if not secrets.is_env_ref(row.api_key_ref):
            secrets.delete_secret(row.api_key_ref)

        self.repo.delete_provider(provider_id)
        logger.info(f"Removed LLM provider {row.name!r}.")

    # ---- Verification ------------------------------------------------

    def _connection_for(self, row):
        profile = profile_store.get_profile(row.profile_key)
        if not profile:
            return None, f"Unknown provider type {row.profile_key!r}."
        conn = self.gateway._connection_from_row(row, profile)
        if not conn:
            return None, "This provider has no server address configured."
        return conn, None

    def list_models(self, provider_id: int) -> ModelListResponse:
        row = self.repo.get_provider(provider_id)
        if not row:
            raise ResourceNotFoundException("LLMProviderConfig", provider_id)

        conn, error = self._connection_for(row)
        if error:
            return ModelListResponse(error=error)
        if not conn.model_discovery:
            return ModelListResponse(error="This provider does not support listing models.")

        adapter = get_adapter(conn.adapter_key)
        url = f"{conn.base_url.rstrip('/')}{conn.model_discovery}"
        headers = {}
        if conn.api_key and (conn.auth or {}).get("style") in ("bearer", "optional_bearer"):
            headers["Authorization"] = f"Bearer {conn.api_key}"

        raw, transport_error = get_json(get_shared_client(), url, timeout=8.0, headers=headers or None)
        if transport_error:
            return ModelListResponse(error=transport_error)
        return ModelListResponse(models=adapter.parse_model_list(raw))

    def verify_provider(self, provider_id: int) -> VerifyResult:
        """
        Prove the provider actually works.

        An open port is not evidence: llamafile answers /models before the
        weights finish loading, and a wrong API key only shows up on a real
        request. So this runs a genuine completion and reports what came back.
        """
        row = self.repo.get_provider(provider_id)
        if not row:
            raise ResourceNotFoundException("LLMProviderConfig", provider_id)

        conn, error = self._connection_for(row)
        if error:
            return self._record_verify(row, VerifyResult(
                ok=False, readiness="error", message=error,
            ))

        detected = self.list_models(provider_id).models

        model = (
            row.default_text_model
            or profile_store.default_model_for(profile_store.get_profile(row.profile_key) or {}, Capability.TEXT_JSON)
            or (detected[0] if detected else None)
        )
        if not model:
            return self._record_verify(row, VerifyResult(
                ok=False, readiness="error", detected_models=detected,
                message="No model is configured and none could be discovered. Enter a model name.",
            ))

        adapter = get_adapter(conn.adapter_key)
        if adapter is None:
            return self._record_verify(row, VerifyResult(
                ok=False, readiness="error", message=f"No adapter for protocol {conn.adapter_key!r}.",
            ))

        request = LLMRequest(capability=Capability.TEXT_JSON, model=model, prompt=VERIFY_PROMPT)
        try:
            http_spec = adapter.build_request(request, conn)
        except ValueError as exc:
            return self._record_verify(row, VerifyResult(
                ok=False, readiness="error", message=str(exc), detected_models=detected,
            ))

        started = time.monotonic()
        raw, transport_error = self.gateway._send(http_spec, timeout=60.0)
        latency_ms = int((time.monotonic() - started) * 1000)

        if transport_error:
            unreachable = "connect" in transport_error.lower() or "timed out" in transport_error.lower()
            return self._record_verify(row, VerifyResult(
                ok=False,
                readiness="unreachable" if unreachable else "error",
                message=self._unreachable_advice(conn, transport_error),
                latency_ms=latency_ms,
                detected_models=detected,
                resolved_model=model,
            ))

        text, parse_error = adapter.parse_text_response(raw)
        if parse_error:
            return self._record_verify(row, VerifyResult(
                ok=False, readiness="error", message=parse_error,
                latency_ms=latency_ms, detected_models=detected, resolved_model=model,
            ))

        from app.llm.json_extract import extract_json_object
        parsed, _ = extract_json_object(text)
        returned_valid_json = parsed is not None

        slow = latency_ms > SLOW_LATENCY_MS
        return self._record_verify(row, VerifyResult(
            ok=True,
            readiness="slow" if slow else "ready",
            message=self._success_message(model, latency_ms, slow, returned_valid_json),
            latency_ms=latency_ms,
            detected_models=detected,
            resolved_model=model,
            returned_valid_json=returned_valid_json,
        ))

    def _unreachable_advice(self, conn, transport_error: str) -> str:
        if conn.is_local:
            return (
                f"Could not reach {conn.base_url}. Start your local model server, "
                f"then try again. ({transport_error})"
            )
        return f"Could not reach {conn.base_url}. Check the address and your API key. ({transport_error})"

    def _success_message(self, model: str, latency_ms: int, slow: bool, valid_json: bool) -> str:
        seconds = latency_ms / 1000
        message = f"Connected. {model} replied in {seconds:.1f}s."
        if slow:
            message += (
                " That is slow enough that System Design grading will take several minutes"
                " per answer. Question generation will still feel fine."
            )
        if not valid_json:
            message += (
                " It did not return clean JSON on the first try, so grading may occasionally"
                " need a retry."
            )
        return message

    def _record_verify(self, row, result: VerifyResult) -> VerifyResult:
        from app.llm.types import utc_now_naive_safe

        row.last_verified_at = utc_now_naive_safe()
        row.last_verify_error = None if result.ok else result.message
        row.last_latency_ms = result.latency_ms
        self.repo.commit()
        return result

    # ---- Local detection ---------------------------------------------

    def detect_local_runners(self) -> List[DetectedRunner]:
        """
        Probe loopback for a running model server.

        Short timeouts and localhost only: this must never look like phoning
        home, and it must not stall the Settings page when nothing is running.
        """
        configured_urls = {
            (p.effective_base_url or "").rstrip("/") for p in self.list_providers()
        }
        found = []

        for profile_key, base_url in LOCAL_PROBE_TARGETS:
            profile = profile_store.get_profile(profile_key)
            if not profile:
                continue
            raw, error = get_json(
                get_shared_client(), f"{base_url}{profile.get('model_discovery', '/models')}", timeout=1.0
            )
            if error or raw is None:
                continue
            adapter = get_adapter(profile["adapter"])
            found.append(DetectedRunner(
                profile_key=profile_key,
                label=profile.get("label", profile_key),
                base_url=base_url,
                models=adapter.parse_model_list(raw),
                already_configured=base_url.rstrip("/") in configured_urls,
            ))

        return found

    # ---- Guided local setup -------------------------------------------

    def get_system_info(self) -> SystemInfo:
        total, available = system_info.memory_gb()
        return SystemInfo(
            os_family=system_info.os_family(),
            total_ram_gb=total,
            available_ram_gb=available,
            usable_for_model_gb=local_setup.usable_ram_gb(),
        )

    def list_local_models(self, ram_gb: Optional[float] = None) -> List[LocalModelOption]:
        return [LocalModelOption(**m) for m in local_setup.recommend_models(ram_gb)]

    def list_runners(self) -> List[RunnerInfo]:
        return [RunnerInfo(**r) for r in local_setup.list_runners()]

    def get_runner(self, key: str) -> RunnerInfo:
        runner = local_setup.get_runner(key)
        if not runner:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No setup guide for {key!r}.",
            )
        return RunnerInfo(**runner)

    def build_launcher(self, req: LauncherRequest) -> LauncherScript:
        try:
            script = local_setup.build_launcher_script(
                runner_key=req.runner_key,
                model_file=req.model_file,
                port=req.port,
                ctx_size=req.ctx_size,
                os_family=req.os_family,
            )
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
        return LauncherScript(**script)

    # ---- Task routing -------------------------------------------------

    def list_tasks(self) -> List[TaskBindingInfo]:
        bindings = {b.task: b for b in self.repo.list_bindings()}
        providers_by_name = {p.name: p for p in self.list_providers()}
        out = []

        for task in LLMTask:
            spec = TASK_SPECS[task]
            binding = bindings.get(task.value)
            conn, model, reason = self.gateway.resolve(task)
            resolved = providers_by_name.get(conn.provider_name) if conn else None

            out.append(TaskBindingInfo(
                task=task.value,
                label=TASK_LABELS.get(task, task.value),
                capability=spec.capability.value,
                bound_provider_id=binding.provider_config_id if binding else None,
                bound_model=binding.model if binding else None,
                resolved_provider_id=resolved.id if resolved else None,
                resolved_provider_name=conn.provider_name if conn else None,
                resolved_model=model,
                is_available=conn is not None and model is not None,
                unavailable_reason=reason,
                cloud_timeout_seconds=spec.cloud_timeout,
                local_timeout_seconds=spec.local_timeout,
            ))
        return out

    def set_task_binding(self, task_value: str, req: TaskBindingUpdate) -> TaskBindingInfo:
        try:
            task = LLMTask(task_value)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Unknown task {task_value!r}.",
            )

        if req.provider_id is not None:
            row = self.repo.get_provider(req.provider_id)
            if not row:
                raise ResourceNotFoundException("LLMProviderConfig", req.provider_id)

            profile = profile_store.get_profile(row.profile_key) or {}
            capability = TASK_SPECS[task].capability
            if capability not in profile_store.profile_capabilities(profile):
                # Refuse rather than accept a binding that can never run. The
                # user would otherwise only discover it when the feature fails.
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"{row.name} cannot do {capability.value.replace('_', ' ')}, "
                        f"which {TASK_LABELS.get(task, task.value)} requires."
                    ),
                )

        self.repo.upsert_binding(task.value, req.provider_id, req.model or None)
        return next(t for t in self.list_tasks() if t.task == task.value)
