import React, { useRef, useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
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
}

export const ScoreTrendChart: React.FC<Props> = ({ trends }) => {
  const chartRef = useRef<any>(null);
  const [chartData, setChartData] = useState<any>(null);

  const labels = trends.map((t) => t.date);
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
          label: 'Exam Score %',
          data: scores,
          borderColor: '#6366F1',
          pointBackgroundColor: '#6366F1',
          backgroundColor: gradient,
          fill: true,
          tension: 0.3,
        },
        {
          label: '5-Exam Rolling Avg %',
          data: rolling,
          borderColor: '#D946EF',
          pointBackgroundColor: '#D946EF',
          backgroundColor: 'transparent',
          borderDash: [5, 5],
          tension: 0.3,
        },
      ],
    });
  }, [trends]);

  if (trends.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200 }}>
        <Typography variant="body2" color="text.secondary">
          Complete an exam to see your score trend here.
        </Typography>
      </Box>
    );
  }

  const defaultData = {
    labels,
    datasets: [
      {
        label: 'Exam Score %',
        data: scores,
        borderColor: '#6366F1',
        pointBackgroundColor: '#6366F1',
        tension: 0.3,
      },
      {
        label: '5-Exam Rolling Avg %',
        data: rolling,
        borderColor: '#D946EF',
        pointBackgroundColor: '#D946EF',
        borderDash: [5, 5],
        tension: 0.3,
      },
    ],
  };

  const options = {
    responsive: true,
    scales: {
      y: {
        min: 0,
        max: 100,
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: { color: '#A1A1AA' },
      },
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: { color: '#A1A1AA' },
      },
    },
    plugins: {
      legend: { labels: { color: '#FAFAFA' } },
    },
  };

  return <Line ref={chartRef} data={chartData || defaultData} options={options} />;
};
