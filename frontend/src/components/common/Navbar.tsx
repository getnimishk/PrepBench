import React from 'react';
import { AppBar, Toolbar, Typography, IconButton, Box, Chip, Tooltip, useTheme } from '@mui/material';
import { Moon, Sun, ShieldCheck, Sparkles } from 'lucide-react';
import { useThemeMode } from '../../context/ThemeContext';

export const Navbar: React.FC = () => {
  const { mode, toggleTheme } = useThemeMode();
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: dark ? '#131314' : '#F8F9FA',
        color: dark ? '#E2E8F0' : '#0F172A',
        borderBottom: `1px solid ${dark ? '#1E1F22' : '#E2E8F0'}`,
      }}
    >
      <Toolbar>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexGrow: 1 }}>
          <Box
            sx={{
              p: 1.25,
              bgcolor: dark ? '#A8C7FA' : '#0B57D0',
              borderRadius: '100px',
              display: 'flex',
              color: dark ? '#000000' : '#FFFFFF',
            }}
          >
            <Sparkles size={22} />
          </Box>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: dark ? '#A8C7FA' : '#0B57D0',
            }}
          >
            PrepBench
          </Typography>
          <Chip
            label="100% Offline"
            size="small"
            icon={<ShieldCheck size={14} color={dark ? '#8FDF8D' : '#146C2E'} />}
            sx={{
              ml: 1,
              bgcolor: dark ? '#1E1F22' : '#FFFFFF',
              border: `1px solid ${dark ? '#333' : '#E2E8F0'}`,
              fontWeight: 600,
              color: dark ? '#E2E8F0' : '#0F172A',
              borderRadius: '8px',
              '& .MuiChip-label': { px: 1 },
            }}
          />
        </Box>

        <Tooltip title={`Switch to ${mode === 'dark' ? 'Light' : 'Dark'} Mode`}>
          <IconButton
            onClick={toggleTheme}
            color="inherit"
          >
            {mode === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
};