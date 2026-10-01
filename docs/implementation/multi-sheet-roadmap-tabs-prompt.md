# Prompt: build multi-sheet roadmap tabs

Paste everything below the line into a new Claude Code session opened at `E:\workspace\PrepBench`.

---

Build the "one tab per roadmap sheet" feature in PrepBench. The design below is approved and its decisions are settled, so implement it as written; don't redesign it. Read `CLAUDE.md` first and follow its hard rules. The ones that matter most here: never touch `backend/data/*`, use `backend/.venv/Scripts/python.exe`, don't edit the frontend while Playwright is running, run Playwright from PowerShell, and don't commit until I ask.

Work in three steps. After each step, stop and report what changed and which tests passed:
1. Backend and pytest.
2. Frontend and Vitest.
3. Verification.

## Goal

If an imported roadmap workbook has several sheets, the roadmap page (`frontend/src/pages/RoadmapDetailPage.tsx`) shows each sheet as its own tab, named after the sheet, in workbook order. A single-sheet roadmap keeps today's view (Syllabus / Phase overview / Schedule). Nothing may depend on specific sheet names. Reference workbook for manual testing: `C:\Users\Nimish Kanungo\Downloads\Agentic_AI_Mastery_Roadmap .xlsx`. Its six sheets are "Agentic AI Master Syllabus" (syllabus), "Journey Progress Tracker" (tracker), "Framework Comparison", "Portfolio Projects", "Suggested Courses" and "Mental Model" (the last four are resources).

## How the code works today (already checked)

- `backend/app/services/roadmap_import_service.py` → `_preview_from_excel` classifies each sheet by its header row as `syllabus`, `tracker`, `resource` or ignored.
  - A syllabus or tracker sheet that yields no rows falls back to a resource through `_fallback_resource`.
  - Resources become `RoadmapImportResource(title=worksheet.title, …)`.
  - If there is no syllabus, the tracker records become the topics.
- `commit()` writes `RoadmapResource` rows with `order_index` set to their position among the resources only.
- **What's missing:** the syllabus and tracker sheet names aren't stored, and neither is where the resource sheets sit relative to the syllabus and tracker. So the sheet information has to be saved at import.
- Resources can't be edited or deleted after import (there's no endpoint), and the import modal (`frontend/src/components/roadmap/RoadmapImportModal.tsx`) sends `preview.resources` back unchanged.
- Today the page puts every resource under one "Reference tables (N)" tab, and the header has a "Reference tables (N)" button and a "Phase overview" button.

## Design

### Data model
Add a nullable JSON column `roadmaps.sheet_layout` to the `Roadmap` model in `backend/app/models/roadmap.py`. Add an idempotent migration step in `backend/app/core/database.py`: check `PRAGMA table_info(roadmaps)`, run `ALTER TABLE roadmaps ADD COLUMN sheet_layout JSON` if the column is missing, wrap it in try/except, and on failure call `_log_migration_failure`, following the `roadmaps.subject_id` step. Don't backfill.

The stored value lists the sheets in workbook order:
```json
[{"name": "Agentic AI Master Syllabus", "kind": "syllabus"},
 {"name": "Journey Progress Tracker",   "kind": "tracker"},
 {"name": "Framework Comparison",       "kind": "resource", "resource_id": 41}]
```
- `kind` is the classification actually used. A syllabus or tracker sheet that fell back to a resource is stored as `resource`.
- Ignored sheets are left out.
- In the tracker-only case, where tracker records become the topics, store that sheet as `syllabus`.

### Schemas (`backend/app/schemas/roadmap.py`)
- `RoadmapImportSheet`: `name: str`, `kind: Literal["syllabus","tracker","resource"]`.
- `RoadmapImportPreview.sheets: List[RoadmapImportSheet] = []` and `RoadmapImportConfirm.sheets: List[RoadmapImportSheet] = []`.
- `RoadmapSheet` (response): `name`, `kind`, `resource_id: Optional[int] = None`.
- `RoadmapDetailResponse.sheets: List[RoadmapSheet] = []`. The server always fills this in.

### Import
- `_preview_from_excel` adds a sheet entry as it processes each worksheet, in workbook order, using the rules above.
- JSON, CSV and Markdown previews leave `sheets` empty.
- `commit()`:
  - after writing the resources, set the resource entries' `resource_id` by matching the sheet name to the resource title (Excel requires sheet names to be unique)
  - drop entries that don't match
  - store the result in `roadmap.sheet_layout` only if `req.sheets` is not empty, otherwise leave it NULL.

### Detail response (`RoadmapService`, where `resources` is built, around line 260)
- **Stored layout present:** return it, dropping resource entries whose `resource_id` is no longer among the roadmap's resources.
- **No stored layout** (imports from before this change, JSON/CSV/Markdown imports, roadmaps built in the app):
  - derive the list as `[{"name": "Syllabus", "kind": "syllabus"}]`, then one `resource` entry per resource in `(order_index, id)` order, with `name` set to the resource title
  - if there are no topics and no resources, return `[]`.

### Frontend
- Add `RoadmapSheet` and `sheets: RoadmapSheet[]` to `RoadmapDetail` in `frontend/src/types/roadmap.ts`. Add `sheets` to the import preview and confirm types, and make the import modal pass `preview.sheets` through to confirm.
- In `RoadmapDetailPage.tsx`, if `roadmap.sheets.length <= 1`, render exactly today's tabs and behaviour, with no visible change.
- Otherwise (multi-sheet mode), build the tabs in this order:
  1. **One tab per sheet, labelled with `sheet.name`:**
     - `syllabus` → `RoadmapTableView`, with the existing phase and status filters
     - `tracker` → `RoadmapJourneyView`
     - `resource` → that one resource's table, using the existing resource-table markup (Panel, Eyebrow "Sheet", an `h2` title, the table) for one resource.
  2. **App tabs:** "Phase overview" (the journey view) only if no tracker tab exists, then "Schedule" (`RoadmapGanttView`).
- **Tab values:** use stable string keys (`sheet:<index>`, `view:journey`, `view:schedule`). Default to the first tab.
- **Header buttons:**
  - "Phase overview" switches to whichever tab shows the journey view.
  - The "Reference tables (N)" button is removed in multi-sheet mode.
- Picking a phase in the journey view still sets the phase filter and switches to the syllabus tab.
- **Several syllabus sheets** (their topics are already merged): show only one syllabus tab, named after the first syllabus sheet, with a short `Detail` line inside it: "Also includes topics from: X, Y". Do the same for several tracker sheets. Don't add per-topic sheet tracking.
- Keep `variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile` on `Tabs`.
- Use design-system primitives and tokens only: no hex colours, and font sizes only through `(t) => t.typography.pxToRem(px)`.

### Out of scope
Deep-link URLs, editing sheets, Excel export of the original sheet order, a `roadmap_sheets` table, and per-topic source sheet.

## Tests

**Backend** (pytest, in the existing roadmap import and service test files or a new `tests/test_roadmap_sheet_layout.py`; follow `conftest.py`, never open your own `SessionLocal()` outside the fixtures):
- An openpyxl-built workbook with sheets in the order syllabus, tracker, resource, resource, plus one empty sheet that gets ignored. The preview's `sheets` keeps that order with the right kinds, and the ignored sheet isn't in it.
- Commit stores the layout with resource ids resolved, and the detail response returns it.
- A syllabus sheet that falls back to a resource is stored as kind `resource`.
- Tracker-only workbook: the tracker sheet is stored as `syllabus`.
- Legacy roadmap (NULL layout) with resources: the derived list is right. With no topics and no resources it's `[]`.
- A stored entry whose resource id is missing is filtered out.
- The migration runs twice without error.
- Regenerate `docs/api/openapi.json` as CLAUDE.md describes (environment redirected), then run `tests/test_openapi_contract.py`.

**Frontend** (Vitest, mocking the API like the existing page tests):
- With 1 sheet, today's tabs and labels appear.
- With multiple sheets, the tab labels and order match the sheets, followed by the Schedule tab.
- A tracker present means there's no separate "Phase overview" tab, and the header button selects the tracker tab.
- A resource tab shows only its own table.
- Choosing a phase in the journey view switches to the syllabus tab with that phase filtered.
- The import modal sends `sheets` on confirm.

## Verification (step 3)
1. Run the full suites from `CLAUDE.md`: `pytest -q`, `npm run typecheck`, `npm run lint`, `npm test`.
2. Do the disposable audit setup from `CLAUDE.md`: a copy of the real database in a scratch folder, a backend on port 8210, Vite on port 5383, and a standalone Playwright script run from PowerShell.
   - Import the reference workbook into the copy through the UI or the API.
   - On its roadmap page and on an older roadmap's page, run axe with the CLAUDE.md tags in light and in dark mode, check that `scrollWidth - clientWidth` is 0 at 390×844, and take a screenshot.
   - Stop both servers afterwards.
3. Run the `pre-completion-checklist` skill. In particular, search for `toHaveLength`/`toHaveCount` assertions on roadmap tabs.
4. Report the results honestly, including anything skipped or failing.
