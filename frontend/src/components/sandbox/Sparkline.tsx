import React from 'react';

// A sparkline, drawn from the real series.
//
// Not a fifth primitive. The four chart primitives are chart.js views with
// axes, a legend, a reading and an entry in CHART_VIEWS; this has none of
// those and never appears in the inventory. It is an affordance on a number,
// and the constraint it exists to satisfy is that the number must not be the
// only thing that responds when a control moves.
//
// That constraint is the reason it is hand-drawn rather than decorative. If
// the outcome strip showed a generic upward wiggle, the page would be
// teaching that metrics have vibes. These are the same values the chart below
// plots, at the same sprints, in the same order.

interface Props {
  /** One value per sprint. Drawn as given -- never smoothed or resampled. */
  values: number[];
  width?: number;
  height?: number;
  /** Stroke colour. Defaults to the inherited text colour. */
  color?: string;
}

export const Sparkline: React.FC<Props> = ({ values, width = 120, height = 28, color }) => {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length < 2) return null;

  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = max - min;

  const pad = 2;
  const usable = height - pad * 2;
  const step = clean.length > 1 ? width / (clean.length - 1) : width;

  // A flat series is a real result -- turn capacity variation off and most of
  // these go perfectly flat. Centring it says "unchanged" honestly, where
  // scaling a zero span would either divide by zero or invent a wobble.
  const y = (v: number) => (span === 0 ? height / 2 : pad + usable - ((v - min) / span) * usable);

  const points = clean.map((v, i) => `${(i * step).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
  const lastX = (clean.length - 1) * step;
  const lastY = y(clean[clean.length - 1]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      // Decorative in the accessibility tree: the value and its change are
      // already announced as text beside it, so a second reading of the same
      // fact would be noise for a screen reader.
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color ?? 'currentColor'}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* The endpoint is the number in the card. Marking it ties the two
          together, so the figure reads as the end of a shape rather than as
          a standalone statistic. */}
      <circle cx={lastX} cy={lastY} r={2.2} fill={color ?? 'currentColor'} />
    </svg>
  );
};
