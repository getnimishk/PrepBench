// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { AppBar, Toolbar, Typography, IconButton, Box, Tooltip } from '@mui/material';
import { Moon, Sun, Sparkles } from 'lucide-react';
import { useThemeMode } from '../../context/ThemeContext';

// There is deliberately no "100% Offline" badge here any more.
//
// PrepBench ships an optional cloud provider path and a settings screen that
// helps you configure it. A permanent badge claiming otherwise is a trust
// problem rather than a copy problem: the one claim a privacy-first product
// cannot afford to get wrong is the privacy claim. Local-first is the
// accurate promise, and Settings is where it is made, next to the switch
// that changes it.
export const Navbar: React.FC = () => {
  const { mode, toggleTheme } = useThemeMode();

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