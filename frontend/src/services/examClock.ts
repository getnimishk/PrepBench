// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

/**
 * Time left on a timed session, by the wall clock from its start.
 *
 * One definition for the countdown and for the runner's "is the time up" check,
 * matching how the server enforces the limit. Returns undefined for an untimed
 * session.
 *
 * The server stores naive UTC, so a timestamp without a zone is read as UTC --
 * read as local time, every clock east or west of Greenwich was off by hours.
 */
export const remainingSeconds = (startISO?: string, allowedSecs?: number | null): number | undefined => {
  if (!allowedSecs || allowedSecs <= 0) return undefined;
  if (!startISO) return allowedSecs;

  let iso = startISO.trim();
  if (!iso.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(iso)) {
    iso += 'Z';
  }

  const startMs = new Date(iso).getTime();
  if (isNaN(startMs)) return allowedSecs;

  const elapsedSecs = Math.floor((Date.now() - startMs) / 1000);
  const remaining = allowedSecs - elapsedSecs;
  return remaining > 0 ? remaining : 0;
};
