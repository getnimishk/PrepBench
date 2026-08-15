/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
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
