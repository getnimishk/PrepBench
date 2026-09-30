// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { FullConfig } from '@playwright/test';
import {
  BACKEND_PORT_BASE, E2E_DATA_DIR, E2E_FILE, FRONTEND_PORT_BASE, TEMPLATE_DB, frontendDir,
} from './paths';
import { killTree, portInUse, startBackend } from './servers';

/**
 * Everything a run needs once, before any worker starts (fixtures.ts starts one
 * app a worker on top of it):
 *
 * 1. Clear what the last run left: every e2e_* database, recordings folder and
 *    secrets folder in backend/data -- and nothing else there.
 * 2. Check every port the run will take is free, so a leftover server from an
 *    earlier run fails the run here, by name, rather than as a test talking to
 *    the wrong backend.
 * 3. Build the template database: one backend starts on an empty file and runs
 *    the migrations and seed packs exactly as a fresh install would, then stops.
 *    Each worker copies it rather than repeating that.
 * 4. Build the production bundle every worker's `vite preview` serves.
 *    `npm run build` type-checks first, so a type error stops the run here.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const workers = config.workers;

  for (const name of fs.readdirSync(E2E_DATA_DIR)) {
    if (E2E_FILE.test(name)) fs.rmSync(path.join(E2E_DATA_DIR, name), { recursive: true, force: true });
  }

  const templatePort = BACKEND_PORT_BASE + workers;
  const ports = [
    ...Array.from({ length: workers + 1 }, (_, n) => BACKEND_PORT_BASE + n),
    ...Array.from({ length: workers }, (_, n) => FRONTEND_PORT_BASE + n),
  ];
  const busy: number[] = [];
  for (const port of ports) if (await portInUse(port)) busy.push(port);
  if (busy.length) {
    throw new Error(`Port(s) ${busy.join(', ')} already in use. A server from an earlier run may still be up -- `
      + 'stop it (on Windows: Get-NetTCPConnection -LocalPort <port> for its process) and run again.');
  }

  let started = Date.now();
  const logs = path.join(frontendDir, 'test-results', 'servers');
  const backend = await startBackend({
    name: 'template backend',
    port: templatePort,
    dbPath: TEMPLATE_DB,
    recordingsDir: path.join(E2E_DATA_DIR, 'e2e_recordings_template'),
    secretsDir: path.join(E2E_DATA_DIR, 'e2e_secrets_template'),
    logFile: path.join(logs, 'template-backend.log'),
  });
  killTree(backend);
  console.log(`Template database ready in ${((Date.now() - started) / 1000).toFixed(0)} s.`);

  started = Date.now();
  const build = spawnSync('npm', ['run', 'build'], { cwd: frontendDir, shell: true, stdio: 'inherit' });
  if (build.status !== 0) {
    throw new Error(`The production build failed (exit ${build.status ?? build.signal}); the browser tests need it. See the output above.`);
  }
  console.log(`Production build ready in ${((Date.now() - started) / 1000).toFixed(0)} s.`);
}
