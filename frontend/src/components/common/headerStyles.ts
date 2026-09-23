// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { NARROW_QUERY, type Tokens } from '../../theme/tokens';

/**
 * A header control drawn as the prototype's .btn: bordered, 9px corners, the
 * height of the buttons beside it. Used by the controls that are an icon rather
 * than a word -- the alerts bell and the theme switch -- so they stand in line
 * with Search and Import.
 */
export const headerIconButtonSx = (t: Tokens) => ({
  width: 39,
  height: 39,
  flexShrink: 0,
  borderRadius: '9px',
  border: `1px solid ${t.line}`,
  bgcolor: t.surface,
  color: t.text,
  '&:hover': { bgcolor: t.surface, borderColor: t.accent },
  [NARROW_QUERY]: { width: 32, height: 32 },
});
