// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useRef, useEffect, useState } from 'react';
import { Box, Typography, alpha, useTheme } from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { ScoreTrendPoint } from '../../types/analytics';
import { usePb } from '../../theme/usePb';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

interface Props {
  trends: ScoreTrendPoint[];
  label?: string;
  rollingLabel?: string;
  emptyMessage?: string;
  /**
   * What the scores are drawn out of. The data always arrives out of 100; a
   * surface that states its scores out of ten (System Design) draws them so.
   */
  outOf?: 100 | 10;
}

export const ScoreTrendChart: React.FC<Props> = ({
  trends,
  label = 'Exam score %',
  rollingLabel = '5-exam rolling average %',
  emptyMessage = 'Complete an exam to see your score trend here.',
  outOf = 100,
}) => {
  const theme = useTheme();
  const pb = usePb();
  const chartRef = useRef<any>(null);
  const [chartData, setChartData] = useState<any>(null);

  // The prototype's colours: the accent for the scores, a quiet dashed line
  // for the average under them.
  const accent = theme.palette.primary.main;
  const quiet = pb.faint;
  const scale = (v: number) => (outOf === 10 ? v / 10 : v);
  const unit = outOf === 10 ? ' / 10' : '%';
  const figure = (v: number) => (outOf === 10 ? scale(v).toFixed(1) : String(Math.round(v)));

  // Backend dates are day-precision only ("Aug 07"), so same-day entries collide.
  // Disambiguate repeated labels with an occurrence suffix; the tooltip title
  // still shows the full exam title + date regardless.
  const dateOccurrence = new Map<string, number>();
  const labels = trends.map((t) => {
    const seen = (dateOccurrence.get(t.date) ?? 0) + 1;
    dateOccurrence.set(t.date, seen);
    return seen === 1 ? t.date : `${t.date} (${seen})`;
  });
  const scores = trends.map((t) => scale(t.score));
  const rolling = trends.map((t) => scale(t.rolling_avg));

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || trends.length === 0) return;

    const ctx = chart.ctx;
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, alpha(accent, 0.22));
    gradient.addColorStop(1, alpha(accent, 0));

    setChartData({
      labels,
      datasets: [
        {
          label,
          data: scores,
          borderColor: accent,
          pointBackgroundColor: accent,
          backgroundColor: gradient,
          fill: true,
          tension: 0.3,
        },
        {
          label: rollingLabel,
          data: rolling,
          borderColor: quiet,
          pointBackgroundColor: quiet,
          backgroundColor: 'transparent',
          borderDash: [5, 5],
          tension: 0.3,
        },
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trends, label, rollingLabel, accent, quiet, outOf]);

  if (trends.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200 }}>
        <Typography variant="body2" color="text.secondary">
          {emptyMessage}
        </Typography>
      </Box>
    );
  }

  const defaultData = {
    labels,
    datasets: [
      { label, data: scores, borderColor: accent, pointBackgroundColor: accent, tension: 0.3 },
      { label: rollingLabel, data: rolling, borderColor: quiet, pointBackgroundColor: quiet, borderDash: [5, 5], tension: 0.3 },
    ],
  };

  const gridColor = pb.line;
  const textColor = pb.muted;

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        min: 0,
        max: outOf,
        grid: { color: gridColor },
        ticks: { color: textColor },
      },
      x: {
        grid: { display: false },
        ticks: { color: textColor },
      },
    },
    plugins: {
      legend: { labels: { color: pb.text, boxWidth: 12, boxHeight: 12 } },
      tooltip: {
        callbacks: {
          title: (items: any[]) => {
            const idx = items[0]?.dataIndex ?? 0;
            const t = trends[idx];
            return t ? `${t.exam_title} — ${t.date}` : '';
          },
        },
      },
    },
  };

  const last = trends[trends.length - 1];
  const described = `${label}: ${trends.length} ${trends.length === 1 ? 'session' : 'sessions'}, latest ${figure(last.score)}${unit}, `
    + `${rollingLabel} ${figure(last.rolling_avg)}${unit}.`;
  return <Line ref={chartRef} data={chartData || defaultData} options={options} aria-label={described} role="img" />;
};
