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
const backendAgent = new http.Agent({ keepAlive: true });

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
  }
});
