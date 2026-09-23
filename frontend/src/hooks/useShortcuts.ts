// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { useEffect, useRef } from 'react';
import { usePreferences } from './usePreferences';
import { belongsElsewhere, keyOf, type Shortcut } from '../services/shortcuts';

/**
 * Bind shortcuts for as long as a screen is showing.
 *
 * Nothing happens when shortcuts are turned off in Settings, while a dialog is
 * open (the dialog owns the keyboard), or when the key belongs to something
 * else -- a field being typed in, or a focused button that Space already presses.
 */
export function useShortcuts(
  bindings: { shortcut: Shortcut; run: (key: string) => void }[],
  active = true,
): void {
  const { shortcutsEnabled } = usePreferences();
  const latest = useRef(bindings);
  useEffect(() => { latest.current = bindings; });

  useEffect(() => {
    if (!active || !shortcutsEnabled) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (belongsElsewhere(e)) return;
      if (document.querySelector('[role="dialog"]')) return;
      const key = keyOf(e);
      const binding = latest.current.find((b) => b.shortcut.bind.includes(key));
      if (!binding) return;
      e.preventDefault();
      binding.run(key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, shortcutsEnabled]);
}
