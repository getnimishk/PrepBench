// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { CalendarCheck, Layers, Library } from 'lucide-react';
import { SettingsSubpage } from '../../components/settings/SettingsSubpage';
import { EmptyState, ErrorState, LoadingState, SaveStatus, type SaveState } from '../../components/common/States';

/**
 * The states a screen has to handle, collected so they are designed rather
 * than improvised.
 *
 * Rendered with the same components the screens use, so what is here is what a
 * learner sees. The examples are the product's own situations; the buttons are
 * shown inert, because on this page there is nothing for them to act on.
 */
const Frame: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <Box component="figure" aria-label={label} sx={{ m: 0, border: '1px solid', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper', overflow: 'hidden' }}>
    <Typography component="figcaption" variant="overline" sx={{ display: 'block', px: 2, pt: 1, color: 'text.secondary' }}>
      {label}
    </Typography>
    <Box sx={{ px: 2, pb: 2 }}>{children}</Box>
  </Box>
);

const Inert: React.FC<{ children: React.ReactNode; variant?: 'contained' | 'outlined' }> = ({ children, variant = 'contained' }) => (
  <Button variant={variant} tabIndex={-1} aria-disabled sx={{ pointerEvents: 'none' }}>{children}</Button>
);

const SAVE_EXAMPLES: [SaveState, string][] = [
  ['pending_sync', 'the moment an answer is sent'],
  ['synced', 'the server has it'],
  ['sync_failed', 'the server refused it or could not be reached'],
  ['offline', 'the server is unreachable and nothing has been kept'],
  ['saved_locally', 'kept in this browser until it can be sent'],
];

export const StatesGalleryPage: React.FC = () => (
  <SettingsSubpage
    title="Interface states"
    description="Empty, loading, error and saving states, as the screens show them. Each one says why, and what to do next."
  >
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
      <Frame label="Empty · no preparations">
        <EmptyState
          icon={<Layers size={28} />}
          title="No preparations yet"
          why="A preparation holds your questions, roadmap and evidence for one exam or skill."
          action={<Inert>Add preparation</Inert>}
        />
      </Frame>
      <Frame label="Empty · no questions">
        <EmptyState
          icon={<Library size={28} />}
          title="This bank is empty"
          why="Import a file, or write your first question. Nothing can be practised until there is something to draw from."
          action={<Inert>Import questions</Inert>}
        />
      </Frame>
      <Frame label="Empty · nothing due">
        <EmptyState
          icon={<CalendarCheck size={28} />}
          title="Nothing due today"
          why="Practising ahead of schedule does not strengthen recall. That is the system working, not a missed day."
        />
      </Frame>
      <Frame label="Empty · no evidence">
        <EmptyState
          title="Nothing measured yet"
          why="Sit a full mock, so recommendations come from evidence rather than guesswork."
          action={<Inert variant="outlined">Take a mock</Inert>}
        />
      </Frame>
      <Frame label="Loading">
        <LoadingState label="Grading your answer…" />
      </Frame>
      <Frame label="Error · grading unavailable">
        <ErrorState
          what="Not graded: no AI provider responded"
          saved="saved"
          detail="It can be graded later. A score is never made up."
          recovery={<Inert variant="outlined">Check providers</Inert>}
        />
      </Frame>
      <Frame label="Error · import failed">
        <ErrorState
          what="Could not read the file"
          saved="nothing_to_save"
          detail="Row 12 has no answer options, so nothing was written to the question bank."
          recovery={<Inert variant="outlined">Open the audit</Inert>}
        />
      </Frame>
      <Frame label="Error · the server is unreachable">
        <ErrorState
          what="Could not reach PrepBench's server"
          saved="not_saved"
          detail="Start the backend, then retry. Your earlier work is safe in the database."
        />
      </Frame>
      <Frame label="Saving">
        <Box sx={{ display: 'grid', gap: 1 }}>
          {SAVE_EXAMPLES.map(([state, when]) => (
            <Box key={state} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
              <SaveStatus state={state} />
              <Typography variant="caption" color="text.secondary">{when}</Typography>
            </Box>
          ))}
        </Box>
      </Frame>
    </Box>
  </SettingsSubpage>
);
