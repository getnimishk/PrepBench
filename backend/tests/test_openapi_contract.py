# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The API contract, pinned.

The frontend's types in frontend/src/types/ are written by hand to mirror the
Pydantic schemas here, and nothing checked that the two agree: a field renamed in
a schema type-checked cleanly on both sides and failed at runtime, in the
browser, in front of the learner.

This does not generate the frontend types -- that would replace 750 lines of
hand-written client -- but it closes the cheaper half of the gap. The live
OpenAPI document must equal the committed docs/api/openapi.json. So any change to
a route, a request body or a response shape fails this test until someone
regenerates the file, and the regenerated file then shows up in the diff where a
reviewer can see exactly what changed and check the frontend types against it.
"""
import json
from pathlib import Path

from app.main import app

CONTRACT = Path(__file__).resolve().parents[2] / "docs" / "api" / "openapi.json"

REGENERATE = (
    "cd backend && ./.venv/Scripts/python.exe scripts/export_openapi.py"
)


def _render(document) -> str:
    # Must match scripts/export_openapi.py exactly, or every run is a diff.
    return json.dumps(document, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def test_the_committed_contract_exists():
    assert CONTRACT.exists(), (
        f"docs/api/openapi.json is missing. Generate it with:\n    {REGENERATE}"
    )


def test_the_live_api_matches_the_committed_contract():
    """A mismatch means the API changed. That is allowed -- silently is not.

    If the change was intended, regenerate the file and check the matching types
    in frontend/src/types/ before committing both. If it was not intended, the
    diff below is the thing that would have broken the browser.
    """
    committed = json.loads(CONTRACT.read_text(encoding="utf-8"))
    live = json.loads(_render(app.openapi()))

    if committed == live:
        return

    committed_paths = set(committed.get("paths", {}))
    live_paths = set(live.get("paths", {}))
    added = sorted(live_paths - committed_paths)
    removed = sorted(committed_paths - live_paths)
    changed_schemas = sorted(
        name
        for name in set(committed.get("components", {}).get("schemas", {}))
        & set(live.get("components", {}).get("schemas", {}))
        if committed["components"]["schemas"][name] != live["components"]["schemas"][name]
    )

    detail = []
    if added:
        detail.append(f"paths added: {added}")
    if removed:
        detail.append(f"paths removed: {removed}")
    if changed_schemas:
        detail.append(f"schemas changed: {changed_schemas}")
    if not detail:
        detail.append("operations on existing paths changed")

    raise AssertionError(
        "The API no longer matches docs/api/openapi.json -- "
        + "; ".join(detail)
        + ".\nIf this was intended, regenerate the contract and check the matching "
        "frontend types:\n    "
        + REGENERATE
    )
