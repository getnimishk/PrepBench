# Skills Plan Phase 1 Gate Report — Content-Pack Foundation

**Date:** 2026-09-27 · **Format:** skills-and-content-packs-plan.md §3 · **Branch:** `feat/skills-phase-1`

**Ruling:** the content-pack foundation ships as specified in §5 (D1–D5): two versioned packs
(`adf/v1.json`, `adls/v1.json`) converted from the prototype **by code**, a forgiving loader, a
pinned subject↔pack link with explicit upgrade, and the Skill-preparation UI to attach/upgrade/
detach one. **Gate decision: PASS.**

---

## Implemented

### Content packs

- **`backend/app/content/packs/{adf,adls}/v1.json`**: converted from the prototype's
  `services/guides/{adf,adls}.ts`, `services/adf/{units,movingData}.ts` and
  `services/roles/diagnostic.ts` by a throwaway Vitest script inside
  `prototypes/lakehouse-and-roles/` (deleted immediately after; never committed, per D13).
  - `adf`: 21 chapters, 18 scenarios (4 written), 10 diagnostic questions.
  - `adls`: 11 chapters, 0 scenarios, 2 diagnostic questions (`lake-access`, `lake-resilience`,
    moved from the ADF diagnostic set per the plan).
  - Table cells contain no `**`; every "chapter N" cross-reference and every
    `practice_links`/`diagnostic_questions.chapter` resolves within its own pack (see tests).
- **`backend/app/content/packs.py`**: Pydantic schema for the pack format, `load_packs()` (cached
  per directory), `latest()`, `get()`. A malformed pack file is logged and skipped, never fatal.
- **`SubjectContentPack`** (`models/subject_content_pack.py`, table `subject_content_packs`):
  `subject_id` FK **ON DELETE CASCADE**, `pack_id`, `pack_version` (pinned), `attached_at`; unique
  on `(subject_id, pack_id)`. New `CREATE TABLE IF NOT EXISTS` + unique-index migration step in
  `core/database.py`, wrapped like every other step so one failure can't crash startup.
- **API** (`api/v1/content_packs.py`, `services/content_pack_service.py`):
  - `GET /content-packs`, `GET /content-packs/{pack_id}?version=N`
  - `POST /subjects/{id}/content-packs` (attach at latest; refused for a certification subject or
    an unknown pack)
  - `PUT /subjects/{id}/content-packs/{pack_id}` (upgrade only to a newer, existing version)
  - `DELETE /subjects/{id}/content-packs/{pack_id}` (detach; learning evidence untouched, per D7 —
    nothing exists to detach from yet, but the contract is in place)
  - `SubjectWithReadiness` gains `content_packs: [{pack_id, pack_version, latest_version, title}]`.

### Frontend

- `types/contentPack.ts` (`ContentPackSummary`, `ContentPackDetail`, `Chapter`, `Scenario`,
  `ScenarioLevel`, `DiagnosticQuestion` — the last three land ahead of Phase 2/3's own use of
  them); `types/subject.ts` gains `SubjectContentPack` and `Subject.content_packs` (optional in
  the TS type only, so pre-existing test fixtures across the codebase don't all need a new
  required field — the server always sends it).
- `services/api.ts`: `getContentPacks`, `getContentPack`, `attachContentPack`,
  `upgradeContentPack`, `detachContentPack`.
- **`PreparationNewPage.tsx`** (Skill path): a "Start from a built-in guide (optional)" step —
  radio cards for "Start empty" and each shipped pack, preselected when the typed name matches a
  pack's title either direction, case-insensitively (`packMatchingName`, exported and unit-tested).
  The chosen pack is attached right after the subject is created (best-effort: a failed attach
  doesn't undo the preparation).
- **`PreparationEditPage.tsx`**: a new "Content packs" panel (Skill preparations only) listing
  attached packs with "Update to version N" when a newer one exists and "Detach", plus the
  catalogue's not-yet-attached packs with "Attach".

## Files changed

**Backend** — new `app/content/__init__.py`, `app/content/packs.py`,
`app/content/packs/{adf,adls}/v1.json`, `models/subject_content_pack.py`,
`schemas/content_pack.py`, `services/content_pack_service.py`, `api/v1/content_packs.py`,
`tests/test_content_packs.py` · `models/__init__.py`, `core/database.py` (migration),
`api/v1/router.py`, `api/v1/subjects.py` (adds `content_packs` to `SubjectWithReadiness`) ·
`docs/api/openapi.json` (regenerated).

**Frontend** — new `types/contentPack.ts`, `pages/PreparationNewPage.test.tsx` · `types/subject.ts`,
`services/api.ts`, `pages/PreparationNewPage.tsx`, `pages/PreparationEditPage.tsx`.

## API changes (additive)

| Endpoint | Change |
|---|---|
| `GET /content-packs`, `GET /content-packs/{pack_id}` | **new** |
| `POST/PUT/DELETE /subjects/{id}/content-packs[/{pack_id}]` | **new** |
| `GET /subjects`, `GET/POST/PUT /subjects/{id}` | `SubjectWithReadiness` adds `content_packs` |

## DB changes

New table `subject_content_packs` (`ON DELETE CASCADE` on `subject_id`, unique on
`(subject_id, pack_id)`). Additive; no existing table touched.

## Tests

| Suite | Before | After |
|---|---|---|
| Backend | 778 | **807** (+29, `tests/test_content_packs.py`: pack shape/validation for both packs, chapter/scenario/diagnostic cross-reference resolution incl. a hardcoded "chapter N → chapter id" map so a future reorder can't silently point a reference at the wrong chapter, no `**` in table cells, malformed-pack-is-skipped, cache-per-directory, and the attach/upgrade/detach API incl. certification-refused, unknown-pack-404, downgrade-refused, and cascade-delete-removes-the-link) |
| Frontend unit | 781 | **788** (+7, `pages/PreparationNewPage.test.tsx`: `packMatchingName` preselect logic both directions and case-insensitively, none for an unrelated/empty name, and an integration test that the chosen pack is attached after the subject is created) |
| E2E (touched specs) | — | **9/9** (`preparations.spec.ts` 4, `accessibility.spec.ts` 3, `navigation.spec.ts` 1, `responsive.spec.ts` 5 — all pass in light and dark, all viewports) |
| E2E (full suite) | — | **70/70** (one failure on first pass, `navigation.spec.ts`'s crawl timing out on `/interview-practice/library`'s heading — unrelated route, re-ran alone and it passed in 2.2 minutes; CLAUDE.md's documented load/timing flake for this specific test, not a regression) |

Typecheck and lint clean (0 errors; 28 pre-existing warnings, none new except one now-removed
unused import).

## Honesty review

- No score, readiness or "matched" claim added or implied — `content_packs` only names the
  pack/version pinned; readiness is untouched by this phase.
- Every pack's `source_notes` field points at the documentation notes it was written from
  (`docs/research/{adf,adls-gen2}-documentation-notes.md`), carried over unchanged from the
  prototype's own `GUIDES` catalogue.
- No sample/demo data invented: the packs are the prototype's own reviewed content, converted
  programmatically, not retyped.

## Accessibility audit (disposable second server, never the running app)

Ran axe (wcag2a/aa, wcag21a/aa, wcag22aa, best-practice) and a 390×844 `scrollWidth` check on both
changed pages, light and dark, via the built-in browser against a scratch copy of the database:

- `/preparations/new` (Skill path, pack step visible and preselected): **0 violations**, both
  themes; no horizontal scroll at 390px.
- `/preparations/:id/edit` (Content packs panel, one pack attached): **2 pre-existing violations**
  (`heading-order`: h1→h3 with no h2 anywhere on the page; `color-contrast`: the disabled "Type"
  field's helper text fails 4.5:1 in dark mode) — confirmed unrelated to this phase by removing the
  new panel from the DOM and re-running axe: both violations still fire. Root cause:
  `/preparations/:id/edit` was never added to `accessibility.spec.ts` or `responsive.spec.ts`'s
  `ROUTES` (only `navigation.spec.ts` has it), so the "full accessibility pass, clean" status never
  actually covered this route. Flagged as a follow-up task (not fixed here, to keep this phase to
  the content-pack foundation); no horizontal scroll at 390px either way.

## Known limitations

- **Diagnostic questions and scenario content are stored but not yet surfaced anywhere.** Phase 2
  (guides) and Phase 3 (scenarios, diagnostic) read this same pack data; Phase 1 only proves it
  loads, validates and can be pinned.
- **The pack-choice step has no e2e coverage.** Phase 1 adds no new route, so it isn't required by
  the plan's exit criteria, and no existing e2e spec exercises creating a *Skill* preparation
  through the form (only certifications). Covered by frontend unit tests instead.

## Fixture audit

No placeholder or invented content. The two packs are the prototype's own reviewed text, converted
by code; nothing was retyped or summarised by hand.

## Session handoff

```
### Handoff — 2026-09-27
Phase: 1 · Branch: feat/skills-phase-1 · PR: (opening after this report)
Done: content-pack foundation (loader, model, API, both packs converted and validated),
  PreparationNewPage's pack-choice step, PreparationEditPage's Content packs panel.
  Backend 807/807, frontend unit 788/788, full e2e suite 70/70 (one flaky first-pass failure on
  an unrelated route, confirmed a known load/timing issue by re-running alone -- see Tests above).
Not done: nothing outstanding for this phase's exit criteria.
Next step: gate PASSES. Wait for the author to merge this PR before starting Phase 2 (guides in
  the Study Library) -- its entry criterion is this phase's gate, not just this report existing.
Surprises / decisions made:
  - The ADLS pack's only prototype practice_links entry pointed at the (not-yet-built) Lakehouse
    Lab sandbox, not one of its own scenarios -- dropped during conversion since the pack schema's
    practice_links only names scenario ids within the same pack. Nothing lost: ADLS ships zero
    scenarios in v1 anyway.
  - Found and flagged (not fixed) a pre-existing accessibility gap on PreparationEditPage.tsx --
    see the audit section above and the spawned follow-up task.
  - `Subject.content_packs` is optional in the frontend TS type (server always sends it) so the
    many existing test fixtures across the codebase that build a `Subject` literal don't all need
    updating for a field this phase adds.
```
