// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

/**
 * The database the browser tests run against, read directly.
 *
 * For journeys the plan says must "assert database state, not just visible
 * text": what a page says and what the API returns are both the app's word for
 * it, and a row in the table is not.
 *
 * Only ever the throwaway e2e_exam_simulator.db that playwright.config.ts deletes
 * and recreates on every run -- never the learner's own database -- and opened
 * read-only, so a test can look but cannot write behind the backend's back.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const E2E_DB = path.resolve(here, '..', '..', 'backend', 'data', 'e2e_exam_simulator.db');

if (path.basename(E2E_DB) !== 'e2e_exam_simulator.db') {
  throw new Error(`Refusing to read ${E2E_DB}: the browser tests only read their own database.`);
}

export function dbRows<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
  const db = new DatabaseSync(E2E_DB, { readOnly: true });
  try {
    return db.prepare(sql).all(...params) as T[];
  } finally {
    db.close();
  }
}

export function dbRow<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | undefined {
  return dbRows<T>(sql, ...params)[0];
}
