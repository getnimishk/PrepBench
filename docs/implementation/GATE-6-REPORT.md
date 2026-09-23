# Phase 6 Gate Report — Question Bank and Import

**Date:** 2026-09-13 · **Format:** plan §40 · **Gate decision: PASS**

This phase was mostly an audit of an import path that already existed, and the
audit found three real defects. All fixed, all proven first with a failing test.

---

## Defects found and fixed

### 1. Imported questions landed in no preparation — a regression from Phase 2

Every import route (confirm, JSON, Markdown, CSV, Excel) goes through one function
that built question rows directly instead of through the repository, so it skipped
the step that attaches a question to its preparation.

Before Phase 2 nobody noticed, because preparations found questions by fuzzy name
matching. After Phase 2 switched to a proper link, **any bank you imported would
have landed unowned** — visible under "All questions", invisible to its own
preparation's mocks and Question Bank.

Proven: `imported questions were not attributed: 0 of 3 owned by their preparation`.
Fixed by using the same attribution rule as everywhere else (and looking each
certification up once per import, not once per row). Confirmed nothing else creates
question rows around the repository.

**Your existing 709 PSM I questions were never affected** — they were attached by
the Phase 2 migration. Only imports made since then would have been.

### 2. CSV/Excel rows vanished from the report

Rows with no question text, rows with no answer choices, and rows that raised an
error were all **skipped without a trace**. A 100-row file with 20 bad rows reported
"80 valid". The row numbers it did show counted parsed questions, not file rows, so
they pointed at the wrong line once anything was skipped.

Now every row appears. A row that produced no question is listed as an error with
its real row number (header = row 1, as a spreadsheet shows).

### 3. Bad values were silently replaced

An unrecognised difficulty ("expert") became medium, and an unrecognised type
("matching") became single choice — with no warning. They still import with those
values, but the report now says what was there, what it became, and what to use.

## Also added

- **Every issue says what to do.** Each problem now has an `action` alongside its
  message — e.g. *"Use easy, medium or hard."* Defined once per field, so every
  current and future check gets one.
- **Missing explanation is flagged.** A warning, never a block — plenty of banks
  arrive without explanations — because a missed question with no explanation gives
  the review nothing to show.

## Plan §12 import requirements

| Requirement | Status |
|---|---|
| Upload → parse → validate → duplicates → preview → confirm → write → result | Already existed |
| Duplicate detection | Already existed — within the file, exact match against the bank, and near-duplicates |
| Failures identify **row** | **Fixed** — real file row numbers |
| … **field**, **error / warning**, **reason** | Already existed |
| … **action** | **Added** |
| Atomic, or partial with clear semantics | Already partial: each question in its own savepoint, failures counted and listed |

## API changes

Additive only. Validation issues gain `action`; validation items gain `source_row`.
Import endpoints unchanged. Contract regenerated.

## DB changes

None.

## Tests

| Suite | Before | After |
|---|---|---|
| Backend | 554 | **563** (+2 import attribution, +7 row reporting) |
| Frontend unit | 476 | **476** |
| E2E | 12 | **13** (+1: import through the real screen, then checked against the database and after a reload) |

Two existing tests used a "clean" question with no explanation, which now correctly
gets a warning. Both were given explanations so they still test what they meant to,
and one gained an assertion that a missing explanation is a warning, never an error.

## Known limitations

- **Question detail, editor and import are still dialogs, not their own pages**, so they can't be linked to directly. The plan asks for that; it's a layout change, not a data one.
- **No question versioning.** Recommended as a deliberate non-goal in the Phase 0 audit.
- **JSON and Markdown imports don't carry row numbers** — those formats have no rows to point at. Their malformed items are still reported by the validator.
- **The import result after confirming** still lists failures as plain text, not per-row structure. The pre-import report, which is where decisions get made, is structured.

## Gate decision

**PASS.** Imports now attach to the right preparation, the report accounts for every
row with what to do about it, and the whole flow is proven in a browser.
