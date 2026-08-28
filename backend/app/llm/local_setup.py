# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The guided local-model setup: what to run, what your machine can handle, and
how to start it.

The governing rule, enforced here rather than left to the UI: PrepBench never
downloads a model and never launches a server. It shows the user what to
fetch, tells them honestly whether their machine can run it, and writes a
launch script they choose to run. Shipping a downloader that fetches and
executes a multi-gigabyte binary would trip antivirus, take on redistribution
obligations for every model licence, and contradict the advice anyone should
give about running unknown executables.
"""
import json
import shlex
from pathlib import Path
from typing import List, Optional

from app.core.config import BASE_DIR, DATA_DIR
from app.core.logging_config import logger
from app.llm import system_info

BUILTIN_CATALOGUE_PATH = BASE_DIR / "app" / "data" / "local_models.json"
CUSTOM_CATALOGUE_PATH = DATA_DIR / "local_models.custom.json"

# Headroom left for the OS and PrepBench itself. Without it we would recommend
# a model that technically fits and then thrashes swap, which feels like the
# app hanging rather than like a model being too big.
RESERVED_RAM_GB = 2.0

# Larger contexts let longer answers be graded but cost memory linearly. 4096
# comfortably fits a full system design answer plus its rubric.
DEFAULT_CTX_SIZE = 4096

_cache: Optional[dict] = None


def _read(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        logger.error(f"Could not read local model catalogue at {path}: {exc}")
        return {}
    return raw if isinstance(raw, dict) else {}


def load_catalogue(refresh: bool = False) -> dict:
    global _cache
    if _cache is None or refresh:
        merged = _read(BUILTIN_CATALOGUE_PATH)
        custom = _read(CUSTOM_CATALOGUE_PATH)
        # Custom entries append to the model list and override runners by key,
        # so a user can add a model without losing the built-in ones.
        if custom.get("models"):
            existing = {m.get("id") for m in merged.get("models", [])}
            merged.setdefault("models", []).extend(
                m for m in custom["models"] if m.get("id") not in existing
            )
        if custom.get("runners"):
            merged.setdefault("runners", {}).update(custom["runners"])
        _cache = merged
    return _cache


def list_runners() -> List[dict]:
    runners = load_catalogue().get("runners", {})
    return [{"key": key, **value} for key, value in runners.items()]


def get_runner(key: str) -> Optional[dict]:
    runner = load_catalogue().get("runners", {}).get(key)
    return {"key": key, **runner} if runner else None


def usable_ram_gb() -> Optional[float]:
    """
    Memory a model could claim on this machine, judged against *installed* RAM.

    Deliberately not based on what is free at this instant. A 16GB laptop with
    a browser open shows ~3GB free, and telling its owner they cannot run any
    model would be the unhelpful kind of accurate -- they can, they just have
    to close something first. Whether it fits *right now* is reported
    separately, as advice rather than as a verdict.
    """
    total, _available = system_info.memory_gb()
    if total is None:
        return None
    return max(0.0, round(total - RESERVED_RAM_GB, 1))


def free_ram_gb() -> Optional[float]:
    _total, available = system_info.memory_gb()
    return available


def recommend_models(ram_gb: Optional[float] = None) -> List[dict]:
    """
    Every model, annotated with whether this machine can run it.

    Returns the whole catalogue rather than filtering: a list that silently
    omits the good models is more confusing than one that marks them as too
    large and says why.

    Two separate questions get two separate answers -- `fits` is about the
    machine and does not change when the user opens a browser tab, while
    `fits_now` is about this moment and tells them whether to close something.
    """
    budget = usable_ram_gb() if ram_gb is None else ram_gb
    # An explicit ram_gb is a hypothetical machine, so "right now" is
    # meaningless for it.
    free_now = free_ram_gb() if ram_gb is None else None
    models = load_catalogue().get("models", [])

    annotated = []
    for model in models:
        required = float(model.get("ram_required_gb") or 0)

        if budget is None:
            fits, fits_now = None, None
            note = "Could not measure this machine's memory, so this is a guess."
        elif required > budget:
            fits, fits_now = False, False
            note = f"Needs about {required:.1f}GB; this machine has about {budget:.1f}GB usable."
        elif free_now is not None and required > free_now:
            fits, fits_now = True, False
            note = (
                f"Fits this machine, but only about {free_now:.1f}GB is free right now "
                f"and it needs {required:.1f}GB. Close a few apps before running it."
            )
        else:
            # fits_now stays unknown when free memory was not measured (or the
            # caller asked about a hypothetical machine). Reporting True there
            # would claim something we did not check.
            fits, fits_now = True, (None if free_now is None else True)
            note = f"Fits comfortably -- needs about {required:.1f}GB."

        annotated.append({**model, "fits": fits, "fits_now": fits_now, "fit_note": note})

    annotated.sort(key=lambda m: (m["fits"] is not True, -float(m.get("parameters_b") or 0)))

    # The recommendation is the best *balance*, not the biggest thing that
    # fits. A 14B model on CPU takes minutes per grade, so pointing a
    # first-time user at it because their RAM allows it would sour the whole
    # feature. Prefer the catalogue's marked sweet spot when the machine can
    # run it, and only fall back to "largest that fits" below that.
    runnable = [m for m in annotated if m["fits"] is True]
    if runnable:
        choice = next((m for m in runnable if m.get("sweet_spot")), runnable[0])
        choice["recommended"] = True
    return annotated


def build_launch_command(
    runner_key: str,
    model_file: str,
    port: Optional[int] = None,
    ctx_size: int = DEFAULT_CTX_SIZE,
    os_family: Optional[str] = None,
) -> str:
    """The exact command to start this runner, for the user to copy."""
    runner = get_runner(runner_key)
    if not runner:
        raise ValueError(f"Unknown runner {runner_key!r}")

    port = port or runner.get("default_port")
    target_os = os_family or system_info.os_family()
    style = runner.get("pull_style")

    if style == "ollama":
        # Ollama serves automatically; the only step is fetching the model.
        return f"ollama pull {model_file}"

    if style == "gui":
        return "Start the server from LM Studio's Developer tab."

    executable = "llamafile.exe" if target_os == "windows" else "./llamafile"
    # Quote the model path for POSIX shells; on Windows cmd, quoting a plain
    # filename is harmless and covers paths containing spaces.
    quoted = f'"{model_file}"' if target_os == "windows" else shlex.quote(model_file)
    return (
        f"{executable} -m {quoted} --server --host 127.0.0.1 "
        f"--port {port} --ctx-size {ctx_size} --nobrowser"
    )


def build_launcher_script(
    runner_key: str,
    model_file: str,
    port: Optional[int] = None,
    ctx_size: int = DEFAULT_CTX_SIZE,
    os_family: Optional[str] = None,
) -> dict:
    """
    A runnable start script the user saves and launches themselves.

    Returns the text and a suggested filename; writing it anywhere is the
    frontend's job via a download, so PrepBench never puts an executable on
    disk by itself.
    """
    target_os = os_family or system_info.os_family()
    command = build_launch_command(runner_key, model_file, port, ctx_size, target_os)
    runner = get_runner(runner_key) or {}
    resolved_port = port or runner.get("default_port")

    if target_os == "windows":
        filename = "Start-PrepBench-AI.bat"
        content = "\r\n".join([
            "@echo off",
            "REM Starts a local AI model for PrepBench.",
            "REM Keep this window open while you use the app.",
            "REM Written by PrepBench; review it before running, as you would any script.",
            "",
            f'cd /d "%~dp0"',
            command,
            "",
            "if errorlevel 1 (",
            "  echo.",
            "  echo The model server exited with an error.",
            f"  echo Check that the model file exists and that port {resolved_port} is free.",
            "  pause",
            ")",
            "",
        ])
    else:
        filename = "start-prepbench-ai.sh"
        content = "\n".join([
            "#!/usr/bin/env bash",
            "# Starts a local AI model for PrepBench.",
            "# Keep this terminal open while you use the app.",
            "# Written by PrepBench; review it before running, as you would any script.",
            "set -euo pipefail",
            "",
            'cd "$(dirname "$0")"',
            command,
            "",
        ])

    return {
        "filename": filename,
        "content": content,
        "command": command,
        "os_family": target_os,
        "port": resolved_port,
    }
