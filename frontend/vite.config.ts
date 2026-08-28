// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
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
  }
});
