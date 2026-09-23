# 00 — API Audit

**Date:** 2026-09-12 · **Base path:** `/api/v1` · **Total endpoints:** 105 across 15 routers
**Purpose:** Plan §8 requires auditing route + handler + service + repository +
schema + consumers + tests *before* adding or modifying any API. This is that
inventory.

---

## 1. Endpoint inventory

| Router | Prefix | Count | Covers |
|---|---|---|---|
| `llm` | `/llm` | 16 | Providers, task bindings, local runner detection, model lists, launcher |
| `roadmaps` | `/roadmaps` | 14 | CRUD, phases, topics, schedule, import validate/confirm |
| `system_design` | `/system-design` | 11 | Prompts, drafts, attempts, analytics |
| `design_review` | `/design-reviews` | 9 | Reviews, domains, axes, attempts, analytics |
| `questions` | `/questions` | 9 | CRUD, filters, research, bulk/clear delete |
| `recordings` | `/recordings` | 9 | Upload, list, audio stream, analyze, analysis, delete |
| `interview_questions` | `/interview-questions` | 8 | CRUD, round types, categories, generate, import |
| `exams` | `/exams` | 6 | Create, detail, answer, finish, reviewed-marks, unreviewed |
| `imports` | `/imports` | 6 | validate, confirm, file, repair, auto-refine, batch-research |
| `home` | `/home` | 5 | Home payload, activity, other-preparation, focus-topics, coverage |
| `analytics` | `/analytics` | 3 | dashboard, score-trends, domain-performance |
| `settings` | `/settings` | 3 | get, put, reset-app |
| `export` | `/export` | 2 | PDF, Excel per session |
| `review` | `/review` | 2 | queue, checks |
| `subjects` | `/subjects` | 2 | **list, detail — read only** |

Client: a single `axios` instance in `frontend/src/services/api.ts` (751 lines) —
one flat module of typed wrapper functions. There is **no OpenAPI contract file
and no generated client**; FastAPI serves `/docs` from the live app, and the
frontend types in `frontend/src/types/` are hand-maintained mirrors of the
Pydantic schemas.

> **Contract risk:** the request/response shapes are duplicated by hand on both
> sides with nothing asserting they agree. `npm run typecheck` validates the
> frontend against its *own* types, not against the backend. This is **RISK-05**.

---

## 2. Endpoints the prototype needs that do not exist

Derived by walking all 59 prototype screens against the 105 endpoints. Each entry
below is a **gap requiring a plan §8 impact report** before implementation.

### 2.1 Preparations — blocking (A-2)

| Needed | Prototype screen | Status |
|---|---|---|
| `POST /subjects` | `prep-new` | **Missing** |
| `PUT /subjects/{id}` | `prep-edit` | **Missing** |
| `DELETE /subjects/{id}` | `prep-edit` | **Missing** |

`subjects.py` exposes only `GET ""` and `GET /{subject_id}`, both returning
`SubjectWithReadiness`. Preparations exist only via `seed_subjects.py`.

The prototype makes "Add preparation" a first-class action reachable from the
preparation picker on **every screen** (`menu-add` button in `togglePrepMenu()`).
Plan §2 makes preparations first-class entities. **This is the largest API gap.**

Note for the impact report: `DELETE` must preserve exam history —
`exam_sessions.subject_id` is `ON DELETE SET NULL` by design, so deletion is
already non-destructive. Confirm that is the intended product behaviour rather
than a cascade.

### 2.2 Learning and sandbox evidence — blocking (A-1)

| Needed | Prototype screen | Status |
|---|---|---|
| `POST /learning/attempts` | `sandbox`, `sandbox-explain`, `guide` | **Missing** |
| `GET /learning/attempts` | mastery / recommendations | **Missing** |
| `PATCH /learning/attempts/{id}` | commit, complete | **Missing** |

Currently `localStorage` only. Shape already defined client-side in
`frontend/src/types/learning.ts`.

### 2.3 Study guide and topic demonstration (A-5, A-6)

| Needed | Prototype screen | Status |
|---|---|---|
| `GET /roadmaps/{id}/topics/{tid}/content` | `guide`, `roadmap-topic` | **Missing** |
| `POST /roadmaps/{id}/topics/{tid}/demonstrations` | `topic-demonstrate` | **Missing** |
| `GET /roadmaps/{id}/topics/{tid}/evidence` | `roadmap-topic` | **Missing** |

**Prefer extension over new routers.** These are nested resources under the
existing `/roadmaps` router, which already owns phases and topics. Plan §8:
*"Prefer existing endpoint extension over new endpoint when the domain operation
is already represented."*

### 2.4 Daily goals (A-7)

| Needed | Prototype screen | Status |
|---|---|---|
| Daily-goal block on the home payload | `home` | **Extend `GET /home`** |

`GET /home` already returns a `HomeResponse` assembled by `HomeService`. The two
goals belong **inside that existing response**, not at a new `/daily-goals`
endpoint — the data is derived from `review_checks` and `practice_recordings`,
both already reachable from that service. One extra field group on an existing
response, no new route.

`dailyCap` rides on the existing `GET/PUT /settings` pair.

### 2.5 Insights drill-down

| Needed | Prototype screen | Status |
|---|---|---|
| Per-domain detail | `insights-domain` | **Extend `/analytics/domain-performance`** |

`GET /analytics/domain-performance` already returns `List[DomainMasteryItem]`.
Whether the drill-down needs a new `/analytics/domains/{domain}` endpoint or just
richer items in the existing list is a call for Phase 13 — decide it from what the
screen actually renders, and prefer the richer item.

### 2.6 Notifications (A-8)

| Needed | Prototype screen | Status |
|---|---|---|
| `GET /notifications` | `notifications` | **Missing** |

Lowest value of all the gaps. There is no producer of notifications in the system
today, so the endpoint would serve an empty list. Recommend **deferring** and
having the screen state that honestly, rather than inventing notifications to
fill it. That is consistent with plan §22's empty-state rule and §38's no-fake
rule.

---

## 3. Endpoints that already satisfy prototype screens

This is the good news and the reason not to rebuild. Verified mappings:

| Prototype screen | Existing endpoint(s) |
|---|---|
| `home` | `GET /home`, `/home/activity`, `/home/other-preparation`, `/home/focus-topics`, `/home/subjects/{id}/coverage` |
| `preparations`, `subject` | `GET /subjects`, `GET /subjects/{id}` |
| `practice`, `practice-runner`, `practice-results` | `POST /exams` (`session_kind=drill`), `GET /exams/{id}`, `POST /exams/{id}/answer`, `POST /exams/{id}/finish` |
| `exam-setup`, `exam-runner`, `exam-review`, `exam-results` | same exam endpoints + `/exams/{id}/unreviewed`, `/export/pdf/{id}`, `/export/excel/{id}` |
| `review`, `spaced-runner` | `GET /review/queue`, `POST /review/checks` |
| `question-bank`, `question-detail`, `question-editor` | `GET /questions`, `/questions/filters`, `/questions/{id}`, `POST/PUT/DELETE /questions`, `POST /questions/{id}/research` |
| `import-audit` | `POST /imports/validate` → `POST /imports/confirm`, `/imports/repair`, `/imports/auto-refine-batch` |
| `roadmaps`, `roadmap-detail`, `roadmap-topics`, `roadmap-editor`, `roadmap-import`, `roadmap-resources` | all 14 `/roadmaps` endpoints, incl. `/import/validate` → `/import/confirm` and `/{id}/schedule` |
| `interview`, `interview-setup`, `interview-library` | `GET /interview-questions`, `/round-types`, `/categories`, `POST /generate`, `POST /import` |
| `interview-record`, `interview-session` | `POST /recordings`, `GET /recordings/{id}/audio` |
| `interview-results`, `interview-summary`, `recording-detail` | `POST /recordings/{id}/analyze`, `GET /recordings/{id}/analysis` |
| `recordings` | `GET /recordings`, `/recordings/analytics`, `/recordings/providers`, `DELETE /recordings/{id}` |
| `system-design`, `-answer`, `-results` | 11 `/system-design` endpoints incl. draft GET/PUT and `/analytics` |
| `design-reviews`, `design-review-result` | 9 `/design-reviews` endpoints incl. `/attempts`, `/{id}/latest-attempt`, `/axes`, `/analytics` |
| `insights` | `GET /analytics/dashboard`, `/score-trends`, `/domain-performance` |
| `settings`, `settings-ai` | `GET/PUT /settings`, `POST /settings/reset-app`, all 16 `/llm` endpoints |
| `settings-data` | `POST /settings/reset-app`, `/export/*` |

**~85% of prototype screens are backed by an endpoint that exists today.**

---

## 4. Breaking-change risk

| Change | Risk | Mitigation |
|---|---|---|
| Adding `subject_id` to roadmap responses | Low — additive field | Frontend types tolerate extra fields; add to `types/roadmap.ts` |
| Adding daily goals to `HomeResponse` | Low — additive | Same |
| Scoping `GET /roadmaps` by subject | **HIGH** — changes the result set of an existing endpoint | Make the filter an **optional query param** (`?subject_id=`), default unfiltered, so existing consumers and the 662 lines of `test_roadmaps.py` keep passing. Flip the default only after the frontend passes it |
| Scoping `GET /questions` by `subject_id` | **HIGH** — same | Same approach: optional param alongside the existing `certification` filter, not a replacement |
| Adding `POST /subjects` | None — new route | Requires unique `name`/`slug` validation; 409 on conflict |

> **Rule for this programme:** no existing endpoint's *default* response set may
> change. Every new scoping mechanism arrives as an optional parameter first.
> `test_roadmaps.py` (662 lines), `test_questions.py`, `test_subjects.py` (230) and
> `test_e2e_regression.py` (486) are the tripwires that will catch a violation.

---

## 5. Required test matrix per changed endpoint

Plan §8 mandates, for every changed endpoint: success, validation failure,
unauthorized, forbidden, not found, conflict, server failure, malformed payload,
boundary values, idempotency.

**`unauthorized` and `forbidden` are not applicable** — there is no auth layer
(see architecture audit §5). Attempting to test them would mean writing tests that
assert a 401 the app can never produce. The applicable eight must all be covered.

Existing tests already follow this shape — `test_roadmaps.py` covers unsupported
file type, missing topic column, no-topics rejection; `test_review_fixes.py`
covers oversized recording upload (413). Match that style.
