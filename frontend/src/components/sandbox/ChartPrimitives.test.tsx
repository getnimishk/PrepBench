import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { ChartPayload } from '../../services/metrics/chartData';
import {
  BarChartView,
  LineChartView,
  ScatterChartView,
  StackedAreaChartView,
} from './ChartPrimitives';

// jsdom has no canvas, so chart.js cannot actually draw here. These tests
// capture the OPTIONS each primitive hands to chart.js instead, which is
// where the design rules that matter live.
const captured: Record<string, unknown>[] = [];

vi.mock('react-chartjs-2', () => {
  const spy = (props: { options: Record<string, unknown> }) => {
    captured.push(props.options);
    return <div data-testid="chart" />;
  };
  return { Line: spy, Bar: spy, Scatter: spy };
});

const payload = (over: Partial<ChartPayload> = {}): ChartPayload => ({
  viewId: 'velocity',
  title: 'Velocity',
  xLabel: 'Sprint',
  yLabel: 'Items',
  unit: 'count',
  labels: ['S1', 'S2'],
  series: [{ label: 'Velocity', data: [10, 11] }],
  reading: 'x',
  ...over,
});

describe('chart primitives', () => {
  it('renders every primitive with animation switched off', () => {
    // "No animation on re-render. A transition between slider positions reads
    // as motion rather than as difference."
    //
    // chart.js animates by default, so this is opt-out, not opt-in -- exactly
    // the kind of rule that is silently lost. The eye follows a travelling
    // line instead of comparing start against end, and the tween adds lag
    // between hand and chart, which is the one attachment the sandbox cannot
    // afford to break.
    captured.length = 0;

    render(<LineChartView payload={payload()} />);
    render(<BarChartView payload={payload()} />);
    render(<StackedAreaChartView payload={payload()} />);
    render(
      <ScatterChartView
        payload={payload({ points: [{ x: 1, y: 2 }], percentiles: [{ label: '85th', value: 2 }] })}
      />,
    );

    expect(captured).toHaveLength(4);
    for (const options of captured) {
      expect(options.animation, 'a primitive is animating between slider positions').toBe(false);
    }
  });
});
