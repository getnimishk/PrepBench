# AI Providers

PrepBench runs fine with no AI at all. Exams, the question bank, roadmaps, analytics, the Chart Sandbox, spaced repetition and export never touch a model.

AI backs seven named tasks, and you decide who runs each one. Configure it at **Settings → AI Providers**.

## The seven tasks

`LLMTask` in `app/llm/types.py` names every AI-backed operation in the app, once:

| Task | Used by |
|---|---|
| `system_design_grading` | Grading written system design answers |
| `design_review_grading` | Judging whether a design review justification named the deciding axis |
| `recording_analysis` | Scoring interview recordings on content and delivery |
| `interview_question_gen` | Generating interview questions |
| `system_design_prompt_gen` | Generating system design prompts |
| `content_validation` | The pre-import audit on question batches |
| `embedding` | Vector operations |

**Routing is per task.** `llm_task_binding` maps each task to a provider independently, so you can grade system design on a local model and send only audio to a cloud one. Nothing forces a single choice across the app.

`design_review_grading` is a good candidate for a local model: it answers one narrow, closed question — *did this reasoning name the axis?* — rather than judging a whole design, which is exactly the kind of task a small model does reliably. See [Design Review](Design-Review#grading).

## Running a model yourself

Click *Set up a local model*. The wizard:

1. Reads your system memory (`system_info.py`)
2. Detects installed runners (`local/detect`)
3. Recommends a model your hardware can run **well** — not the largest one that technically fits
4. Shows the exact command to start it
5. Optionally saves you a launcher script

> [!IMPORTANT]
> PrepBench never downloads a model and never launches a server for you. It tells you the command; you run it, deliberately. This is enforced in `local_setup.py`, not just documented — an app that silently pulls multi-gigabyte binaries is not one you can describe as offline.

With a local model, AI grading works with the Wi-Fi off like everything else.

## Cloud providers

Three adapters ship in `app/llm/adapters/`:

| Adapter | Covers |
|---|---|
| `gemini.py` | Google Gemini |
| `anthropic.py` | Anthropic |
| `openai_compatible.py` | OpenAI, plus anything speaking its API — Groq, Together, DeepSeek, vLLM, LM Studio, Ollama's compatible endpoint |

`openai_compatible` is why most vendors need no code. Provider **profiles** are data, loaded from two files and merged:

```
app/data/llm_profiles.json        built-in profiles, shipped
data/llm_profiles.custom.json     yours, overrides and extends
```

Adding a vendor PrepBench does not ship a profile for is a JSON edit, not a code change. Your custom file wins on key collision, so you can override a built-in without forking it.

## How keys are stored

**The database holds a reference, never the secret.** `llm_provider_config` stores a pointer string that `resolve_secret()` dereferences at call time. Three schemes:

| Scheme | Where the value lives |
|---|---|
| `env:NAME` | The environment or `backend/.env`. Used by the one-time import of a pre-existing `GEMINI_API_KEY`, which is left where it already is rather than copied |
| `keyring:NAME` | The OS credential store — Windows Credential Manager, macOS Keychain, Secret Service. Used when the `keyring` package is installed |
| `file:NAME` | A local obfuscated store, used when no keyring is available |

> [!WARNING]
> **The `file:` fallback is obfuscation, not encryption.** The key sits beside the data on a single-user offline desktop, so anyone who can read one can read the other.
>
> What it genuinely prevents is *casual leakage* — a key surfacing in a screenshot, a support log, a backup, or a shared `.env`. That is the threat that actually occurs on this machine. It is never described in the UI as anything stronger, and it should not be described that way anywhere else either.
>
> If you want a real credential store, install `keyring` and PrepBench will use it.

### Two rules that must not regress

**No endpoint may return an API key.** Provider responses expose `has_api_key` and the last four characters — never the value. If you add an endpoint that touches provider config, this is the thing to check.

**The credential store is never tracked in git.** `backend/data/.llm_secrets.json` and `.llm_secret_key` must stay ignored.

## Endpoints

All under `/api/v1/llm`:

| Endpoint | Method | Purpose |
|---|---|---|
| `/profiles` | GET | Available provider profiles, built-in and custom |
| `/providers` | GET / POST | List or create a configured provider |
| `/providers/{id}` | GET / PATCH / DELETE | Read, update, remove |
| `/providers/{id}/verify` | POST | Test the connection |
| `/providers/{id}/models` | GET | List models the provider offers |
| `/tasks` | GET | Current task → provider bindings |
| `/tasks/{task}` | PUT | Rebind one task |
| `/system-info` | GET | Memory and hardware summary for the wizard |
| `/local/detect` | GET | Runners already installed |
| `/local/runners` | GET | Supported runners |
| `/local/runners/{key}` | GET | One runner's details |
| `/local/models` | GET | Models recommended for this machine |
| `/local/launcher` | POST | Generate a start script |

## When nothing is configured

Every AI-backed feature reports itself **unavailable**. None falls back to a heuristic, and none returns a zero.

| Feature | Without a provider |
|---|---|
| System design grading | *"Not Graded"* — the answer still saves |
| Design review grading | `grading_status: not_graded`, **no verdict** — the attempt still saves and the reveal still shows |
| Interview recording analysis | Unavailable — the recording is still kept |
| Question generation and the import audit | Unavailable; import itself is unaffected |

This is the first of the project's four rules (see [Home](Home)): an invented grade is worse than a missing one, because the learner cannot tell the difference. A `0%` on a system design answer reads as *"you scored nothing"*, not *"nothing scored you"* — and on a design review, a fabricated `missed` verdict would blame the learner for a missing API key.

## See also

- [Architecture](Architecture) — where the LLM module sits
- [Design Review](Design-Review) — what `design_review_grading` is asked to judge
- [Troubleshooting](Troubleshooting) — provider verification failures
