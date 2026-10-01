// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { E2E_DATA_DIR, E2E_DB_NAME } from './paths';

/**
 * The database the browser tests run against, read directly.
 *
 * For journeys the plan says must "assert database state, not just visible
 * text": what a page says and what the API returns are both the app's word for
 * it, and a row in the table is not.
 *
 * Only ever this worker's own throwaway e2e_exam_simulator_w<n>.db, which
 * fixtures.ts copies from the run's template and points the worker's backend at
 * -- never the learner's own database -- and opened read-only, so a test can
 * look but cannot write behind the backend's back.
 */
function workerDb(): string {
  const dbPath = process.env.PREPBENCH_E2E_DB_PATH;
  if (!dbPath) {
    throw new Error('No PREPBENCH_E2E_DB_PATH: read the database from inside a test, whose worker has started its own backend (fixtures.ts).');
  }
  if (!E2E_DB_NAME.test(path.basename(dbPath)) || path.resolve(path.dirname(dbPath)) !== path.resolve(E2E_DATA_DIR)) {
    throw new Error(`Refusing to read ${dbPath}: the browser tests only read their own worker's database.`);
  }
  return dbPath;
}

export function dbRows<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
  const db = new DatabaseSync(workerDb(), { readOnly: true });
  try {
    return db.prepare(sql).all(...params) as T[];
  } finally {
    db.close();
  }
}

export function dbRow<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | undefined {
  return dbRows<T>(sql, ...params)[0];
}
