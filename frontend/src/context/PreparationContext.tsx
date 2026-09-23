// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { getSubjects } from '../services/api';
import { loadFailed } from '../services/apiError';
import { connection } from '../services/connection';
import type { Subject } from '../types/subject';

/**
 * Which preparation you are working in.
 *
 * A preparation owns its own questions, roadmap, practice history and evidence,
 * and nothing is shared between them -- so "which one" is a question almost every
 * screen needs answered, and answering it per-page meant each page picked its own
 * and they disagreed.
 *
 * The choice is a UI preference, not learner data, so localStorage is the right
 * home for it: losing it costs one click, and it must survive a reload because
 * re-picking your preparation on every refresh is the kind of small friction that
 * makes an app feel broken.
 *
 * Archived preparations are deliberately absent from this list. Archive exists to
 * take something out of the picker; a list that still offered it would make the
 * control do nothing.
 */

const STORAGE_KEY = 'prepbench.selectedPreparationId';

interface PreparationContextValue {
  /** Selectable preparations, archived ones excluded. */
  preparations: Subject[];
  selected: Subject | null;
  selectedId: number | null;
  select: (id: number) => void;
  /** Re-fetch after a create, edit, archive or delete. */
  refresh: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

const PreparationContext = createContext<PreparationContextValue>({
  preparations: [],
  selected: null,
  selectedId: null,
  select: () => {},
  refresh: async () => {},
  loading: true,
  error: null,
});

export const usePreparation = () => useContext(PreparationContext);

/** Reads are wrapped because a private window, cleared site data or a browser
 *  set to block storage all throw on access rather than returning null. */
function readStoredId(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredId(id: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    // A preference that cannot be saved is not worth failing a render over.
  }
}

export const PreparationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preparations, setPreparations] = useState<Subject[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(readStoredId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Whether the last read failed, kept where the connection listener can see it
  // the moment it happens rather than after the next render.
  const failedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const list = await getSubjects({ includeArchived: false });
      failedRef.current = false;
      setPreparations(list);
      setError(null);

      // Resolve the selection against what actually exists. A stored id can
      // point at a preparation that has since been deleted or archived, and
      // holding on to it would leave every scoped screen filtering by an id the
      // server will never match -- an app that looks empty for no stated reason.
      setSelectedId((current) => {
        if (current !== null && list.some((s) => s.id === current)) return current;
        const first = list[0];
        if (!first) return null;
        writeStoredId(first.id);
        return first.id;
      });
    } catch (err) {
      failedRef.current = true;
      setError(loadFailed('Could not load your preparations', err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Nearly every screen is scoped by this list, and none of them can ask for it
  // again. Read while the server was down it would stay empty until a reload, so
  // it is asked for again as soon as the server answers.
  useEffect(() => connection.subscribe((state) => {
    if (state === 'online' && failedRef.current) void load();
  }), [load]);

  const select = useCallback((id: number) => {
    setSelectedId(id);
    writeStoredId(id);
  }, []);

  const value = useMemo<PreparationContextValue>(() => ({
    preparations,
    selected: preparations.find((s) => s.id === selectedId) ?? null,
    selectedId,
    select,
    refresh: load,
    loading,
    error,
  }), [preparations, selectedId, select, load, loading, error]);

  return (
    <PreparationContext.Provider value={value}>
      {children}
    </PreparationContext.Provider>
  );
};
