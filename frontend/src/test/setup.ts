// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

// Browser storage, as the app gets it in a browser.
//
// Recent Node versions define their own `localStorage` global, which is
// undefined unless the process is started with a storage file -- and it hides
// jsdom's. Code that keeps work on the device while the server is unreachable
// has to be testable, so the tests get an in-memory Storage, emptied before
// every test so nothing one test keeps can leak into the next.
class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.has(key) ? this.data.get(key)! : null; }
  key(index: number) { return Array.from(this.data.keys())[index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, String(value)); }
}

if (typeof globalThis.localStorage === 'undefined' || globalThis.localStorage === null) {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true, writable: true });
}

beforeEach(() => {
  globalThis.localStorage?.clear();
});
