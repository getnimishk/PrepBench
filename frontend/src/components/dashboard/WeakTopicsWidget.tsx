// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Card, CardContent, Typography, Box, LinearProgress } from '@mui/material';
import { TopicMasteryItem } from '../../types/analytics';

interface Props {
  topics: TopicMasteryItem[];
  /** Overridable so the same widget can show strong areas too. Showing only
   *  what someone is worst at is a bleak way to open a page. */
  title?: string;
  emptyMessage?: string;
  /** Strong topics are all above the threshold, so the weak-area colour ramp
   *  would paint every bar the same green and say nothing. */
  colorByAccuracy?: boolean;
}

export const WeakTopicsWidget: React.FC<Props> = ({
  topics,
  title = 'Weak Areas Requiring Attention (<70%)',
  emptyMessage = 'No weak areas detected yet! Complete more practice exams to see targeted recommendations.',
  colorByAccuracy = true,
}) => {
  return (
    <Card sx={{ height: '100%', borderRadius: 3, boxShadow: 'none', bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
          {title}
        </Typography>
        {topics.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {emptyMessage}
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {topics.map((t) => {
              let barColor: 'success' | 'warning' | 'error' = 'success';
              if (!colorByAccuracy) {
                // Left green: everything here is already above the bar.
              } else if (t.accuracy_percentage < 40) {
                barColor = 'error';
              } else if (t.accuracy_percentage < 60) {
                barColor = 'warning';
              } else if (t.accuracy_percentage < 70) {
                barColor = 'warning';
              }

              return (
                <Box key={t.topic}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {t.topic}
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: `${barColor}.main` }}>
                      {t.accuracy_percentage}% Correct ({t.correct_count}/{t.total_attempted})
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={t.accuracy_percentage}
                    color={barColor}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      bgcolor: 'action.hover',
                    }}
                  />
                </Box>
              );
            })}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};