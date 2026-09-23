# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

import re
from datetime import date
from typing import Optional

from pydantic import BaseModel, Field, field_validator

EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class ProfileUpdate(BaseModel):
    """The name and email to show. Blank clears one; omitting it leaves it alone."""

    display_name: Optional[str] = Field(default=None, max_length=100)
    email: Optional[str] = Field(default=None, max_length=254)

    @field_validator("display_name")
    @classmethod
    def _name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return value.strip() or None

    @field_validator("email")
    @classmethod
    def _email(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not value:
            return None
        if not EMAIL.match(value):
            raise ValueError("That does not look like an email address.")
        return value


class ProfileTimezone(BaseModel):
    """The clock PrepBench keeps days by: this computer's.

    Due dates, the day's review and roadmap schedules all follow the machine's
    local time. Reported rather than offered as a choice, because a timezone
    picker that none of those read would be a control whose only effect is to be
    saved.
    """

    name: str
    utc_offset_minutes: int


class ProfileStats(BaseModel):
    # Preparations not archived.
    preparations: int
    # Every question in the bank, whichever preparation holds it.
    questions: int
    # Mocks sat to the end. Drills and unfinished papers are not mocks taken.
    mocks_taken: int
    # Local calendar days on which something you did was recorded: a session
    # started, an answer given, a topic demonstrated or a guide section read, a
    # take recorded, a design answer written, a review check or a sandbox run.
    days_active: int
    active_since: Optional[date] = None
    # Practice recordings taken in interview practice
    interview_answers: int = 0
    # Aggregated study time in hours across completed roadmap topics
    study_hours: Optional[float] = None


class ProfileStorage(BaseModel):
    # The database file and its write-ahead log. None when the database is not a
    # file this server can measure.
    database_bytes: Optional[int] = None
    recordings_bytes: int = 0


class ProfileResponse(BaseModel):
    display_name: Optional[str] = None
    email: Optional[str] = None
    timezone: ProfileTimezone
    stats: ProfileStats
    storage: ProfileStorage
