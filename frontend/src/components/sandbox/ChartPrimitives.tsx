import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import type { ChartDataset, TooltipItem } from 'chart.js';
import { Line, Bar, Scatter } from 'react-chartjs-2';
import type { ChartPrimitive } from '../../types/agileMetrics';
import type { ChartPayload, ChartUnit, ScatterPoint } from '../../services/metrics/chartData';

type ScatterPointData = ScatterPoint;

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

// The four renderers, kept in one module on purpose.
//
// They are named after primitives, not after charts: a burndown and a burnup
// are not two components, they are one line renderer given different series.
// Four cover all twenty-seven views. They share their entire theming and
// axis-formatting story, and splitting them across four files would mean
// either duplicating that or inventing a fifth module to hold it.
//
// None of them knows what it is drawing. That is deliberate -- the moment a
// renderer special-cases "burndown", the next chart wants its own special
// case and the four primitives quietly become twenty-seven components.

/**
 * Series colours. Chosen to stay legible on both the light and dark app
 * themes rather than pulled from the palette, which shifts between them.
 */
const SERIES_COLORS = ['#6366F1', '#14B8A6', '#F59E0B', '#EC4899'];

function formatValue(value: number, unit: ChartUnit): string {
  switch (unit) {
    case 'percent':
      return `${(value * 100).toFixed(1)}%`;
    case 'days':
      return `${value.toFixed(2)} d`;
    case 'hours':
      return `${value.toFixed(1)} h`;
    case 'rating':
      return `${value.toFixed(2)} / 5`;
    case 'perDay':
      return `${value.toFixed(2)} /day`;
    default:
      return value.toFixed(2);
  }
}

/** Axis and tooltip configuration shared by all four primitives. */
function useBaseOptions(payload: ChartPayload, stacked = false) {
  const theme = useTheme();
  const grid = theme.palette.divider;
  const tick = theme.palette.text.secondary;
  const legend = theme.palette.text.primary;

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    scales: {
      x: {
        stacked,
        title: { display: true, text: payload.xLabel, color: tick },
        grid: { color: grid },
        ticks: { color: tick, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
      },
      y: {
        stacked,
        beginAtZero: true,
        max: payload.yMax,
        title: { display: true, text: payload.yLabel, color: tick },
        grid: { color: grid },
        ticks: {
          color: tick,
          callback: (value: string | number) =>
            payload.unit === 'percent'
              ? `${(Number(value) * 100).toFixed(0)}%`
              : Number(value).toFixed(
                  payload.unit === 'count' || payload.unit === 'hours' ? 1 : 2,
                ),
        },
      },
    },
    plugins: {
      legend: { labels: { color: legend, boxWidth: 12 } },
      tooltip: {
        callbacks: {
          // `parsed.y` is nullable in chart.js -- a gap in a series is a real
          // state, not an error, and formatting `null` as "0.00" would draw a
          // reading that is not there.
          label: (item: TooltipItem<'line' | 'bar'>) =>
            item.parsed.y === null
              ? `${item.dataset.label}: no data`
              : `${item.dataset.label}: ${formatValue(item.parsed.y, payload.unit)}`,
        },
      },
    },
  };
}

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      minHeight: 200,
    }}
  >
    <Typography variant="body2" color="text.secondary">
      {message}
    </Typography>
  </Box>
);

export const LineChartView: React.FC<{ payload: ChartPayload }> = ({ payload }) => {
  const theme = useTheme();
  const options = useBaseOptions(payload);

  if (payload.series.length === 0) {
    return <EmptyState message="No series to plot for this view." />;
  }

  const data = {
    labels: payload.labels,
    datasets: payload.series.map((s, i) => ({
      label: s.label,
      data: s.data,
      // A reference line is a target or a threshold, not an observation.
      // Dashing it keeps the eye from reading a commitment as a measurement.
      borderColor: s.reference ? theme.palette.text.disabled : SERIES_COLORS[i % SERIES_COLORS.length],
      backgroundColor: s.reference ? 'transparent' : SERIES_COLORS[i % SERIES_COLORS.length],
      borderDash: s.reference ? [6, 4] : undefined,
      pointRadius: s.reference ? 0 : 2,
      borderWidth: 2,
      tension: 0.25,
      fill: false,
    })),
  };

  return <Line data={data} options={options} />;
};

export const BarChartView: React.FC<{ payload: ChartPayload }> = ({ payload }) => {
  const theme = useTheme();
  const options = useBaseOptions(payload);

  if (payload.series.length === 0) {
    return <EmptyState message="No series to plot for this view." />;
  }

  // A reference among bars reads as a line, not as another bar -- otherwise
  // the target competes visually with the thing being measured.
  //
  // chart.js supports mixing dataset types on one chart, but its generics
  // pin every dataset to the chart's own type, so a `line` among `bar`s is a
  // type error rather than an unsupported feature. The cast is narrowed to
  // the dataset array for that reason and nothing else.
  const datasets = payload.series.map((s, i) => ({
    type: s.reference ? 'line' : 'bar',
    label: s.label,
    data: s.data,
    borderColor: s.reference ? theme.palette.text.disabled : SERIES_COLORS[i % SERIES_COLORS.length],
    backgroundColor: s.reference
      ? 'transparent'
      : `${SERIES_COLORS[i % SERIES_COLORS.length]}CC`,
    borderDash: s.reference ? [6, 4] : undefined,
    pointRadius: 0,
    borderWidth: s.reference ? 2 : 0,
    borderRadius: s.reference ? 0 : 3,
  })) as unknown as ChartDataset<'bar', (number | null)[]>[];

  return <Bar data={{ labels: payload.labels, datasets }} options={options} />;
};

export const StackedAreaChartView: React.FC<{ payload: ChartPayload }> = ({ payload }) => {
  const options = useBaseOptions(payload, false);

  if (payload.series.length === 0) {
    return <EmptyState message="No bands to plot for this view." />;
  }

  // Bands are drawn largest-first so the smaller ones sit visibly on top.
  // A CFD's meaning lives entirely in the gaps between bands, so they must
  // not occlude one another.
  const data = {
    labels: payload.labels,
    datasets: payload.series.map((s, i) => ({
      label: s.label,
      data: s.data,
      borderColor: SERIES_COLORS[i % SERIES_COLORS.length],
      backgroundColor: `${SERIES_COLORS[i % SERIES_COLORS.length]}55`,
      fill: 'origin' as const,
      pointRadius: 0,
      borderWidth: 1.5,
      tension: 0,
    })),
  };

  return <Line data={data} options={options} />;
};

export const ScatterChartView: React.FC<{ payload: ChartPayload }> = ({ payload }) => {
  const theme = useTheme();
  const points = payload.points ?? [];

  if (points.length === 0) {
    return <EmptyState message="No completed items to plot yet." />;
  }

  const grid = theme.palette.divider;
  const tick = theme.palette.text.secondary;

  const xs = points.map((p) => p.x);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);

  const datasets = [
    {
      type: 'scatter',
      label: 'Completed items',
      data: points,
      backgroundColor: `${SERIES_COLORS[0]}AA`,
      pointRadius: 4,
    },
    // Percentile markers are what make a scatter actionable: the 85th is what
    // you can promise, and without it people quote the mean and miss half
    // their commitments.
    ...(payload.percentiles ?? []).map((p, i) => ({
      type: 'line',
      label: `${p.label} percentile — ${p.value.toFixed(2)}`,
      data: [
        { x: xMin, y: p.value },
        { x: xMax, y: p.value },
      ],
      borderColor: SERIES_COLORS[(i + 2) % SERIES_COLORS.length],
      borderDash: [6, 4],
      borderWidth: 2,
      pointRadius: 0,
      fill: false,
    })),
    // Same mixed-type constraint as the bar renderer: percentile markers are
    // lines drawn over a scatter, which chart.js renders and its types reject.
  ] as unknown as ChartDataset<'scatter', ScatterPointData[]>[];

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'linear' as const,
        title: { display: true, text: payload.xLabel, color: tick },
        grid: { color: grid },
        ticks: { color: tick },
      },
      y: {
        beginAtZero: true,
        title: { display: true, text: payload.yLabel, color: tick },
        grid: { color: grid },
        ticks: { color: tick },
      },
    },
    plugins: {
      legend: { labels: { color: theme.palette.text.primary, boxWidth: 12 } },
      tooltip: {
        callbacks: {
          // chart.js types both axes as nullable on a parsed point. A
          // scatter point with no coordinate is not a reading, so say so
          // rather than rendering "0.00 at 0.0".
          label: (item: TooltipItem<'scatter'>) =>
            item.parsed.y === null || item.parsed.x === null
              ? 'no data'
              : `${formatValue(item.parsed.y, payload.unit)} at ${item.parsed.x.toFixed(1)}`,
        },
      },
    },
  };

  return <Scatter data={{ datasets }} options={options} />;
};

/** Picks the renderer declared by the view's metadata. */
export const ChartPrimitiveView: React.FC<{
  primitive: ChartPrimitive;
  payload: ChartPayload;
}> = ({ primitive, payload }) => {
  switch (primitive) {
    case 'line':
      return <LineChartView payload={payload} />;
    case 'bar':
      return <BarChartView payload={payload} />;
    case 'stackedArea':
      return <StackedAreaChartView payload={payload} />;
    case 'scatter':
      return <ScatterChartView payload={payload} />;
  }
};
