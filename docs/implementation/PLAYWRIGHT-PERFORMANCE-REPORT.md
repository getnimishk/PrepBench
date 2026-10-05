# System Test Architecture Report: Playwright Test Suite Performance Analysis

**Target System:** PrepBench E2E Test Suite (`frontend/e2e/`)  
**Suite Profile:** 27 Spec Files | 83 Tests  
**Observed Execution Time:** **32.7 minutes** (~1,962 seconds) on a single Chromium instance  
**Role:** System Test Architect  
**Date:** September 30, 2026  

---

## 1. Executive Summary

A 33-minute test run for an 83-test browser suite indicates significant architectural friction. In a modern automated test architecture, a localized single-browser suite of 83 tests should complete in **2 to 4 minutes**. 

The root cause of this execution bottleneck is **not Playwright itself**, but an interplay of five fundamental architectural constraints:

1. **Forced Total Serialization (`workers: 1`)** dictated by an unisolated, monolithic SQLite database architecture, leaving 85–90% of available CPU cores idle.
2. **Execution Against Vite Development Server (`npm run dev`)** instead of a pre-built static bundle (`vite preview`), incurring on-demand, unbundled ESM compilation latency on every visited route.
3. **Combinatorial Brute-Force Route Crawling** across entire application route sets in three test files (`responsive.spec.ts`, `accessibility.spec.ts`, and `navigation.spec.ts`), which together consume **16.5 minutes (over 50% of the entire suite)** across 285+ full-page navigations.
4. **Widespread Reliance on the `waitForLoadState('networkidle')` Anti-Pattern**, which introduces an artificial 500 ms dead-wait window on every navigation (wasting 2.5 to 3+ minutes in pure thread idle time).
5. **Double-Hop API Proxy Overhead** routing all synthetic test fixtures through the Node.js Vite proxy middleware rather than directly to the FastAPI test backend.

---

## 2. In-Depth Root Cause Breakdown

### Root Cause 1: Enforced Single-Worker Serialization (`workers: 1`) Driven by Database Architecture

**Location:** `frontend/playwright.config.ts` (lines 87–88)
```typescript
workers: 1,
fullyParallel: false,
```

#### Why it exists:
The configuration documentation states:
> *"One worker: every test shares one backend and one database, and several of them assert on what a preparation owns. Parallel runs would see each other's rows and fail for reasons that have nothing to do with the code under test."*

#### Architectural Impact:
* **Zero Core Utilization:** On an 8-core / 16-thread machine, all tests execute sequentially in a single Chrome process. A suite that takes 33 minutes in 1 worker would theoretically finish in **~4.5 minutes** with 8 parallel workers under identical test logic.
* **State Accumulation Penalty:** Because all 83 tests write to the same `e2e_exam_simulator.db` database without per-test resets, the database progressively accumulates hundreds of questions, roadmaps, mock sessions, and diagnostic roles. Later tests (such as `navigation.spec.ts`) experience degraded database query times, larger payload transfers, and longer search index traversals.

---

### Root Cause 2: Testing Against Vite Dev Server (`npm run dev`) Instead of a Production Build

**Location:** `frontend/playwright.config.ts` (line 135)
```typescript
command: `npm run dev -- --port ${FRONTEND_PORT} --strictPort`,
```

#### Architectural Impact:
* **On-the-Fly Dynamic Compilation:** In dev mode, Vite does not serve bundled static assets. Instead, it serves unbundled native ES modules. When a test navigates to a screen for the first time, Vite must dynamically parse TypeScript, transform JSX and Emotion CSS-in-JS primitives, resolve imports, and serve dozens of individual HTTP module requests to Chrome.
* **Confirmed Dev Server Stall:** The codebase documentation in `navigation.spec.ts` (lines 30–34) and `playwright.config.ts` (lines 40–42) documents this exact problem:
  > *"Vite's dev server compiles a route on its first visit, and a page that has never been hit before in this run can occasionally take longer than 5s to serve... In a 30-50 minute run with Vite compiling under load..."*
* **Contrast with Production Build:** A pre-bundled build (`npm run build && vite preview`) compiles all TypeScript and JSX upfront. Pages load in <50 ms from pre-optimized static bundles, eliminating hundreds of individual module round-trips and Node.js compilation pauses.

---

### Root Cause 3: The "Big Three" Combinatorial Route Crawlers (16.5 Minutes / 50.5% of Runtime)

Three specific spec files account for more than half of the total test duration due to Cartesian-product testing across all screens:

```
Total Suite: ~32.7 min (1,962 s)
├── responsive.spec.ts:     7.0 min (420 s)  ── 21.4%
├── accessibility.spec.ts:  6.1 min (366 s)  ── 18.7%
├── navigation.spec.ts:     3.4 min (204 s)  ── 10.4%
└── All Other 24 Specs:    16.2 min (972 s)  ── 49.5%
```

#### 1. `frontend/e2e/responsive.spec.ts` (7.0 minutes)
* **The Pattern:** Iterates through **5 viewport dimensions** (1280px, 1024px, 768px, 430px, 390px). For **each** viewport, it navigates through **29 distinct application routes**.
* **The Math:** $5 \text{ viewports} \times 29 \text{ routes} = \mathbf{145 \text{ full page navigations}}$.
* On every single route, it awaits heading visibility, waits for `networkidle`, and executes custom DOM evaluations checking for sideways scrolling and minimum tap target sizes ($24 \times 24$ px).
* $145 \text{ navigations} \times \sim 2.9\text{ seconds/navigation} = \mathbf{420\text{ seconds (7.0 minutes)}}$.

#### 2. `frontend/e2e/accessibility.spec.ts` (6.1 minutes)
* **The Pattern:** Iterates through **2 color themes** (light and dark). For **each** theme, it crawls **40 distinct application routes**.
* **The Math:** $2 \text{ themes} \times 40 \text{ routes} = \mathbf{80 \text{ full page navigations}}$ + **80 full Axe-core accessibility scans**.
* On every route, it invokes `await new AxeBuilder({ page }).withTags(TAGS).analyze()`. Axe performs deep DOM traversal, computational color-contrast analysis across every typography element, ARIA role tree validation, and landmark structure inspection.
* Light theme audit: **2.9 minutes**; Dark theme audit: **3.0 minutes**.

#### 3. `frontend/e2e/navigation.spec.ts` (3.4 minutes)
* **The Pattern:** First crawls **44 core routes** sequentially to collect all internal anchor `href`s on the page. It then computes unseen route shapes and navigates to all remaining unvisited links, followed by a 404 error boundary check.
* Results in **~60 full page navigations**, verifying heading visibility, absence of 404 headers, and network idle.

---

### Root Cause 4: The `networkidle` Load Detection Anti-Pattern

**Locations:**
- `responsive.spec.ts`: `await page.waitForLoadState('networkidle');`
- `accessibility.spec.ts`: `await page.waitForLoadState('networkidle');`
- `navigation.spec.ts`: `await page.waitForLoadState('networkidle');`

#### Architectural Flaw:
* Playwright’s official documentation explicitly warns:
  > *"DISCOURAGED: `waitForLoadState('networkidle')` is discouraged. Do not use this method for load detection. Rely on web assertions to assess readiness instead."*
* **The Mandatory 500ms Penalty:** `networkidle` pauses execution until there are zero network connections for at least **500 ms**.
* Across the 285 page navigations performed in `responsive`, `accessibility`, and `navigation` alone:
  $$285 \times 0.5\text{ s} = \mathbf{142.5\text{ seconds (~2.4 minutes)}}\text{ of pure, unyielding sleep time.}$$
* If any keep-alive socket or delayed background telemetry fires, `networkidle` pauses even longer or times out.

---

### Root Cause 5: API Traffic Double-Hopping via Vite Proxy

**Location:** `frontend/e2e/helpers.ts` (lines 16–17)
> *"Every request goes through the dev server's /api proxy to the E2E backend, which runs against its own throwaway database."*

#### Architectural Impact:
* In every test, setup functions (`createCertification`, `createRole`, `completedMockWithMisses`, `roadmaps`, `phases`, `topics`) make 5 to 12 synthetic REST API calls via Playwright's `request` context.
* Instead of communicating directly with FastAPI on `http://127.0.0.1:8100`, requests are routed to `http://127.0.0.1:5273/api/...`. The single-threaded Node.js Vite process must intercept, proxy, and buffer every HTTP request and response.
* This proxy contention caused connection resets (`socket hang up`), which forced the team to implement a 75-second keep-alive workaround (`playwright.config.ts`, line 47).

---

### Root Cause 6: Repetitive End-to-End API Seeding per Test

Across the 83 individual tests, there are virtually no shared fixtures or cached database states:
* In `responsive.spec.ts`, all 5 viewport tests independently call `createCertification`, `createRole`, `completedMockWithMisses`, create a roadmap, create a phase, create a topic, and create guide sections via the REST API before testing layout.
* In `isolation.spec.ts`, multiple tests repeat multi-stage mock completions with wrong answers to set up readiness metrics.
* Each multi-request seed chain takes between 1.5 and 4.0 seconds of serialized network IO before the browser UI even opens.

---

## 3. Pareto Analysis: Where the 32.7 Minutes Are Spent

| Category | Estimated Time | % of Suite | Root Bottleneck |
|---|---|---|---|
| **Responsive Viewport Crawls** (`responsive.spec.ts`) | **7.0 min** | 21.4% | 145 page navigations ($5 \text{ viewports} \times 29 \text{ routes}$) + `networkidle` |
| **Theme Accessibility Scans** (`accessibility.spec.ts`) | **6.1 min** | 18.7% | 80 page navigations ($2 \text{ themes} \times 40 \text{ routes}$) + 80 deep Axe DOM analyses |
| **Link & Route Crawl** (`navigation.spec.ts`) | **3.4 min** | 10.4% | ~60 navigations checking all dynamic links + `networkidle` |
| **All Other 24 Feature Specs** (75 tests) | **16.2 min** | 49.5% | Serialized execution (`workers: 1`), Vite dev compilation, API setup |
| *Cumulative `networkidle` Sleep Overhead* | *~3.0 min* | *~9.2%* | *500 ms idle wait across ~350 total navigations in the run* |
| *Vite Dev Server Dynamic Transform Overhead* | *~4.5 min* | *~13.8%* | *Runtime TypeScript/JSX compilation on uncompiled routes* |

---

## 4. Strategic Recommendations (Architectural Roadmap)

### Tier 1: Zero-Risk Configuration Adjustments (Estimated Gain: ~35–45% Runtime Reduction)

1. **Serve a Pre-Built Production Bundle (`vite preview`):**
   * Change the webServer command in `playwright.config.ts` from `npm run dev` to `npm run build && npm run preview`.
   * **Result:** Eliminates all dynamic runtime TypeScript/JSX compilation. HTML/JS/CSS assets are served instantly as static files, reducing navigation latency from ~2–4 seconds to <100 ms.
2. **Replace `waitForLoadState('networkidle')` with Web Assertions:**
   * Replace `page.waitForLoadState('networkidle')` in `responsive.spec.ts`, `accessibility.spec.ts`, and `navigation.spec.ts` with explicit locator assertions:
     ```typescript
     // Instead of:
     await page.waitForLoadState('networkidle');
     // Use locator readiness:
     await expect(page.locator('main h1').first()).toBeVisible();
     ```
   * **Result:** Saves 500 ms on every route navigation across 285+ routes (~2.5 to 3 minutes saved immediately).

---

### Tier 2: Suite Decomposition & Route Sampling (Estimated Gain: ~50–60% Additional Reduction in Crawlers)

1. **Deduplicate Responsive Viewport Testing:**
   * Testing all 29 screens across all 5 viewports ($5 \times 29 = 145$) is largely redundant. Screens with identical structural layouts (e.g., standard form pages, settings subpages) do not behave differently across 430px and 390px.
   * **Solution:** Audit all 29 screens on desktop (1280px) and phone (390px). For intermediate viewports (1024px, 768px, 430px), audit only layout-critical, grid-heavy screens (Analytics, Schedule Gantt, Question Bank, Topic Guide).
   * **Result:** Reduces `responsive.spec.ts` from 145 navigations to ~50 navigations, cutting runtime from **7.0 minutes to ~2.0 minutes**.
2. **Optimize Axe Accessibility Theme Auditing:**
   * Running full Axe audits on 40 routes in both light and dark mode ($2 \times 40 = 80$) repeats structural checks (headings, landmarks, buttons, form labels) that do not change between themes.
   * **Solution:** Run the full WCAG rule set in Light mode. In Dark mode, run Axe with rules restricted strictly to color contrast (`withRules(['color-contrast'])`).
   * **Result:** Cuts dark mode audit time in half, reducing `accessibility.spec.ts` from **6.1 minutes to ~3.5 minutes**.

---

### Tier 3: True Parallelization with Worker Database Isolation (Estimated Gain: ~4x to 6x Overall Throughput)

1. **Worker-Isolated SQLite Databases:**
   * Instead of sharing a single `e2e_exam_simulator.db`, leverage Playwright’s `testInfo.parallelIndex`:
     ```typescript
     const dbPath = `e2e_exam_simulator_worker_${testInfo.parallelIndex}.db`;
     ```
   * Each Playwright worker spawns its own isolated FastAPI instance (or runs an isolated SQLite database file).
   * Enable `workers: 4` (or `workers: '50%'`).
   * **Result:** With 4 parallel workers, an optimized 10-minute suite runs in **~2.5 to 3.0 minutes total wall-clock time**.

---

## 5. Summary Matrix

| Metric | Current State | Potential Optimized State |
|---|---|---|
| **Total Wall-Clock Runtime** | **32.7 minutes** | **~2.5 – 3.5 minutes** |
| **Worker Concurrency** | `workers: 1` (Serial) | `workers: 4` (Parallel) |
| **Frontend Server Mode** | `npm run dev` (Unbundled ESM on-demand) | `vite preview` (Pre-compiled static chunks) |
| **Page Load Detection** | `networkidle` (+500 ms sleep per page) | Locator / DOM readiness assertions |
| **Responsive Route Crawls** | 145 full navigations | ~50 sampled navigations |
| **API Traffic Path** | Client $\to$ Vite Proxy $\to$ FastAPI | Client $\to$ Direct FastAPI Test Port |
