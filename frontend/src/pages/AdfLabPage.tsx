// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { Detail, PageHead, Panel, PanelHead, Pill, Row } from '../components/ui/primitives';
import { LoadingState } from '../components/common/States';
import { AdfLabGate, IntegrationNotice } from '../components/adfLab/AdfLabGate';
import { apiErrorMessage } from '../services/apiError';
import { fetchAdfLabAttempts, latestRun, runAttempts } from '../services/adfLab/attempts';
import { ADF_LAB_EXPERIMENTS, tracksOf, type AdfLabExperiment } from '../services/adfLab/experiments';
import type { Track } from '../services/adfLab/attempts';
import { COMPLETE, STAGES, stageOf } from '../services/adfLab/stages';
import type { WireLearningAttempt } from '../types/learning';
import type { Subject } from '../types/subject';

/**
 * /lab/adf -- the ADF Behaviour Lab's five experiments, for the ADF preparation being worked in.
 *
 * Reachable by its address while the lab is INTEGRATION_PENDING (for development and the
 * browser tests); Home, the sidebar and the Learning Lab hub do not offer it until it is live.
 */
export const AdfLabPage: React.FC = () => (
  <AdfLabGate title="ADF Behaviour Lab">{(prep) => <Hub prep={prep} />}</AdfLabGate>
);

const Hub: React.FC<{ prep: Subject }> = ({ prep }) => {
  const [attempts, setAttempts] = useState<WireLearningAttempt[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setAttempts(null);
    fetchAdfLabAttempts(prep.id)
      .then((rows) => { if (!cancelled) setAttempts(rows); })
      .catch((err) => { if (!cancelled) setError(apiErrorMessage(err, 'Your attempts did not load.')); });
    return () => { cancelled = true; };
  }, [prep.id]);

  /** Where a track's latest run is, from the server's rows. */
  const trackState = (track: Track) => {
    const run = latestRun(attempts ?? [], prep.id, track);
    const rows = runAttempts(attempts ?? [], { subjectId: prep.id, track, run });
    if (Object.keys(rows).length === 0) return { run, started: false, stage: 0 };
    return { run, started: true, stage: stageOf(rows, { understood: true, ran: false }) };
  };

  /**
   * Where an experiment is; unsaid if the attempts did not load. An experiment with fault modes
   * is complete only when every mode's latest run is.
   */
  const progress = (e: AdfLabExperiment): React.ReactNode => {
    if (error) return <Pill tone="warning">Progress unavailable</Pill>;
    if (!attempts) return null;
    const states = tracksOf(e).map((t) => trackState(t as Track));
    if (!states.some((s) => s.started)) return <Pill tone="neutral">Not started</Pill>;
    if (states.length > 1) {
      const done = states.filter((s) => s.stage === COMPLETE).length;
      return done === states.length
        ? <Pill tone="success">Both modes complete</Pill>
        : <Pill tone="accent">{done} of {states.length} modes complete</Pill>;
    }
    const [s] = states;
    return s.stage === COMPLETE
      ? <Pill tone="success">Run {s.run} complete</Pill>
      : <Pill tone="accent">Run {s.run} · {STAGES[s.stage]}</Pill>;
  };

  return (
    <Box>
      <PageHead
        eyebrow={`${prep.name} · Learning Lab`}
        title="ADF Behaviour Lab"
        sub="Predict how an Azure Data Factory pipeline behaves, change it, watch a teaching model respond, and explain why. Every stage is recorded against this preparation."
      />
      <IntegrationNotice prep={prep} />
      <Panel component="section" aria-labelledby="adf-lab-experiments" sx={{ mt: '18px' }}>
        <PanelHead eyebrow="Five experiments" title="Experiments" titleId="adf-lab-experiments" />
        {!attempts && !error && <LoadingState label="Loading your progress…" />}
        <Box component="ul" aria-label="Experiments" sx={{ listStyle: 'none', p: 0, m: 0 }}>
          {ADF_LAB_EXPERIMENTS.map((e) => (
            <Box component="li" key={e.slug}>
              <Row
                title={e.title}
                detail={(
                  <>
                    {e.purpose}
                    <Detail component="span" sx={{ display: 'block', mt: '4px' }}>
                      Guide: {e.chapters.map((c) => c.title).join(' · ')}. Roadmap topics {e.topics.map((t) => t.number).join(', ')}.
                    </Detail>
                  </>
                )}
                middle={e.ready ? progress(e) : <Pill tone="neutral">Not built yet</Pill>}
                action={e.ready
                  ? <Button variant="outlined" component={RouterLink} to={`/lab/adf/${e.slug}`} aria-label={`Open ${e.title}`}>Open</Button>
                  : <Button variant="outlined" disabled aria-disabled="true">Not built yet</Button>}
              />
            </Box>
          ))}
        </Box>
      </Panel>
    </Box>
  );
};
