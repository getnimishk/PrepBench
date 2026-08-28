# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
How much machine the user actually has.

Used to recommend a model size honestly rather than presenting a list and
letting someone with 8GB download a 13B model and conclude the feature is
broken. Deliberately stdlib-only -- psutil would do this in one line, but a
prep app that runs offline should not grow a dependency to read a number the
OS will hand over for free.

Every function degrades to None rather than raising. An unknown amount of RAM
means "we cannot advise", which is a fine thing to say; a crashed Settings
page is not.
"""
import ctypes
import os
import platform
import re
from typing import Optional

from app.core.logging_config import logger

BYTES_PER_GB = 1024 ** 3


def _windows_memory() -> Optional[tuple]:
    class MEMORYSTATUSEX(ctypes.Structure):
        _fields_ = [
            ("dwLength", ctypes.c_ulong),
            ("dwMemoryLoad", ctypes.c_ulong),
            ("ullTotalPhys", ctypes.c_ulonglong),
            ("ullAvailPhys", ctypes.c_ulonglong),
            ("ullTotalPageFile", ctypes.c_ulonglong),
            ("ullAvailPageFile", ctypes.c_ulonglong),
            ("ullTotalVirtual", ctypes.c_ulonglong),
            ("ullAvailVirtual", ctypes.c_ulonglong),
            ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
        ]

    status = MEMORYSTATUSEX()
    status.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
    if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status)):
        return None
    return status.ullTotalPhys, status.ullAvailPhys


def _linux_memory() -> Optional[tuple]:
    try:
        text = open("/proc/meminfo", encoding="utf-8").read()
    except OSError:
        return None

    def field(name: str) -> Optional[int]:
        match = re.search(rf"^{name}:\s+(\d+) kB", text, re.MULTILINE)
        return int(match.group(1)) * 1024 if match else None

    total = field("MemTotal")
    # MemAvailable is the kernel's own estimate of what a new process could
    # actually get, which is what matters here -- MemFree excludes reclaimable
    # cache and would badly understate it.
    available = field("MemAvailable") or field("MemFree")
    if total is None:
        return None
    return total, available or 0


def _macos_memory() -> Optional[tuple]:
    try:
        total = int(os.popen("sysctl -n hw.memsize").read().strip())
    except (OSError, ValueError):
        return None
    # No cheap equivalent of MemAvailable here; report total and let the
    # caller treat available as unknown rather than inventing a figure.
    return total, 0


def total_and_available_bytes() -> tuple:
    """(total, available) in bytes; either may be None/0 when unknown."""
    system = platform.system()
    try:
        if system == "Windows":
            result = _windows_memory()
        elif system == "Linux":
            result = _linux_memory()
        elif system == "Darwin":
            result = _macos_memory()
        else:
            result = None
    except Exception as exc:
        logger.warning(f"Could not read system memory: {exc}")
        result = None

    if not result:
        return None, None
    return result


def memory_gb() -> tuple:
    """(total_gb, available_gb) rounded to one decimal, or (None, None)."""
    total, available = total_and_available_bytes()
    if total is None:
        return None, None
    return (
        round(total / BYTES_PER_GB, 1),
        round(available / BYTES_PER_GB, 1) if available else None,
    )


def os_family() -> str:
    return {"Windows": "windows", "Darwin": "macos", "Linux": "linux"}.get(
        platform.system(), "unknown"
    )
