import React from 'react';
import { Box, Typography } from '@mui/material';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';
import { DomainMasteryItem } from '../../types/analytics';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface Props {
  domains: DomainMasteryItem[];
}

export const TopicRadarChart: React.FC<Props> = ({ domains }) => {
  if (domains.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200 }}>
        <Typography variant="body2" color="text.secondary">
          Complete an exam to see your domain mastery here.
        </Typography>
      </Box>
    );
  }

  const labels = domains.map((d) => d.domain);
  const dataValues = domains.map((d) => d.accuracy_percentage);

  const data = {
    labels,
    datasets: [
      {
        label: 'Domain Mastery %',
        data: dataValues,
        backgroundColor: 'rgba(99, 102, 241, 0.18)',
        borderColor: '#6366F1',
        borderWidth: 2,
        pointBackgroundColor: '#6366F1',
      },
    ],
  };

  const options = {
    scales: {
      r: {
        angleLines: { color: 'rgba(255, 255, 255, 0.06)' },
        grid: { color: 'rgba(255, 255, 255, 0.06)' },
        pointLabels: { color: '#A1A1AA', font: { size: 12 } },
        ticks: { color: '#A1A1AA', backdropColor: 'transparent' },
        min: 0,
        max: 100,
      },
    },
    plugins: {
      legend: { labels: { color: '#FAFAFA' } },
    },
  };

  return <Radar data={data} options={options} />;
};
