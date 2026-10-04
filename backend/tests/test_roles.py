# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Roles from a job description, and the diagnostic (skills plan Phase 4, §8).

Through the API and the conftest-redirected database only. The migration tests
build their own throwaway SQLite file.
"""
import sqlite3
import uuid

import pytest
from sqlalchemy import create_engine, text

from app.core.database import Base, register_sqlite_pragmas

REF_RECON = "adf@1/diagnostic/reconciliation"   # 6 points
REF_COST = "adf@1/diagnostic/cost"              # 5 points
REF_S1_PO = "adf@1/scenario/1/lens/po"
REF_S1_DM = "adf@1/scenario/1/lens/dm"


def _skill(client, name=None, kind="skill"):
    body = {"name": name or f"Role skill {uuid.uuid4().hex[:6]}", "kind": kind}
    if kind == "certification":
        body.update(certification=f"Cert {uuid.uuid4().hex[:6]}", pass_mark=80, exam_question_count=40, exam_minutes=60)
    res = client.post("/api/v1/subjects", json=body)
    assert res.status_code == 201, res.text
    return res.json()


def _role(client, **overrides):
    payload = {
        "name": f"Technical Product Owner {uuid.uuid4().hex[:6]}",
        "interview_date": "2026-11-02",
        "job_description": "SAMPLE JOB DESCRIPTION (fictional)\nMandatory skills\n- SQL",
        "lens": "po",
        "requirements": [
            {"text": "Data reconciliation for migrations", "kind": "mandatory"},
            {"text": "Power BI", "kind": "preferred"},
        ],
    }
    payload.update(overrides)
    res = client.post("/api/v1/roles", json=payload)
    assert res.status_code == 201, res.text
    return res.json()


def _item(ref, covered=(), confidence="partly", fits=False):
    return {"question_ref": ref, "answer": "My answer.", "covered": list(covered),
            "confidence": confidence, "fits_requirement": fits}


# ---- CRUD ------------------------------------------------------------------


def test_a_role_is_created_read_listed_updated_and_deleted(client):
    role = _role(client)
    assert role["lens"] == "po"
    assert [r["text"] for r in role["requirements"]] == ["Data reconciliation for migrations", "Power BI"]
    assert [r["order_index"] for r in role["requirements"]] == [0, 1]
    assert all(r["subject_id"] is None for r in role["requirements"])

    assert client.get(f"/api/v1/roles/{role['id']}").json()["name"] == role["name"]
    listed = {r["id"]: r for r in client.get("/api/v1/roles").json()}
    assert listed[role["id"]]["requirement_count"] == 2
    assert listed[role["id"]]["linked_count"] == 0
    assert listed[role["id"]]["diagnostic_count"] == 0

    updated = client.put(f"/api/v1/roles/{role['id']}", json={"name": "Renamed", "interview_date": None}).json()
    assert updated["name"] == "Renamed" and updated["interview_date"] is None

    assert client.delete(f"/api/v1/roles/{role['id']}").status_code == 204
    assert client.get(f"/api/v1/roles/{role['id']}").status_code == 404


def test_archived_roles_leave_the_list_unless_asked_for(client):
    role = _role(client)
    client.put(f"/api/v1/roles/{role['id']}", json={"is_archived": True})
    assert role["id"] not in {r["id"] for r in client.get("/api/v1/roles").json()}
    assert role["id"] in {r["id"] for r in client.get("/api/v1/roles?include_archived=true").json()}


def test_no_role_response_carries_a_readiness_figure(client):
    """A role has no mocks, so it has no readiness; the page says "Needs evaluation"."""
    role = _role(client)
    client.post(f"/api/v1/roles/{role['id']}/diagnostics", json={"lens": "po", "items": [_item(REF_RECON)]})
    bodies = [
        client.get(f"/api/v1/roles/{role['id']}").json(),
        *client.get("/api/v1/roles").json(),
        *client.get(f"/api/v1/roles/{role['id']}/diagnostics").json(),
    ]
    for body in bodies:
        assert not any("readiness" in key or "score" in key for key in body), body.keys()


def test_bad_input_is_refused(client):
    assert client.post("/api/v1/roles", json={"name": ""}).status_code == 422
    assert client.post("/api/v1/roles", json={"name": "x", "lens": "cto"}).status_code == 422
    assert client.post("/api/v1/roles", json={"name": "x", "requirements": [{"text": "a", "kind": "optional"}]}).status_code == 422
    assert client.get("/api/v1/roles/987654321").status_code == 404


# ---- requirement links (D8) --------------------------------------------------


def test_requirements_are_replaced_with_the_links_the_learner_confirmed(client):
    skill = _skill(client)
    role = _role(client)
    res = client.put(f"/api/v1/roles/{role['id']}/requirements", json={"requirements": [
        {"text": "Azure Data Factory", "kind": "mandatory", "subject_id": skill["id"]},
        {"text": "Power BI", "kind": "preferred"},
    ]})
    assert res.status_code == 200, res.text
    reqs = res.json()["requirements"]
    assert [(r["text"], r["subject_id"], r["subject_name"]) for r in reqs] == [
        ("Azure Data Factory", skill["id"], skill["name"]),
        ("Power BI", None, None),
    ]
    listed = {r["id"]: r for r in client.get("/api/v1/roles").json()}
    assert listed[role["id"]]["linked_count"] == 1


def test_a_requirement_links_only_to_an_existing_skill(client):
    cert = _skill(client, kind="certification")
    role = _role(client)
    to_cert = client.put(f"/api/v1/roles/{role['id']}/requirements", json={"requirements": [
        {"text": "Scrum", "subject_id": cert["id"]},
    ]})
    assert to_cert.status_code == 400
    missing = client.put(f"/api/v1/roles/{role['id']}/requirements", json={"requirements": [
        {"text": "Scrum", "subject_id": 987654321},
    ]})
    assert missing.status_code == 404
    # Nothing changed.
    assert [r["text"] for r in client.get(f"/api/v1/roles/{role['id']}").json()["requirements"]] == [
        "Data reconciliation for migrations", "Power BI",
    ]


def test_deleting_a_linked_skill_turns_the_requirement_back_into_a_gap(client):
    skill = _skill(client)
    role = _role(client, requirements=[{"text": "ADF", "subject_id": skill["id"]}])
    res = client.request("DELETE", f"/api/v1/subjects/{skill['id']}", json={"confirm_name": skill["name"]})
    assert res.status_code == 200, res.text
    req = client.get(f"/api/v1/roles/{role['id']}").json()["requirements"][0]
    assert req["text"] == "ADF" and req["subject_id"] is None


def test_deleting_a_role_removes_its_requirements_and_diagnostics_but_not_the_skill(client):
    from tests.conftest import TestingSessionLocal
    from app.models.role import RoleDiagnosticAttempt, RoleRequirement

    skill = _skill(client)
    role = _role(client, requirements=[{"text": "ADF", "subject_id": skill["id"]}])
    client.post(f"/api/v1/roles/{role['id']}/diagnostics", json={"lens": "po", "items": [_item(REF_RECON)]})
    assert client.delete(f"/api/v1/roles/{role['id']}").status_code == 204

    db = TestingSessionLocal()
    try:
        assert db.query(RoleRequirement).filter(RoleRequirement.role_id == role["id"]).count() == 0
        assert db.query(RoleDiagnosticAttempt).filter(RoleDiagnosticAttempt.role_id == role["id"]).count() == 0
    finally:
        db.close()
    assert client.get(f"/api/v1/subjects/{skill['id']}").status_code == 200


# ---- the diagnostic (D9) ------------------------------------------------------


def test_a_diagnostic_is_recorded_and_listed_oldest_first(client):
    role = _role(client)
    first = client.post(f"/api/v1/roles/{role['id']}/diagnostics", json={"lens": "po", "items": [
        _item(REF_RECON, covered=[0, 2], confidence="partly", fits=True),
        _item(REF_S1_PO, covered=[1], confidence="not-yet"),
    ]})
    assert first.status_code == 201, first.text
    again = client.post(f"/api/v1/roles/{role['id']}/diagnostics", json={"lens": "po", "items": [
        _item(REF_S1_PO, covered=[0, 1, 2], confidence="confident"),
        _item(REF_RECON, covered=[0, 1, 2, 3], confidence="confident", fits=True),
    ]})
    assert again.status_code == 201, again.text

    attempts = client.get(f"/api/v1/roles/{role['id']}/diagnostics").json()
    assert [a["id"] for a in attempts] == [first.json()["id"], again.json()["id"]]
    assert attempts[0]["items"][0] == _item(REF_RECON, covered=[0, 2], confidence="partly", fits=True)
    assert client.get(f"/api/v1/roles/{role['id']}").json()["diagnostic_count"] == 2


def test_a_retake_with_different_questions_is_refused(client):
    role = _role(client)
    client.post(f"/api/v1/roles/{role['id']}/diagnostics", json={"lens": "po", "items": [_item(REF_RECON), _item(REF_S1_PO)]})

    swapped = client.post(f"/api/v1/roles/{role['id']}/diagnostics", json={"lens": "po", "items": [_item(REF_RECON), _item(REF_COST)]})
    fewer = client.post(f"/api/v1/roles/{role['id']}/diagnostics", json={"lens": "po", "items": [_item(REF_RECON)]})
    assert swapped.status_code == 400 and "same questions" in swapped.json()["detail"]
    assert fewer.status_code == 400
    assert len(client.get(f"/api/v1/roles/{role['id']}/diagnostics").json()) == 1


def test_a_retake_in_another_lens_is_refused_and_the_lens_is_then_fixed(client):
    role = _role(client, lens="dm")
    client.post(f"/api/v1/roles/{role['id']}/diagnostics", json={"lens": "dm", "items": [_item(REF_RECON), _item(REF_S1_DM)]})

    other_lens = client.post(f"/api/v1/roles/{role['id']}/diagnostics", json={"lens": "po", "items": [_item(REF_RECON), _item(REF_S1_DM)]})
    assert other_lens.status_code == 400
    assert client.put(f"/api/v1/roles/{role['id']}", json={"lens": "po"}).status_code == 400
    assert client.put(f"/api/v1/roles/{role['id']}", json={"lens": "dm"}).status_code == 200


def test_a_diagnostic_answers_only_questions_that_ship(client):
    role = _role(client)
    post = lambda items, lens="po": client.post(f"/api/v1/roles/{role['id']}/diagnostics", json={"lens": lens, "items": items})
    assert post([_item("adf@1/diagnostic/no-such-question")]).status_code == 400
    assert post([_item("adf@99/diagnostic/reconciliation")]).status_code == 400
    assert post([_item("nope@1/diagnostic/reconciliation")]).status_code == 400
    assert post([_item("adf@1/scenario/99/lens/po")]).status_code == 400   # not in pack
    assert post([_item(REF_S1_DM)]).status_code == 400                     # a dm question, answered as po
    assert post([_item(REF_COST, covered=[5])]).status_code == 400         # cost has points 0-4
    assert post([_item(REF_RECON), _item(REF_RECON)]).status_code == 400   # the same question twice
    assert post([]).status_code == 422
    assert post([{**_item(REF_RECON), "confidence": "sure"}]).status_code == 422
    assert client.get(f"/api/v1/roles/{role['id']}/diagnostics").json() == []


# ---- the migration ------------------------------------------------------------


@pytest.fixture
def legacy_db(tmp_path, monkeypatch):
    """A database from before roles existed: subjects only."""
    path = tmp_path / "legacy.db"
    raw = sqlite3.connect(path)
    raw.execute("""
        CREATE TABLE subjects (
            id INTEGER NOT NULL, name VARCHAR(150) NOT NULL, slug VARCHAR(80) NOT NULL,
            kind VARCHAR(13) NOT NULL, PRIMARY KEY (id)
        )
    """)
    raw.commit()
    raw.close()
    engine = create_engine(f"sqlite:///{path}", connect_args={"check_same_thread": False})
    register_sqlite_pragmas(engine)

    import app.core.database as database_module

    monkeypatch.setattr(database_module, "engine", engine)
    yield engine
    engine.dispose()


def _columns(engine, table):
    with engine.connect() as conn:
        return {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})")).fetchall()}


def test_the_migration_creates_the_role_tables_like_a_fresh_install(legacy_db, tmp_path):
    from app.core.database import apply_lightweight_migrations

    apply_lightweight_migrations()
    apply_lightweight_migrations()  # idempotent

    fresh = create_engine(f"sqlite:///{tmp_path / 'fresh.db'}", connect_args={"check_same_thread": False})
    register_sqlite_pragmas(fresh)
    Base.metadata.create_all(bind=fresh)
    try:
        for table in ("roles", "role_requirements", "role_diagnostic_attempts"):
            assert _columns(legacy_db, table), f"{table} was not created"
            assert _columns(legacy_db, table) == _columns(fresh, table), f"{table} differs from a fresh install"
    finally:
        fresh.dispose()


def test_a_blank_name_or_requirement_is_refused_not_stored_empty(client):
    assert client.post("/api/v1/roles", json={"name": "   "}).status_code == 422
    assert client.post("/api/v1/roles", json={"name": "x", "requirements": [{"text": "  "}]}).status_code == 422
    role = _role(client)
    assert client.put(f"/api/v1/roles/{role['id']}", json={"name": "  "}).status_code == 422
    trimmed = _role(client, name="  Padded name  ", requirements=[{"text": "  SQL  "}])
    assert trimmed["name"] == "Padded name"
    assert trimmed["requirements"][0]["text"] == "SQL"


def test_a_retake_keeps_the_first_attempts_fits_and_core_labels(client):
    role = _role(client)
    client.post(f"/api/v1/roles/{role['id']}/diagnostics", json={"lens": "po", "items": [
        _item(REF_RECON, fits=True), _item(REF_S1_PO, fits=False),
    ]})
    retake = client.post(f"/api/v1/roles/{role['id']}/diagnostics", json={"lens": "po", "items": [
        _item(REF_RECON, fits=False), _item(REF_S1_PO, fits=True),
    ]})
    assert retake.status_code == 201, retake.text
    labels = {i["question_ref"]: i["fits_requirement"] for i in retake.json()["items"]}
    assert labels == {REF_RECON: True, REF_S1_PO: False}
