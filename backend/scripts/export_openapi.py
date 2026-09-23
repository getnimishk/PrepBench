# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Write the API's OpenAPI document to docs/api/openapi.json.

Run this after deliberately changing an endpoint, then commit the result. The
committed file is the contract: tests/test_openapi_contract.py fails whenever
the live API and the file disagree, so a change to a request or response shape
cannot land without someone choosing to accept it.

    cd backend && ./.venv/Scripts/python.exe scripts/export_openapi.py
"""
import json
import os
import sys
from pathlib import Path

# The contract is a property of the code, not of a database, so exporting it
# must not create tables, migrate or seed anything.
os.environ.setdefault("SQLALCHEMY_DATABASE_URI", "sqlite:///:memory:")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app  # noqa: E402

OUT = Path(__file__).resolve().parents[2] / "docs" / "api" / "openapi.json"


def render() -> str:
    """Stable output: sorted keys, fixed indentation, trailing newline.

    Without sorting, dictionary order changes would show up as a contract diff
    when nothing about the contract changed.
    """
    return json.dumps(app.openapi(), indent=2, sort_keys=True, ensure_ascii=False) + "\n"


if __name__ == "__main__":
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(render(), encoding="utf-8")
    print(f"Wrote {OUT} ({len(app.openapi()['paths'])} paths)")
