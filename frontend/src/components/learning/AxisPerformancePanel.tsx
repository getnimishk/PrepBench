// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import {
  Box, Card, CardContent, Typography, LinearProgress, Stack, Chip, Button,
} from '@mui/material';
import { Target } from 'lucide-react';
import { DesignReviewAnalytics } from '../../types/designReview';

interface AxisPerformancePanelProps {
  analytics: DesignReviewAnalytics;
  /** Jump straight into practising the axis being missed most. */
  onPractiseAxis?: (axisLabel: string) => void;
}

const pct = (rate: number) => Math.round(rate * 100);

/**
 * What the learner keeps missing, said in words.
 *
 * The point of this panel is the sentence, not the bars: "you have missed Cost
 * in 3 of 3 graded attempts" is actionable in a way a percentage is not. The
 * per-axis bars are supporting detail underneath it.
 */
export const AxisPerformancePanel: React.FC<AxisPerformancePanelProps> = ({
  analytics,
  onPractiseAxis,
}) => {
  const { weakest_axis: weakest, by_axis: byAxis, graded_attempts: graded } = analytics;

  // Nothing graded is not the same as scoring zero, so this says what is
  // missing rather than drawing an empty chart at 0%.
  if (graded === 0) {
    // A learner who has not asked about AI does not need to be told the
    // product has providers. The absence is stated as what it is -- nothing
    // graded yet -- and the setup route is a link for someone who wants it,
    // not the substance of the message.
    if (analytics.total_attempts === 0) return null;
    return (
      <Box sx={{ mb: 4 }}>
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
          Which decisions you spot
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
          Your answers are saved. None have been graded yet, so there is
          nothing to report on which factors you tend to miss.{' '}
          <Box component="a" href="/settings" sx={{ color: 'primary.main' }}>
            Set up grading
          </Box>
          .
        </Typography>
      </Box>
    );
  }

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
          Which decisions you spot
        </Typography>

        {weakest && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.5,
              mt: 1,
              mb: 2.5,
            }}
          >
            <Target size={20} style={{ marginTop: 2, flexShrink: 0 }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.35 }}>
                You miss <strong>{weakest.axis_label}</strong> most — named it in{' '}
                {weakest.named} of {weakest.attempts} graded{' '}
                {weakest.attempts === 1 ? 'attempt' : 'attempts'}.
              </Typography>
              {onPractiseAxis && (
                <Button
                  size="small"
                  sx={{ mt: 0.5, ml: -1 }}
                  onClick={() => onPractiseAxis(weakest.axis_label)}
                >
                  Practise {weakest.axis_label}
                </Button>
              )}
            </Box>
          </Box>
        )}

        <Stack spacing={1.5}>
          {byAxis.map((axis) => {
            const rate = axis.named_rate ?? 0;
            return (
              <Box key={axis.axis_label}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.25 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, flexGrow: 1 }}>
                    {axis.axis_label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    named {axis.named}/{axis.attempts}
                  </Typography>
                  {axis.partial > 0 && (
                    <Chip size="small" variant="outlined" label={`${axis.partial} partial`} />
                  )}
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={pct(rate)}
                  color={rate >= 0.7 ? 'success' : rate >= 0.4 ? 'warning' : 'error'}
                  sx={{ height: 6, borderRadius: 3 }}
                />
              </Box>
            );
          })}
        </Stack>

        <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'text.secondary' }}>
          {analytics.reviews_completed} of {analytics.reviews_available} reviews attempted ·{' '}
          {graded} graded
        </Typography>
      </CardContent>
    </Card>
  );
};
