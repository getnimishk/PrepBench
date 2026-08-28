# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
timeutils.py

Bridging between how timestamps are *stored* and what a day means to a person.

Every DateTime column in this app holds naive UTC. That is the right storage
choice, but it makes "did I practice today?" subtly wrong if answered by
comparing against a UTC calendar day: UTC midnight is 05:30 in IST, 19:00 the
previous day in PST. A user studying at 01:00 local would not be counted
toward today's goal, and their streak would break on a day they actually
practiced.

These helpers convert between the two so day-boundary decisions use the
machine's local timezone -- which, for a single-user local-first app, is by
definition the user's own.
"""

from datetime import date, datetime, timedelta, UTC


def utc_now_naive() -> datetime:
    """Current instant as naive UTC, matching how columns are stored."""
    return datetime.now(UTC).replace(tzinfo=None)


def to_local_date(naive_utc: datetime) -> date:
    """Local calendar date of a naive-UTC timestamp."""
    return naive_utc.replace(tzinfo=UTC).astimezone().date()


def local_today() -> date:
    """Today's date in the machine's local timezone."""
    return datetime.now().date()


def local_day_start_as_naive_utc(day: date | None = None) -> datetime:
    """
    The naive-UTC instant at which a given local calendar day begins.

    Use this as the lower bound when filtering stored (naive UTC) timestamps
    for "things that happened today", so the boundary lands at local midnight
    rather than UTC midnight.
    """
    target = day or local_today()
    local_midnight = datetime(target.year, target.month, target.day).astimezone()
    return local_midnight.astimezone(UTC).replace(tzinfo=None)


__all__ = [
    "utc_now_naive",
    "to_local_date",
    "local_today",
    "local_day_start_as_naive_utc",
    "timedelta",
]
