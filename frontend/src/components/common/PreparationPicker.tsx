// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Divider, ListSubheader, Menu, MenuItem, Typography,
} from '@mui/material';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { usePreparation } from '../../context/PreparationContext';
import type { Subject } from '../../types/subject';
import { NARROW_QUERY } from '../../theme/tokens';

/**
 * Which preparation you are in, and the way to change it.
 *
 * In the header rather than on a page because switching is something you do
 * *while* looking at something else -- a picker you have to navigate to in order
 * to use is a page, not a control.
 *
 * Grouped by kind because the two behave differently in a way that matters
 * before you pick: a certification has a pass mark and can be "ready", a skill
 * has neither and can only be practised.
 */

/** A number under the name, or nothing. Never an invented one.
 *
 *  A skill has no pass mark, so readiness is uncomputable rather than zero --
 *  showing "0%" for one would report a failure that has not happened. */
function summarise(prep: Subject): string {
  const parts: string[] = [];
  // Index access rather than .at(-1): the project's TS lib target predates it.
  const scores = prep.readiness.recent_scores;
  const latest = scores.length > 0 ? scores[scores.length - 1] : undefined;
  if (latest !== undefined) parts.push(`${Math.round(latest)}%`);
  if (prep.pass_mark != null) parts.push(`${Math.round(prep.pass_mark)}% to pass`);
  if (parts.length === 0) {
    parts.push(prep.question_count > 0 ? `${prep.question_count} questions` : 'No questions yet');
  }
  return parts.join(' · ');
}

export const PreparationPicker: React.FC = () => {
  const { preparations, selected, select, loading, error, refresh } = usePreparation();
  // Not "No preparation": with the list unread, that is a claim about data the
  // picker does not have.
  const unread = !loading && error !== null && preparations.length === 0;
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();

  const close = () => setAnchor(null);

  const certifications = preparations.filter((p) => p.kind === 'certification');
  const skills = preparations.filter((p) => p.kind === 'skill');

  const label = loading
    ? 'Loading…'
    : unread ? 'Preparations unavailable' : selected?.name ?? 'No preparation';

  const renderGroup = (heading: string, items: Subject[]) => {
    if (items.length === 0) return null;
    return [
      <ListSubheader
        key={`${heading}-heading`}
        sx={{
          bgcolor: 'transparent',
          fontSize: (t) => t.typography.pxToRem(10),
          fontWeight: 800,
          letterSpacing: '0.1em',
          lineHeight: 2.4,
        }}
      >
        {heading.toUpperCase()}
      </ListSubheader>,
      ...items.map((prep) => (
        <MenuItem
          key={prep.id}
          selected={prep.id === selected?.id}
          onClick={() => {
            select(prep.id);
            close();
          }}
          sx={{ alignItems: 'flex-start', gap: 1, py: 1 }}
        >
          <Box sx={{ width: 18, pt: 0.25, flexShrink: 0 }}>
            {prep.id === selected?.id && <Check size={14} />}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: (t) => t.typography.pxToRem(14) }}>{prep.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {summarise(prep)}
            </Typography>
          </Box>
        </MenuItem>
      )),
    ];
  };

  return (
    <>
      <Button
        onClick={(e) => setAnchor(e.currentTarget)}
        endIcon={<ChevronDown size={16} />}
        aria-haspopup="menu"
        aria-expanded={anchor ? true : undefined}
        aria-label={`Preparation: ${label}. Change preparation`}
        variant="outlined"
        // The prototype's .prep-picker: the preparation's name at body size,
        // heavy, with the caret pushed to the far edge.
        sx={{
          fontSize: (t) => t.typography.pxToRem(14),
          fontWeight: 760,
          gap: '10px',
          justifyContent: 'space-between',
          px: '12px',
          minWidth: 210,
          maxWidth: 300,
          flexShrink: 1,
          '& .MuiButton-endIcon': { ml: 0 },
          // What a phone leaves beside five header controls on a 76px rail.
          [NARROW_QUERY]: { minWidth: 0, maxWidth: 104, px: '9px', fontSize: (t) => t.typography.pxToRem(13) },
        }}
      >
        <Box
          component="span"
          sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {label}
        </Box>
      </Button>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        slotProps={{ paper: { sx: { width: 330, maxWidth: '90vw', mt: 0.5 } } }}
      >
        {unread && [
          <MenuItem key="unread" disabled sx={{ whiteSpace: 'normal' }}>
            <Typography variant="body2" color="text.secondary">
              {error}
            </Typography>
          </MenuItem>,
          <MenuItem
            key="retry"
            onClick={() => {
              close();
              void refresh();
            }}
            sx={{ fontWeight: 700 }}
          >
            Try again
          </MenuItem>,
        ]}
        {!unread && preparations.length === 0 && (
          <MenuItem disabled sx={{ whiteSpace: 'normal' }}>
            <Typography variant="body2" color="text.secondary">
              No preparations yet. Add one to get started.
            </Typography>
          </MenuItem>
        )}

        {renderGroup('Certifications', certifications)}
        {renderGroup('Skills', skills)}

        <Divider sx={{ my: 0.5 }} />
        <MenuItem
          onClick={() => {
            close();
            navigate('/preparations/new');
          }}
          sx={{ color: 'primary.main', fontWeight: 700, gap: 1 }}
        >
          <Plus size={16} />
          Add preparation
        </MenuItem>
        <MenuItem
          onClick={() => {
            close();
            navigate('/preparations');
          }}
          sx={{ gap: 1 }}
        >
          Manage preparations
        </MenuItem>
      </Menu>
    </>
  );
};
