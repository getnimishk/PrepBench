// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { useMemo } from 'react';
import { useTheme } from '@mui/material';
import { usePb } from '../../theme/usePb';
import { FONT_STACK } from '../../theme/tokens';

export interface DiagramTheme {
  mode: 'light' | 'dark';
  textScale: number;
  fontSizePx: number;
  themeVariables: Record<string, string | boolean>;
  theme: 'base';
}

/**
 * Hook to build dynamic Mermaid theme variables from PrepBench design tokens.
 *
 * Follows the textScale = theme.typography.fontSize / 14 pattern to scale
 * diagram text when the Large-text accessibility setting is enabled.
 * Uses tokens from usePb() without any hard-coded hex colors.
 */
export function useDiagramTheme(): DiagramTheme {
  const muiTheme = useTheme();
  const pb = usePb();
  const mode = muiTheme.palette.mode === 'dark' ? 'dark' : 'light';
  const textScale = (muiTheme.typography.fontSize || 14) / 14;
  const fontSizePx = Math.round(14 * textScale);
  const diagramFontSize = `${fontSizePx}px`;

  const themeVariables = useMemo<Record<string, string | boolean>>(() => ({
    darkMode: mode === 'dark',
    fontFamily: FONT_STACK,
    fontSize: diagramFontSize,
    background: 'transparent',
    primaryColor: pb.surface2,
    primaryTextColor: pb.text,
    primaryBorderColor: pb.line,
    lineColor: pb.line,
    secondaryColor: pb.surface2,
    tertiaryColor: pb.bg,
    textColor: pb.text,
    mainBkg: pb.surface2,
    nodeBorder: pb.line,
    nodeTextColor: pb.text,
    clusterBkg: pb.surface,
    clusterBorder: pb.line,
    titleColor: pb.text,
    edgeLabelBackground: pb.surface,
    actorBkg: pb.surface2,
    actorBorder: pb.line,
    actorTextColor: pb.text,
    actorLineColor: pb.line,
    signalColor: pb.text,
    signalTextColor: pb.text,
    labelBoxBkgColor: pb.surface,
    labelBoxBorderColor: pb.line,
    labelTextColor: pb.text,
    loopTextColor: pb.text,
    noteBkgColor: pb.warningSoft,
    noteBorderColor: pb.noteLine,
    noteTextColor: pb.warning,
  }), [
    mode,
    fontSizePx,
    pb.surface2,
    pb.text,
    pb.line,
    pb.bg,
    pb.surface,
    pb.warningSoft,
    pb.noteLine,
    pb.warning,
  ]);

  return useMemo(() => ({
    mode,
    textScale,
    fontSizePx,
    themeVariables,
    theme: 'base',
  }), [mode, textScale, fontSizePx, themeVariables]);
}
