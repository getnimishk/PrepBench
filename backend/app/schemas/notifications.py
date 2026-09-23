# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import List, Optional

from pydantic import BaseModel


class Notification(BaseModel):
    """Something the evidence says is worth doing next. Derived, never stored."""
    id: str
    trigger: str
    # warning: the evidence moved against you. attention: something is waiting.
    severity: str
    title: str
    detail: str
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    count: Optional[int] = None
    action_label: str
    action_path: str


class NotificationList(BaseModel):
    items: List[Notification]
