// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

/// <reference types="vitest/config" />
import http from 'node:http';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Kept-alive connections from the proxy to the backend.
//
// With no agent, Vite's proxy sends every request with "Connection: close", so the
// backend closes the socket the moment it has written a response. On Windows, a
// large response closed that way while the reader is momentarily not reading
// (the proxy pauses whenever the browser is slower than the backend) can leave
// its last few kilobytes and the close itself undelivered: the request never
// finishes and the screen waits on a loading state for good. Measured against
// the backend directly, with no proxy and two different clients: 14 of 100 slow
// reads of a 330 KB response stalled with "Connection: close", 0 of 200 with
// keep-alive. Kept-alive, the backend does not close after the response and the
// client reads to its Content-Length.
//
// A kept-alive socket has its own failure: the backend closes it after an idle
// timeout and says nothing, so the agent can hand it to a request just as it
// closes, and that request fails with "socket hang up". When told the backend's
// timeout (PREPBENCH_API_KEEP_ALIVE_S, set by the browser tests alongside
// uvicorn's --timeout-keep-alive; see playwright.config.ts), idle sockets are
// dropped here at half that, so this side always closes first. The agent's
// `timeout` only destroys free sockets. In-flight requests just get a 'timeout'
// event, and the proxy doesn't listen for it (no proxyTimeout is set), so a slow
// AI-grading call is not cut short. Unset (the everyday dev server), the agent is
// as before.
const backendKeepAliveS = Number(process.env.PREPBENCH_API_KEEP_ALIVE_S);
const backendAgent = new http.Agent({
  keepAlive: true,
  ...(backendKeepAliveS > 0 ? { timeout: (backendKeepAliveS * 1000) / 2 } : {}),
});

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Fail rather than drift. Without this, a busy 5173 sends Vite quietly to
    // 5174 while start_app.bat still opens 5173 -- the browser lands on a dead
    // URL and the app looks broken with no error printed anywhere. A refused
    // start naming the busy port is far easier to act on.
    strictPort: true,
    host: true,
    proxy: {
      '/api': {
        // Overridable so the browser tests can run their own backend on another
        // port, against a throwaway database, while the real app keeps 8000. An
        // E2E run that shared the everyday backend would create and delete
        // preparations in the learner's own data.
        target: process.env.PREPBENCH_API_TARGET ?? 'http://127.0.0.1:8000',
        changeOrigin: true,
        agent: backendAgent,
      }
    }
  },
  // The production build, served locally, needs the same API proxy as the dev
  // server: `npm run preview` is how the release gate measures what a learner
  // actually loads rather than what Vite compiles on the fly.
  preview: {
    port: 4173,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.PREPBENCH_API_TARGET ?? 'http://127.0.0.1:8000',
        changeOrigin: true,
        agent: backendAgent,
      }
    }
  },

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Vitest's 5s default is too tight for this suite. The heaviest tests
    // drive a full MUI dialog through render -> type -> save -> refetch, which
    // measures ~7s here even running alone, and jsdom + MUI make every
    // interaction a real re-render. Tests were failing intermittently on
    // timeout with nothing wrong in the code under test -- the classic way a
    // suite loses its credibility. Raised rather than papered over with
    // retries, so a genuine hang still fails instead of being retried away.
    testTimeout: 20000,
    // Browser tests live in e2e/ and run under Playwright, not here. Without
    // this Vitest would try to execute them in jsdom and fail on the first
    // `page.goto`.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    // Coverage, and a floor under it. On in CI (GitHub sets CI), where
    // `npm test` runs the whole suite; off locally, where `npm test -- <file>`
    // runs a subset that could never reach the floor. `npm run test:coverage`
    // measures locally -- run it on the whole suite, not a subset.
    //
    // The floor is about three points under what was measured on 2026-10-01
    // (statements 83.1, branches 75.3, functions 77.0, lines 85.1): it stops a
    // slide without failing on noise. Raise it as coverage rises; never lower it
    // to let a change through. services/api.ts reads low (~32%) by design --
    // unit tests mock it; the browser suite exercises it.
    coverage: {
      enabled: Boolean(process.env.CI),
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/**/*.d.ts', 'src/main.tsx'],
      reporter: ['text-summary'],
      thresholds: { statements: 80, branches: 72, functions: 74, lines: 82 },
    },
  }
});
