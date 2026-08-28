// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Box, Typography, LinearProgress } from '@mui/material';

export interface CategoryScoreItem {
  category: string;
  score: number;
  max_score: number;
  feedback: string;
}

export const scoreColor = (pct: number): 'success' | 'warning' | 'error' => {
  if (pct >= 70) return 'success';
  if (pct >= 40) return 'warning';
  return 'error';
};

interface Props {
  scores: CategoryScoreItem[];
  gap?: number;
}

/**
 * Category label + score/max_score + colored progress bar + feedback caption,
 * repeated per category. Was duplicated independently in SystemDesignResultsPage,
 * InterviewPracticeResultsPage, and RecordingsPage before being extracted here.
 */
export const CategoryScoreList: React.FC<Props> = ({ scores, gap = 1.5 }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap }}>
    {scores.map((c) => {
      const pct = c.max_score > 0 ? (c.score / c.max_score) * 100 : 0;
      return (
        <Box key={c.category}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{c.category}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: `${scoreColor(pct)}.main` }}>
              {c.score}/{c.max_score}
            </Typography>
          </Box>
          <LinearProgress variant="determinate" value={pct} color={scoreColor(pct)} sx={{ height: 6, borderRadius: 3, mb: 0.5 }} />
          <Typography variant="caption" color="text.secondary">{c.feedback}</Typography>
        </Box>
      );
    })}
  </Box>
);
