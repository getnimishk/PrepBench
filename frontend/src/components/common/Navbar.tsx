// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { AppBar, Toolbar, Typography, IconButton, Box, Tooltip, alpha } from '@mui/material';
import { Moon, Search, Settings, Sun, Upload, User } from 'lucide-react';
import { useThemeMode } from '../../context/ThemeContext';
import { usePreparation } from '../../context/PreparationContext';
import { useImportLauncher } from '../../context/importLauncherContext';
import { useShortcuts } from '../../hooks/useShortcuts';
import { usePreferences } from '../../hooks/usePreferences';
import { initialsOf, useProfileName } from '../../hooks/useProfileName';
import { GLOBAL_SHORTCUTS } from '../../services/shortcuts';
import { NARROW_QUERY } from '../../theme/tokens';
import { usePb } from '../../theme/usePb';
import { PreparationPicker } from './PreparationPicker';
import { NotificationBell } from './NotificationBell';
import { HeaderAction } from './HeaderAction';
import { sectionFor } from './navigation';

// There is deliberately no "100% Offline" badge here any more.
//
// PrepBench ships an optional cloud provider path and a settings screen that
// helps you configure it. A permanent badge claiming otherwise is a trust
// problem rather than a copy problem: the one claim a privacy-first product
// cannot afford to get wrong is the privacy claim. Local-first is the
// accurate promise, and Settings is where it is made, next to the switch
// that changes it.
interface NavbarProps {
  /**
   * Drop everything except the brand and the theme toggle.
   *
   * Used by the focus layouts. While a round is being answered or a paper sat,
   * nothing on screen should belong to another part of the product -- and a
   * preparation picker in particular is a way to navigate away mid-recording and
   * lose the take.
   */
  minimal?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ minimal = false }) => {
  const t = usePb();
  const { mode, toggleTheme } = useThemeMode();
  const { shortcutsEnabled } = usePreferences();
  const location = useLocation();
  const navigate = useNavigate();
  const { selected } = usePreparation();
  const { openImport } = useImportLauncher();
  // Not read on the focus screens, which draw no avatar.
  const profileName = useProfileName(!minimal);
  const initials = initialsOf(profileName);

  // Where you are, in words: the section, and the preparation it is showing.
  // Nothing for an address nothing answers, rather than a guess at a section.
  const section = sectionFor(location.pathname).title;
  const context = section ? [section, selected?.name].filter(Boolean).join(' · ') : null;

  // "/" opens search from anywhere outside the focus screens, which draw the
  // minimal header and so never bind it.
  useShortcuts(
    [{ shortcut: GLOBAL_SHORTCUTS.search, run: () => navigate('/search') }],
    !minimal && location.pathname !== '/search',
  );

  const themeLabel = `Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`;

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        top: 0,
        zIndex: 40,
        bgcolor: alpha(t.surface, 0.96),
        backdropFilter: 'blur(14px)',
        color: t.text,
        borderBottom: `1px solid ${t.line}`,
        boxShadow: 'none',
      }}
    >
      <Toolbar
        disableGutters
        sx={{
          minHeight: '64px !important',
          height: 64,
          px: '25px',
          gap: '10px',
          [NARROW_QUERY]: { px: '13px', gap: '6px' },
        }}
      >
        {/* Only the focus screens name the product here; everywhere else the
            rail carries the name and the header names the screen. */}
        {minimal && (
          <Typography
            component="span"
            sx={{ fontSize: (t) => t.typography.pxToRem(21), fontWeight: 820, letterSpacing: '-0.04em', color: t.text, flexShrink: 0 }}
          >
            PrepBench
          </Typography>
        )}

        {!minimal && <PreparationPicker />}

        {!minimal && context && (
          <Typography
            noWrap
            data-testid="header-context"
            sx={{
              fontSize: (t) => t.typography.pxToRem(12), color: t.muted, minWidth: 0,
              '@media (max-width:1180px)': { display: 'none' },
            }}
          >
            {context}
          </Typography>
        )}

        <Box sx={{ flexGrow: 1 }} />

        {/* Not in focus mode: every one of these is a way out of a round in
            progress, which is exactly what the minimal header exists to remove. */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, [NARROW_QUERY]: { gap: '4px' } }}>
          {!minimal && (
            <HeaderAction
              label="Search"
              icon={<Search size={16} />}
              tooltip={shortcutsEnabled ? 'Search everything (/)' : 'Search everything'}
              to="/search"
            />
          )}
          {!minimal && <NotificationBell />}
          {!minimal && (
            <HeaderAction
              label="Import"
              icon={<Upload size={16} />}
              tooltip="Import questions: CSV, JSON, Excel or Markdown"
              onClick={openImport}
              sx={{ [NARROW_QUERY]: { display: 'none' } }}
            />
          )}

          {/* The prototype's word for what the button does: "Dark mode" while the page is light. */}
          <HeaderAction
            label={mode === 'dark' ? 'Light mode' : 'Dark mode'}
            icon={mode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            tooltip={themeLabel}
            onClick={toggleTheme}
            sx={{ [NARROW_QUERY]: { display: 'none' } }}
          />

          {!minimal && (
            <HeaderAction
              label="Settings"
              icon={<Settings size={16} />}
              tooltip="Settings"
              to="/settings"
              sx={{ [NARROW_QUERY]: { display: 'none' } }}
            />
          )}

          {!minimal && (
            <Tooltip title={profileName ? `Profile: ${profileName}` : 'Profile'}>
              <IconButton
                component={RouterLink}
                to="/profile"
                aria-label={profileName ? `Profile: ${profileName}` : 'Profile'}
                sx={{
                  width: 33, height: 33, p: 0, borderRadius: '50%', flexShrink: 0,
                  bgcolor: t.accentSoft, color: t.accent, fontSize: (t) => t.typography.pxToRem(10), fontWeight: 800,
                  '&:hover': { bgcolor: t.accentSoft, boxShadow: `0 0 0 2px ${t.accent}` },
                }}
              >
                {initials ?? <User size={15} />}
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};
