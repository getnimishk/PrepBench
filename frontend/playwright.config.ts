// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Browser tests, against a real backend and a throwaway database.
 *
 * The one rule this file exists to keep: an E2E run must never touch the
 * learner's own data. These tests create and delete preparations, and the real
 * backend/data/exam_simulator.db holds question banks the learner imported by
 * hand that cannot be regenerated from seeds.
 *
 * So the backend is started here, on its own port, with SQLALCHEMY_DATABASE_URI
 * pointed at backend/data/e2e_exam_simulator.db -- deleted before every run, then
 * built and seeded by the app's own startup exactly as a fresh install would be.
 * The dev server is started on its own port too, proxying to that backend, so a
 * copy of the app you already have open on 5173/8000 is left alone.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const backendDir = path.join(repoRoot, 'backend');

const BACKEND_PORT = 8100;
const FRONTEND_PORT = 5273;

// SQLAlchemy wants forward slashes in a sqlite URL, including on Windows.
const e2eDbPath = path.join(backendDir, 'data', 'e2e_exam_simulator.db').replace(/\\/g, '/');

// Recorded answers go here, never beside the learner's own in backend/data/recordings.
const e2eRecordingsDir = path.join(backendDir, 'data', 'e2e_recordings');

// And provider keys, never into the learner's own .llm_secrets.json -- the same
// redirect the backend tests make in conftest.py.
const e2eSecretsDir = path.join(backendDir, 'data', 'e2e_secrets');

const python = process.platform === 'win32'
  ? path.join(backendDir, '.venv', 'Scripts', 'python.exe')
  : path.join(backendDir, '.venv', 'bin', 'python');

// Start every run from an empty database.
//
// Done here, as the config loads, rather than in globalSetup: Playwright starts
// the web servers before globalSetup runs, so deleting the file there would race
// a backend that already has it open.
//
// Only in the main process. Worker processes load this file too, and a worker
// deleting the database out from under a running backend is the one outcome
// worse than a stale file -- on Linux the unlink succeeds silently and the next
// connection creates a new empty database mid-run. TEST_WORKER_INDEX is set in
// workers and nowhere else.
if (process.env.TEST_WORKER_INDEX === undefined) {
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    fs.rmSync(`${e2eDbPath}${suffix}`, { force: true });
  }
  fs.rmSync(e2eRecordingsDir, { recursive: true, force: true });
  fs.rmSync(e2eSecretsDir, { recursive: true, force: true });
}

export default defineConfig({
  testDir: './e2e',
  // One worker: every test shares one backend and one database, and several of
  // them assert on what a preparation owns. Parallel runs would see each other's
  // rows and fail for reasons that have nothing to do with the code under test.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: `http://127.0.0.1:${FRONTEND_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
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
      },
    },
  ],

  webServer: [
    {
      command: `"${python}" -m uvicorn app.main:app --app-dir "${backendDir}" --host 127.0.0.1 --port ${BACKEND_PORT}`,
      url: `http://127.0.0.1:${BACKEND_PORT}/api/v1/subjects`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        SQLALCHEMY_DATABASE_URI: `sqlite:///${e2eDbPath}`,
        PREPBENCH_RECORDINGS_DIR: e2eRecordingsDir,
        PREPBENCH_SECRETS_DIR: e2eSecretsDir,
        // Blank, so a GEMINI_API_KEY in the developer's .env cannot turn into a
        // provider row and make a test's behaviour depend on a live AI service.
        GEMINI_API_KEY: '',
      },
    },
    {
      command: `npm run dev -- --port ${FRONTEND_PORT} --strictPort`,
      url: `http://127.0.0.1:${FRONTEND_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        PREPBENCH_API_TARGET: `http://127.0.0.1:${BACKEND_PORT}`,
      },
    },
  ],
});
