// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Box, Typography } from '@mui/material';
import type { LabPicture, PictureTone } from '../../services/adfLab/definition';

/**
 * A model run drawn as lanes of cells: a partition's offsets, a broker's replicas, a consumer's
 * partitions. Plain boxes and text rather than an SVG, so the labels scale with Large text, wrap on a
 * phone, and read in order to a screen reader. Colours are the theme's tokens, and every tone also
 * has a legend entry in words, so nothing is said by colour alone.
 */

const VISUALLY_HIDDEN = {
  position: 'absolute', width: '1px', height: '1px', p: 0, m: '-1px', overflow: 'hidden', clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap', border: 0,
} as const;

const TONE: Record<PictureTone, { bg: string; border: string; text: string }> = {
  neutral: { bg: 'pb.surface', border: 'divider', text: 'text.primary' },
  good: { bg: 'pb.successSoft', border: 'pb.success', text: 'text.primary' },
  bad: { bg: 'pb.dangerSoft', border: 'pb.danger', text: 'text.primary' },
  warn: { bg: 'pb.warningSoft', border: 'pb.warning', text: 'text.primary' },
  accent: { bg: 'pb.accentSoft', border: 'pb.accent', text: 'text.primary' },
  muted: { bg: 'pb.surface2', border: 'divider', text: 'text.secondary' },
};

export const LabPictureView: React.FC<{ idPrefix: string; heading: string; picture: LabPicture }> = ({ idPrefix, heading, picture }) => (
  <Box
    component="figure"
    aria-labelledby={`${idPrefix}-picture`}
    sx={{ m: 0, mt: '10px', p: '12px', border: '1px solid', borderColor: 'divider', borderRadius: '8px', bgcolor: 'pb.surface2' }}
  >
    <Typography component="figcaption" id={`${idPrefix}-picture`} variant="body2" sx={{ fontWeight: 700, mb: '8px' }}>
      {heading}
    </Typography>
    <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gap: '10px' }}>
      {picture.lanes.map((lane) => (
        <Box component="li" key={lane.label}>
          <Typography variant="body2" component="p" sx={{ fontWeight: 600, mb: '4px' }}>{lane.label}</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'flex-start' }}>
            {lane.cells.length === 0 && (
              <Typography variant="body2" component="span" sx={{ color: 'text.secondary' }}>(empty)</Typography>
            )}
            {lane.cells.map((cell, i) => {
              const tone = TONE[cell.tone ?? 'neutral'];
              const markers = (lane.markers ?? []).filter((m) => m.at === i);
              return (
                <Box key={i} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: (t) => t.typography.pxToRem(34) }}>
                  <Box
                    component="span"
                    sx={{
                      px: '6px', py: '3px', minWidth: (t) => t.typography.pxToRem(30), textAlign: 'center',
                      border: '1px solid', borderColor: tone.border, bgcolor: tone.bg, color: tone.text, borderRadius: '4px',
                      fontSize: (t) => t.typography.pxToRem(13), lineHeight: 1.4, fontWeight: 600,
                    }}
                  >
                    {cell.spoken ? (
                      <>
                        <span aria-hidden="true">{cell.label}</span>
                        <Box component="span" sx={VISUALLY_HIDDEN}>{cell.spoken}</Box>
                      </>
                    ) : cell.label}
                  </Box>
                  {markers.map((m) => (
                    <Typography key={m.label} component="span" sx={{ fontSize: (t) => t.typography.pxToRem(11.5), color: 'text.secondary', mt: '2px', whiteSpace: 'nowrap' }}>
                      ▲ {m.label}
                    </Typography>
                  ))}
                </Box>
              );
            })}
            {(lane.markers ?? []).filter((m) => m.at >= lane.cells.length).map((m) => (
              <Typography key={m.label} component="span" sx={{ fontSize: (t) => t.typography.pxToRem(11.5), color: 'text.secondary', alignSelf: 'center', ml: '4px' }}>
                ◀ {m.label}
              </Typography>
            ))}
          </Box>
          {lane.note && (
            <Typography variant="body2" component="p" sx={{ color: 'text.secondary', mt: '4px' }}>{lane.note}</Typography>
          )}
        </Box>
      ))}
    </Box>
    {picture.legend && picture.legend.length > 0 && (
      <Box component="ul" aria-label="Key" sx={{ listStyle: 'none', p: 0, m: 0, mt: '10px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        {picture.legend.map((l) => (
          <Box component="li" key={l.tone} sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Box component="span" aria-hidden="true" sx={{ width: 12, height: 12, borderRadius: '3px', border: '1px solid', borderColor: TONE[l.tone].border, bgcolor: TONE[l.tone].bg }} />
            <Typography variant="body2" component="span">{l.label}</Typography>
          </Box>
        ))}
      </Box>
    )}
  </Box>
);
