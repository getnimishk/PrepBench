"""A linter for an agent's identity and permission design. It turns 'least privilege' from a sentence into checks that can fail.

The design is plain data (a dict, or JSON). The rules come from the sources we read: prefer managed or federated credentials to stored
secrets; prefer delegated permissions to application permissions; avoid broad '.All' permissions; every agent has a named owner and sponsor;
access can be revoked quickly and is reviewed on a schedule; a token issued to one service is never passed on to another.
The permission names follow Microsoft Graph's pattern {resource}.{operation}.{constraint}. They are examples for the exercise, not a recommendation.
"""
BROAD = ("Directory.AccessAsUser.All", "Directory.ReadWrite.All", "Directory.Read.All")


def lint(design: dict) -> list[str]:
    f = []
    cred = design.get("credentials", {})
    if cred.get("kind") not in ("managed_identity", "federated_credential"):
        if cred.get("kind") != "client_secret":
            f.append("credentials: use a managed identity or a federated credential (no stored secret)")
        else:
            if cred.get("store") != "key_vault":
                f.append("credentials: a client secret must live in a vault, never in code or config")
            if cred.get("rotation_days", 9999) > 90:
                f.append("credentials: a client secret must be rotated at least every 90 days")
    if design.get("secrets_in_code"):
        f.append("secrets: a secret is present in code or configuration")
    for s in design.get("scopes", []):
        name, kind = s.get("name", ""), s.get("kind")
        if kind == "application":
            f.append(f"scope {name}: an application permission acts without a user and needs admin consent; use a delegated permission if the need allows")
        if name in BROAD or (name.endswith(".All") and not s.get("justification")):
            f.append(f"scope {name}: broad permission without a written justification")
        if "Write" in name and not design.get("writes_require_approval"):
            f.append(f"scope {name}: a write permission needs an approval step for the writes")
    if not design.get("owner") or not design.get("sponsor"):
        f.append("ownership: an agent needs a named owner and a sponsor")
    rev = design.get("revocation", {})
    if not rev.get("how") or rev.get("max_minutes", 9999) > 60:
        f.append("revocation: say how access is removed and make it effective within 60 minutes")
    if design.get("access_review_days", 9999) > 180:
        f.append("review: access must be reviewed at least every 180 days")
    if design.get("token_passthrough"):
        f.append("tokens: never pass a token issued to this agent on to another service; get one for that service")
    return f


EMAIL_TICKET_AGENT = {   # the criterion's example: an agent that can read a user's email and write tickets
    "agent": "email-ticket-agent",
    "owner": "platform-team@example.com", "sponsor": "head-of-support@example.com",
    "runs_as": "agent identity paired with a delegated user context for mail; its own identity for tickets",
    "credentials": {"kind": "managed_identity"},
    "scopes": [
        {"name": "Mail.Read", "kind": "delegated", "justification": "read the signed-in user's own mail to find ticket requests"},
        {"name": "Tickets.Create", "kind": "delegated", "justification": "create a ticket on behalf of the user; cannot edit or delete"},
    ],
    "writes_require_approval": True,
    "token_passthrough": False,
    "revocation": {"how": "disable the agent identity and remove its role assignments", "max_minutes": 15},
    "access_review_days": 90,
}
