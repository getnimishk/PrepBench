// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

/**
 * Lakehouse Lab P1-1: interview questions saved from lab results.
 *
 * Source reference convention:
 * `lab/<packId>@<version>/station/<station>/<challenge>` (max 150 chars).
 *
 * Talking points rule:
 * Strictly derived only from observed values recorded during the attempt.
 * If no observations were recorded, no talking points exist.
 */

/**
 * Builds a stable source reference for an interview question generated from a lab station challenge.
 */
export function labInterviewSourceRef(
  packId: string,
  packVersion: number,
  station: string,
  challengeId: string,
): string {
  const normStation = station.toLowerCase();
  const raw = `lab/${packId}@${packVersion}/station/${normStation}/${challengeId}`;
  return raw.slice(0, 150);
}

/**
 * Extracts talking points strictly and only from the learner's observed attempt data.
 * No talking point exists unless it traces to a value in the learner's own attempt.
 */
export function extractTalkingPoints(observed: Record<string, unknown> | null | undefined): string[] {
  if (!observed || typeof observed !== 'object') return [];

  const points: string[] = [];

  if (observed.result !== undefined && observed.result !== null && observed.result !== '') {
    points.push(`Observed result: ${String(observed.result)}`);
  }
  if (observed.outcome !== undefined && observed.outcome !== null && observed.outcome !== '') {
    points.push(`Observed outcome: ${String(observed.outcome)}`);
  }
  if (observed.claim !== undefined && observed.claim !== null && observed.claim !== '') {
    points.push(`Defect identified: ${String(observed.claim)}`);
  }
  if (observed.basis !== undefined && observed.basis !== null && observed.basis !== '') {
    points.push(`Observation basis: ${String(observed.basis)}`);
  }
  if (typeof observed.ok === 'boolean') {
    points.push(`Operation status: ${observed.ok ? 'Succeeded' : 'Refused'}`);
  }
  if (typeof observed.version === 'number') {
    points.push(`Delta table version: ${observed.version}`);
  }
  if (typeof observed.rows === 'number') {
    points.push(`Affected rows: ${observed.rows}`);
  }
  if (typeof observed.missed === 'number') {
    points.push(`Missed records: ${observed.missed}`);
  }
  if (typeof observed.duplicated === 'number') {
    points.push(`Duplicated records: ${observed.duplicated}`);
  }
  if (typeof observed.right === 'number' && typeof observed.total === 'number') {
    points.push(`Classification score: ${observed.right} of ${observed.total} correct`);
  } else if (typeof observed.right === 'number') {
    points.push(`Correctly classified: ${observed.right}`);
  }
  if (observed.source !== undefined && observed.source !== null && observed.source !== '') {
    points.push(`Execution source: ${String(observed.source)}`);
  }

  // Any other non-empty values recorded in observed
  const handled = new Set([
    'result', 'outcome', 'claim', 'basis', 'ok', 'version',
    'rows', 'missed', 'duplicated', 'right', 'total', 'source',
  ]);

  for (const [key, value] of Object.entries(observed)) {
    if (!handled.has(key) && value !== null && value !== undefined && value !== '') {
      const label = key.replace(/_/g, ' ');
      const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
      points.push(`${capitalized}: ${String(value)}`);
    }
  }

  return points;
}

/**
 * Generates a default question prompt for the rehearsal studio.
 */
export function defaultQuestionText(stationName: string, challengeTitle: string): string {
  return `How does Delta Lake handle ${challengeTitle} in production (${stationName})?`;
}
