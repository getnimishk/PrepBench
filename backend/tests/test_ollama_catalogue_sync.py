# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from unittest.mock import patch
from fastapi.testclient import TestClient

from app.main import app
from app.llm.ollama_catalogue_sync import (
    _parse_models_from_html,
    _calculate_specs,
    _determine_task_suitability,
    sync_ollama_catalogue,
)

client = TestClient(app)

SAMPLE_OLLAMA_HTML = """
<div id="repo">
  <ul role="list">
    <li class="border-b py-6">
      <a href="/library/llama3.3" class="group">
        <h2 class="truncate"><span>llama3.3</span></h2>
        <p class="break-words">Meta Llama 3.3 70B parameter model.</p>
        <div>
          <span>70b</span>
        </div>
      </a>
    </li>
    <li class="border-b py-6">
      <a href="/library/deepseek-r1" class="group">
        <h2 class="truncate"><span>deepseek-r1</span></h2>
        <p class="break-words">DeepSeek R1 reasoning model.</p>
        <div>
          <span>1.5b</span>
          <span>7b</span>
          <span>8b</span>
          <span>14b</span>
        </div>
      </a>
    </li>
    <li class="border-b py-6">
      <a href="/library/nomic-embed-text" class="group">
        <h2 class="truncate"><span>nomic-embed-text</span></h2>
        <p class="break-words">Embedding model.</p>
      </a>
    </li>
  </ul>
</div>
"""


def test_specs_calculation():
    download_gb, ram_gb = _calculate_specs(7.0)
    assert 4.0 <= download_gb <= 5.0
    assert 6.5 <= ram_gb <= 8.0

    download_gb_small, ram_gb_small = _calculate_specs(1.5)
    assert download_gb_small < download_gb
    assert ram_gb_small < ram_gb


def test_task_suitability_sweet_spot():
    good, weak, sweet = _determine_task_suitability(7.0)
    assert sweet is True
    assert "system_design_grading" in good
    assert len(weak) == 0

    good_small, weak_small, sweet_small = _determine_task_suitability(1.5)
    assert sweet_small is False
    assert "system_design_grading" in weak_small


def test_parse_models_from_html():
    models = _parse_models_from_html(SAMPLE_OLLAMA_HTML)
    assert len(models) >= 5  # llama3.3 (70b) + deepseek-r1 (1.5b, 7b, 8b, 14b)

    # nomic-embed-text should be skipped
    slugs = {m["id"] for m in models}
    assert not any("nomic-embed" in s for s in slugs)

    # Verify deepseek 7b has sweet_spot
    ds_7b = next(m for m in models if m["id"] == "deepseek-r1-7b-instruct-q4")
    assert ds_7b["parameters_b"] == 7.0
    assert ds_7b["sweet_spot"] is True
    assert ds_7b["licence"] == "MIT"


def test_sync_ollama_catalogue_mocked(tmp_path, monkeypatch):
    custom_cat = tmp_path / "local_models.custom.json"
    monkeypatch.setattr("app.llm.local_setup.CUSTOM_CATALOGUE_PATH", custom_cat)

    with patch("app.llm.ollama_catalogue_sync.get_text", return_value=(SAMPLE_OLLAMA_HTML, None)):
        ok, total, added, msg = sync_ollama_catalogue()
        assert ok is True
        assert added > 0
        assert total >= added
        assert custom_cat.exists()

    # Second sync should add 0 new models
    with patch("app.llm.ollama_catalogue_sync.get_text", return_value=(SAMPLE_OLLAMA_HTML, None)):
        ok, total2, added2, msg2 = sync_ollama_catalogue()
        assert ok is True
        assert added2 == 0
        assert total2 == total


def test_sync_ollama_catalogue_network_failure(tmp_path, monkeypatch):
    custom_cat = tmp_path / "local_models.custom.json"
    monkeypatch.setattr("app.llm.local_setup.CUSTOM_CATALOGUE_PATH", custom_cat)

    with patch("app.llm.ollama_catalogue_sync.get_text", return_value=(None, "Connection refused")):
        ok, total, added, msg = sync_ollama_catalogue()
        assert ok is False
        assert added == 0
        assert "Could not connect" in msg


def test_api_refresh_local_models(tmp_path, monkeypatch):
    custom_cat = tmp_path / "local_models.custom.json"
    monkeypatch.setattr("app.llm.local_setup.CUSTOM_CATALOGUE_PATH", custom_cat)

    with patch("app.llm.ollama_catalogue_sync.get_text", return_value=(SAMPLE_OLLAMA_HTML, None)):
        res = client.post("/api/v1/llm/local/models/refresh")
        assert res.status_code == 200
        data = res.json()
        assert "ok" in data
        assert "models_count" in data
        assert "message" in data
