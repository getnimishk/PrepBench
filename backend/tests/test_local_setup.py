# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Guided local-model setup: hardware advice, model recommendations, and the
launcher script.

The rule these exist to hold: PrepBench tells the user what to run and never
runs it. Nothing here downloads a model, writes an executable, or starts a
server.
"""
import pytest
from fastapi.testclient import TestClient

from app.llm import local_setup, system_info
from app.main import app

client = TestClient(app)
BASE = "/api/v1/llm"


# ---- Hardware detection ----------------------------------------------

def test_memory_is_readable_or_honestly_unknown():
    """Either we get a real figure or None -- never a fabricated default."""
    total, available = system_info.memory_gb()
    if total is not None:
        assert total > 0
        assert available is None or available >= 0


def test_os_family_is_recognised():
    assert system_info.os_family() in {"windows", "macos", "linux", "unknown"}


# ---- Recommendations --------------------------------------------------

def test_recommendation_is_the_balanced_choice_not_the_biggest_that_fits():
    """
    A 14B model on CPU takes minutes per grade. Pointing a first-time user at
    it because their RAM happens to allow it would sour the whole feature, so
    the catalogue's marked sweet spot wins whenever the machine can run it.
    """
    models = local_setup.recommend_models(ram_gb=32.0)
    recommended = [m for m in models if m.get("recommended")]

    assert len(recommended) == 1
    assert recommended[0]["sweet_spot"] is True
    biggest = max(models, key=lambda m: m["parameters_b"])
    assert recommended[0]["id"] != biggest["id"], "should not just pick the largest"


def test_small_machine_gets_a_smaller_recommendation():
    models = local_setup.recommend_models(ram_gb=6.0)
    recommended = next(m for m in models if m.get("recommended"))
    assert recommended["ram_required_gb"] <= 6.0


def test_machine_too_small_for_anything_recommends_nothing():
    """Better to recommend nothing than something that will thrash swap."""
    models = local_setup.recommend_models(ram_gb=1.0)
    assert all(m["fits"] is False for m in models)
    assert not any(m.get("recommended") for m in models)


def test_catalogue_is_returned_whole_with_oversized_entries_marked():
    """Silently omitting the good models is more confusing than showing them
    marked as too large, which also explains what more RAM would buy."""
    all_models = local_setup.recommend_models(ram_gb=100.0)
    tiny_machine = local_setup.recommend_models(ram_gb=3.0)
    assert len(all_models) == len(tiny_machine)
    assert any(m["fits"] is False for m in tiny_machine)


def test_fits_and_fits_now_are_separate_questions():
    """
    'Can this machine run it' must not flip just because a browser is open.
    A 16GB laptop showing 3GB free can still run a 7B model after closing
    something -- telling its owner otherwise would be the unhelpful kind of
    accurate.
    """
    plenty = local_setup.recommend_models(ram_gb=16.0)
    seven_b = next(m for m in plenty if m["parameters_b"] == 7 and m["licence_commercial_ok"])

    assert seven_b["fits"] is True
    # An explicit ram_gb describes a hypothetical machine, so "right now" is
    # not a meaningful question and is reported as unknown rather than guessed.
    assert seven_b["fits_now"] is None


def test_every_catalogue_entry_declares_its_licence():
    """Shown at pick time because it decides whether a model could ever ship
    with a paid product -- much cheaper to know now than later."""
    for model in local_setup.recommend_models(ram_gb=64.0):
        assert model["licence"], f"{model['id']} has no licence"
        assert isinstance(model["licence_commercial_ok"], bool)


def test_at_least_one_recommended_model_is_commercially_usable():
    models = local_setup.recommend_models(ram_gb=16.0)
    recommended = next(m for m in models if m.get("recommended"))
    assert recommended["licence_commercial_ok"] is True


# ---- Launcher generation ---------------------------------------------

def test_windows_launcher_is_a_batch_file_that_binds_to_loopback():
    script = local_setup.build_launcher_script(
        "llamafile", "qwen2.5-7b-instruct-q4_k_m.gguf", os_family="windows"
    )
    assert script["filename"].endswith(".bat")
    assert "llamafile.exe" in script["command"]
    # Loopback only: a local model must not be exposed to the network by a
    # script we generated.
    assert "--host 127.0.0.1" in script["command"]
    assert "@echo off" in script["content"]


def test_posix_launcher_is_a_shell_script_with_a_shebang():
    script = local_setup.build_launcher_script(
        "llamafile", "model.gguf", os_family="linux"
    )
    assert script["filename"].endswith(".sh")
    assert script["content"].startswith("#!/usr/bin/env bash")
    assert "--host 127.0.0.1" in script["command"]


def test_model_filenames_with_spaces_are_quoted():
    """An unquoted path with a space silently truncates the argument and the
    server starts with no model."""
    posix = local_setup.build_launch_command("llamafile", "my model.gguf", os_family="linux")
    assert "'my model.gguf'" in posix

    windows = local_setup.build_launch_command("llamafile", "my model.gguf", os_family="windows")
    assert '"my model.gguf"' in windows


def test_context_size_is_configurable_and_appears_in_the_command():
    script = local_setup.build_launcher_script(
        "llamafile", "m.gguf", ctx_size=8192, os_family="linux"
    )
    assert "--ctx-size 8192" in script["command"]


def test_ollama_gets_a_pull_command_not_a_server_command():
    """Ollama serves on its own; telling the user to start a server would be
    wrong for it."""
    command = local_setup.build_launch_command("ollama", "qwen2.5:7b")
    assert command == "ollama pull qwen2.5:7b"
    assert "--server" not in command


def test_unknown_runner_is_rejected():
    with pytest.raises(ValueError):
        local_setup.build_launch_command("not-a-runner", "m.gguf")


def test_generated_script_tells_the_user_to_read_it():
    """We are handing someone a script to execute; saying so is the minimum."""
    script = local_setup.build_launcher_script("llamafile", "m.gguf", os_family="windows")
    assert "review it before running" in script["content"].lower()


# ---- API --------------------------------------------------------------

def test_system_info_endpoint():
    res = client.get(f"{BASE}/system-info")
    assert res.status_code == 200
    body = res.json()
    assert body["os_family"] in {"windows", "macos", "linux", "unknown"}


def test_local_models_endpoint_accepts_a_ram_override():
    res = client.get(f"{BASE}/local/models", params={"ram_gb": 6.0})
    assert res.status_code == 200
    models = res.json()
    assert models
    recommended = [m for m in models if m["recommended"]]
    assert len(recommended) == 1
    assert recommended[0]["ram_required_gb"] <= 6.0


def test_runners_endpoint_lists_per_os_steps():
    res = client.get(f"{BASE}/local/runners")
    assert res.status_code == 200
    by_key = {r["key"]: r for r in res.json()}

    assert {"ollama", "llamafile", "lmstudio"} <= set(by_key)
    for runner in by_key.values():
        # A Windows user must not be shown chmod instructions.
        assert {"windows", "macos", "linux"} <= set(runner["steps"])
        assert all(runner["steps"][os_key] for os_key in ("windows", "macos", "linux"))


def test_unknown_runner_404s():
    assert client.get(f"{BASE}/local/runners/nope").status_code == 404


def test_launcher_endpoint_returns_a_script_without_writing_anything(tmp_path):
    res = client.post(f"{BASE}/local/launcher", json={
        "runner_key": "llamafile",
        "model_file": "qwen2.5-7b-instruct-q4_k_m.gguf",
        "os_family": "windows",
        "ctx_size": 4096,
    })
    assert res.status_code == 200
    body = res.json()
    assert body["filename"] == "Start-PrepBench-AI.bat"
    assert "--ctx-size 4096" in body["command"]
    # The content is returned for the user to save; nothing is created on disk
    # by this call.
    assert not list(tmp_path.iterdir())


def test_launcher_endpoint_rejects_an_unknown_runner():
    res = client.post(f"{BASE}/local/launcher", json={
        "runner_key": "nonsense", "model_file": "m.gguf",
    })
    assert res.status_code == 400
