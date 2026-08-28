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

Delete it and restart for a clean slate — built-in prompts and interview questions reseed, imported content does not. **There is no other copy.** Nothing was uploaded anywhere; that is the whole point of the project, and it applies to your mistakes as well as your privacy.

## See also

- [Development Guide](Development-Guide) · [AI Providers](AI-Providers) · [Architecture](Architecture)
