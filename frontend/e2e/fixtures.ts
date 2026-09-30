// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import fs from 'node:fs';
import path from 'node:path';
import { test as base, expect } from '@playwright/test';
import {
  BACKEND_KEEP_ALIVE_S, BACKEND_PORT_BASE, FRONTEND_PORT_BASE, E2E_DATA_DIR, e2eDbPath, frontendDir, TEMPLATE_DB,
} from './paths';
import { killTree, startBackend, startServer } from './servers';

/**
 * Every Playwright worker gets its own app: its own backend on its own throwaway
 * database, recordings and secrets, and its own frontend in front of it.
 *
 * Tests assert on what a preparation owns, and several change app-wide state --
 * the theme, the profile's name, notification settings. With one shared backend
 * they could only run one at a time. With one backend a worker, a worker's tests
 * still run one after another against their own data, exactly as the whole suite
 * used to, and workers run side by side without seeing each other.
 *
 * Each worker's database starts as a copy of the template global-setup.ts built,
 * so migrations and the seed packs run once a run, not once a worker. It is named
 * for the worker (workerIndex), so a worker that replaces a failed one never waits
 * on Windows to release the old one's lock. Ports come from parallelIndex instead:
 * 0..workers-1, unique among the workers running at any moment -- across both
 * projects -- and reused by a replacement, so they stay inside the range
 * global-setup.ts checked was free.
 *
 * The frontend depends on the project: `preview` serves the production build
 * (built once by global-setup.ts); `dev` runs Vite's dev server, for the one spec
 * that needs React's development warnings (see playwright.config.ts).
 */

export type Frontend = 'preview' | 'dev';

const viteBin = path.join(frontendDir, 'node_modules', 'vite', 'bin', 'vite.js');

// Fixture callbacks name their hand-over `provide`, not the usual `use`: the
// React hooks lint rule takes a call to `use()` for React's hook.
export const test = base.extend<object, { frontend: Frontend; workerApp: { baseURL: string } }>({
  frontend: ['preview', { scope: 'worker', option: true }],

  workerApp: [async ({ frontend }, provide, workerInfo) => {
    const n = workerInfo.parallelIndex;
    const id = `w${workerInfo.workerIndex}`;
    const backendPort = BACKEND_PORT_BASE + n;
    const frontendPort = FRONTEND_PORT_BASE + n;
    const dbPath = e2eDbPath(id);
    const logs = path.join(workerInfo.project.outputDir, 'servers');

    // The template's WAL goes too: the backend that built it was stopped
    // without a checkpoint, and SQLite recovers the pair as one database.
    fs.copyFileSync(TEMPLATE_DB, dbPath);
    if (fs.existsSync(`${TEMPLATE_DB}-wal`)) fs.copyFileSync(`${TEMPLATE_DB}-wal`, `${dbPath}-wal`);
    // Read directly by db.ts, in this worker's process.
    process.env.PREPBENCH_E2E_DB_PATH = dbPath;

    const backend = await startBackend({
      name: `backend ${id}`,
      port: backendPort,
      dbPath,
      recordingsDir: path.join(E2E_DATA_DIR, `e2e_recordings_${id}`),
      secretsDir: path.join(E2E_DATA_DIR, `e2e_secrets_${id}`),
      logFile: path.join(logs, `${id}-backend.log`),
    });
    try {
      const app = await startServer({
        name: `${frontend} ${id}`,
        command: process.execPath,
        args: [viteBin, ...(frontend === 'preview' ? ['preview'] : []), '--port', String(frontendPort), '--strictPort'],
        env: {
          PREPBENCH_API_TARGET: `http://127.0.0.1:${backendPort}`,
          PREPBENCH_API_KEEP_ALIVE_S: String(BACKEND_KEEP_ALIVE_S),
        },
        url: `http://127.0.0.1:${frontendPort}`,
        logFile: path.join(logs, `${id}-${frontend}.log`),
      });
      try {
        await provide({ baseURL: `http://127.0.0.1:${frontendPort}` });
      } finally {
        killTree(app);
      }
    } finally {
      killTree(backend);
    }
  }, { scope: 'worker', auto: true, timeout: 300_000 }],

  // Everything a test opens -- pages and the `request` fixture alike -- goes to this worker's app.
  baseURL: async ({ workerApp }, provide) => {
    await provide(workerApp.baseURL);
  },
});

export { expect };
