# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import Dict, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

ThemeChoice = Literal["light", "dark", "system"]
TextSize = Literal["standard", "large"]
MotionChoice = Literal["system", "always"]

# Every derived notification, by key, with whether it is on until changed. See
# NotificationService for what raises each. Unreviewed imports start off, as the
# prototype has it: a bank imported before auditing existed would otherwise
# open on an alert about hundreds of questions nobody asked to review.
NOTIFICATION_TRIGGERS = {
    "review_due": True,
    "mock_below_pass": True,
    "evidence_stale": True,
    "roadmap_slipping": True,
    "import_unreviewed": False,
}


class AppSettingsSchema(BaseModel):
    """The settings row, as read. Lenient about what an older database holds."""

    theme: ThemeChoice = "light"
    timer_sound_enabled: bool = True
    # The ceiling on a day's review goal. 1-200: zero would mean "never review",
    # which the queue cannot express and nobody wants as a setting, and 200 is
    # the hard ceiling GET /review/queue enforces whatever this says.
    review_daily_cap: int = Field(default=20, ge=1, le=200)
    # An "Exam Defaults" block lived here: default exam mode, default
    # question count, default passing score, shuffle question order. Nothing
    # read any of them. A mock takes its shape from the subject's exam
    # profile, because the real exam does not let you choose; a drill takes
    # its shape from the screen you start it on, one click away. Four
    # controls whose only effect was to be saved.
    #
    # Removed from the surface rather than left looking operative. The
    # columns remain on the table, unread, because dropping a column in
    # SQLite means rebuilding the table and there is nothing to gain by it.
    default_target_role: Optional[str] = None

    text_size: TextSize = "standard"
    reduce_motion: MotionChoice = "system"
    shortcuts_enabled: bool = True
    # {trigger: on}, every trigger present: what is stored, over the defaults.
    notification_triggers: Dict[str, bool] = Field(default_factory=lambda: dict(NOTIFICATION_TRIGGERS))

    model_config = ConfigDict(from_attributes=True)

    @field_validator("theme", mode="before")
    @classmethod
    def _known_theme(cls, value):
        # A value no screen can show reads as the default rather than failing
        # every page that loads settings.
        return value if value in ("light", "dark", "system") else "light"

    @field_validator("text_size", mode="before")
    @classmethod
    def _known_text_size(cls, value):
        return value if value in ("standard", "large") else "standard"

    @field_validator("reduce_motion", mode="before")
    @classmethod
    def _known_motion(cls, value):
        return value if value in ("system", "always") else "system"

    @field_validator("shortcuts_enabled", "timer_sound_enabled", mode="before")
    @classmethod
    def _bool_default(cls, value):
        return True if value is None else value

    @field_validator("notification_triggers", mode="before")
    @classmethod
    def _triggers(cls, value):
        stored = {k: bool(v) for k, v in (value or {}).items() if k in NOTIFICATION_TRIGGERS}
        return {**NOTIFICATION_TRIGGERS, **stored}


class AppSettingsUpdate(BaseModel):
    """A change to the settings. Only the fields sent are changed.

    Strict where the read model is lenient: an unknown theme or trigger is a
    mistake in the request, and saving it would only be read back as a default.
    """

    theme: ThemeChoice = "light"
    timer_sound_enabled: bool = True
    review_daily_cap: int = Field(default=20, ge=1, le=200)
    default_target_role: Optional[str] = Field(default=None, max_length=200)
    text_size: TextSize = "standard"
    reduce_motion: MotionChoice = "system"
    shortcuts_enabled: bool = True
    notification_triggers: Dict[str, bool] = Field(default_factory=dict)

    @field_validator("notification_triggers")
    @classmethod
    def _only_known_triggers(cls, value: Dict[str, bool]) -> Dict[str, bool]:
        unknown = sorted(set(value) - set(NOTIFICATION_TRIGGERS))
        if unknown:
            raise ValueError(f"Unknown notification trigger(s): {', '.join(unknown)}")
        return value
