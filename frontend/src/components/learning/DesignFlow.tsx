// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { ChevronRight } from 'lucide-react';
import { FlowStage } from '../../types/designReview';

interface DesignFlowProps {
  stages: FlowStage[];
}

/**
 * The pipeline as boxes and arrows.
 *
 * Rendered from structured stages rather than a diagram source string, so it
 * needs no diagram library, inherits the app's theme automatically, and stays
 * writable by hand in the seed file. These pipelines are linear, so a row of
 * chips says everything a rendered graph would.
 *
 * The emphasised stage is where the option's cost or risk actually sits --
 * marking it is the difference between a diagram and an even row of boxes.
 */
export const DesignFlow: React.FC<DesignFlowProps> = ({ stages }) => {
  const theme = useTheme();

  if (!stages.length) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        flexWrap: 'wrap',
        gap: 0.5,
      }}
    >
      {stages.map((stage, i) => (
        <React.Fragment key={`${stage.label}-${i}`}>
          <Box
            sx={{
              flex: '1 1 auto',
              minWidth: 96,
              px: 1.25,
              py: 0.75,
              borderRadius: 1,
              border: '1px solid',
              borderColor: stage.emphasis ? 'warning.main' : 'divider',
              bgcolor: stage.emphasis
                ? theme.palette.mode === 'dark'
                  ? 'rgba(255,180,161,0.10)'
                  : 'rgba(143,76,56,0.07)'
                : 'transparent',
            }}
          >
            <Typography
              variant="caption"
              sx={{ display: 'block', fontWeight: 600, lineHeight: 1.3 }}
            >
              {stage.label}
            </Typography>
            {stage.detail && (
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  color: stage.emphasis ? 'warning.main' : 'text.secondary',
                  fontSize: '0.68rem',
                  lineHeight: 1.35,
                }}
              >
                {stage.detail}
              </Typography>
            )}
          </Box>
          {i < stages.length - 1 && (
            <Box
              aria-hidden="true"
              sx={{ display: 'flex', alignItems: 'center', color: 'text.disabled' }}
            >
              <ChevronRight size={14} />
            </Box>
          )}
        </React.Fragment>
      ))}
    </Box>
  );
};
