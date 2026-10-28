// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { Detail, PageHead, Panel, PanelHead, Pill, Row } from '../ui/primitives';
import { LoadingState } from '../common/States';
import { IntegrationNotice, LabGate } from './AdfLabGate';
import { ExperimentRunner } from './ExperimentRunner';
import { apiErrorMessage } from '../../services/apiError';
import { fetchLabAttempts, latestRun, runAttempts, type Track } from '../../services/adfLab/attempts';
import { tracksOf, type LabExperiment } from '../../services/adfLab/experiments';
import type { ExperimentDefinition } from '../../services/adfLab/definition';
import type { LabSpec } from '../../services/adfLab/lab';
import { COMPLETE, STAGES, stageOf } from '../../services/adfLab/stages';
import type { WireLearningAttempt } from '../../types/learning';
import type { Subject } from '../../types/subject';

/**
 * The two screens every lab on the shared runner has: its hub (`basePath`) and one experiment
 * (`basePath/:slug`, with `?mode=` for an experiment with fault modes). The ADF Behaviour Lab's and
 * the Kafka Lab's pages are these, given their LabSpec.
 */

const COUNT = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
const countWord = (n: number) => COUNT[n] ?? String(n);

export const LabHubPage: React.FC<{ lab: LabSpec }> = ({ lab }) => (
  <LabGate lab={lab} title={lab.name}>{(prep) => <Hub lab={lab} prep={prep} />}</LabGate>
);

const Hub: React.FC<{ lab: LabSpec; prep: Subject }> = ({ lab, prep }) => {
  const [attempts, setAttempts] = useState<WireLearningAttempt[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setAttempts(null);
    fetchLabAttempts(prep.id, lab.ids)
      .then((rows) => { if (!cancelled) setAttempts(rows); })
      .catch((err) => { if (!cancelled) setError(apiErrorMessage(err, 'Your attempts did not load.')); });
    return () => { cancelled = true; };
  }, [prep.id, lab.ids]);

  /** Where a track's latest run is, from the server's rows. */
  const trackState = (track: Track) => {
    const run = latestRun(attempts ?? [], prep.id, track, lab.ids);
    const rows = runAttempts(attempts ?? [], { subjectId: prep.id, track, run }, lab.ids);
    if (Object.keys(rows).length === 0) return { run, started: false, stage: 0 };
    return { run, started: true, stage: stageOf(rows, { understood: true, ran: false }) };
  };

  /**
   * Where an experiment is; unsaid if the attempts did not load. An experiment with fault modes
   * is complete only when every mode's latest run is.
   */
  const progress = (e: LabExperiment): React.ReactNode => {
    if (error) return <Pill tone="warning">Progress unavailable</Pill>;
    if (!attempts) return null;
    const states = tracksOf(e).map((t) => trackState(t));
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

  const listId = `${lab.packId}-lab-experiments`;
  return (
    <Box>
      <PageHead eyebrow={`${prep.name} · Learning Lab`} title={lab.name} sub={lab.hubIntro} />
      <IntegrationNotice lab={lab} />
      <Panel component="section" aria-labelledby={listId} sx={{ mt: '18px' }}>
        <PanelHead eyebrow={`${countWord(lab.experiments.length)} experiments`} title="Experiments" titleId={listId} />
        {!attempts && !error && <LoadingState label="Loading your progress…" />}
        <Box component="ul" aria-label="Experiments" sx={{ listStyle: 'none', p: 0, m: 0 }}>
          {lab.experiments.map((e) => (
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
                  ? <Button variant="outlined" component={RouterLink} to={`${lab.basePath}/${e.slug}`} aria-label={`Open ${e.title}`}>Open</Button>
                  : <Button variant="outlined" disabled aria-disabled="true">Not built yet</Button>}
              />
            </Box>
          ))}
        </Box>
      </Panel>
    </Box>
  );
};

export const LabExperimentPage: React.FC<{
  lab: LabSpec;
  definitions: Partial<Record<string, ExperimentDefinition<unknown>[]>>;
}> = ({ lab, definitions }) => {
  const { slug } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const experiment = lab.experiments.find((e) => e.slug === slug) ?? null;

  if (!experiment) {
    return (
      <PageHead
        eyebrow={lab.name}
        title="No such experiment"
        sub={`The ${lab.name} has ${countWord(lab.experiments.length).toLowerCase()} experiments, and this address is none of them.`}
        actions={<Button component={RouterLink} to={lab.basePath} variant="outlined">All experiments</Button>}
      />
    );
  }

  const defs = definitions[experiment.slug];
  const tracks = experiment.tracks ?? [];
  const modeIndex = Math.max(0, tracks.findIndex((t) => t.id === params.get('mode')));
  const def = defs?.[tracks.length ? modeIndex : 0];

  return (
    <LabGate lab={lab} title={experiment.title}>
      {(prep) => (experiment.ready && def
        ? (
          <ExperimentRunner
            key={def.track}
            lab={lab} prep={prep} def={def} experiment={experiment}
            titleSuffix={tracks.length ? tracks[modeIndex].title : undefined}
            modeSwitch={tracks.length > 0 && (
              <Box component="nav" aria-label="Fault modes" sx={{ display: 'flex', gap: '8px', flexWrap: 'wrap', mt: '14px' }}>
                {tracks.map((t, i) => (
                  <Button
                    key={t.id} component={RouterLink} to={`${lab.basePath}/${experiment.slug}?mode=${t.id}`}
                    variant={i === modeIndex ? 'contained' : 'outlined'} aria-current={i === modeIndex ? 'page' : undefined}
                  >
                    {t.title}
                  </Button>
                ))}
              </Box>
            )}
          />
        )
        : (
          <PageHead
            eyebrow={`${prep.name} · ${lab.name}`}
            title={experiment.title}
            sub="This experiment is not built yet. It will open here when it is."
            actions={<Button component={RouterLink} to={lab.basePath} variant="outlined">All experiments</Button>}
          />
        ))}
    </LabGate>
  );
};
