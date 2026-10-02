import copy
import time

import pytest

import check_governance
import policy
from hitl import checkpoint
from identity_policy import EMAIL_TICKET_AGENT, lint
from registry import ToolEntry, check_registry, validate_entry


# ---- identity and permission design ----------------------------------------------------------------
def test_the_example_design_for_an_email_and_ticket_agent_passes():
    assert lint(EMAIL_TICKET_AGENT) == []


def test_a_careless_design_is_flagged_on_every_point():
    bad = {"agent": "x", "credentials": {"kind": "client_secret", "store": "config_file", "rotation_days": 365}, "secrets_in_code": True,
           "scopes": [{"name": "Directory.ReadWrite.All", "kind": "application"}, {"name": "Mail.ReadWrite", "kind": "delegated"}],
           "token_passthrough": True, "access_review_days": 400}
    text = " | ".join(lint(bad))
    for needle in ("vault", "rotated", "secret is present", "application permission", "broad permission", "approval step", "owner", "revocation", "review", "never pass"):
        assert needle in text, needle


# ---- registry --------------------------------------------------------------------------------------
GOOD = dict(name="rerun_job", version="1.0.0", description="Schedule a rerun of one pipeline. Use only when the runbook says a rerun is the fix. It does not run anything else.",
            input_schema={"type": "object", "additionalProperties": False, "properties": {}}, permission="approval_required", data_classes=["operational"],
            owner="platform@example.com")


def test_a_good_entry_has_no_findings():
    assert validate_entry(ToolEntry(**GOOD)) == []


@pytest.mark.parametrize("change,needle", [
    ({"version": "v1"}, "version"), ({"owner": "nobody"}, "owner"), ({"data_classes": []}, "data classes"),
    ({"description": "A tool that does a thing for the agent in the system always."}, "when to use"),
    ({"input_schema": {"type": "object"}}, "forbids extra"),
    ({"permission": "write", "data_classes": ["customer"]}, "approval_required"),
    ({"idempotent": False}, "idempotent"),
])
def test_each_registry_rule_fires(change, needle):
    findings = validate_entry(ToolEntry(**{**GOOD, **change}))
    assert any(needle in f for f in findings), findings


def test_an_agent_cannot_use_a_deprecated_or_unlisted_tool():
    e = ToolEntry(**{**GOOD, "status": "deprecated"})
    f = check_registry([e], {"rerun_job", "ghost"})
    assert any("deprecated" in x for x in f) and any("not in the registry" in x for x in f)


# ---- environment policy, separation of duties, expiring credentials ------------------------------------
NOW = 1_000_000.0


def cred(minutes=15, identity="agent-dataops"):
    return policy.Credential(identity, NOW, minutes)


def test_production_denies_plain_writes_and_requires_a_named_approver_for_approval_required():
    ok = lambda **kw: policy.decide("prod", "approval_required", requester="ana", agent="agent-dataops", credential=cred(), now=NOW + 1, **kw)
    assert ok(approver="sam.reviewer")[0]
    assert not ok(approver="bob")[0]                                   # not a named approver
    assert not ok(approver="ana")[0]                                   # the requester cannot approve their own request
    assert not ok(approver="agent-dataops")[0]                         # the agent cannot approve its own work
    assert not ok()[0]
    assert not policy.decide("prod", "write", requester="ana", agent="agent-dataops", approver="sam.reviewer", credential=cred(), now=NOW + 1)[0]


def test_credentials_expire_and_have_a_ceiling():
    c = cred(15)
    assert c.valid(NOW + 60) and not c.valid(NOW + 16 * 60)
    with pytest.raises(ValueError):
        cred(120)
    assert not policy.decide("dev", "read", requester="ana", agent="agent-dataops", credential=c, now=NOW + 16 * 60)[0]
    assert not policy.decide("dev", "read", requester="ana", agent="someone-else", credential=cred(), now=NOW + 1)[0]


# ---- the blocking check ----------------------------------------------------------------------------
def test_the_governance_check_passes_the_current_design():
    assert check_governance.check() == []


def test_the_governance_check_blocks_each_kind_of_bad_change():
    perms = {**check_governance.PERMISSIONS, "rerun_job": "write"}
    assert any(f.startswith("G1") for f in check_governance.check(permissions=perms))
    loose = copy.deepcopy(policy.POLICY)
    loose["prod"]["write"] = "allow"
    assert any(f.startswith("G2") for f in check_governance.check(pol=loose))
    assert any(f.startswith("G3") for f in check_governance.check(approvers={"sam.reviewer", check_governance.AGENT_IDENTITY}))
    assert any(f.startswith("G4") for f in check_governance.check(minutes=120))


# ---- risk-based checkpoints --------------------------------------------------------------------------
@pytest.mark.parametrize("kw,level", [
    (dict(changes_data=False, reversible=True, blast_radius=0), "none"),
    (dict(changes_data=True, reversible=True, blast_radius=1), "notify"),
    (dict(changes_data=True, reversible=True, blast_radius=50), "approve"),
    (dict(changes_data=True, reversible=False, blast_radius=1), "two_person"),
    (dict(changes_data=True, reversible=True, blast_radius=5000), "two_person"),
    (dict(changes_data=True, reversible=True, blast_radius=1, regulated=True), "two_person"),
    (dict(changes_data=False, reversible=True, blast_radius=0, evidence_supported=False), "approve"),
])
def test_checkpoint_levels(kw, level):
    assert checkpoint(**kw) == level
