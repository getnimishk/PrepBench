# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The one place that decides who answers a task.

Feature services call run()/embed() with an LLMTask and get an LLMResult. They
do not know which provider ran, which model, or what the timeout was -- which
is the whole point: switching a user from Gemini to a local llamafile touches
configuration, not code.
"""
import time
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from app.core.logging_config import logger
from app.llm import profiles as profile_store
from app.llm.adapters import get_adapter
from app.llm.json_extract import extract_json_object
from app.llm.secrets import env_ref, resolve_secret
from app.llm.transport import get_shared_client, post_json
from app.llm.types import (
    TASK_SPECS,
    Capability,
    Connection,
    LLMRequest,
    LLMResult,
    LLMTask,
)

# The provider PrepBench falls back to when the database holds no
# configuration but the historical GEMINI_API_KEY is present. This is what
# makes the whole change invisible to existing users -- see llm/bootstrap.py,
# which turns the same environment into a real, visible provider row.
ENV_FALLBACK_PROFILE = "gemini"
ENV_FALLBACK_KEY_NAME = "GEMINI_API_KEY"
ENV_FALLBACK_LABEL = "Gemini (from environment)"

# Appended to a retried prompt after the response failed to parse. Kept short
# and literal: a model that just produced malformed JSON is not going to
# benefit from a longer explanation.
_REPAIR_SUFFIX = (
    "\n\nYour previous response was not valid JSON and could not be parsed. "
    "Respond again with ONLY the JSON object, no commentary, no code fences."
)


class LLMGateway:
    """
    Resolves and runs one task.

    `db` is optional because ContentValidator is constructed without a session
    (see api/v1/questions.py). With no session there are no stored bindings to
    consult, so resolution goes straight to the environment fallback -- which
    is exactly the behaviour that code had before this layer existed.
    """

    def __init__(self, db: Optional[Session] = None):
        self.db = db
        self._client = get_shared_client()

    # ---- Resolution --------------------------------------------------

    def _connection_from_row(self, row, profile: dict) -> Optional[Connection]:
        base_url = row.base_url or profile.get("base_url")
        if not base_url:
            logger.warning(f"LLM provider {row.name!r} has no base_url and its profile supplies none.")
            return None
        return Connection(
            provider_name=row.name,
            profile_key=row.profile_key,
            adapter_key=profile.get("adapter", ""),
            base_url=base_url,
            auth=profile.get("auth") or {},
            api_key=resolve_secret(row.api_key_ref),
            is_local=profile_store.infer_is_local(profile, base_url),
            supports_json_mode=bool(profile.get("supports_json_mode")),
            capabilities=profile_store.profile_capabilities(profile),
            model_discovery=profile.get("model_discovery"),
        )

    def _env_fallback_connection(self) -> Optional[Connection]:
        api_key = resolve_secret(env_ref(ENV_FALLBACK_KEY_NAME))
        if not api_key:
            return None
        profile = profile_store.get_profile(ENV_FALLBACK_PROFILE)
        if not profile:
            return None
        base_url = profile.get("base_url")
        if not base_url:
            return None
        return Connection(
            provider_name=ENV_FALLBACK_LABEL,
            profile_key=ENV_FALLBACK_PROFILE,
            adapter_key=profile.get("adapter", ""),
            base_url=base_url,
            auth=profile.get("auth") or {},
            api_key=api_key,
            is_local=profile_store.infer_is_local(profile, base_url),
            supports_json_mode=bool(profile.get("supports_json_mode")),
            capabilities=profile_store.profile_capabilities(profile),
            model_discovery=profile.get("model_discovery"),
        )

    def _model_for(self, conn: Connection, capability: Capability,
                   row=None, binding_model: Optional[str] = None) -> Optional[str]:
        """Most specific wins: binding, then provider default, then profile default."""
        if binding_model:
            return binding_model
        if row is not None:
            column = {
                Capability.TEXT_JSON: "default_text_model",
                Capability.AUDIO_JSON: "default_audio_model",
                Capability.EMBEDDING: "default_embedding_model",
            }.get(capability)
            if column:
                configured = getattr(row, column, None)
                if configured:
                    return configured
        profile = profile_store.get_profile(conn.profile_key) or {}
        return profile_store.default_model_for(profile, capability)

    def resolve(self, task: LLMTask) -> Tuple[Optional[Connection], Optional[str], Optional[str]]:
        """
        Returns (connection, model, unavailable_reason). Exactly one of
        connection or reason is set.
        """
        spec = TASK_SPECS[task]
        capability = spec.capability

        if self.db is not None:
            # Imported here rather than at module scope: models import Base
            # from core.database, and this module is reached from services
            # early enough that a top-level import risks a cycle.
            from app.repositories.llm_repository import LLMConfigRepository

            repo = LLMConfigRepository(self.db)

            binding = repo.get_binding(task.value)
            if binding and binding.provider_config_id:
                row = repo.get_provider(binding.provider_config_id)
                if row and row.is_enabled:
                    profile = profile_store.get_profile(row.profile_key)
                    if profile:
                        conn = self._connection_from_row(row, profile)
                        if conn and conn.supports(capability):
                            model = self._model_for(conn, capability, row, binding.model)
                            if model:
                                return conn, model, None
                            return None, None, (
                                f"No model is configured for {task.value} on provider "
                                f"{row.name!r}, and its profile has no default."
                            )

            # No usable binding: first enabled provider that can do this.
            for row in repo.list_providers(enabled_only=True):
                profile = profile_store.get_profile(row.profile_key)
                if not profile:
                    continue
                conn = self._connection_from_row(row, profile)
                if not conn or not conn.supports(capability):
                    continue
                adapter = get_adapter(conn.adapter_key)
                if not adapter or not adapter.supports(capability):
                    continue
                model = self._model_for(conn, capability, row, None)
                if model:
                    return conn, model, None

        conn = self._env_fallback_connection()
        if conn and conn.supports(capability):
            model = self._model_for(conn, capability)
            if model:
                return conn, model, None

        return None, None, (
            f"No AI provider is configured that can handle {task.value}."
        )

    def is_available(self, task: LLMTask) -> bool:
        conn, model, _ = self.resolve(task)
        return conn is not None and model is not None

    def provider_name_for(self, task: LLMTask) -> Optional[str]:
        conn, _, _ = self.resolve(task)
        return conn.provider_name if conn else None

    # ---- Execution ---------------------------------------------------

    def _timeout_for(self, task: LLMTask, conn: Connection) -> float:
        spec = TASK_SPECS[task]
        return spec.local_timeout if conn.is_local else spec.cloud_timeout

    def _send(self, spec_req, timeout: float) -> Tuple[Optional[dict], Optional[str]]:
        """
        The single I/O point for the whole layer.

        Everything above this is pure, so tests substitute this one method with
        a recorded vendor response and exercise the real adapters end to end.
        """
        return post_json(
            self._client, spec_req.url, spec_req.json_body, timeout, headers=spec_req.headers
        )

    def run(
        self,
        task: LLMTask,
        prompt: str,
        media_bytes: Optional[bytes] = None,
        media_mime: Optional[str] = None,
        allow_repair_retry: bool = True,
    ) -> LLMResult:
        """Run a JSON-returning task. Never raises."""
        conn, model, reason = self.resolve(task)
        if conn is None or model is None:
            return LLMResult(status="unavailable", error=reason)

        capability = TASK_SPECS[task].capability
        adapter = get_adapter(conn.adapter_key)
        if adapter is None:
            return LLMResult(
                status="unavailable",
                error=f"No adapter is installed for protocol {conn.adapter_key!r}.",
                provider_name=conn.provider_name,
            )
        if not adapter.supports(capability):
            return LLMResult(
                status="unavailable",
                error=(
                    f"{conn.provider_name} cannot perform {capability.value}. "
                    "Choose a provider that supports this feature."
                ),
                provider_name=conn.provider_name,
                model=model,
            )

        timeout = self._timeout_for(task, conn)
        started = time.monotonic()

        parsed, error = self._attempt(
            adapter, conn, model, capability, prompt, media_bytes, media_mime, timeout
        )

        # Only a parse failure is worth a second call. A timeout or a refused
        # connection will fail the same way again, and on a local provider a
        # blind retry could mean another five minutes of waiting.
        if parsed is None and allow_repair_retry and error and "malformed JSON" in error:
            logger.info(f"Retrying {task.value} once after unparseable response from {conn.provider_name}")
            parsed, retry_error = self._attempt(
                adapter, conn, model, capability, prompt + _REPAIR_SUFFIX,
                media_bytes, media_mime, timeout,
            )
            if parsed is None:
                error = retry_error or error

        latency_ms = int((time.monotonic() - started) * 1000)

        if parsed is None:
            return LLMResult(
                status="error", error=error, provider_name=conn.provider_name,
                model=model, latency_ms=latency_ms,
            )
        return LLMResult(
            status="ok", data=parsed, provider_name=conn.provider_name,
            model=model, latency_ms=latency_ms,
        )

    def _attempt(self, adapter, conn, model, capability, prompt, media_bytes, media_mime, timeout):
        request = LLMRequest(
            capability=capability,
            model=model,
            prompt=prompt,
            json_mode=True,
            media_bytes=media_bytes,
            media_mime=media_mime,
        )
        try:
            http_spec = adapter.build_request(request, conn)
        except ValueError as exc:
            return None, str(exc)

        raw, transport_error = self._send(http_spec, timeout)
        if transport_error:
            return None, transport_error

        text, parse_error = adapter.parse_text_response(raw)
        if parse_error:
            return None, parse_error

        return extract_json_object(text)

    def embed(self, text: str, task: LLMTask = LLMTask.EMBEDDING) -> LLMResult:
        """Produce an embedding vector. Never raises."""
        conn, model, reason = self.resolve(task)
        if conn is None or model is None:
            return LLMResult(status="unavailable", error=reason)

        adapter = get_adapter(conn.adapter_key)
        if adapter is None or not adapter.supports(Capability.EMBEDDING):
            return LLMResult(
                status="unavailable",
                error=f"{conn.provider_name} does not provide embeddings.",
                provider_name=conn.provider_name,
            )

        request = LLMRequest(capability=Capability.EMBEDDING, model=model, input_text=text)
        try:
            http_spec = adapter.build_request(request, conn)
        except ValueError as exc:
            return LLMResult(status="error", error=str(exc), provider_name=conn.provider_name)

        started = time.monotonic()
        raw, transport_error = self._send(http_spec, self._timeout_for(task, conn))
        latency_ms = int((time.monotonic() - started) * 1000)

        if transport_error:
            return LLMResult(status="error", error=transport_error,
                             provider_name=conn.provider_name, model=model, latency_ms=latency_ms)

        vector, parse_error = adapter.parse_embedding_response(raw)
        if parse_error:
            return LLMResult(status="error", error=parse_error,
                             provider_name=conn.provider_name, model=model, latency_ms=latency_ms)

        return LLMResult(status="ok", vector=vector, provider_name=conn.provider_name,
                         model=model, latency_ms=latency_ms)
