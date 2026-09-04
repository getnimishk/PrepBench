// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Tooltip, IconButton, Collapse, Typography, useTheme } from '@mui/material';
import { LayoutDashboard, PlayCircle, BookOpen, BarChart3, History, Settings, ChevronLeft, ChevronRight, ChevronDown, Network, Mic, Headphones, Map, LineChart, Scale } from 'lucide-react';
import { useSidebar } from '../../App';

// Four groups, and it stays four.
//
// The navigation grows with SUBJECTS, not with formats. Subjects live on
// Home rather than in this list, so adding Databricks or AI changes nothing
// here. Formats are a closed set -- exams, design review, system design,
// interviews, sandboxes -- and they nest under the verb they belong to.
//
// Verbs rather than nouns because a person arrives wanting to do something.
// Settings is not one of those things, so it sits below the divider instead
// of being filed under "progress", which is where it used to be.
const HOME_ITEM = { label: 'Home', path: '/', icon: LayoutDashboard };

const NAV_GROUPS = [
  {
    label: 'Practice',
    path: '/practice',
    icon: PlayCircle,
    children: [
      { label: 'Exams', path: '/exam-setup', icon: PlayCircle },
      { label: 'Design Review', path: '/design-reviews', icon: Scale },
      { label: 'System Design', path: '/system-design', icon: Network },
      { label: 'Interview Practice', path: '/interview-practice', icon: Mic },
      { label: 'Chart Sandbox', path: '/chart-sandbox', icon: LineChart },
    ],
  },
  {
    label: 'Learn',
    path: '/learn',
    icon: BookOpen,
    children: [
      { label: 'Roadmaps', path: '/roadmaps', icon: Map },
      { label: 'Question Bank', path: '/question-bank', icon: BookOpen },
    ],
  },
  {
    label: 'Review',
    path: '/review',
    icon: History,
    children: [
      { label: 'Activity', path: '/review', icon: History },
      { label: 'Analytics', path: '/analytics', icon: BarChart3 },
      { label: 'Audio Recordings', path: '/recordings', icon: Headphones },
    ],
  },
];

const SETTINGS_ITEM = { label: 'Settings', path: '/settings', icon: Settings };

type NavEntry = { label: string; path: string; icon: typeof LayoutDashboard };

export const Sidebar: React.FC = () => {
  const { collapsed, toggleCollapsed } = useSidebar();
  // Everything open by default: the formats are the point of the list, and
  // hiding them behind a click would make them harder to find than the flat
  // list this replaced.
  const [open, setOpen] = useState<Record<string, boolean>>(
    () => Object.fromEntries(NAV_GROUPS.map((g) => [g.label, true]))
  );
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';

  const renderItems = (items: NavEntry[], nested = false) => {
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
            pl: nested && !collapsed ? 5 : 2,
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
            <Icon size={nested ? 20 : 24} />
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
                sx: { fontWeight: nested ? 400 : 500, fontSize: nested ? '0.88rem' : '0.95rem' },
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
        <List disablePadding>
          {renderItems([HOME_ITEM])}

          {NAV_GROUPS.map((group) => (
            <React.Fragment key={group.label}>
              {/* The group header is both a destination and a toggle: clicking
                  the label opens the hub overview, clicking the chevron just
                  expands. Collapsing the whole sidebar hides the children,
                  since there is no room to indent them. */}
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  {renderItems([group])}
                </Box>
                {!collapsed && (
                  <IconButton
                    size="small"
                    aria-label={`${open[group.label] ? 'Collapse' : 'Expand'} ${group.label}`}
                    onClick={() => setOpen((o) => ({ ...o, [group.label]: !o[group.label] }))}
                    sx={{
                      mr: 1.5,
                      mb: 0.5,
                      color: 'text.secondary',
                      transform: open[group.label] ? 'rotate(0deg)' : 'rotate(-90deg)',
                      transition: 'transform 0.2s ease',
                    }}
                  >
                    <ChevronDown size={16} />
                  </IconButton>
                )}
              </Box>
              <Collapse in={!collapsed && open[group.label]} timeout="auto" unmountOnExit>
                <List disablePadding>{renderItems(group.children, true)}</List>
              </Collapse>
            </React.Fragment>
          ))}
        </List>
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
