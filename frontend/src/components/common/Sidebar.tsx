// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Tooltip, IconButton, useMediaQuery,
} from '@mui/material';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSidebar } from '../../App';
import { usePreparation } from '../../context/PreparationContext';
import { useConnection } from '../../hooks/useConnection';
import { getReviewCounts } from '../../services/api';
import { NAV_GROUPS, sectionFor, type NavEntry } from './navigation';
import { usePb } from '../../theme/usePb';
import { RAIL_QUERY } from '../../theme/tokens';

// Every area at the top level, grouped, as the unified prototype's rail has it:
// Today, Certification, Interview, Evidence and Workspace, fourteen destinations.
//
// This was once four verbs -- Home, Practice, Learn, Review -- with the formats
// reached from inside them, because the list before that was a feature inventory
// in which "Chart Sandbox" sat at the same weight as Practice itself. The groups
// are what keep fourteen from reading that way again: the rail is a map of the
// product, and a first-time reader can see its shape without learning which verb
// hides which format.

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

/** The prototype's rail width, and the icon rail it becomes below 1080px. */
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
  const review = useReviewWaiting();
  const waiting = review ? review.unreviewed + review.spacedDue : 0;
  const waitingText = review && waiting > 0
    ? `${waiting} waiting: ${review.unreviewed} ${review.unreviewed === 1 ? 'miss' : 'misses'} to read, ${review.spacedDue} due from memory`
    : null;

  const renderItems = (items: NavEntry[]) => items.map((item) => {
    const Icon = item.icon;
    const active = section.key === item.key;
    // The count sits on the Review Queue entry only, and only when there is
    // something to count. Its words go in the link's name, so a screen reader
    // hears what the number means rather than a bare digit.
    const count = item.key === 'review' && waitingText ? waiting : null;
    const name = count !== null ? `${item.label}, ${waitingText}` : item.label;
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
          fontSize: (t) => t.typography.pxToRem(14),
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
              ml: 'auto', pl: 1, fontSize: (t) => t.typography.pxToRem(10), fontVariantNumeric: 'tabular-nums', color: 'inherit',
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
        // is while the page scrolls. It used to grow with the document, so on a
        // long screen every destination scrolled off the top and the only way
        // back to Home was to scroll the content you were reading.
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
      {/* The product's name, not a heading: every page names itself. */}
      <Box
        sx={{
          fontSize: collapsed ? '1.375rem' : '1.3125rem',
          fontWeight: 820,
          letterSpacing: '-0.04em',
          lineHeight: 1.2,
          color: t.text,
          px: collapsed ? 0 : '12px',
          pt: '6px',
          pb: '23px',
          textAlign: collapsed ? 'center' : 'left',
          whiteSpace: 'nowrap',
          [RAIL_QUERY]: {
            px: 0,
            textAlign: 'center',
          },
        }}
      >
        {collapsed ? (
          <span aria-label="PrepBench">P</span>
        ) : (
          <>
            <Box component="span" sx={{ [RAIL_QUERY]: { display: 'none' } }}>
              PrepBench
            </Box>
            <Box
              component="span"
              aria-label="PrepBench"
              sx={{ display: 'none', [RAIL_QUERY]: { display: 'inline' } }}
            >
              P
            </Box>
            <Box
              component="small"
              sx={{
                display: 'block', fontSize: (t) => t.typography.pxToRem(9), color: t.faint, letterSpacing: '0.06em',
                mt: '3px', fontWeight: 650,
                [RAIL_QUERY]: { display: 'none' },
              }}
            >
              Local-first preparation workspace
            </Box>
          </>
        )}
      </Box>

      <Box component="nav" aria-label="Main" sx={{ flexGrow: 1 }}>
        {NAV_GROUPS.map((group) => (
          <Box key={group.heading} sx={{ mb: '2px' }}>
            {/* Headings are what let fourteen destinations read as a map rather
                than a list. They go on the icon rail, where the tooltips carry
                the labels. */}
            {!collapsed && (
              <Box
                sx={{
                  m: '17px 12px 6px',
                  color: t.faint,
                  fontSize: (t) => t.typography.pxToRem(10),
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

      {!narrow && (
        <Box sx={{ pt: 1.5, display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end', [RAIL_QUERY]: { display: 'none' } }}>
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
