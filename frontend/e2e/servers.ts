// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { BACKEND_KEEP_ALIVE_S, backendDir, python } from './paths';

/**
 * Starting and stopping the servers the browser tests run against: each
 * worker's backend and frontend (fixtures.ts), and the backend that builds the
 * template database (global-setup.ts).
 */

/**
 * Kill `child` and everything it started, and wait for them to go.
 *
 * The whole tree, because a process left behind is not harmless on Windows: a
 * backend still holding its database open is the one real cause of a slow,
 * flaky run this suite has seen. And taskkill by its full path, because on this
 * machine a shell's PATH has been seen without System32 in a usable form --
 * Playwright's own web-server teardown then hung for hours, unable to find it.
 */
export function killTree(child: ChildProcess): void {
  if (child.exitCode !== null || child.signalCode !== null || child.pid === undefined) return;
  if (process.platform === 'win32') {
    const taskkill = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'taskkill.exe');
    spawnSync(taskkill, ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
  }
}

interface ServerSpec {
  name: string;
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
  /** Answers 200 once the server is ready. */
  url: string;
  logFile: string;
}

/** Start a server, logging to its file, and return once `url` answers 200. */
export async function startServer({ name, command, args, env, url, logFile }: ServerSpec): Promise<ChildProcess> {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const log = fs.createWriteStream(logFile);
  const child = spawn(command, args, {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    // Its own process group off Windows, so killTree can take the group.
    detached: process.platform !== 'win32',
  });
  child.stdout?.pipe(log);
  child.stderr?.pipe(log);

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`${name} exited with code ${child.exitCode} before ${url} answered; see ${logFile}`);
    }
    try {
      if ((await fetch(url)).ok) return child;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  killTree(child);
  throw new Error(`${name} did not answer ${url} within 120 s; see ${logFile}`);
}

interface BackendSpec {
  name: string;
  port: number;
  dbPath: string;
  recordingsDir: string;
  secretsDir: string;
  logFile: string;
}

/** A backend on its own throwaway database, recordings and secrets. */
export function startBackend({ name, port, dbPath, recordingsDir, secretsDir, logFile }: BackendSpec): Promise<ChildProcess> {
  return startServer({
    name,
    command: python,
    args: ['-m', 'uvicorn', 'app.main:app', '--app-dir', backendDir, '--host', '127.0.0.1', '--port', String(port),
      '--timeout-keep-alive', String(BACKEND_KEEP_ALIVE_S)],
    env: {
      // SQLAlchemy wants forward slashes in a sqlite URL, including on Windows.
      SQLALCHEMY_DATABASE_URI: `sqlite:///${dbPath.replace(/\\/g, '/')}`,
      PREPBENCH_RECORDINGS_DIR: recordingsDir,
      PREPBENCH_SECRETS_DIR: secretsDir,
      // Blank, so a GEMINI_API_KEY in the developer's .env cannot turn into a
      // provider row and make a test's behaviour depend on a live AI service.
      GEMINI_API_KEY: '',
    },
    url: `http://127.0.0.1:${port}/api/v1/subjects`,
    logFile,
  });
}

/**
 * Whether something already answers on `port` at 127.0.0.1. By connecting rather
 * than binding: on Windows a bind to 127.0.0.1 can succeed beside a server that
 * holds the port on every interface, as Vite does.
 */
export function portInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.setTimeout(1_000);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => resolve(false));
  });
}
