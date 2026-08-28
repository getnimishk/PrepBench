# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from datetime import datetime, UTC

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text

from app.core.database import Base


def _utcnow():
    return datetime.now(UTC).replace(tzinfo=None)


class LLMProviderConfig(Base):
    """
    One configured way to reach a model.

    Separate from LLMTaskBinding below because a provider is a *connection*
    while a binding is a *routing rule*. Most users configure one provider and
    never touch bindings; keeping them apart costs nothing and makes "grade
    with the cloud, generate locally" fall out for free.
    """

    __tablename__ = "llm_provider_config"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # User-facing label, e.g. "My Llamafile". Unique so the Settings list and
    # any future CLI can address a provider by name.
    name = Column(String(80), nullable=False, unique=True, index=True)

    # Key into llm_profiles.json -- supplies adapter, auth style, capabilities
    # and default models. Not a foreign key: profiles are data files, and a
    # user-supplied custom profile can appear or vanish without the database
    # needing to know.
    profile_key = Column(String(50), nullable=False)

    # NULL means "use the profile's base_url". Only set when the user is
    # pointing at a non-default endpoint (a custom port, a remote host).
    base_url = Column(String(500), nullable=True)

    # A *reference* to a credential, never the credential. See llm/secrets.py.
    api_key_ref = Column(String(200), nullable=True)

    # NULL means "use the profile's default for that capability".
    default_text_model = Column(String(200), nullable=True)
    default_audio_model = Column(String(200), nullable=True)
    default_embedding_model = Column(String(200), nullable=True)

    is_enabled = Column(Boolean, nullable=False, default=True)

    # Populated by the verification probe. Nullable throughout: an unverified
    # provider reports "not checked yet", never a fabricated healthy state.
    last_verified_at = Column(DateTime, nullable=True)
    last_verify_error = Column(Text, nullable=True)
    last_latency_ms = Column(Integer, nullable=True)

    created_at = Column(DateTime, nullable=False, default=_utcnow)
    updated_at = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)


class LLMTaskBinding(Base):
    """
    Which provider handles one task.

    No row for a task, or a row whose provider was deleted, means "resolve the
    default provider for this task's capability" -- so deleting a provider
    degrades routing gracefully instead of breaking the feature. That is what
    ondelete="SET NULL" buys, and it genuinely fires now that the test engine
    enables foreign keys (see core/database.register_sqlite_pragmas).
    """

    __tablename__ = "llm_task_binding"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    task = Column(String(50), nullable=False, unique=True, index=True)
    provider_config_id = Column(
        Integer,
        ForeignKey("llm_provider_config.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # NULL means "use the provider's default model for this capability".
    model = Column(String(200), nullable=True)

    created_at = Column(DateTime, nullable=False, default=_utcnow)
    updated_at = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)
