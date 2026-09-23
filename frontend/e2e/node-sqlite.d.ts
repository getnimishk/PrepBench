// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

/**
 * The part of Node's built-in SQLite module the browser tests use.
 *
 * Node ships `node:sqlite` (the runtime here is Node 26), but the installed
 * @types/node predates it. Declared locally rather than by upgrading the types
 * package, whose installs on this machine have come out partial before.
 */
declare module 'node:sqlite' {
  interface StatementSync {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
  }

  export class DatabaseSync {
    constructor(path: string, options?: { readOnly?: boolean; open?: boolean });
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
