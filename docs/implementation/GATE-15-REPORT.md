# Phase 15 Gate Report — Accessibility and Responsive QA

**Date:** 2026-09-14 · **Format:** plan §40 · **Gate decision: PASS**

---

## Audit first

An automated audit (axe-core, WCAG 2.2 A/AA plus best-practice rules) was run over 32 screens in both themes before anything was changed, with a preparation that had sat a mock so pages had content. It found:

| Rule | Impact | Where |
|---|---|---|
| Content outside landmarks | moderate | every screen: the sidebar wasn't a navigation landmark |
| No level-one heading | moderate | 11 screens: page titles rendered as `h4` |
| Heading levels skipped | moderate | 8 screens: `h1` straight to `h5`/`h6` |
| Colour contrast | serious | Mock Exam status pills, about 2.4:1 in both themes |
| Chart images with no text alternative | serious | Chart Sandbox: 8 canvases |
| Progress bar with no name | serious | Insights bars; the exam's progress bar |
| Invalid list | serious | area page: dividers inside a `<ul>` |
| Empty table header | minor | Mock Exam history |

Manual checks for what axe doesn't cover then found more:

- **No skip link.** A keyboard user had to Tab through the header and 13 navigation links on every page.
- **The focus ring faded in.** The sidebar animated `all` properties, so the focus outline grew from nothing over 0.2 s.
- **Mock Exam scrolled sideways** by ~1000 px at every width. A "visually hidden" label had `width: 1`, which MUI reads as 100%.
- **Tables pushed phone pages sideways.** The main area was a flex item with no `min-width: 0`, so a table couldn't scroll inside its own container.
- **Light flash on every load for dark-mode users.** The theme loaded asynchronously, so pages painted light first (also an issue for light-sensitive users).
- **Design Review radios were 20×20 px**, under WCAG 2.2's 24 px minimum.
- **The exam runner had no `h1`,** and the header brand was an `h6` heading on every page.
- **Text faded to its colour on every load.** A global CSS rule animated colour changes on every element, and the delay adds up through nested elements. For over a second after the theme applied, deeply nested text sat at an unintended contrast (the full browser run caught this on the Chart Sandbox in dark mode). A second global rule forced dark form controls and scrollbars even in the light theme.

## Implemented

- **Landmarks and headings.** The sidebar is `<nav aria-label="Main">`. Focus pages have a `<main>`. Every screen has one `h1`, and section and card titles use levels in order. The brand in the header is no longer a heading.
- **Skip to main content.** It's the first Tab stop, visible when focused, and moves focus into the page.
- **Visible focus straight away.** The sidebar animates only colours; the 2 px focus outline appears at once.
- **Contrast.** Status pills use the theme's main colour on a faint tint of itself (≥ 4.5:1 in both themes), and the words carry the state.
- **Text alternatives.** Charts describe their title, axes and latest values. The score trend describes sessions, latest and rolling average. Progress bars are named. The empty table header is named "Actions" for screen readers.
- **Responsive.** The main area can shrink, so wide tables scroll inside their own containers. The hidden label is placed correctly. Radios are 24×24 px.
- **Theme without a flash.** The last display preferences are cached in the browser (listed on the Data screen). The server's value still wins when it arrives.
- **No global transitions.** The rule animating every element's colour is removed; components that animate hover states declare their own. The browser's colour scheme (form controls, scrollbars) now follows the theme.
- **Reduced motion** (from Phase 14) is now tested: animations stop under the OS setting and under the "Always" preference.

Already in place and now under test: MUI dialogs trap focus, close on Escape and return focus. The exam and review screens have keyboard shortcuts. Every icon button has an accessible name. The exam palette shows answered, flagged and current with fill, a dot and a border, not colour alone.

## Files changed

`index.css` (global transition and fixed colour scheme removed), `App.tsx` (skip link, main landmarks, `minWidth: 0`), `components/common/Sidebar.tsx`, `components/common/Navbar.tsx`, `context/ThemeContext.tsx` (preference cache), `components/exam/MockExamSetup.tsx`, `components/exam/QuestionView.tsx`, `components/exam/QuestionPalette.tsx`, `pages/ExamRunnerPage.tsx`, `components/sandbox/ChartPrimitives.tsx`, `services/metrics/chartDescription.ts` (new), `components/analytics/ScoreTrendChart.tsx`, `components/sandbox/KeyOutcomes.tsx`, `components/learning/ConceptMap.tsx`, headings on 12 pages, `pages/InsightsDomainPage.tsx`, `pages/DesignReviewPage.tsx`, `pages/settings/DataSettingsPage.tsx`; `package.json` (dev dependency `@axe-core/playwright`)

## API / DB changes

None.

## Tests

| Suite | Before | After |
|---|---|---|
| Backend | 672 | **672** (no backend change) |
| Frontend unit | 633 | **633** (one test now finds a chart title by its heading role instead of by an `h6` tag) |
| E2E | 35 | **47** (+12) |

The 12 new browser tests:

- **axe audit (2 tests):** 34 screens, including the exam runner and the System Design answer page, in the light and dark themes, with no violations.
- **Responsive (5 tests):** 16 screens at 1280, 1024, 768, 430 and 390 px. None scroll sideways; the heading and navigation are visible; on phones every tap target is at least 24×24 px.
- **Keyboard (4 tests):** the skip link; a visible 2 px focus ring; a dialog that holds focus, closes on Escape and returns focus; and a timed paper answered, flagged and navigated from the keyboard alone.
- **Reduced motion (1 test):** both the OS setting and the preference stop animation.

Typecheck clean. Lint 0 errors (16 existing warnings).

## Known limitations

- **Automated checks aren't a screen-reader session.** axe and these tests catch structural and contrast failures. They don't replace testing with NVDA, JAWS or VoiceOver, which hasn't been done.
- **The mobile navigation is an icon rail, not a drawer**, as in the prototype below 1080 px. The icons have names and tooltips; on a 390 px phone it takes 76 px.
- **Two-dimensional chart detail isn't navigable.** The text alternative gives the headline figures, not every data point.

## Gate decision

**PASS.** Phase 15 is complete. Next: Phase 16, loading, empty, error and offline states.
