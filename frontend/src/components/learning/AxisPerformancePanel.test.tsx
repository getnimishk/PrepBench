// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxisPerformancePanel } from './AxisPerformancePanel';
import { DesignReviewAnalytics } from '../../types/designReview';

const GRADED: DesignReviewAnalytics = {
  total_attempts: 6,
  graded_attempts: 6,
  reviews_completed: 4,
  reviews_available: 10,
  by_axis: [
    { axis_label: 'Cost', attempts: 3, named: 0, partial: 1, missed: 2, named_rate: 0 },
    { axis_label: 'Freshness', attempts: 3, named: 3, partial: 0, missed: 0, named_rate: 1 },
  ],
  weakest_axis: { axis_label: 'Cost', attempts: 3, named: 0, partial: 1, missed: 2, named_rate: 0 },
};

describe('AxisPerformancePanel', () => {
  it('names the weakest axis in a sentence, not a percentage', () => {
    render(<AxisPerformancePanel analytics={GRADED} />);
    // The sentence is the point of the panel: "you miss Cost most, named it in
    // 0 of 3" is actionable in a way a bare number is not.
    expect(screen.getByText(/you miss/i)).toBeInTheDocument();
    expect(screen.getByText(/named it in\s*0\s*of\s*3/i)).toBeInTheDocument();
  });

  it('offers to filter practice down to the axis being missed', async () => {
    const onPractiseAxis = vi.fn();
    const user = userEvent.setup();
    render(<AxisPerformancePanel analytics={GRADED} onPractiseAxis={onPractiseAxis} />);

    await user.click(screen.getByRole('button', { name: /practise cost/i }));
    expect(onPractiseAxis).toHaveBeenCalledWith('Cost');
  });

  it('asks for a provider rather than showing zeros when attempts exist but none are graded', () => {
    render(
      <AxisPerformancePanel
        analytics={{
          total_attempts: 4,
          graded_attempts: 0,
          reviews_completed: 4,
          reviews_available: 10,
          by_axis: [],
          weakest_axis: null,
        }}
      />
    );
    expect(screen.getByText(/none have been graded yet/i)).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.queryByText(/you miss/i)).not.toBeInTheDocument();
  });

  it('invites a first attempt when nothing has been done at all', () => {
    render(
      <AxisPerformancePanel
        analytics={{
          total_attempts: 0,
          graded_attempts: 0,
          reviews_completed: 0,
          reviews_available: 10,
          by_axis: [],
          weakest_axis: null,
        }}
      />
    );
    expect(screen.getByText(/complete a design review to see/i)).toBeInTheDocument();
  });
});
