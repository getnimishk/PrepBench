// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

/**
 * Text a screen reader reads and nobody sees: e.g. inside an otherwise empty
 * table header cell, which axe's empty-table-header rule needs (an aria-label
 * on the empty cell isn't enough).
 */
export const VISUALLY_HIDDEN = {
  border: 0, clip: 'rect(0 0 0 0)', height: '1px', margin: '-1px', overflow: 'hidden',
  padding: 0, position: 'absolute', top: 0, left: 0, whiteSpace: 'nowrap', width: '1px',
} as const;
