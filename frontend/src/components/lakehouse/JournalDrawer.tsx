// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Box, Button, Drawer, IconButton, Typography } from '@mui/material';
import { Trash2 } from 'lucide-react';
import type { JournalEntry } from '../../types/lakehouse';
import { NARROW_QUERY } from '../../theme/tokens';
import { entrySummary } from '../../services/lakehouse/present';
import { CheckRow, Detail, Pill } from '../ui/primitives';

const when = (iso: string) => {
  // The server's naive timestamps are UTC.
  const d = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

/**
 * The lab journal (mockup A6). Every entry carries a pill saying whether it
 * really ran on the engine or came from a simulation, always. Entries can be
 * deleted and never edited; there is no edit control here, and the API has no
 * PUT or PATCH.
 */
export const JournalDrawer: React.FC<{
  open: boolean;
  entries: JournalEntry[];
  error?: string | null;
  onClose: () => void;
  onDelete: (entryUid: string) => void;
  onExport: () => void;
}> = ({ open, entries, error, onClose, onDelete, onExport }) => (
  <Drawer
    anchor="right"
    open={open}
    onClose={onClose}
    slotProps={{ paper: { 'aria-labelledby': 'journal-title', sx: { width: 420, maxWidth: '100%', p: '20px', [NARROW_QUERY]: { width: '100%' } } } }}
  >
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
      <Typography variant="h5" component="h2" id="journal-title">Lab journal</Typography>
      <Button variant="outlined" size="small" onClick={onExport} disabled={entries.length === 0}>Export .md</Button>
    </Box>
    <Detail sx={{ mt: '6px', mb: '8px' }}>Every entry says whether it really ran.</Detail>
    {error && <Box role="alert"><Detail sx={{ color: 'error.main' }}>{error}</Detail></Box>}
    {entries.length === 0 ? (
      <Detail>Nothing yet. Run something in a station.</Detail>
    ) : (
      <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {entries.map((e) => (
          <Box component="li" key={e.entry_uid}>
            <CheckRow
              mark={null}
              aside={(
                <IconButton size="small" aria-label={`Delete entry: ${e.op}${e.table_name ? ` on ${e.table_name}` : ''}, ${when(e.created_at)}`} onClick={() => onDelete(e.entry_uid)}>
                  <Trash2 size={16} aria-hidden />
                </IconButton>
              )}
            >
              <Pill tone={e.source === 'real_engine' ? 'success' : 'neutral'}>
                {e.source === 'real_engine' ? 'Real engine' : 'Simulation'}
              </Pill>{' '}
              <Detail component="span">{when(e.created_at)}</Detail>
              <Typography variant="body2" component="p" sx={{ fontWeight: 700, mt: '4px' }}>
                {e.op}{e.table_name ? ` · ${e.table_name}` : ''}
              </Typography>
              {entrySummary(e) && <Detail>{entrySummary(e)}</Detail>}
            </CheckRow>
          </Box>
        ))}
      </Box>
    )}
    <Box sx={{ mt: 'auto', pt: '14px' }}>
      <Button onClick={onClose}>Close</Button>
    </Box>
  </Drawer>
);
