// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { NavLink } from 'react-router-dom';
import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Tooltip, IconButton, Typography, useTheme } from '@mui/material';
import { LayoutDashboard, PlayCircle, BookOpen, BarChart3, History, Settings, ChevronLeft, ChevronRight, Network, Mic, Headphones, Map, LineChart, Scale } from 'lucide-react';
import { useSidebar } from '../../App';

const DASHBOARD_ITEM = { label: 'Dashboard', path: '/', icon: LayoutDashboard };

// Grouped by what the user is trying to do, not by feature-add order --
// PrepBench's whole purpose is interview/exam prep, so the three ways to
// practice are grouped together and named as activities ("... Practice"),
// not left as a flat list of unrelated-looking links.
const PRACTICE_ITEMS = [
  { label: 'Exam Practice', path: '/exam-setup', icon: PlayCircle },
  { label: 'Design Review', path: '/design-reviews', icon: Scale },
  { label: 'System Design Practice', path: '/system-design', icon: Network },
  { label: 'Interview Practice', path: '/interview-practice', icon: Mic },
];

// Roadmaps straddle CONTENT (importable material) and PROGRESS (tracked
// state), so they get their own group rather than being filed under either
// and reading as the wrong kind of thing. One item for now.
const LEARN_ITEMS = [
  { label: 'Roadmaps', path: '/roadmaps', icon: Map },
  { label: 'Chart Sandbox', path: '/chart-sandbox', icon: LineChart },
];

const CONTENT_ITEMS = [
  { label: 'Question Bank', path: '/question-bank', icon: BookOpen },
  { label: 'Audio Recordings', path: '/recordings', icon: Headphones },
];

const PROGRESS_ITEMS = [
  { label: 'Analytics', path: '/analytics', icon: BarChart3 },
  { label: 'Exam History', path: '/history', icon: History },
  { label: 'System Design History', path: '/system-design/history', icon: Network },
  { label: 'Settings', path: '/settings', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const { collapsed, toggleCollapsed } = useSidebar();
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';

  const renderItems = (items: typeof PRACTICE_ITEMS) => {
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
              primary: { noWrap: true, sx: { fontWeight: 500, fontSize: '0.95rem' } }
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

  const renderSectionHeader = (title: string, mt: number = 2) => (
    <Typography
      variant="caption"
      sx={{
        px: 3,
        mt,
        mb: 1,
        display: 'block',
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: dark ? '#94A3B8' : '#64748B',
        opacity: collapsed ? 0 : 1,
        transition: 'opacity 0.3s',
        whiteSpace: 'nowrap',
      }}
    >
      {title}
    </Typography>
  );

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
        <List disablePadding>
          {renderItems([DASHBOARD_ITEM])}

          {renderSectionHeader('PRACTICE')}
          {renderItems(PRACTICE_ITEMS)}

          {renderSectionHeader('LEARN')}
          {renderItems(LEARN_ITEMS)}

          {renderSectionHeader('CONTENT')}
          {renderItems(CONTENT_ITEMS)}

          {renderSectionHeader('PROGRESS')}
          {renderItems(PROGRESS_ITEMS)}
        </List>
      </Box>
      <Box
        sx={{
          p: 2,
          borderTop: `1px solid ${dark ? '#1E1F22' : '#E2E8F0'}`,
          display: 'flex',
          justifyContent: collapsed ? 'center' : 'flex-end',
        }}
      >
        <IconButton
          onClick={toggleCollapsed}
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
