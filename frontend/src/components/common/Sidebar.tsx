// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Tooltip, IconButton, Typography, useMediaQuery,
} from '@mui/material';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSidebar } from '../../App';
import { usePreparation } from '../../context/PreparationContext';
import { useConnection } from '../../hooks/useConnection';
import { getReviewCounts } from '../../services/api';
import { NAV_GROUPS, isNavKeySupported, sectionFor, type NavEntry } from './navigation';
import { BrandLogo } from './BrandLogo';
import { usePb } from '../../theme/usePb';
import { RAIL_QUERY } from '../../theme/tokens';

// Every area at the top level, grouped, as the unified prototype's rail has it:
// Today, Certification, Interview, Evidence, Workspace and Learning Lab.
//
// The rail is capability-aware: items unsupported by the currently active subject
// are rendered in a disabled state with an explanatory tooltip indicating why,
// ensuring context integrity and clear capability boundaries.

/**
 * Review waiting in the picked preparation: unreviewed mock misses plus questions
 * the schedule has brought round -- the two things the Review Queue asks for.
 *
 * Read again on every navigation, because what clears it happens on other
 * screens, and again when the server comes back. Null when it could not be read,
 * so the count disappears rather than showing a zero that claims nothing waits.
 */
function useReviewWaiting(): { unreviewed: number; spacedDue: number } | null {
  const location = useLocation();
  const { selectedId, loading } = usePreparation();
  const online = useConnection() === 'online';
  const [counts, setCounts] = useState<{ unreviewed: number; spacedDue: number } | null>(null);

  useEffect(() => {
    if (loading || !online) return undefined;
    let cancelled = false;
    getReviewCounts(selectedId)
      .then((c) => { if (!cancelled) setCounts({ unreviewed: c.unreviewed, spacedDue: c.spaced_due }); })
      .catch(() => { if (!cancelled) setCounts(null); });
    return () => { cancelled = true; };
  }, [location.pathname, selectedId, loading, online]);

  return counts;
}

/** The rail width, and the icon rail it becomes below 1080px. */
const RAIL_WIDTH = 238;
const ICON_RAIL_WIDTH = 76;

export const Sidebar: React.FC = () => {
  const { collapsed: chosen, toggleCollapsed } = useSidebar();
  const t = usePb();

  // Icons only below 1080px, where the prototype's rail gives up its labels, so
  // a laptop keeps its content column and a 390px phone gives the rail 76px.
  const narrow = useMediaQuery('(max-width:1080px)');
  const collapsed = chosen || narrow;

  const location = useLocation();
  const section = sectionFor(location.pathname);
  const { selected, selectedId, capabilities } = usePreparation();
  const review = useReviewWaiting();
  const waiting = review ? review.unreviewed + review.spacedDue : 0;
  const waitingText = review && waiting > 0
    ? `${waiting} waiting: ${review.unreviewed} ${review.unreviewed === 1 ? 'miss' : 'misses'} to read, ${review.spacedDue} due from memory`
    : null;

  const renderItems = (items: NavEntry[]) => items.map((item) => {
    const Icon = item.icon;
    const active = section.key === item.key;
    const supported = isNavKeySupported(item.key, capabilities, selected ?? (selectedId ? { id: selectedId } : null));
    const subjectName = selected?.name ?? (selectedId ? `Subject ${selectedId}` : 'current subject');

    // The count sits on the Review Queue entry only, and only when there is
    // something to count. Its words go in the link's name, so a screen reader
    // hears what the number means rather than a bare digit.
    const count = item.key === 'review' && waitingText ? waiting : null;
    const name = count !== null ? `${item.label}, ${waitingText}` : item.label;

    if (!supported) {
      // Disabled non-clickable control for unsupported capabilities (Strict P0 requirement)
      const isPending = item.key === 'lab' && capabilities?.learningLabStatus === 'INTEGRATION_PENDING';
      const disabledReason = isPending
        ? `${item.label} (Integration pending for ${subjectName})`
        : `${item.label} (Not configured for ${subjectName})`;
      const disabledButton = (
        <ListItemButton
          disabled
          aria-disabled="true"
          aria-label={disabledReason}
          sx={{
            minHeight: 0,
            gap: '10px',
            px: '12px',
            py: '10px',
            my: '2px',
            borderRadius: '9px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: t.faint,
            bgcolor: 'transparent',
            fontSize: (theme) => theme.typography.pxToRem(14),
            lineHeight: 1.48,
            opacity: 0.35,
            cursor: 'not-allowed !important',
            pointerEvents: 'auto',
            '&.Mui-disabled': {
              color: t.faint,
              opacity: 0.35,
              cursor: 'not-allowed',
              pointerEvents: 'auto',
            },
            [RAIL_QUERY]: {
              justifyContent: 'center',
              px: '10px',
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 0, color: 'inherit', justifyContent: 'center' }}>
            <Icon size={collapsed ? 19 : 16} strokeWidth={collapsed ? 1.9 : 2.1} aria-hidden />
          </ListItemIcon>
          {!collapsed && (
            <ListItemText
              primary={item.label}
              sx={{ m: 0, [RAIL_QUERY]: { display: 'none' } }}
              slotProps={{
                primary: {
                  noWrap: true,
                  sx: { fontSize: 'inherit', fontWeight: 'inherit', lineHeight: 'inherit', color: 'inherit' },
                },
              }}
            />
          )}
        </ListItemButton>
      );

      return (
        <ListItem key={item.path} disablePadding sx={{ display: 'block' }}>
          <Tooltip title={disabledReason} placement="right" arrow>
            {disabledButton}
          </Tooltip>
        </ListItem>
      );
    }

    const link = (
      <ListItemButton
        component={RouterLink}
        to={item.path}
        className={active ? 'active' : undefined}
        aria-current={active ? 'page' : undefined}
        aria-label={name}
        sx={{
          minHeight: 0,
          gap: '10px',
          px: '12px',
          py: '10px',
          my: '2px',
          borderRadius: '9px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          color: t.muted,
          fontSize: (theme) => theme.typography.pxToRem(14),
          lineHeight: 1.48,
          transition: 'background-color .15s ease, color .15s ease',
          '&:hover': { bgcolor: t.surface2, color: t.text },
          '&.active': {
            bgcolor: t.accentSoft,
            color: t.accent,
            fontWeight: 760,
            '&:hover': { bgcolor: t.accentSoft, color: t.accent },
          },
          [RAIL_QUERY]: {
            justifyContent: 'center',
            px: '10px',
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: 0, color: 'inherit', justifyContent: 'center' }}>
          <Icon size={collapsed ? 19 : 16} strokeWidth={collapsed ? 1.9 : 2.1} aria-hidden />
        </ListItemIcon>
        {!collapsed && (
          <ListItemText
            primary={item.label}
            sx={{ m: 0, [RAIL_QUERY]: { display: 'none' } }}
            slotProps={{
              primary: {
                noWrap: true,
                sx: { fontSize: 'inherit', fontWeight: 'inherit', lineHeight: 'inherit', color: 'inherit' },
              },
            }}
          />
        )}
        {count !== null && !collapsed && (
          <Box
            component="span"
            aria-hidden
            sx={{
              ml: 'auto', pl: 1, fontSize: (theme) => theme.typography.pxToRem(10), fontVariantNumeric: 'tabular-nums', color: 'inherit',
              [RAIL_QUERY]: { display: 'none' },
            }}
          >
            {count}
          </Box>
        )}
      </ListItemButton>
    );

    return (
      <ListItem key={item.path} disablePadding sx={{ display: 'block' }}>
        {collapsed ? (
          <Tooltip title={name ?? item.label} placement="right" arrow>
            {link}
          </Tooltip>
        ) : link}
      </ListItem>
    );
  });

  return (
    // A landmark of its own: the brand and the collapse control sit beside the
    // navigation, and content outside every landmark is lost to anyone moving
    // by landmarks.
    <Box
      component="aside"
      aria-label="Sidebar"
      sx={{
        width: collapsed ? ICON_RAIL_WIDTH : RAIL_WIDTH,
        [RAIL_QUERY]: {
          width: `${ICON_RAIL_WIDTH}px !important`,
          px: '10px !important',
        },
        flexShrink: 0,
        // The rail stands beside the page for its full height and stays where it
        // is while the page scrolls.
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
        height: '100vh',
        overflowY: 'auto',
        overflowX: 'hidden',
        bgcolor: t.nav,
        borderRight: `1px solid ${t.line}`,
        px: collapsed ? '10px' : '12px',
        py: '17px',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 50,
      }}
    >
      {/* Authoritative PrepBench Brand */}
      <Box
        sx={{
          px: collapsed ? 0 : '10px',
          pt: '4px',
          pb: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          [RAIL_QUERY]: {
            px: 0,
            justifyContent: 'center',
          },
        }}
      >
        <BrandLogo
          to="/"
          variant={collapsed ? 'mark' : 'full'}
          size={collapsed ? 28 : 32}
        />
      </Box>

      <Box component="nav" aria-label="Main" sx={{ flexGrow: 1 }}>
        {NAV_GROUPS.map((group) => (
          <Box key={group.heading} sx={{ mb: '2px' }}>
            {/* Headings are what let destinations read as a map rather than a list. */}
            {!collapsed && (
              <Box
                sx={{
                  m: '17px 12px 6px',
                  color: t.faint,
                  fontSize: (theme) => theme.typography.pxToRem(10),
                  fontWeight: 800,
                  letterSpacing: '0.11em',
                  textTransform: 'uppercase',
                  lineHeight: 1.48,
                  [RAIL_QUERY]: { display: 'none' },
                }}
              >
                {group.heading}
              </Box>
            )}
            <List disablePadding>{renderItems(group.items)}</List>
          </Box>
        ))}
      </Box>

      {/* Active Subject Context Indicator (Bound to Active Subject) */}
      {!collapsed && selected && (
        <Box
          data-testid="sidebar-active-subject"
          sx={{
            p: '10px',
            borderRadius: '8px',
            bgcolor: t.surface2,
            border: `1px solid ${t.line}`,
            mt: 'auto',
            mb: 1,
            [RAIL_QUERY]: { display: 'none' },
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: t.faint,
              textTransform: 'uppercase',
              fontWeight: 800,
              fontSize: (theme) => theme.typography.pxToRem(10),
              letterSpacing: '0.08em',
              display: 'block',
            }}
          >
            Active Subject
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 780, color: t.text, lineHeight: 1.3, mt: '2px' }}>
            {selected.name}
          </Typography>
          <Typography variant="caption" sx={{ color: t.muted, display: 'block', mt: '3px', fontSize: (theme) => theme.typography.pxToRem(11) }}>
            {selected.kind === 'certification'
              ? `${selected.question_count} Questions${selected.pass_mark ? ` · Pass: ${selected.pass_mark}%` : ''}`
              : selected.description
              ? selected.description.length > 45
                ? `${selected.description.slice(0, 42)}...`
                : selected.description
              : 'Skill Track'}
          </Typography>
        </Box>
      )}

      {!narrow && (
        <Box sx={{ pt: 1, display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end', [RAIL_QUERY]: { display: 'none' } }}>
          <IconButton
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
            size="small"
            sx={{ color: t.faint, '&:hover': { bgcolor: t.surface2, color: t.text } }}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </IconButton>
        </Box>
      )}
    </Box>
  );
};
