// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { getLakehouseSourceIndex } from '../api';
import type { SourceRow } from './adfModel';

// The pack's source index (every row's id, when it changed, whether it is deleted and which
// batch it arrives in) is a few thousand small rows. Station A runs its model over it and
// Station C's downstream challenge builds its manifest from it, so one fetch is shared.
// A failed fetch isn't remembered: the next caller tries again.

const cache = new Map<string, Promise<SourceRow[]>>();

export function loadSourceIndex(packId: string, version: number, table: string): Promise<SourceRow[]> {
  const key = `${packId}@${version}:${table}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const pending = getLakehouseSourceIndex(packId, table)
    .then((rows) => rows.map((r) => ({ id: r.id, modifiedAt: r.modified_at, deleted: r.deleted, batch: r.batch ?? null })))
    .catch((err) => {
      cache.delete(key);
      throw err;
    });
  cache.set(key, pending);
  return pending;
}

/** For tests: forget everything fetched. */
export const clearSourceIndexCache = () => cache.clear();
