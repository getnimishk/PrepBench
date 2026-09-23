// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Typography } from '@mui/material';
import { archiveSubject, getSubjects } from '../services/api';
import { usePreparation } from '../context/PreparationContext';
import { loadFailed } from '../services/apiError';
import type { Subject } from '../types/subject';
import { LoadingState } from '../components/common/States';
import {
  Actions, Detail, Eyebrow, Grid, PageHead, Panel, PanelHead, Pill, Row, Section,
} from '../components/ui/primitives';
import {
  InsideRows, KIND_LABEL, ReadinessBlock, RecommendedBlock, cardMeta, useOverviewFacts,
} from '../components/preparation/PreparationOverview';
import { NARROW_QUERY, RAIL_QUERY } from '../theme/tokens';

/**
 * My Preparations: the portfolio, as the prototype draws it -- a card for every
 * preparation, and the chosen one opened underneath with its readiness, the
 * one thing recommended, and a row for everything inside it.
 *
 * Below that, every preparation again, archived ones included, with the
 * controls that manage them. The picker hides archived rows, so somewhere has
 * to be able to bring one back or there is no way to undo an archive.
 */

/** What this preparation is measured against, in words.
 *
 *  A skill genuinely has no pass mark, so it says so rather than showing a zero
 *  that would read as a failing score. */
function measuredBy(prep: Subject): string {
  if (prep.kind === 'skill') return 'No pass mark — practised, not passed';
  if (prep.pass_mark == null) return 'No exam profile yet';
  return `${prep.exam_question_count} questions · ${prep.exam_minutes} min · ${Math.round(prep.pass_mark)}% to pass`;
}

export const PreparationsPage: React.FC = () => {
  const { selectedId, select, refresh } = usePreparation();
  const navigate = useNavigate();

  const [all, setAll] = useState<Subject[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Archived included: this is the only screen that can restore one.
  const load = async (): Promise<boolean> => {
    try {
      setAll(await getSubjects({ includeArchived: true }));
      setLoadError(null);
      return true;
    } catch (err) {
      // Never an empty list: "No preparations yet" is a claim about data that
      // was not read.
      setLoadError(loadFailed('Could not load your preparations', err));
      return false;
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const active = (all ?? []).filter((p) => !p.is_archived);
  const archived = (all ?? []).filter((p) => p.is_archived);
  const current = active.find((p) => p.id === selectedId) ?? active[0] ?? null;
  const facts = useOverviewFacts(current?.id);

  const toggleArchive = async (prep: Subject) => {
    const verb = prep.is_archived ? 'restore' : 'archive';
    setBusyId(prep.id);
    setError(null);
    try {
      await archiveSubject(prep.id, !prep.is_archived);
    } catch (err) {
      setError(loadFailed(`Could not ${verb} ${prep.name}`, err));
      setBusyId(null);
      return;
    }
    // The change is made. A list that then fails to refresh must not say otherwise.
    const refreshed = await load();
    if (!refreshed) {
      setError(`${prep.name} was ${verb}d, but the list could not be refreshed. Reload to see it.`);
    }
    // The picker's list excludes archived rows, so it has to be told.
    await refresh();
    setBusyId(null);
  };

  if (all === null && !loadError) return <LoadingState label="Loading your preparations…" />;

  const manageRow = (prep: Subject, isSelected: boolean) => (
    <Row
      key={prep.id}
      sx={{ opacity: prep.is_archived ? 0.7 : 1 }}
      title={prep.name}
      detail={`${prep.question_count} question${prep.question_count === 1 ? '' : 's'} · ${measuredBy(prep)}`}
      middle={(
        <Box sx={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <Pill>{KIND_LABEL[prep.kind]}</Pill>
          {isSelected && <Pill tone="accent">Current</Pill>}
          {prep.is_archived && <Pill tone="warning">Archived</Pill>}
        </Box>
      )}
      action={(
        <Actions sx={{ gap: '6px', flexWrap: 'nowrap' }}>
          {!prep.is_archived && !isSelected && (
            <Button variant="outlined" onClick={() => select(prep.id)}>Switch to</Button>
          )}
          <Button variant="outlined" onClick={() => void toggleArchive(prep)} disabled={busyId === prep.id}>
            {prep.is_archived ? 'Restore' : 'Archive'}
          </Button>
          <Button variant="outlined" component={RouterLink} to={`/preparations/${prep.id}/edit`} aria-label={`Edit ${prep.name}`}>
            Edit
          </Button>
        </Actions>
      )}
    />
  );

  return (
    <Box>
      <PageHead
        eyebrow="Preparation portfolio"
        title="My Preparations"
        sub="Each certification or skill track keeps its own content, learning path, practice history and evidence."
        actions={(
          <Button variant="contained" color="ink" onClick={() => navigate('/preparations/new')}>
            + Add preparation
          </Button>
        )}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loadError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={<Button color="inherit" size="small" onClick={() => void load()}>Retry</Button>}
        >
          {loadError}
        </Alert>
      )}

      {all === null ? null : active.length === 0 ? (
        <Panel sx={{ textAlign: 'center', p: '36px' }}>
          {archived.length > 0 ? (
            <Detail>Every preparation is archived. Restore one below, or add a new one.</Detail>
          ) : (
            <>
              <Typography variant="h6" component="p">No preparations yet</Typography>
              <Detail sx={{ mt: '4px' }}>
                Add one to start building a question bank, a roadmap and a record of what you have practised.
              </Detail>
            </>
          )}
        </Panel>
      ) : (
        <>
          {/* The prototype's .preps: one card a preparation, the current one ringed. */}
          <Box
            role="list"
            aria-label="Preparations"
            sx={{
              display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(5, minmax(0,1fr))',
              [RAIL_QUERY]: { gridTemplateColumns: 'repeat(3, minmax(0,1fr))' },
              [NARROW_QUERY]: { gridTemplateColumns: 'repeat(2, minmax(0,1fr))' },
            }}
          >
            {active.map((prep) => {
              const on = prep.id === current?.id;
              return (
                <Box role="listitem" key={prep.id} sx={{ minWidth: 0 }}>
                  <Box
                    component="button"
                    type="button"
                    onClick={() => select(prep.id)}
                    aria-pressed={on}
                    aria-label={`${prep.name}: ${cardMeta(prep)}`}
                    sx={{
                      width: '100%', height: '100%', textAlign: 'left', font: 'inherit', cursor: 'pointer',
                      bgcolor: 'background.paper', color: 'text.primary', borderRadius: '11px',
                      border: on ? '2px solid' : '1px solid', borderColor: on ? 'primary.main' : 'divider',
                      p: on ? '14px' : '15px',
                      '&:hover': { borderColor: 'primary.main' },
                      '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                    }}
                  >
                    <Eyebrow>{KIND_LABEL[prep.kind]}</Eyebrow>
                    <Box component="span" sx={{ display: 'block', fontSize: (t) => t.typography.pxToRem(14), fontWeight: 750, mt: '4px', overflowWrap: 'anywhere' }}>
                      {prep.name}
                    </Box>
                    <Detail component="span" sx={{ display: 'block', mt: '2px' }}>{cardMeta(prep)}</Detail>
                  </Box>
                </Box>
              );
            })}
          </Box>

          {current && (
            <Section>
              <Panel component="section" aria-labelledby="current-preparation">
                <PanelHead
                  eyebrow={KIND_LABEL[current.kind]}
                  title={current.name}
                  titleId="current-preparation"
                  aside={(
                    <Actions sx={{ flexWrap: 'nowrap' }}>
                      <Button variant="outlined" component={RouterLink} to={`/preparations/${current.id}/edit`}>Settings</Button>
                      <Button variant="contained" color="ink" component={RouterLink} to={`/subjects/${current.id}`}>Open overview</Button>
                    </Actions>
                  )}
                >
                  {current.description && <Detail>{current.description}</Detail>}
                </PanelHead>

                <Grid columns={2}>
                  <ReadinessBlock subject={current} />
                  <RecommendedBlock subject={current} />
                </Grid>

                <Box sx={{ mt: '28px' }}>
                  <Eyebrow>Inside this preparation</Eyebrow>
                  <InsideRows subject={current} facts={facts} />
                </Box>
              </Panel>
            </Section>
          )}
        </>
      )}

      {all !== null && (active.length > 0 || archived.length > 0) && (
        <Section>
          <Panel soft component="section" aria-labelledby="manage-preparations">
            <PanelHead eyebrow="Manage" title="Every preparation" titleId="manage-preparations" />
            {active.map((prep) => manageRow(prep, prep.id === current?.id))}
            {archived.length > 0 && (
              <>
                <Eyebrow sx={{ mt: '18px' }}>Archived</Eyebrow>
                <Detail sx={{ mt: '2px' }}>
                  Hidden from the picker. Their questions and history are kept, and restoring one puts it back.
                </Detail>
                {archived.map((prep) => manageRow(prep, false))}
              </>
            )}
          </Panel>
        </Section>
      )}
    </Box>
  );
};
