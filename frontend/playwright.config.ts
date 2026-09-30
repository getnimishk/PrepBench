// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { defineConfig, devices } from '@playwright/test';
import type { Frontend } from './e2e/fixtures';

/**
 * Browser tests, against real backends and throwaway databases.
 *
 * The one rule this suite exists to keep: an E2E run must never touch the
 * learner's own data. These tests create and delete preparations, and the real
 * backend/data/exam_simulator.db holds question banks the learner imported by
 * hand that cannot be regenerated from seeds.
 *
 * So no test talks to the app you may have open on 5173/8000. Each worker
 * starts its own (e2e/fixtures.ts): a backend on 8100+n pointed at its own
 * e2e_exam_simulator_w<n>.db, recordings and secrets folders, and a frontend on
 * 5273+n proxying to it. Every database starts as a copy of a template that
 * e2e/global-setup.ts builds once a run the way a fresh install would, after
 * clearing everything e2e_* the last run left in backend/data.
 *
 * Workers run side by side because none can see another's data. Within a
 * worker, tests still run one after another against the same app, so a spec
 * whose tests build on each other keeps working.
 *
 * Two frontends, one per project:
 *
 * - `chromium` (every spec but the navigation crawl) runs against the production
 *   build, served by `vite preview`. Built once up front, so no screen waits on the
 *   dev server compiling it on its first visit -- in a run that opens every screen
 *   several times over, that compilation was a large share of the wall-clock time
 *   and the usual reason a first visit brushed a timeout.
 * - `chromium-dev` runs only navigation.spec.ts, against the dev server. The
 *   production build strips React's development warnings (a missing key,
 *   validateDOMNesting, StrictMode's double-run effects), and the crawl's "no
 *   console errors" is the check that catches them. So that one spec keeps the
 *   dev server; it opens every screen and follows every link, which the preview
 *   project would only repeat.
 */

// Two by default. Each worker is a Chrome plus a backend and a frontend. Four
// were tried first, on an 8-thread, 16 GB machine: runs took about eleven
// minutes, but the machine was saturated (tests 1.5-3x slower than alone, free
// memory down to 0.8 GB) and every run turned up a different timing race -- a
// save still in flight, a late response. Some were the app's (the Question Bank
// could show a late answer to an earlier request; fixed), some the tests'
// (waiting on a clock rather than on the request; fixed), and they kept coming.
// Two keep most of the gain with far less contention. PREPBENCH_E2E_WORKERS
// overrides it; 1 runs the suite as it used to, one test at a time.
const workers = Number(process.env.PREPBENCH_E2E_WORKERS ?? 2);

export default defineConfig<object, { frontend: Frontend }>({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  workers,
  // Spec files are spread across workers; the tests inside a file run in order
  // on one, unless the file opts in (the chunked crawls do).
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',

  use: {
    ...devices['Desktop Chrome'],
    // Locally, the Chrome that is already installed. Downloading Playwright's
    // own browser means fetching a large binary through Norton's TLS
    // interception on this machine, which is exactly the kind of download it
    // breaks. CI has no such problem and uses the bundled build.
    ...(process.env.CI ? {} : { channel: 'chrome' }),
    // Interview practice records from the microphone. A fake device gives the
    // browser a real audio stream to encode, with no prompt and no hardware.
    permissions: ['microphone'],
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  // chromium-dev first: Playwright hands out tests in project order, and its one
  // test -- the three-minute navigation crawl -- listed second started only once
  // every other test had been handed out, and ran on alone at the end of the run.
  projects: [
    {
      name: 'chromium-dev',
      testMatch: /navigation\.spec\.ts$/,
      use: { frontend: 'dev' },
    },
    {
      name: 'chromium',
      testIgnore: /navigation\.spec\.ts$/,
      use: { frontend: 'preview' },
    },
  ],
});
