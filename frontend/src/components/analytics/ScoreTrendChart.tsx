import React, { useRef, useEffect, useState } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

interface Props {
  trends: ScoreTrendPoint[];
  label?: string;
  rollingLabel?: string;
  emptyMessage?: string;
}

export const ScoreTrendChart: React.FC<Props> = ({
  trends,
  label = 'Exam Score %',
  rollingLabel = '5-Exam Rolling Avg %',
  emptyMessage = 'Complete an exam to see your score trend here.',
}) => {
  const theme = useTheme();
  const chartRef = useRef<any>(null);
  const [chartData, setChartData] = useState<any>(null);

  // Backend dates are day-precision only ("Aug 07"), so same-day entries collide.
  // Disambiguate repeated labels with an occurrence suffix; the tooltip title
  // still shows the full exam title + date regardless.
  const dateOccurrence = new Map<string, number>();
  const labels = trends.map((t) => {
    const seen = (dateOccurrence.get(t.date) ?? 0) + 1;
    dateOccurrence.set(t.date, seen);
    return seen === 1 ? t.date : `${t.date} (${seen})`;
  });
  const scores = trends.map((t) => t.score);
  const rolling = trends.map((t) => t.rolling_avg);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || trends.length === 0) return;

    const ctx = chart.ctx;
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

    setChartData({
      labels,
      datasets: [
        {
          label,
          data: scores,
          borderColor: '#6366F1',
          pointBackgroundColor: '#6366F1',
          backgroundColor: gradient,
          fill: true,
          tension: 0.3,
        },
        {
          label: rollingLabel,
          data: rolling,
          borderColor: '#D946EF',
          pointBackgroundColor: '#D946EF',
          backgroundColor: 'transparent',
          borderDash: [5, 5],
          tension: 0.3,
        },
      ],
    });
  }, [trends, label, rollingLabel]);

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
      {
        label,
        data: scores,
        borderColor: '#6366F1',
        pointBackgroundColor: '#6366F1',
        tension: 0.3,
      },
      {
        label: rollingLabel,
        data: rolling,
        borderColor: '#D946EF',
        pointBackgroundColor: '#D946EF',
        borderDash: [5, 5],
        tension: 0.3,
      },
    ],
  };

  const gridColor = theme.palette.divider;
  const textColor = theme.palette.text.secondary;
  const legendColor = theme.palette.text.primary;

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        min: 0,
        max: 100,
        grid: { color: gridColor },
        ticks: { color: textColor },
      },
      x: {
        grid: { color: gridColor },
        ticks: { color: textColor },
      },
    },
    plugins: {
      legend: { labels: { color: legendColor } },
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

  return <Line ref={chartRef} data={chartData || defaultData} options={options} />;
};
