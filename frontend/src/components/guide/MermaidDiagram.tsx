// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { Note } from '../ui/primitives';
import { MONO_STACK } from '../../theme/tokens';
import { useDiagramTheme } from './useDiagramTheme';
import {
  diagramMaxWidth, diagramMinWidth, extractMermaidAlt, getNextMermaidId, queueMermaidRender, validateMermaidSource,
} from './guideUtils';

export const MermaidDiagram: React.FC<{ source: string }> = ({ source }) => {
  const { themeVariables, mode, fontSizePx } = useDiagramTheme();
  const [renderResult, setRenderResult] = useState<{
    loading: boolean;
    dataUri?: string;
    minWidth?: string;
    maxWidth?: string;
    error?: string;
  }>({ loading: true });

  const alt = extractMermaidAlt(source);

  useEffect(() => {
    const validation = validateMermaidSource(source);
    if (!validation.valid) {
      setRenderResult({ loading: false, error: validation.reason });
      return;
    }

    let cancelled = false;
    setRenderResult({ loading: true });

    void queueMermaidRender(async () => {
      if (cancelled) return;
      try {
        const mermaidModule = await import('mermaid');
        const mermaid = mermaidModule.default;

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'base',
          flowchart: {
            htmlLabels: false,
          },
          themeVariables,
        });

        const id = getNextMermaidId();

        try {
          const { svg } = await mermaid.render(id, source);
          if (!cancelled) {
            const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
            setRenderResult({
              loading: false, dataUri, minWidth: diagramMinWidth(svg), maxWidth: diagramMaxWidth(svg),
            });
          }
        } finally {
          const el = document.getElementById(id);
          if (el) el.remove();
          const dEl = document.getElementById(`d${id}`);
          if (dEl) dEl.remove();
          document.querySelectorAll(`[id^="${id}"], [id^="d${id}"]`).forEach((n) => n.remove());
        }
      } catch (err) {
        if (!cancelled) {
          setRenderResult({
            loading: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [source, themeVariables, mode, fontSizePx]);

  if (renderResult.error) {
    return (
      <Box sx={{ my: '14px' }}>
        <Note role="alert">
          <b>Diagram could not be rendered:</b> {renderResult.error}
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

  if (renderResult.loading) {
    return (
      <Box
        component="figure"
        aria-busy="true"
        aria-label="Rendering diagram"
        sx={{
          m: 0,
          my: '16px',
          p: '20px',
          borderRadius: '9px',
          bgcolor: 'pb.surface2',
          border: '1px dashed',
          borderColor: 'divider',
          textAlign: 'center',
        }}
      >
        <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
          Rendering diagram…
        </Typography>
      </Box>
    );
  }

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
          src={renderResult.dataUri}
          alt={alt}
          sx={{
            display: 'block',
            width: '100%',
            // Fit the column, but never larger than the diagram's own width, and never so small that its
            // text cannot be read: below that, the box scrolls sideways instead.
            minWidth: renderResult.minWidth,
            maxWidth: renderResult.maxWidth,
            height: 'auto',
          }}
        />
      </Box>
      <Box
        component="details"
        sx={{
          mt: '10px',
          fontSize: (t) => t.typography.pxToRem(12),
          color: 'text.secondary',
          '& > summary': {
            cursor: 'pointer',
            userSelect: 'none',
            fontWeight: 500,
            py: '4px',
            borderRadius: '4px',
            '&:focus-visible': {
              outline: '2px solid',
              outlineColor: 'pb.accent',
            },
          },
        }}
      >
        <Box component="summary">Diagram source</Box>
        <Box
          component="pre"
          sx={{
            mt: '6px',
            p: '10px 12px',
            borderRadius: '8px',
            bgcolor: 'pb.surface2',
            border: '1px solid',
            borderColor: 'divider',
            fontFamily: MONO_STACK,
            fontSize: (t) => t.typography.pxToRem(12),
            overflowX: 'auto',
            whiteSpace: 'pre',
          }}
        >
          <code>{source}</code>
        </Box>
      </Box>
    </Box>
  );
};
