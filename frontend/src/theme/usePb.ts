// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { useTheme } from '@mui/material';
import { TOKENS, type Tokens } from './tokens';

/**
 * The prototype's tokens for the current mode.
 *
 * Read from the theme PrepBench builds; outside it -- a component rendered on
 * its own, as tests do -- the same values for MUI's default mode, rather than
 * a crash on a palette entry only PrepBench's theme defines.
 */
export const usePb = (): Tokens => {
  const theme = useTheme();
  return (theme.palette as { pb?: Tokens }).pb ?? TOKENS[theme.palette.mode === 'dark' ? 'dark' : 'light'];
};
