import React from 'react';
import { NavLink } from 'react-router-dom';
import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Tooltip, IconButton, Typography, useTheme } from '@mui/material';
import { LayoutDashboard, PlayCircle, BookOpen, BarChart3, History, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSidebar } from '../../App';

const MAIN_ITEMS = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Start Exam', path: '/exam-setup', icon: PlayCircle },
  { label: 'Question Bank', path: '/question-bank', icon: BookOpen },
];

const TOOLS_ITEMS = [
  { label: 'Analytics', path: '/analytics', icon: BarChart3 },
  { label: 'Exam History', path: '/history', icon: History },
  { label: 'Settings', path: '/settings', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const { collapsed, toggleCollapsed } = useSidebar();
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';

  const renderItems = (items: typeof MAIN_ITEMS) => {
    return items.map((item) => {
      const Icon = item.icon;
      const buttonContent = (
        <ListItemButton
          component={NavLink}
          to={item.path}
          sx={{
            minHeight: 48,
            px: 2,
            mx: 1.5,
            mb: 0.5,
            borderRadius: '100px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            transition: 'all 0.2s ease',
            color: dark ? '#E2E8F0' : '#475569',
            '&:hover': {
              bgcolor: dark ? '#1E1F22' : '#F1F5F9',
            },
            '&.active': {
              bgcolor: dark ? 'rgba(168, 199, 250, 0.2)' : 'rgba(11, 87, 208, 0.1)',
              color: dark ? '#A8C7FA' : '#0B57D0',
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
            primaryTypographyProps={{ fontWeight: 500, fontSize: '0.95rem', noWrap: true }}
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
        bgcolor: dark ? '#131314' : '#F8F9FA',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ flexGrow: 1, overflowY: 'auto', py: 2, overflowX: 'hidden' }}>
        <List disablePadding>
          <Typography
            variant="caption"
            sx={{
              px: 3,
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
            MAIN
          </Typography>
          {renderItems(MAIN_ITEMS)}

          <Typography
            variant="caption"
            sx={{
              px: 3,
              mt: 2,
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
            TOOLS
          </Typography>
          {renderItems(TOOLS_ITEMS)}
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