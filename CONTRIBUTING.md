# Contributing to PrepBench

Thanks for the interest. Before anything else, please read the licensing terms below — they are unusual for a public repository and they affect what happens to anything you send.

## Licensing of contributions

PrepBench is not a community-governed open source project. It is a personal project published under the [PolyForm Noncommercial License 1.0.0](LICENSE), with **commercial rights reserved entirely by the copyright holder**.

**By submitting a pull request, patch, or any other contribution, you agree that:**

1. You grant Nimish Kanungo a **perpetual, worldwide, irrevocable, royalty-free, non-exclusive licence** to use, reproduce, modify, distribute, publicly perform and display your contribution, and to **sublicense it on any terms, including commercial terms**.

2. You **retain copyright** in your own contribution. This is a licence grant, not an assignment — you keep your work and can use it elsewhere however you like.

3. Your contribution is **your own original work**, and you have the right to grant this licence. If it belongs to your employer, or contains anyone else's code, you have their permission.

4. Your contribution is offered **as is**, with no warranty.

### Why this is here

Without it, every merged pull request would leave a piece of the project owned by someone else on terms nobody wrote down. That has two consequences worth being direct about: the project could not be relicensed later, and a commercial licence could not honestly be offered for code the copyright holder does not have the right to sublicense.

This clause is what keeps commercial rights whole. It is not a claim on your work — point 2 is deliberate.

If you are not comfortable with this, **please do not send a pull request.** Open an issue describing the change instead, and it can be implemented independently. That is a perfectly good outcome and no offence is taken.

## Before you open a pull request

Open an issue first for anything beyond an obvious fix. This is a single-maintainer project, and a PR that arrives without a conversation may be declined for reasons that have nothing to do with its quality.

Things most likely to be declined:

- **Anything that sends data off the machine.** PrepBench is offline by design. There is no telemetry, no analytics, no account system, and no issue-tracker integration — now or later.
- **Anything that fabricates a number.** If a score cannot be computed, the UI must say so. Never `0%` standing in for "not graded".
- **Anything that lets a drill count toward readiness.** Readiness answers "would I pass", and only full mocks are evidence for that. The exclusion lives in the repository query so it cannot be widened by forgetting a filter — see [Readiness](https://github.com/getnimishk/PrepBench/wiki/Readiness).
- **Anything that tells the user what to do next.** A ranked list of suggested actions was put to the user and rejected as nagging. The app reports state; the person decides. The one exception is a count of unreviewed wrong answers, and it stays a count rather than becoming an instruction.
- **Anything that presents a modelling choice as a fact.** In the Chart Sandbox every relationship is typed `arithmetic | assumption | convention` and rendered as what it is.
- **Anything that makes PrepBench download or launch a model.** It tells you the command; you run it.
- **Anything that seeds built-in content without going through the ledger.** `app/utils/seed_ledger.py` is what makes deleting a built-in stick and lets new ones reach an existing install.

## Working on it

Setup, tests, conventions, and how to add an endpoint, chart, concept, design review, subject or provider are in the [Development Guide](https://github.com/getnimishk/PrepBench/wiki/Development-Guide). Documentation sources live in `docs/wiki/` and are mirrored to the wiki by `scripts/sync-wiki.sh`, so a docs change is a pull request like any other.

The short version:

```bash
cd backend && python -m pytest -q
cd frontend && npm test && npm run typecheck && npm run lint
```

CI runs all of it on every push and pull request. A red build will not be merged.

Match the surrounding code — its naming, its comment density, its idiom. Comments in this codebase explain *why*, not *what*; a comment restating the line above it will be asked about.

## Reporting a bug

Open an [issue](https://github.com/getnimishk/PrepBench/issues) with what you did, what happened, and what you expected. If it involves your study data, say so and leave the data out — nobody needs a copy of your database, and it is not going anywhere near this repository.

## Commercial licensing

If you want to use PrepBench commercially, that is a separate conversation and a separate licence. Open an [issue](https://github.com/getnimishk/PrepBench/issues) to start it.
