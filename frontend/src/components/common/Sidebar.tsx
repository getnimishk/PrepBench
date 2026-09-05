// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Tooltip,
  IconButton, useMediaQuery, useTheme,
} from '@mui/material';
import { LayoutDashboard, PlayCircle, BookOpen, History, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSidebar } from '../../App';

// Five destinations, and nothing nested inside them.
//
// This list used to be four groups containing ten formats, all expanded by
// default -- fourteen rows, in which "Chart Sandbox", "Question Bank" and
// "Audio Recordings" sat at the same weight as Practice itself. That is a
// feature inventory, not navigation: it grows every time the product gains a
// capability, and it asks a first-time reader to learn PrepBench's internal
// vocabulary before they can find anything.
//
// Verbs, because a person arrives wanting to do something. Formats are
// reached from inside the verb they belong to, where the page can say what
// each one is for. Subjects are reached from Home, which is what keeps this
// list the same length however many subjects arrive.
//
// Settings is not an activity, so it sits below the divider.
const NAV_ITEMS = [
  { label: 'Home', path: '/', icon: LayoutDashboard },
  { label: 'Practice', path: '/practice', icon: PlayCircle },
  { label: 'Learn', path: '/learn', icon: BookOpen },
  { label: 'Review', path: '/review', icon: History },
];

const SETTINGS_ITEM = { label: 'Settings', path: '/settings', icon: Settings };

type NavEntry = { label: string; path: string; icon: typeof LayoutDashboard };

export const Sidebar: React.FC = () => {
  const { collapsed: chosen, toggleCollapsed } = useSidebar();
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';

  // Collapsed on its own below md.
  //
  // 260px of a 375px phone is seventy per cent of the screen given to four
  // links, which squeezed the readiness verdict into two lines and wrapped
  // the score sequence onto three. The rail keeps its icons at 76px, and the
  // manual toggle is hidden there rather than offering to make it worse.
  const narrow = useMediaQuery(theme.breakpoints.down('md'));
  const collapsed = chosen || narrow;

  const renderItems = (items: NavEntry[]) => {
    return items.map((item) => {
      const Icon = item.icon;
      const buttonContent = (
        <ListItemButton
          component={NavLink}
          to={item.path}
          end={item.path === '/'}
          sx={{
            position: 'relative',
            minHeight: 48,
            px: 2,
            mx: 1.5,
            mb: 0.5,
            borderRadius: '100px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            transition: 'all 0.2s ease',
            color: 'text.secondary',
            '&:hover': {
              bgcolor: 'action.hover',
            },
            '&.active': {
              bgcolor: 'action.selected',
              color: 'primary.main',
              // MD3-style leading indicator, not a gradient -- solid role color.
              '&::before': {
                content: '""',
                position: 'absolute',
                left: 0,
                top: '20%',
                bottom: '20%',
                width: 3,
                borderRadius: '0 4px 4px 0',
                bgcolor: 'primary.main',
              },
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 0, mr: collapsed ? 0 : 2, justifyContent: 'center', color: 'inherit' }}>
            <Icon size={24} />
          </ListItemIcon>
          <ListItemText
            primary={item.label}
            sx={{
              opacity: collapsed ? 0 : 1,
              width: collapsed ? 0 : 'auto',
              overflow: 'hidden',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              m: 0,
            }}
            slotProps={{
              // Typography styling props moved into sx in MUI v9; noWrap is
              // still a real Typography prop and stays where it is.
              primary: {
                noWrap: true,
                sx: { fontWeight: 500, fontSize: '0.95rem' },
              }
            }}
          />
        </ListItemButton>
      );

      return (
        <ListItem key={item.path} disablePadding>
          {collapsed ? (
            <Tooltip title={item.label} placement="right" arrow>
              {buttonContent}
            </Tooltip>
          ) : (
            buttonContent
          )}
        </ListItem>
      );
    });
  };


  return (
    <Box
      sx={{
        width: collapsed ? 76 : 260,
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        borderRight: `1px solid ${dark ? '#1E1F22' : '#E2E8F0'}`,
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ flexGrow: 1, overflowY: 'auto', py: 2, overflowX: 'hidden' }}>
        <List disablePadding>{renderItems(NAV_ITEMS)}</List>
      </Box>
      {/* Configuration is not an activity, so it sits below the divider
          rather than inside the list of things you came here to do. */}
      <List disablePadding sx={{ borderTop: `1px solid ${dark ? '#1E1F22' : '#E2E8F0'}`, pt: 1 }}>
        {renderItems([SETTINGS_ITEM])}
      </List>
      <Box
        sx={{
          p: 2,
          borderTop: `1px solid ${dark ? '#1E1F22' : '#E2E8F0'}`,
          display: narrow ? 'none' : 'flex',
          justifyContent: collapsed ? 'center' : 'flex-end',
        }}
      >
        <IconButton
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
          size="small"
          sx={{
            color: dark ? '#E2E8F0' : '#475569',
            '&:hover': { bgcolor: dark ? '#1E1F22' : '#F1F5F9' },
          }}
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </IconButton>
      </Box>
    </Box>
  );
};
