// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Where the browser tests' own files live, shared by playwright.config.ts (which
 * clears them at the start of a run), fixtures.ts (which starts each worker's
 * app on them) and db.ts (which reads a worker's database).
 *
 * Every file here is named e2e_*, in backend/data beside -- and never -- the
 * learner's own exam_simulator.db, recordings and secrets.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
export const frontendDir = path.resolve(here, '..');
export const backendDir = path.resolve(frontendDir, '..', 'backend');
export const E2E_DATA_DIR = path.join(backendDir, 'data');

/** Everything a run may create in E2E_DATA_DIR, and so everything it clears. */
export const E2E_FILE = /^e2e_(exam_simulator|recordings|secrets)/;

/** A worker's database: e2e_exam_simulator_w<workerIndex>.db. */
export const E2E_DB_NAME = /^e2e_exam_simulator_w\d+\.db$/;
export const e2eDbPath = (workerId: string) => path.join(E2E_DATA_DIR, `e2e_exam_simulator_${workerId}.db`);

/** Built once a run by global-setup.ts; every worker's database starts as a copy. */
export const TEMPLATE_DB = path.join(E2E_DATA_DIR, 'e2e_exam_simulator_template.db');

// Worker n's backend is on BACKEND_PORT_BASE + n and its frontend on
// FRONTEND_PORT_BASE + n; the template's backend takes the port after the last
// worker's. Clear of 8000/5173 (the learner's own app) and 8210/5383 (the audit
// setup in CLAUDE.md) for up to 100 workers.
export const BACKEND_PORT_BASE = 8100;
export const FRONTEND_PORT_BASE = 5273;

export const python = process.platform === 'win32'
  ? path.join(backendDir, '.venv', 'Scripts', 'python.exe')
  : path.join(backendDir, '.venv', 'bin', 'python');

// How long the backend keeps an idle kept-alive connection open, in seconds.
//
// Uvicorn's default is 5 s, and it closes the socket without warning: no
// "Keep-Alive: timeout=" header, so the frontend's proxy keeps the socket in its
// pool as if it were good forever. A request that reuses it in the instant
// uvicorn closes it fails with "socket hang up" or ECONNRESET, and the screen
// behind it shows an error or never loads. Measured with no app and no proxy,
// just Node's agent against uvicorn: 2 of 12 reuses at ~5 s idle reset; 0 of 12
// at 75 s. In a 30-50 minute run with Vite compiling under load, that window
// came up often enough to fail a few random screens per run.
//
// So the backend is given a long keep-alive, and the same number goes to the
// frontend's proxy (PREPBENCH_API_KEEP_ALIVE_S; see vite.config.ts), which drops
// its idle sockets well before this. The proxy always closes an idle connection
// first, and a client closing an idle connection loses nothing.
export const BACKEND_KEEP_ALIVE_S = 75;
