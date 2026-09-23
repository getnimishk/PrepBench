// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { DesignReviewAnalytics } from '../../types/designReview';
import { Bar, Detail, Eyebrow, Panel, PanelHead, Pill, Section } from '../ui/primitives';

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
      <Section>
        <Panel soft component="section" aria-label="Which decisions you spot">
          <Eyebrow>Which decisions you spot</Eyebrow>
          <Detail sx={{ mt: '4px' }}>
            Your answers are saved. None have been graded yet, so there is
            nothing to report on which factors you tend to miss.{' '}
            <Box component="a" href="/settings/ai" sx={{ color: 'primary.main' }}>
              Set up grading
            </Box>
            .
          </Detail>
        </Panel>
      </Section>
    );
  }

  return (
    <Section>
      <Panel component="section" aria-label="Which decisions you spot">
        <PanelHead
          eyebrow="Which decisions you spot"
          title={weakest ? (
            <>
              You miss <strong>{weakest.axis_label}</strong> most — named it in{' '}
              {weakest.named} of {weakest.attempts} graded{' '}
              {weakest.attempts === 1 ? 'attempt' : 'attempts'}.
            </>
          ) : 'Every axis you have met, by how often you named it'}
          aside={weakest && onPractiseAxis ? (
            <Button variant="outlined" onClick={() => onPractiseAxis(weakest.axis_label)}>
              Practise {weakest.axis_label}
            </Button>
          ) : undefined}
        />

        <Box sx={{ display: 'grid', gap: '12px' }}>
          {byAxis.map((axis) => {
            const rate = axis.named_rate ?? 0;
            return (
              <Box key={axis.axis_label}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '8px', mb: '4px' }}>
                  <Typography variant="body1" component="span" sx={{ fontWeight: 600, flexGrow: 1 }}>
                    {axis.axis_label}
                  </Typography>
                  <Detail component="span">named {axis.named}/{axis.attempts}</Detail>
                  {axis.partial > 0 && <Pill tone="warning">{axis.partial} partial</Pill>}
                </Box>
                <Bar
                  value={pct(rate)}
                  label={`${axis.axis_label}: named ${axis.named} of ${axis.attempts}`}
                  color={rate >= 0.7 ? 'success' : rate >= 0.4 ? 'warning' : 'error'}
                />
              </Box>
            );
          })}
        </Box>

        <Detail sx={{ mt: '12px' }}>
          {analytics.reviews_completed} of {analytics.reviews_available} reviews attempted · {graded} graded
        </Detail>
      </Panel>
    </Section>
  );
};
