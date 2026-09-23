// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { getDomainDetail, getRoadmap, getRoadmaps } from '../services/api';
import { apiErrorMessage } from '../services/apiError';
import { usePreparation } from '../context/PreparationContext';
import type { DomainDetail } from '../types/analytics';
import type { RoadmapDetail, RoadmapPhase, RoadmapSummary, RoadmapTopic, RoadmapTopicStatus } from '../types/roadmap';
import type { Subject } from '../types/subject';
import { ErrorState, LoadingState } from '../components/common/States';
import {
  Actions, Bar, BigFigure, Detail, Eyebrow, Grid, Metric, MetricRow, Note, PageHead, Panel, PanelHead, Pill, Section, Sub,
} from '../components/ui/primitives';

/**
 * The Study Library: what to learn next, and how to prove it has been learnt.
 *
 * The prototype's Learn screen, from the learner's own evidence. Three panels:
 *
 *   Recommended        the preparation's weakest area, as its readiness rules
 *                      name it -- the same area Home tells you to practise --
 *                      with that area's own figures
 *   Continue learning  the roadmap topic in progress, or the next one not
 *                      started, with the two ways on: open it, or demonstrate it
 *   Roadmap            the plan's progress and its first four phases
 *
 * It used to be two links, to Roadmaps and to the Question Bank. Both are in
 * the rail, so the page said nothing the navigation had not.
 */

const STATUS_LABEL: Record<RoadmapTopicStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  skipped: 'Skipped',
};

/** Whole hours as whole numbers, anything else to one place. */
const hours = (h: number) => (Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`);

/** The first `max` characters, cut at a word, with an ellipsis only when cut. */
function excerpt(text: string, max = 120): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

const byOrder = <T extends { order_index: number; id: number }>(a: T, b: T) =>
  a.order_index - b.order_index || a.id - b.id;

import { chooseRoadmap } from '../services/roadmapChoice';

export { chooseRoadmap };

/** The topic in progress, else the first one not started, in plan order. */
export function topicToContinue(detail: RoadmapDetail): { topic: RoadmapTopic; phase: RoadmapPhase } | null {
  const flat = [...detail.phases].sort(byOrder)
    .flatMap((phase) => [...phase.topics].sort(byOrder).map((topic) => ({ topic, phase })));
  return flat.find((x) => x.topic.status === 'in_progress')
    ?? flat.find((x) => x.topic.status === 'not_started')
    ?? null;
}

// ---- Recommended ---------------------------------------------------------

const RecommendedPanel: React.FC<{ preparation: Subject | null; loadingPreparation: boolean }> = ({
  preparation, loadingPreparation,
}) => {
  const area = preparation?.readiness.weakest_domain ?? null;
  const [detail, setDetail] = useState<DomainDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setDetail(null);
    setError(null);
    if (!preparation || !area) return undefined;
    let cancelled = false;
    getDomainDetail(preparation.id, area)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((err) => { if (!cancelled) setError(apiErrorMessage(err, '')); });
    return () => { cancelled = true; };
  }, [preparation, area, attempt]);

  if (loadingPreparation) {
    return <Panel component="section" aria-label="Recommended"><LoadingState label="Loading your recommendation…" /></Panel>;
  }

  if (!preparation || !area) {
    const why = !preparation
      ? 'Pick a preparation in the header. What to study is named from that preparation’s own evidence.'
      : !preparation.has_exam_profile || preparation.question_count === 0
        ? `${preparation.name} has nothing scored yet, so no area can be named as the one to study.`
        : 'Sit a full mock and the area it shows weakest is named here, with its own figures.';
    return (
      <Panel component="section" aria-labelledby="recommended-title">
        <PanelHead eyebrow="Recommended" title="Nothing to recommend yet" titleId="recommended-title" />
        <Sub sx={{ mb: 0 }}>{why}</Sub>
        {preparation && preparation.has_exam_profile && preparation.question_count > 0 && (
          <Actions sx={{ mt: '16px' }}>
            <Button variant="contained" component={RouterLink} to={`/exam-setup?kind=mock&subject=${preparation.id}`}>
              Take a mock
            </Button>
          </Actions>
        )}
      </Panel>
    );
  }

  const domainState = preparation.readiness.domains.find((d) => d.domain === area)?.state;
  const underFloor = domainState === 'needs_work';
  const floor = preparation.readiness.rules?.domain_floor_pct;
  const areaHref = `/analytics/area?subject=${preparation.id}&domain=${encodeURIComponent(area)}`;
  const drillHref = `/exam-setup?kind=drill&subject=${preparation.id}&domain=${encodeURIComponent(area)}`;

  return (
    <Panel component="section" aria-labelledby="recommended-title">
      <PanelHead
        eyebrow="Recommended"
        title={area}
        titleId="recommended-title"
        // "Weakest" only for an area under the floor. The lowest-scoring area of
        // a preparation doing well is not a problem, and a warning would say it was.
        aside={<Pill tone={underFloor ? 'warning' : 'neutral'}>{underFloor ? 'Weakest area' : 'Lowest area'}</Pill>}
      />
      {error !== null ? (
        <ErrorState
          what={`Could not load the figures for ${area}.`}
          saved="nothing_to_save"
          detail={error}
          onRetry={() => setAttempt((n) => n + 1)}
        />
      ) : !detail ? (
        <LoadingState label="Loading this area’s figures…" />
      ) : (
        <>
          <Sub sx={{ mb: 0 }}>
            {detail.accuracy_percentage != null
              ? `${Math.round(detail.accuracy_percentage)}% across ${detail.answers} ${detail.answers === 1 ? 'answer' : 'answers'} in this area`
              : 'No answers in this area yet'}
            {underFloor && floor != null ? `, under the ${Math.round(floor)}% floor` : ''}
            {' — the clearest thing to study next.'}
          </Sub>
          <MetricRow sx={{ mt: '12px' }}>
            <Metric value={detail.question_count} label="questions here" />
            <Metric value={detail.missed_questions} label="missed" />
            <Metric value={detail.unreviewed_misses} label="misses to read" />
          </MetricRow>
        </>
      )}
      <Actions sx={{ mt: '16px' }}>
        <Button variant="contained" component={RouterLink} to={areaHref}>Start learning</Button>
        <Button variant="outlined" component={RouterLink} to={drillHref}>Practise instead</Button>
      </Actions>
    </Panel>
  );
};

// ---- Continue learning ---------------------------------------------------

const ContinuePanel: React.FC<{ detail: RoadmapDetail | null; hasRoadmap: boolean }> = ({ detail, hasRoadmap }) => {
  const next = detail ? topicToContinue(detail) : null;

  if (!next) {
    return (
      <Panel soft component="section" aria-labelledby="continue-title">
        <PanelHead eyebrow="Continue learning" title="Nothing in progress" titleId="continue-title" />
        <Sub sx={{ mb: 0 }}>
          {hasRoadmap
            ? 'Every topic in this roadmap is complete.'
            : 'Topics come from a roadmap. Import one and the topic to work on next appears here.'}
        </Sub>
        {!hasRoadmap && (
          <Actions sx={{ mt: '14px' }}>
            <Button variant="contained" component={RouterLink} to="/roadmaps">Import a roadmap</Button>
          </Actions>
        )}
      </Panel>
    );
  }

  const { topic, phase } = next;
  const progress = Math.round(topic.progress_percentage ?? 0);
  const topicHref = `/roadmaps/${topic.roadmap_id}/topics/${topic.id}`;

  return (
    <Panel soft component="section" aria-labelledby="continue-title">
      <PanelHead
        eyebrow="Continue learning"
        title={topic.title}
        titleId="continue-title"
        aside={<Pill tone={topic.status === 'in_progress' ? 'accent' : 'neutral'}>{STATUS_LABEL[topic.status]}</Pill>}
      />
      <Detail>
        {phase.name}
        {topic.estimated_hours != null ? ` · ${hours(topic.estimated_hours)} estimated` : ''}
      </Detail>
      <Bar value={progress} label={`${topic.title}: ${progress}% complete`} sx={{ mt: '10px' }} />
      <Detail sx={{ mt: '7px' }}>{progress}% complete</Detail>
      {topic.learning_objective && (
        <Sub sx={{ mt: '12px', mb: 0 }}>{excerpt(topic.learning_objective)}</Sub>
      )}
      <Actions sx={{ mt: '14px' }}>
        <Button variant="contained" component={RouterLink} to={topicHref}>Continue</Button>
        <Button variant="outlined" component={RouterLink} to={`${topicHref}/demonstrate`}>Demonstrate</Button>
      </Actions>
    </Panel>
  );
};

// ---- Roadmap -------------------------------------------------------------

const PhaseCard: React.FC<{ roadmapId: number; phase: RoadmapPhase }> = ({ roadmapId, phase }) => {
  const counted = phase.topics.filter((t) => t.status !== 'skipped');
  const done = counted.filter((t) => t.status === 'completed').length;
  const pct = counted.length > 0 ? Math.round((done / counted.length) * 100) : 0;
  const name = phase.name.length > 26 ? `${phase.name.slice(0, 26).trimEnd()}…` : phase.name;
  return (
    <Box
      component={RouterLink}
      to={`/roadmaps/${roadmapId}`}
      aria-label={`${phase.name}: ${done} of ${counted.length} topics complete`}
      sx={{
        display: 'block', textDecoration: 'none', color: 'text.primary', minWidth: 0,
        bgcolor: 'surfaceContainerHigh.main', border: '1px solid', borderColor: 'divider', borderRadius: '13px', p: '20px',
        '&:hover': { borderColor: 'primary.main' },
      }}
    >
      <Eyebrow>{name}</Eyebrow>
      <BigFigure size={22} sx={{ mt: '4px' }}>{done} / {counted.length}</BigFigure>
      <Bar value={pct} label={`${phase.name}: ${pct}% complete`} sx={{ mt: '8px' }} />
    </Box>
  );
};

const RoadmapPanel: React.FC<{
  detail: RoadmapDetail;
  linked: boolean;
  preparation: Subject | null;
}> = ({ detail, linked, preparation }) => {
  const { progress } = detail;
  const phases = [...detail.phases].sort(byOrder);
  const pct = progress.completion_percentage;
  const facts = [
    `${progress.completed_count} / ${progress.total_topics} topics`,
    `${phases.length} ${phases.length === 1 ? 'phase' : 'phases'}`,
    ...(progress.total_estimated_hours != null ? [`${hours(progress.total_estimated_hours)} planned`] : []),
  ];

  return (
    <Panel component="section" aria-labelledby="roadmap-title">
      <PanelHead
        eyebrow="Roadmap"
        title={detail.title}
        titleId="roadmap-title"
        aside={(
          <>
            <Button variant="outlined" component={RouterLink} to="/roadmaps">All roadmaps</Button>
            <Button variant="contained" color="ink" component={RouterLink} to={`/roadmaps/${detail.id}`}>
              View roadmap
            </Button>
          </>
        )}
      >
        <Detail>{facts.join(' · ')}</Detail>
      </PanelHead>
      <Bar
        value={pct ?? 0}
        label={pct != null ? `${detail.title}: ${Math.round(pct)}% of topics complete` : `${detail.title}: no topics to count`}
      />
      {phases.length > 0 && (
        <Grid columns={4} sx={{ mt: '14px' }}>
          {phases.slice(0, 4).map((phase) => <PhaseCard key={phase.id} roadmapId={detail.id} phase={phase} />)}
        </Grid>
      )}
      {!linked && preparation && (
        <Note sx={{ mt: '14px' }}>
          This roadmap is not linked to {preparation.name}. It belongs to no preparation yet, so switching
          preparation does not change it — link it from Roadmaps to track it with {preparation.name}.
        </Note>
      )}
    </Panel>
  );
};

// ---- the page ------------------------------------------------------------

export const StudyLibraryPage: React.FC = () => {
  const { selected, loading: loadingPreparation } = usePreparation();
  const [chosen, setChosen] = useState<{ roadmap: RoadmapSummary; linked: boolean } | null>(null);
  const [detail, setDetail] = useState<RoadmapDetail | null>(null);
  const [loadingRoadmap, setLoadingRoadmap] = useState(true);
  const [roadmapError, setRoadmapError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const subjectId = selected?.id ?? null;

  useEffect(() => {
    if (loadingPreparation) return undefined;
    let cancelled = false;
    setLoadingRoadmap(true);
    setRoadmapError(null);
    (async () => {
      try {
        const pick = chooseRoadmap(await getRoadmaps(), subjectId);
        const full = pick ? await getRoadmap(pick.roadmap.id) : null;
        if (cancelled) return;
        setChosen(pick);
        setDetail(full);
      } catch (err) {
        if (!cancelled) setRoadmapError(apiErrorMessage(err, ''));
      } finally {
        if (!cancelled) setLoadingRoadmap(false);
      }
    })();
    return () => { cancelled = true; };
  }, [subjectId, loadingPreparation, attempt]);

  return (
    <Box>
      <PageHead
        eyebrow={selected?.name}
        title="Learn"
        sub="What to learn next, and how to prove you have learnt it."
      />

      <Section>
        <Grid columns={2}>
          <RecommendedPanel preparation={selected} loadingPreparation={loadingPreparation} />
          {loadingRoadmap || loadingPreparation ? (
            <Panel soft component="section" aria-label="Continue learning">
              <LoadingState label="Loading your roadmap…" />
            </Panel>
          ) : roadmapError !== null ? (
            <Panel soft component="section" aria-label="Continue learning">
              <ErrorState what="Could not load your roadmaps." saved="nothing_to_save" detail={roadmapError} onRetry={retry} />
            </Panel>
          ) : (
            <ContinuePanel detail={detail} hasRoadmap={chosen !== null} />
          )}
        </Grid>
      </Section>

      <Section>
        {loadingRoadmap || loadingPreparation ? null : roadmapError !== null ? null : detail && chosen ? (
          <RoadmapPanel detail={detail} linked={chosen.linked} preparation={selected} />
        ) : (
          <Panel component="section" aria-labelledby="roadmap-title">
            <PanelHead
              eyebrow="Roadmap"
              title="No roadmap yet"
              titleId="roadmap-title"
              aside={<Button variant="contained" color="ink" component={RouterLink} to="/roadmaps">Open Roadmaps</Button>}
            />
            <Sub sx={{ mb: 0 }}>
              A roadmap is a plan of phases and topics, imported from Excel, CSV, JSON or Markdown — one row per topic.
              {selected ? ` Link one to ${selected.name} and its progress shows here.` : ''}
            </Sub>
          </Panel>
        )}
      </Section>
    </Box>
  );
};
