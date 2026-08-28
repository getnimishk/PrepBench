// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Card, CardContent, Typography, Box, alpha, useTheme } from '@mui/material';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, icon: Icon, color }) => {
  const theme = useTheme();
  // The `color` prop was accepted and then ignored: the icon tile hardcoded the
  // theme primary, so the four dashboard cards all rendered the same colour
  // while their call sites each asked for a different one.
  const accent = color ?? theme.palette.primary.main;

  return (
    <Card
      sx={{
        height: '100%',
        borderRadius: 3,
        boxShadow: 'none',
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>
              {title}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              width: 48,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '14px',
              bgcolor: alpha(accent, 0.1),
              color: accent,
            }}
          >
            <Icon size={24} />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};