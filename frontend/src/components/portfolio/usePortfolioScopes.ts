// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiErrorMessage } from '../../services/apiError';

export type Loaded<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; message: string };

/**
 * The two scopes Workspace and Evidence show, each read on its own request:
 *
 *   own      the chosen preparation's -- not asked for at all when none is chosen
 *   unowned  work that belongs to no preparation (subject_id omitted)
 *
 * They are never merged: the page shows them apart, labelled. Switching
 * preparation re-reads `own`, and only the latest request's answer is applied, so
 * an answer that arrives late for the previous preparation is dropped rather than
 * shown under the new one.
 */
export function usePortfolioScopes<T>(
  load: (subjectId: number | null) => Promise<T>,
  selectedId: number | null,
  what: string,
) {
  const [own, setOwn] = useState<Loaded<T> | null>(null);
  const [unowned, setUnowned] = useState<Loaded<T>>({ status: 'loading' });
  const [reload, setReload] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    const mine = ++seq.current;
    const current = () => mine === seq.current;
    const read = (subjectId: number | null, set: (v: Loaded<T>) => void) => {
      set({ status: 'loading' });
      load(subjectId)
        .then((data) => { if (current()) set({ status: 'ready', data }); })
        .catch((err) => { if (current()) set({ status: 'error', message: apiErrorMessage(err, `${what} did not load.`) }); });
    };
    if (selectedId === null) setOwn(null);
    else read(selectedId, (v) => setOwn(v));
    read(null, setUnowned);
  }, [load, selectedId, what, reload]);

  const retry = useCallback(() => setReload((n) => n + 1), []);
  return { own, unowned, retry };
}
