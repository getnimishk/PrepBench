# Readiness

The one question PrepBench exists to answer: **would you pass?**

Everything else — the question bank, drills, design reviews, analytics — is evidence feeding that answer. The rule lives in `app/services/readiness.py`, deliberately as pure arithmetic over a small dataclass rather than as queries, so it is testable without a database and readable without tracing relationships.

## Subjects

A **subject** is the thing you are preparing for. Subjects, not formats, are what the navigation grows with: exams, design reviews, system design and interviews are a closed set, while Scrum, Databricks and AI keep arriving. Each subject is one row in `subjects`, so adding one costs a row rather than a screen.

Two kinds, and the whole difference is a pass mark:

| Kind | Has an exam profile | Can be READY |
|---|---|---|
| `certification` | Pass mark, question count, duration — taken from the certification body | Yes |
| `skill` | None | **No** — there is no bar to be ready against |

A skill subject can only ever reach `developing`. Reporting anything stronger would be inventing a bar that does not exist.

### The built-in subjects

`app/utils/seed_subjects.py`:

| Subject | Slug | Kind | Exam profile |
|---|---|---|---|
| Scrum / PSM I | `psm-i` | certification | 85%, 80 questions, 60 min |
| Databricks Data Platform | `databricks` | skill | — |
| System Design | `system-design` | skill | — |

Databricks ships as a **skill** on purpose. The exam exists, but PrepBench has no Databricks questions yet, so claiming an exam profile would promise a mock it cannot assemble.

A certification subject carries a `certification` string matching `Question.certification` exactly, which is how several hundred existing questions resolve to a subject with no data migration.

## Mocks and drills

`exam_sessions.session_kind` is `mock` or `drill`, and the distinction is load-bearing.

> [!IMPORTANT]
> **Only full mocks count toward readiness.** A drill is untimed, unpressured and usually shorter, so mixing the two produces a number that cannot answer "would I pass".

This is enforced **at the repository**, in `SubjectRepository.get_mock_results`, not by convention in a service — so no future caller can widen it by forgetting a filter. A drill is not a weaker measurement of readiness; it is not a measurement of it.

Three defaults protect the same property:

- The column defaults to `drill`, with a `server_default`, so every session recorded before it existed is treated as practice. **Historical data cannot inflate readiness.**
- `ExamCreateRequest.session_kind` also defaults to `drill`: a caller that has not thought about it is not sitting an exam under exam conditions.
- A `session_kind` outside the two known words is rejected by a validator rather than stored. An unrecognised value would silently fail every mock filter, which reads as *"the exam did not count"* with nothing anywhere explaining why.

> [!NOTE]
> **Mocks are startable from the browser.** Exam setup sends `session_kind: mock` and `subject_id`, and refuses the request unless the subject has an exam profile and enough questions to fill the paper — a short mock is a drill wearing a measurement's label, which is worse than no measurement. `test_product_invariants.py` holds that line.

### Historical sessions can be promoted

`app/utils/reconcile_evidence.py` runs at every startup and promotes a historical drill to a mock when the row itself proves the shape: completed, every question answered, `TIMED`, exactly the subject's question count, exactly its time allowance, its certification, learner provenance. Anything failing any one of those stays a drill.

This is not the same thing as inventing evidence. `session_kind` was added by `ALTER TABLE ... NOT NULL DEFAULT 'drill'`, so `drill` on a row that predates the column is a schema default rather than something anybody chose — there is no intent to overwrite. What the row cannot prove is *motive*, and the product says so where it says the count rather than burying it here.

The `passing_percentage` stored on those rows is deliberately ignored. Five of the six on the developer's database carry `95.0`, which was an app default at the time and never the PSM I pass mark; readiness re-judges the raw score against the subject's own pass mark, so a settings default from August cannot decide whether a paper passed.

## The five states

| State | Means | Reached when |
|---|---|---|
| `needs_evaluation` | No measurement yet | Zero mocks. **Not** zero per cent |
| `developing` | Working, not close | At least one mock, and none of the below |
| `almost_there` | Within reach | Last-3 average within 5 points of the pass mark |
| `plateau` | Stuck at the line | Four mocks spread ≤ 3 points, averaging within 2 of the pass mark |
| `ready` | Book it | All four conditions below, no exceptions |

**READY requires all of:**

1. At least 3 mocks total.
2. The last 3 **consecutive** mocks at or above the pass mark — consecutive, not averaged, because an average hides a collapse.
3. Every scored domain at or above the domain floor. Exams sample every domain; one weak area sinks you.
4. The most recent mock within the recency window. Knowledge decays, so stale evidence is not evidence.

`plateau` is checked **before** `almost_there`, because a plateau at the line also satisfies "almost", and the plateau is the more useful thing to say. It is the screen that stops someone practising forever at 85%.

## The thresholds

Every number the rule depends on sits at the top of `readiness.py`, in one place. These are product decisions, not implementation details — each is arguable, and each is meant to be argued with. Change one and every surface follows.

| Constant | Value | Why |
|---|---|---|
| `MIN_MOCKS_FOR_READY` | 3 | One good mock is luck; three is a pattern |
| `CONSECUTIVE_MOCKS_AT_PASS` | 3 | Consecutive, not averaged |
| `DOMAIN_FLOOR_PCT` | 80.0 | One weak domain sinks a sampled exam |
| `RECENCY_DAYS` | 14 | Beyond this the evidence is stale |
| `ALMOST_THERE_MARGIN` | 5.0 | Within this of the pass mark reads as "nearly" |
| `PLATEAU_MIN_MOCKS` | 4 | Fewer than four is not yet a shape |
| `PLATEAU_MAX_SPREAD` | 3.0 | Four results this tight are not improving |
| `PLATEAU_MARGIN` | 2.0 | …and this close to the line |
| `MIN_QUESTIONS_PER_DOMAIN` | 10 | Below this a domain has no reportable score |

## Domain readiness

Per-domain accuracy is pooled across **the mocks that decide the verdict**, not across all history, so the reported weakness matches the reported readiness.

| Domain state | Accuracy |
|---|---|
| `solid` | ≥ 90% |
| `developing` | ≥ 80% |
| `needs_work` | < 80% |
| `needs_evaluation` | Fewer than 10 answered — **no score**, not a bad one |

A domain below the reporting threshold returns `score_pct: null`. Rendering it as `0%` would be the same lie the whole module exists to avoid, one level down.

## Readiness always travels with its evidence

`Readiness` carries `mock_count`, `pass_mark`, `recent_scores`, `latest_taken_at`, `domains`, `weakest_domain`, and where computable `points_per_mock` and `mocks_to_pass_estimate`.

**No surface may state a readiness without also being able to state what it rests on.** A bare "developing" is unfalsifiable; "developing, 3 mocks, 71 / 74 / 78, weakest domain Scrum Events" is something you can argue with.

`points_per_mock` is the plain first-to-last slope, not a regression. The number is shown to a person as *"rising about N points per mock"*, and a regression coefficient would imply a precision three data points do not have. `mocks_to_pass_estimate` is populated only when the trend is positive and the average is still below the pass mark — never as a countdown that ticks up when you have a bad day.

## What Home renders

`GET /api/v1/home` returns state, and **deliberately nothing more**.

> [!IMPORTANT]
> There is no `suggested` or `next_actions` field. A ranked list of what to do next was put to the user and rejected as nagging. The client is given state and the person chooses.

| Field | Meaning |
|---|---|
| `resumable` | The unfinished session, if any. Surfaced above everything else — an abandoned mock used to be invisible the next day, which made stopping mid-session a decision you had to make again from scratch |
| `mock_count` · `mock_accuracy` | Mocks only. `mock_accuracy` is `null`, never `0.0`, with nothing to average |
| `subjects_total` · `subjects_ready` | How many subjects are at `ready` |
| `unreviewed_total` · `per_subject` | Wrong answers from completed mocks never looked at. Mocks only — a drill gives feedback as you go, so there is no separate review step to be behind on |
| `due_for_review` | Questions the SM-2 engine has scheduled for today. The engine sat in the codebase with no route and no navigation entry; this is the first thing that reads it |

The unreviewed count is the only thing the product surfaces unprompted, and it is **a count, not an instruction**. `POST /api/v1/exams/{id}/answers/{qid}/reviewed` clears one.

## Coverage

`GET /api/v1/home/subjects/{id}/coverage` lists **every** practice format for a subject, including the ones with no content.

An unavailable format is returned rather than omitted. An empty row is the only way the application can tell you that Databricks has ten design reviews and zero exam questions — hiding it would leave the subject looking finished.

A full mock reports `available: false` unless the subject has both an exam profile **and** enough questions to fill it, and the `detail` string says which of the two is missing.

## Activity

`GET /api/v1/home/activity` is one timeline across every format — mocks, drills, design reviews, system design attempts, recordings.

It supersedes the separate Exam History and System Design History pages. Those pages are gone; `/history` and `/system-design/history` are kept as redirects to `/review` so an old bookmark still lands somewhere real. Two of the practice modes had their own history page and the other two had none, so nowhere in the app answered "what have I actually been doing".

## Endpoints

| Endpoint | Method | Returns |
|---|---|---|
| `/api/v1/subjects` | GET | Every subject with its readiness — what Home renders |
| `/api/v1/subjects/{id}` | GET | One subject with its readiness |
| `/api/v1/home` | GET | The summary Home renders — resumable session, mock totals, outstanding review |
| `/api/v1/home/activity` | GET | The unified timeline |
| `/api/v1/home/other-preparation` | GET | The formats that are not the primary subject |
| `/api/v1/home/subjects/{id}/coverage` | GET | Every format, present or absent |
| `/api/v1/review/queue` | GET | Today's misses — capped at 20, newest mock first, with `remaining` |
| `/api/v1/exams/{id}/answers/{qid}/reviewed` | POST | Mark one wrong answer as looked at |
| `/api/v1/exams/{id}/unreviewed` | GET | Which wrong answers still need review |

## Adding a subject

`SEED_SUBJECTS` in `app/utils/seed_subjects.py`. Give a certification subject all three exam-profile fields or none — `has_exam_profile` requires all three, and a partial profile means readiness silently degrades to `developing` with no explanation.

Seeding is reconciled through the [seed ledger](Architecture#seeding-and-the-ledger), so a subject added by a later version reaches an existing install, and one deleted by hand stays deleted.

## See also

- [Design Review](Design-Review) — the practice format that feeds the same picture
- [Architecture](Architecture) — where these tables and routers sit
- [Troubleshooting](Troubleshooting#readiness-never-leaves-needs-evaluation)
