# Troubleshooting

## The frontend refuses to start: port 5173 in use

```
Port 5173 is already in use
```

This is deliberate. `vite.config.ts` sets `strictPort: true`, so Vite **fails loudly instead of drifting to 5174** — because `start_app.bat` opens `5173` regardless, and a silent drift lands the browser on a dead URL with the app looking broken and nothing printed anywhere.

Find what holds it:

```bash
netstat -ano | findstr ":5173"     # Windows — last column is the PID
lsof -i :5173                       # macOS / Linux
```

Usually it is a dev server you already have running. Use that one.

## The UI loads but every request fails

The frontend proxies `/api` to `127.0.0.1:8000`. If the backend is not up, every call fails while the page itself renders fine.

Check the backend directly:

```bash
curl http://127.0.0.1:8000/docs
```

If that fails, start it and read its output — a failure during `apply_lightweight_migrations()` or seeding will surface there, not in the browser.

## `pip install` fails with certificate errors

Symptoms are SSL/TLS verification failures against PyPI that look like a network outage but persist on a working connection.

The usual cause is **antivirus HTTPS interception** — Norton, Kaspersky, ESET and others terminate TLS and re-sign with their own root, which Python's bundled certificate store does not trust. It breaks `pip`, `uv`, and `requests` alike.

Options, in order of preference:

1. Use a tool that can read the OS trust store — `uv` supports `--system-certs`.
2. Point Python at the interception root explicitly via `REQUESTS_CA_BUNDLE` / `SSL_CERT_FILE`.
3. Exempt PyPI in the antivirus settings.

Disabling verification is not on this list.

## The wrong Python runs

`python` on `PATH` is frequently not the interpreter you think, particularly on Windows where the Store shim, an old system install, and a `py` launcher entry can all disagree. A stale `py -3.13` registry entry pointing at a removed install is a common one.

Pin it explicitly rather than trusting `python`:

```bash
python -V              # confirm before creating the venv
py -0                  # Windows: list what the launcher actually knows about
```

PrepBench targets **3.14**. A `pydantic-core` build from source is the usual sign you are on an interpreter with no matching wheel.

## TypeScript cannot find types that are definitely installed

If `tsc` reports missing declarations for a package whose JavaScript clearly works, the install may have **extracted partially** — `.js` present, `.d.ts` absent. Interrupted installs and antivirus quarantine both cause it.

Reinstall **the locked version**:

```bash
npm ci
```

Do not "fix" it by bumping the package. A version bump that appears to resolve a missing-types error has usually just replaced a broken extraction with a working one, and you have taken an unrelated upgrade along with it.

## AI features say "unavailable"

Working as designed when no provider is configured, and the app will not invent a score to fill the gap.

1. **Settings → AI Providers** — is a provider configured at all?
2. Is it **bound to the task**? Routing is per task; grading and recording analysis bind separately.
3. Hit `POST /api/v1/llm/providers/{id}/verify` and read the failure.

See [AI Providers](AI-Providers).

## Readiness never leaves "needs evaluation"

Almost always because the sessions being counted are **drills**, and readiness counts full mocks only.

> [!NOTE]
> **Drills never move readiness, and that is not a bug.** Exam setup does start mocks — it sends `session_kind: mock` and `subject_id`. But it refuses to when the subject has no exam profile or the bank cannot fill the paper, and it says which of the two is missing. If readiness is stuck at `needs_evaluation`, check that the sessions in Review are labelled *mock* rather than *drill*; a drill is not a weaker measurement of readiness, it is not a measurement of it.

To confirm what is actually stored:

```sql
SELECT session_kind, status, COUNT(*) FROM exam_sessions GROUP BY 1, 2;
```

If they are all `drill`, that is the reason. The other causes, in the order worth checking:

| Cause | Check |
|---|---|
| The session is not finished | Only `COMPLETED` sessions with a non-null score count |
| It resolved to no subject | A session matches by `subject_id`, falling back to the certification string. A skill subject has no certification, so a session with no `subject_id` can never belong to one |
| It is a skill subject | No pass mark means `developing` is the ceiling, by design — see [Readiness](Readiness#subjects) |
| Fewer than three mocks | `ready` needs three, and the last three consecutive at or above the pass mark |
| The last mock is older than 14 days | Stale evidence is not evidence; the state drops back |

A domain showing no percentage rather than a low one is also working as intended: below ten answered questions there is no reportable score, and `0%` would read as a failure that has not happened.

## A built-in came back after I deleted it

It should not, and if it did, the [seed ledger](Architecture#seeding-and-the-ledger) is the place to look:

```sql
SELECT namespace, content_key FROM seeded_content ORDER BY 1, 2;
```

Every built-in this install has ever been *offered* is listed there, whether or not it is still present. A missing row is why an item was recreated.

The usual cause is that the item's **key changed**. Keys are the readable identity — a prompt or review title, a subject name, `round:question_text` for an interview question — so editing one in the seed file makes the next boot see a new item and create it alongside the old one.

## A new built-in did not arrive after upgrading

Check the ledger the same way. One case creates rows without creating content, deliberately: a database created **before** the ledger existed holds content but no record of it, and nothing can distinguish *"the user deleted this"* from *"this was never shipped"*. On that one boot everything currently in the built-in list is marked as offered and nothing is created. From the next boot on, only genuinely new items arrive.

If you want the full built-in set back, `Settings → Reset` empties every table — the ledger included — and reseeds from scratch. It also deletes your study data.

## Provider verification fails

| Cause | Check |
|---|---|
| Secret does not resolve | The stored reference is a pointer. If it is `env:NAME`, that variable must exist in the running backend's environment — restart after editing `.env` |
| Keyring not installed | A `keyring:` reference with the package absent logs a warning and resolves to nothing. Install `keyring` or re-store the secret |
| Local model not running | PrepBench never launches one for you. Start it yourself, then verify |
| Wrong base URL | For OpenAI-compatible providers the path suffix matters — most want the root, not `/v1/chat/completions` |

## A schema change did not take effect

There is no Alembic. Startup adds **missing columns and indexes only**. Renaming a column, changing its type, or dropping one will not happen, and will not error either — the old column simply stays and the new one appears empty.

See [Architecture](Architecture#schema-changes-without-alembic).

## Frontend tests fail intermittently on timeout

Check whether you are hitting the 20-second `testTimeout` in `vite.config.ts` rather than a real hang. The heaviest tests drive a full MUI dialog through render → type → save → refetch, around 7 seconds even in isolation, and a loaded machine can push that over.

Do not add retries. A retried test that passes has told you nothing.

## Charts render at zero width

If a chart canvas measures `width: 0` while its container has a real width, Chart.js never received a size — it reads the container through a `ResizeObserver`, which only fires when the page is compositing frames.

This happens in headless or hidden-pane contexts, not in a normal browser. Confirm with:

```js
requestAnimationFrame(() => console.log('compositing'))
```

If that never fires, the page is not painting and the canvas size is a symptom, not the bug.

## Resetting

The database is one file:

```
backend/data/exam_simulator.db
```

Delete it and restart for a clean slate. Built-in system design prompts, interview questions, design reviews and subjects reseed; imported content does not. **There is no other copy.** Nothing was uploaded anywhere; that is the whole point of the project, and it applies to your mistakes as well as your privacy.

`Settings → Reset` is the same outcome without deleting the file: every table emptied, including the seed ledger, then the identical seeding that startup runs.

## See also

- [Development Guide](Development-Guide) · [Readiness](Readiness) · [AI Providers](AI-Providers) · [Architecture](Architecture)
