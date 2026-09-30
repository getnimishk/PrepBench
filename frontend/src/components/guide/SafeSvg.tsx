// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Box } from '@mui/material';
import { Note } from '../ui/primitives';
import { MONO_STACK } from '../../theme/tokens';
import { sanitizeSvg } from './sanitizeSvg';
import { diagramMaxWidth, diagramMinWidth, extractSvgAlt } from './guideUtils';

export const SafeSvg: React.FC<{ source: string }> = ({ source }) => {
  const result = sanitizeSvg(source);

  if (!result.ok) {
    return (
      <Box sx={{ my: '14px' }}>
        <Note role="alert">
          <b>SVG could not be rendered:</b> {result.reason}
        </Note>
        <Box
          component="pre"
          sx={{
            mt: '8px',
            p: '11px 12px',
            borderRadius: '9px',
            bgcolor: 'pb.surface2',
            border: '1px solid',
            borderColor: 'divider',
            fontFamily: MONO_STACK,
            fontSize: (t) => t.typography.pxToRem(12),
            color: 'text.secondary',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
          }}
        >
          <code>{source}</code>
        </Box>
      </Box>
    );
  }

  const alt = extractSvgAlt(source);
  const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(source)}`;

  return (
    <Box component="figure" sx={{ m: 0, my: '16px', maxWidth: '100%' }}>
      <Box
        tabIndex={0}
        role="region"
        aria-label={alt}
        sx={{
          overflowX: 'auto',
          maxWidth: '100%',
          borderRadius: '8px',
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'pb.accent',
          },
        }}
      >
        <Box
          component="img"
          src={dataUri}
          alt={alt}
          sx={{
            display: 'block',
            width: '100%',
            minWidth: diagramMinWidth(source),
            maxWidth: diagramMaxWidth(source),
            height: 'auto',
          }}
        />
      </Box>
    </Box>
  );
};
