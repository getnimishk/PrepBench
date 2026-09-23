// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

/**
 * Work kept on this device while the server cannot take it.
 *
 * Only ever a copy of something on its way to the database: written before a
 * save is attempted, removed once the server has it. If the save fails, the copy
 * is what the screen restores on the next visit and sends when the server is
 * back. It is never shown as saved to your data -- only as saved on this device.
 */
const PREFIX = 'prepbench.draft.';

export interface LocalDraft<T> {
  value: T;
  /** When it was kept, as an ISO timestamp. */
  savedAt: string;
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Keep a copy. False when this browser refuses storage, so the screen can say so. */
export function writeLocalDraft<T>(key: string, value: T): boolean {
  const ls = storage();
  if (!ls) return false;
  try {
    ls.setItem(PREFIX + key, JSON.stringify({ value, savedAt: new Date().toISOString() }));
    return true;
  } catch {
    return false;
  }
}

export function readLocalDraft<T>(key: string): LocalDraft<T> | null {
  const ls = storage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalDraft<T>;
    return parsed && typeof parsed.savedAt === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export function clearLocalDraft(key: string): void {
  try {
    storage()?.removeItem(PREFIX + key);
  } catch {
    // Nothing to do: a copy that cannot be removed is sent again, harmlessly.
  }
}

/** How many pieces of work are waiting on this device. */
export function countLocalDrafts(): number {
  const ls = storage();
  if (!ls) return 0;
  let n = 0;
  for (let i = 0; i < ls.length; i += 1) {
    if (ls.key(i)?.startsWith(PREFIX)) n += 1;
  }
  return n;
}
