// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { AppBar, Toolbar, Typography, IconButton, Box, Chip, Tooltip, useTheme } from '@mui/material';
import { Moon, Sun, ShieldCheck, Sparkles } from 'lucide-react';
import { useThemeMode } from '../../context/ThemeContext';

export const Navbar: React.FC = () => {
  const { mode, toggleTheme } = useThemeMode();
  const theme = useTheme();

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: 'background.default',
        color: 'text.primary',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Toolbar>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexGrow: 1 }}>
          <Box
            sx={{
              p: 1.25,
              bgcolor: 'primary.main',
              borderRadius: '100px',
              display: 'flex',
              color: 'primary.contrastText',
            }}
          >
            <Sparkles size={22} />
          </Box>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: 'primary.main',
            }}
          >
            PrepBench
          </Typography>
          <Chip
            label="100% Offline"
            size="small"
            icon={<ShieldCheck size={14} color={theme.palette.success.main} />}
            sx={{
              ml: 1,
              bgcolor: 'surfaceContainer.main',
              border: '1px solid',
              borderColor: 'divider',
              fontWeight: 600,
              color: 'text.primary',
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