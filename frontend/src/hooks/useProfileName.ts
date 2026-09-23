// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { useEffect, useState } from 'react';
import { getProfile } from '../services/api';

/** Dispatched on window when the profile is saved, so the header redraws its initials. */
export const PROFILE_UPDATED = 'prepbench:profile-updated';

/** Up to two initials from a name: the first letters of its first and last words. */
export function initialsOf(name: string | null | undefined): string | null {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const first = Array.from(words[0])[0] ?? '';
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] ?? '' : '';
  return (first + last).toUpperCase();
}

/**
 * The name written on the profile, for the header's avatar.
 *
 * Read once, and again whenever the profile is saved. Null until read, when
 * none has been written, and when it cannot be read -- the avatar then shows a
 * plain person, never someone's invented initials.
 */
export function useProfileName(enabled = true): string | null {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const read = () => {
      getProfile()
        .then((profile) => { if (!cancelled) setName(profile.display_name); })
        .catch(() => { if (!cancelled) setName(null); });
    };
    read();
    window.addEventListener(PROFILE_UPDATED, read);
    return () => {
      cancelled = true;
      window.removeEventListener(PROFILE_UPDATED, read);
    };
  }, [enabled]);

  return name;
}
