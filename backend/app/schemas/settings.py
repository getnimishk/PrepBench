# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import Optional
from pydantic import BaseModel, ConfigDict

class AppSettingsSchema(BaseModel):
    theme: str = "light"
    timer_sound_enabled: bool = True
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

    model_config = ConfigDict(from_attributes=True)
