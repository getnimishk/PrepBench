# Agent identity & authorization

**Course:** Agentic AI, from first principles to production · Module 10 Security and Governance · lesson 51 of 77 · **about 4 hours** · paper draft for review.  
**Success criterion:** Write the identity and permission design for an agent that can read email and write tickets: which identity it runs as, its scopes, where secrets live and how access is revoked.

> Sources (read 2026-10-02 and 2026-10-03; details and gaps in docs/research/agentic-ai): Microsoft Learn: 'Managed identities for Azure resources' (page dated 2025-08-19, updated 2026-06-15: no credentials to manage; system-assigned and user-assigned; RBAC; sign-in logs; federated identity credentials), 'Overview of Microsoft Graph permissions' (dated 2025-12-26, updated 2026-09-04: delegated versus application permissions; the naming pattern; least privilege; permissions to use with caution; some high-risk permissions blocked for agent identities), 'Microsoft identity platform and OAuth 2.0 On-Behalf-Of flow' (dated 2025-01-04, updated 2026-06-15: delegated scopes only; do not send a middle-tier token anywhere but its audience; Conditional Access claim challenges) and 'What are agent identities?' (Microsoft Entra Agent ID; dated 2025-11-06, updated 2026-06-15); Databricks documentation 'Service principals' (updated 2026-09-11: an identity for automation, assigned Unity Catalog permissions); Model Context Protocol specification 2026-07-28 (lesson 40: audience-bound tokens, no passthrough). Read 2026-10-03 through page summaries and, for the Graph, On-Behalf-Of and Entra pages, in full. The code on this page (the dataops folder) was written by us and run on Python 3.14.7 with Pydantic 2.13.4 and pytest 9.1.1; the folder's tests passed (58 in all, covering lessons 33 to 55). Permission names, policy values, owners and approvers in it are examples for the exercise, not recommendations for your organisation. Unverified: how any particular tenant is configured; what licences Microsoft Entra Agent ID features need in your organisation (the page says extending security features to agents requires Microsoft Agent 365, a licensed product: check current terms); Databricks OAuth details, since the page we read did not describe them; and the exact content of each Graph mail permission (check the permissions reference).

---

## Part 1 · Who is the agent, and whose authority does it use?

Two questions come before any permission list. **Authentication** asks 'who or what is this?'; **authorization** asks 'what may it do?'. An agent adds a third: **on whose authority does it act?**

Microsoft's documentation distinguishes the kinds of identity an agent might run as:

| Identity | What it is | Fit for an agent |
|---|---|---|
| **A human user** | A person's account, with their mailbox, groups and permissions | Dangerous to reuse: the agent inherits everything the person can do, and its actions look like the person's |
| **An application / service principal** | A workload identity for a service your organisation builds, expected to be long-lived, with a known owner | The usual choice for a fixed service |
| **A managed identity** | A workload identity attached to an Azure compute resource; you hold no credentials for it | Good for an agent hosted on Azure: nothing to leak |
| **An agent identity (Microsoft Entra Agent ID)** | An identity construct for AI agents, designed for scale and short life (agents may exist for minutes or be created thousands of times a day), with owners and sponsors, so agent activity can be told apart from human and other workload activity | Built for this case. The page says Agent ID is available to all Entra customers, and that extending Entra security features to agents requires a separate licensed product, so check your terms |

The agent-identity page gives four reasons they exist: to **distinguish** operations by AI agents from those by workforce, customer or workload identities; to give agents **right-sized access** across systems; to **prevent agents from reaching the most critical roles and systems**; and to **scale** identity management to many short-lived agents. Whatever platform you use, you want the same four properties.

Then the authority question. The Graph documentation names two access scenarios:

- **Delegated access:** the app calls on behalf of a signed-in user. The page's key sentence: the app's privileges are determined by the permissions it was granted **and** the user's own permissions, and the app **cannot access anything the signed-in user could not**.
- **App-only (autonomous) access:** the app calls with its own identity and no user. With an application permission such as `Files.Read.All`, it can read **any** file the permission covers. The page calls application permissions highly privileged, says only certain administrators can consent to them, and says the delegated model is the recommended approach whenever it meets the need.

**Worked example**

Fictional. A mailbox-triage agent should read the signed-in user's mail and create tickets for them. Delegated access to mail means it can only ever see that user's mail. An application permission to read mail would let it read every mailbox in the tenant: a far larger blast radius for the same feature.

**Common mistake**

Running an agent under a developer's own login 'for now'. Its actions are then indistinguishable from the developer's, it inherits all their rights, and it stops working when they leave.

**Check yourself.** What is the difference between delegated and application permissions, and which does Microsoft recommend when either would work?

<details><summary>Model answer (write yours first)</summary>

Delegated: the app acts for a signed-in user and can reach only what both the grant and the user allow. Application: the app acts alone and can reach everything the permission covers. Delegated is recommended whenever it meets the need.

</details>

---

## Part 2 · Tokens and delegation across services

An access token is a short-lived proof that a particular client may call a particular service. Three rules from the documentation matter for agents.

**1. A token is for one audience.** The On-Behalf-Of (OBO) page, which describes how a middle-tier service calls a downstream API as the user, warns: do not send an access token issued to the middle tier to anywhere except its intended audience. The MCP authorization specification (lesson 40) says the same in its own words: a server must accept only tokens issued for it, and must not pass tokens through to downstream APIs. If your agent needs to call a second service as the user, it gets a **new token for that service**.

**2. Delegation carries the user's limits.** In OBO the middle tier uses only delegated *scopes*, not application *roles*, so that the user does not gain permission to resources they should not reach. The user's identity and permissions travel down the chain, which is what you want from a support or mail agent.

**3. Extra checks may interrupt the chain.** If the downstream API has a Conditional Access policy (multi-factor authentication, for example), the token request fails with an `interaction_required` error and a claims challenge. The middle tier must pass that back to the client so the user can satisfy it; it must not retry with a cached token. For an agent this means a delegated call can legitimately stop and ask the person for something: design that as a normal state (lesson 33's 'interrupted' tasks), not an error.

The same logic applies between agents (lesson 42): when agent A delegates to agent B, decide whether B acts with A's authority or its own, and make that choice visible in the identity that appears in the logs.

**Worked example**

Fictional. A user asks the agent to 'file a ticket for the problem in my latest email'. The agent holds a delegated token for mail (audience: the mail service) and gets a separate delegated token for the ticket system (audience: the ticket service). If the ticket service requires MFA step-up, the agent pauses and asks the user, rather than reusing the mail token or storing a password.

**Common mistake**

Forwarding the user's token to every downstream tool 'so it just works'. A stolen or logged token then opens every service it was forwarded to.

**Check yourself.** Why must a service that calls another service on a user's behalf get a new token instead of forwarding the one it received?

<details><summary>Model answer (write yours first)</summary>

The received token is bound to the first service as its audience. Forwarding it breaks that binding, widens the damage of a leak, and bypasses checks (such as MFA step-up) that the downstream service requires.

</details>

---

## Part 3 · Secrets, service principals and managed identities

The best secret is one nobody holds. The managed-identity page describes managed identities as removing the need for developers to manage credentials: code running on the Azure resource asks Microsoft Entra for a token, the platform authenticates it by where it runs, and the credentials are not even accessible to you. You then authorise the identity with role-based access control, and its activity shows in the Azure activity and Entra sign-in logs. The page distinguishes **system-assigned** identities (created with one resource and deleted with it) from **user-assigned** ones (a standalone resource you can attach to several resources and delete explicitly).

Where a managed identity is not available, the Databricks service-principal page gives the equivalent idea for that platform: a **service principal** is an identity for automation and programmatic access, so jobs and tools do not run as a person (and do not break when that person leaves), and you grant it workspace roles and Unity Catalog permissions like any other principal. A user-assigned Azure managed identity can also be used as a federated credential for an Entra application, which is the recommended credential-free route when an app registration is required.

Rules that follow, whatever the platform:

- **No secret in code, prompts, notebooks, configuration committed to Git, or traces.** A key placed in a prompt is a key the model can repeat.
- **If a secret is unavoidable, keep it in a vault, rotate it on a schedule, and give each agent its own,** so one leak can be revoked without stopping others.
- **Prefer short-lived tokens** requested at run time over long-lived keys.
- **Give each agent (or each class of agent) its own identity.** Shared identities make audit and revocation blunt.
- **Name an owner and a sponsor.** Entra's agent-identity model records the person who created an agent as its sponsor. Someone must answer for each identity, and an identity with no owner is a finding.

**Worked example**

Fictional. A DataOps agent runs on Azure with a user-assigned managed identity that has read access to the log store and write access only to a queue. No key exists to leak. When the agent is retired, its role assignments are removed and the identity deleted; nothing is left behind.

**Common mistake**

Putting one 'service account' key in a shared notebook so every agent can use it. It cannot be revoked without breaking all of them, and it is a standing credential on every machine that read it.

**Check yourself.** What problem do managed identities solve, and what is the difference between system-assigned and user-assigned?

<details><summary>Model answer (write yours first)</summary>

They remove the need to hold and rotate credentials: the platform authenticates the workload. System-assigned shares a lifecycle with one resource; user-assigned is a standalone identity that can be attached to several resources.

</details>

---

## Part 4 · Least privilege, revocation and a design you can lint

**Least privilege** means each identity gets the minimum permission for its task. The Graph documentation makes it concrete with a naming pattern, `{resource}.{operation}.{constraint}`, and examples: `User.Read` for the signed-in user's own profile (least), against `User.ReadWrite` (over-privileged if the app never writes); `Application.ReadWrite.OwnedBy` (only applications the app owns) against `Application.ReadWrite.All` (every application in the tenant). It names `Directory.AccessAsUser.All` as the highest-privileged delegated permission and `Directory.ReadWrite.All` and `Directory.Read.All` as other permissions to use with caution. It also notes that for Entra Agent ID some high-risk Graph permissions are globally blocked for agent identities, so an attempt to request them is rejected.

**Revocation and review** are the other half. Decide how access is removed, how quickly, and who checks it: disable the identity, remove its role assignments, let short-lived tokens lapse. Set a review rhythm so permissions that are no longer needed are removed.

Here is your design exercise, answered for the criterion's example: **an agent that can read a user's email and write tickets.**

| Question | Design |
|---|---|
| Which identity does it run as? | An agent identity (or managed identity) with a named owner and sponsor; mail is read in a delegated user context so it sees only that user's mail; tickets are created under the agent's own identity so the audit log shows an agent acted |
| What scopes? | `Mail.Read` delegated (reads the signed-in user's mail; by the naming pattern `Mail.ReadBasic` would give only basic properties and `Mail.ReadWrite` would also change mail, so check the permissions reference for exact content); `Tickets.Create` delegated (creates, cannot edit or delete) |
| What is not granted? | No application permissions, no `.All` scopes, no mailbox-wide access, no ticket edit or delete |
| Where do secrets live? | Nowhere: managed identity or federated credential. If a ticket-system key exists, it is in a vault, rotated every 90 days, readable only by this identity |
| How is access revoked? | Disable the agent identity and remove its role assignments, effective within 15 minutes; tokens are short-lived; access is reviewed every 90 days |
| What stops a bad write? | Writes need an approval step (lesson 53) |

A design only counts if it can be checked. Our `identity_policy.py` linter turns these rules into checks that return findings. The example design above passes with no findings. A careless design produces a finding for each problem:

```text
credentials: a client secret must live in a vault, never in code or config
credentials: a client secret must be rotated at least every 90 days
secrets: a secret is present in code or configuration
scope Directory.ReadWrite.All: an application permission acts without a user and needs admin consent; use a delegated permission if the need allows
scope Directory.ReadWrite.All: broad permission without a written justification
scope Directory.ReadWrite.All: a write permission needs an approval step for the writes
ownership: an agent needs a named owner and a sponsor
revocation: say how access is removed and make it effective within 60 minutes
review: access must be reviewed at least every 180 days
tokens: never pass a token issued to this agent on to another service; get one for that service
```

The linter's rules and example design are in the lab files. The permission names are examples; the thresholds (90 and 180 days, 60 minutes) are our choices to be replaced by your organisation's policy.

**Worked example**

```python
"""A linter for an agent's identity and permission design. It turns 'least privilege' from a sentence into checks that can fail.

The design is plain data (a dict, or JSON). The rules come from the sources we read: prefer managed or federated credentials to stored
secrets; prefer delegated permissions to application permissions; avoid broad '.All' permissions; every agent has a named owner and sponsor;
access can be revoked quickly and is reviewed on a schedule; a token issued to one service is never passed on to another.
The permission names follow Microsoft Graph's pattern {resource}.{operation}.{constraint}. They are examples for the exercise, not a recommendation.
"""
# ... lint(design) returns a list of findings; EMAIL_TICKET_AGENT is the worked design ...
```

**Common mistake**

Treating a permission list as a design. A design says which identity, which authority (delegated or autonomous), where secrets live, how access is revoked and reviewed, and who owns it.

**Check yourself.** For an agent that reads email and writes tickets, why use a delegated mail permission and a separate agent identity for tickets?

<details><summary>Model answer (write yours first)</summary>

Delegated mail access limits the agent to the signed-in user's own mail, while creating tickets under the agent's own identity makes the audit log show an agent acted. Together they limit blast radius and keep actions attributable.

</details>

---

## Do it: lab

1. Write the identity and permission design for an agent that can read email and write tickets (or an agent from your own work): which identity it runs as, its authority (delegated or autonomous) for each system, its scopes with a justification each, where secrets live, how access is revoked and how fast, how often it is reviewed, and who owns it.
2. Check every scope against the platform's permissions reference and write what it grants and what a lesser-privileged alternative would grant. Record the date you read it.
3. Turn the design into data (start from `identity_policy.py`) and run the linter. Fix every finding, or write down why you accept it.
4. Write the token path: for each downstream service the agent calls, which token it uses and its audience. Confirm no token is forwarded to a service it was not issued for.
5. Write the revocation drill: the exact steps, who performs them and a test that shows the agent can no longer act within the time you promised.

**Done when:** you have a one-page identity and permission design naming the identity, scopes with justification, where secrets live, how access is revoked and reviewed, and the owner; the design passes your linter; and a revocation drill is written with a time limit.

---

## Interview check

**Question.** What identity should an AI agent run as, and what permissions should it have?

<details><summary>A strong answer has this shape</summary>

1. Its own identity, not a person's: a managed identity, service principal or agent identity with a named owner and sponsor, so its actions are attributable and it survives staff changes.
2. The least authority that does the job: prefer delegated permissions, where the agent can reach only what the signed-in user can, over application permissions that act alone and reach everything the permission covers; avoid broad `.All` scopes without a written reason.
3. No stored secrets where a managed or federated identity works; otherwise a vault, short life, rotation and a separate credential per agent.
4. Tokens bound to one audience: get a new token for each downstream service, never forward one.
5. Fast revocation and regular review, and writes behind an approval step. I would lint the design and rehearse the revocation.

</details>

---

## Evidence to keep

Keep the one-page design, the permission checks with dates, the linter output, the token path and the revocation drill. They feed the governance plan in lesson 53.

---
