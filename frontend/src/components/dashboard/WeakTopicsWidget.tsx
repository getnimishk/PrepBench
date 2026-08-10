import React from 'react';
import { Card, CardContent, Typography, Box, LinearProgress } from '@mui/material';
import { TopicMasteryItem } from '../../types/analytics';

interface Props {
  topics: TopicMasteryItem[];
}

export const WeakTopicsWidget: React.FC<Props> = ({ topics }) => {
  return (
    <Card sx={{ height: '100%', borderRadius: 3, boxShadow: 'none', bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
          Weak Areas Requiring Attention (&lt;70%)
        </Typography>
        {topics.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No weak areas detected yet! Complete more practice exams to see targeted recommendations.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {topics.map((t) => {
              let barColor: 'success' | 'warning' | 'error' = 'success';
              if (t.accuracy_percentage < 40) {
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