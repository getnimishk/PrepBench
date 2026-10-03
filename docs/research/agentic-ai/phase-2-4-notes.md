# Wave 2 source notes (Modules 2 to 4, topics 9 to 25)

Sources were read on 2026-10-02 through the fetch tool, which summarises each page through a small model; exact wording and figures should be checked against the page before they go into anything you would quote in an interview. Anthropic pages were read at `platform.claude.com/docs` (the old `docs.anthropic.com` addresses redirect there).

## Sources by module

**Module 2.** Python 3 tutorial: Classes (docs for 3.14.8), Errors and Exceptions, Data Structures, More Control Flow Tools, Virtual Environments and Packages; Python library: dataclasses, asyncio Coroutines and Tasks; Python Packaging User Guide: Writing your pyproject.toml; uv docs: project layout (lockfile); Pydantic v2 Models; pytest Get Started; mypy Getting started; HTTPX Timeouts and Async; Anthropic: Get started, Messages API, API errors, Rate limits, Python SDK.

**Module 3.** Anthropic: Prompt engineering overview, Prompting best practices, Structured outputs, Thinking, Effort, Define success criteria and build evaluations, API errors; Anthropic Engineering: Effective context engineering for AI agents (2025-09-29); arXiv 2411.00640 (abstract only); Wikipedia: Binomial proportion confidence interval; Claude Academy notes (AI Fluency lessons 8 to 11, Capabilities lessons 3 to 12, SDLC continuous evals).

**Module 4.** Anthropic Engineering: Building effective agents (2024-12-19); Anthropic: Tool use overview, How tool use works, Define tools, Handle tool calls; Microsoft Learn: Agent Framework overview (page dated 2026-07-29); OWASP Gen AI: LLM06:2025 Excessive Agency; Stripe API: Idempotent requests; Claude Academy SDLC Playbook notes.

## Verified by running (not by reading)

- Every Python snippet in lessons 9, 10, 11, 14 (the retry demo), 15 (arithmetic), 18 (statistics) and 21 to 25 was run; the lessons show the real output. Code is in `reference-code/`.
- The 11 assistant tests pass. The three demos print what the lessons quote.
- All five Mermaid diagrams (lessons 11, 12, 20, 21, 22) parse in the real Mermaid library, and each has a title and description.
- Statistics: Wilson intervals 48 to 85 percent (14 of 20) and 64 to 95 percent (17 of 20); Fisher p = 0.45 and 0.09; exact McNemar p = 0.375 (1 worse, 4 better) and 0.031 (0 worse, 6 better); about 120 cases per version to separate 70 from 85 percent.

## Not run, and why

- **No call to a real model API** (needs a key and spends money). The SDK, structured-output, thinking and tool-use examples come from the vendor documentation and are labelled as not run by us.
- **mypy** was not installed in the check environment; its example error text comes from the mypy page.
- The full text of arXiv 2411.00640 was not read, only its abstract.

## Vendor-specific facts that will go stale (all as documented on 2026-10-02)

SDK defaults (2 retries, 10-minute timeout); the Anthropic SDK now uses `httpx2`, a fork of httpx; effort levels and per-model defaults (Opus 5.5 defaults to medium, most others high); thinking cannot be disabled and `budget_tokens` is rejected on several current models; prefill is rejected from Claude 4.6; forced tool use (`any`, `tool`) returns 400 on Opus 5.5, Sonnet 5.5, Fable 5.1 and Mythos 5.1; structured-output schema limits; tool-use system-prompt overhead (286 tokens on two models); rate-limit tiers and spend caps. The lessons mark these as vendor-specific and use placeholder model ids.

## Claims to treat with care

- Anthropic's "up to 30 percent" gain from putting the question last in a long prompt is the vendor's own test, not reproduced.
- The context-engineering article's explanation of context rot is its own account.
- The SDLC and AI Fluency material is course prescription, not measurement.
- Definitions of "agent" differ by author; the lessons use Anthropic's and note Microsoft's.

## Known gaps

The lessons have not been rendered in the app (the checkout was on another session's branch), nor reviewed by an outside model or the owner. Module 5 onward still needs its sources (see the blueprint's source map).
