// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import { getContentPack, getDomainDetail, getReferenceSheets, getRoadmap, getScopedRoadmaps } from '../services/api';
import { apiErrorMessage } from '../services/apiError';
import { usePreparation } from '../context/PreparationContext';
import { getSubjectCapabilities } from '../services/capabilities';
import type { DomainDetail } from '../types/analytics';
import type { ContentPackDetail } from '../types/contentPack';
import type {
  ReferenceSheet, RoadmapDetail, RoadmapPhase, RoadmapSummary, RoadmapTopic, RoadmapTopicStatus,
} from '../types/roadmap';
import type { Subject } from '../types/subject';
import { ErrorState, LoadingState } from '../components/common/States';
import {
  Actions, Bar, BigFigure, Detail, Eyebrow, Grid, Metric, MetricRow, Note, PageHead, Panel, PanelHead, Pill, Row, Section, Sub,
} from '../components/ui/primitives';
import { classifyResource } from '../utils/resourceClassification';
import { chooseRoadmap } from '../services/roadmapChoice';

export { chooseRoadmap };

/**
 * The Study Library: the user's learning workspace.
 *
 * Answers: “What should I study now, and how do I learn/prove it?”
 *
 * Information architecture order:
 *   1. Recommended       weakest area from readiness figures
 *   2. Continue Learning topic in progress or next not started
 *   3. Relevant Guide    attached guide packs and mapped chapters from active topic
 *   4. Reference Material reference sheets from roadmaps (concepts, models, courses)
 *   5. Practice          weak area drills, spaced review, question bank, mock exam
 *   6. Demonstrate       prove learning against criteria unprompted
 *   7. Roadmap Progress  overarching roadmap progress anchoring the learning
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

/** The topic in progress, else the first one not started, in plan order. */
export function topicToContinue(detail: RoadmapDetail): { topic: RoadmapTopic; phase: RoadmapPhase } | null {
  const flat = [...detail.phases].sort(byOrder)
    .flatMap((phase) => [...phase.topics].sort(byOrder).map((topic) => ({ topic, phase })));
  return flat.find((x) => x.topic.status === 'in_progress')
    ?? flat.find((x) => x.topic.status === 'not_started')
    ?? null;
}

// ---- 1. Recommended ------------------------------------------------------

const RecommendedPanel: React.FC<{
  preparation: Subject | null;
  loadingPreparation: boolean;
  activeRoadmap?: RoadmapDetail | null;
}> = ({
  preparation, loadingPreparation, activeRoadmap,
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
        {preparation && preparation.question_count > 0 && (
          <Actions sx={{ mt: '16px' }}>
            <Button
              variant="contained"
              component={RouterLink}
              to={`/exam-setup?kind=drill&subject=${preparation.id}&limit=5`}
            >
              Take a quick diagnostic (5 questions)
            </Button>
            {preparation.has_exam_profile && (
              <Button
                variant="outlined"
                component={RouterLink}
                to={`/exam-setup?kind=mock&subject=${preparation.id}`}
              >
                Take a full mock
              </Button>
            )}
          </Actions>
        )}
      </Panel>
    );
  }

  const domainState = preparation.readiness.domains.find((d) => d.domain === area)?.state;
  const underFloor = domainState === 'needs_work';
  const floor = preparation.readiness.rules?.domain_floor_pct;

  // Look for a roadmap topic matching this area
  const matchedTopic = activeRoadmap?.phases.flatMap((ph) => ph.topics.map((t) => ({ topic: t, phase: ph })))
    .find((x) => x.topic.title.toLowerCase().includes(area.toLowerCase()) || area.toLowerCase().includes(x.topic.title.toLowerCase()));

  const areaHref = `/analytics/area?subject=${preparation.id}&domain=${encodeURIComponent(area)}`;
  const drillHref = `/exam-setup?kind=drill&subject=${preparation.id}&domain=${encodeURIComponent(area)}`;

  return (
    <Panel component="section" aria-labelledby="recommended-title">
      <PanelHead
        eyebrow="Recommended"
        title={area}
        titleId="recommended-title"
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
          {matchedTopic && (
            <Detail sx={{ mt: '10px' }}>
              Mapped to roadmap: <strong>{matchedTopic.topic.title}</strong> ({matchedTopic.phase.name})
            </Detail>
          )}
        </>
      )}
      <Actions sx={{ mt: '16px' }}>
        <Button variant="contained" component={RouterLink} to={areaHref}>Start learning</Button>
        <Button variant="outlined" component={RouterLink} to={drillHref}>Practise instead</Button>
      </Actions>
    </Panel>
  );
};

// ---- 2. Continue learning ------------------------------------------------

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
        <Button variant="outlined" component={RouterLink} to={`${topicHref}/demonstrate`} state={{ from: '/learn' }}>Demonstrate</Button>
      </Actions>
    </Panel>
  );
};

// ---- 3. Relevant Guide ----------------------------------------------------

/** One attached pack's chapters, each with a way to read it. */
const GuidePackPanel: React.FC<{ pack: ContentPackDetail }> = ({ pack }) => (
  <Panel component="section" aria-labelledby={`guide-${pack.pack_id}`}>
    <PanelHead
      eyebrow="Relevant Guide"
      title={pack.title}
      titleId={`guide-${pack.pack_id}`}
      aside={<Button variant="outlined" component={RouterLink} to={`/learn/guides/${pack.pack_id}`}>All chapters</Button>}
    >
      <Detail>{pack.chapters.length} chapters · Shared study reference material</Detail>
    </PanelHead>
    {pack.chapters.map((c, i) => (
      <Row
        key={c.id}
        title={`${i + 1} · ${c.title}`}
        detail={c.summary}
        action={(
          <Button
            size="small"
            variant="outlined"
            component={RouterLink}
            to={`/learn/guides/${pack.pack_id}/${c.id}`}
            aria-label={`Read chapter ${i + 1}: ${c.title}`}
          >
            Read
          </Button>
        )}
      />
    ))}
  </Panel>
);

const RelevantGuideSection: React.FC<{
  preparation: Subject | null;
  activeTopic?: RoadmapTopic | null;
}> = ({ preparation, activeTopic }) => {
  const mapped = activeTopic?.mapped_chapters ?? [];
  const links = preparation?.content_packs ?? [];
  const [packs, setPacks] = useState<ContentPackDetail[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPacks([]);
    setError(null);
    if (links.length === 0) return undefined;
    let cancelled = false;
    Promise.all(links.map((cp) => getContentPack(cp.pack_id, cp.pack_version)))
      .then((result) => { if (!cancelled) setPacks(result); })
      .catch((err) => { if (!cancelled) setError(apiErrorMessage(err, '')); });
    return () => { cancelled = true; };
  }, [preparation?.id, links.length]);

  if (mapped.length === 0 && links.length === 0) return null;

  return (
    <Section>
      {mapped.length > 0 && (
        <Panel component="section" aria-labelledby="relevant-guide-topic-title" sx={{ mb: packs.length > 0 ? '16px' : 0 }}>
          <PanelHead
            eyebrow={`Relevant Guide · ${mapped[0].pack_title}`}
            title={activeTopic ? `Study Guide for ${activeTopic.title}` : mapped[0].chapter_title}
            titleId="relevant-guide-topic-title"
            aside={mapped.length === 1 && mapped[0].coverage ? (
              <Pill tone="success">{mapped[0].coverage} Coverage</Pill>
            ) : undefined}
          >
            <Detail>
              Curated built-in study guide mapped to your active roadmap topic.
            </Detail>
          </PanelHead>
          <Box sx={{ display: 'grid', gap: '12px', mt: '14px' }}>
            {mapped.map((ch) => (
              <Box
                key={ch.chapter_id}
                sx={{
                  p: '14px 16px',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <Box sx={{ flex: 1, minWidth: 260 }}>
                    <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 700 }}>
                      Chapter {ch.chapter_number} · {ch.chapter_title}
                    </Typography>
                    {ch.chapter_summary && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: '4px' }}>
                        {ch.chapter_summary}
                      </Typography>
                    )}
                  </Box>
                  <Actions>
                    <Button
                      variant="contained"
                      color="ink"
                      component={RouterLink}
                      to={`/learn/guides/${ch.pack_id}/${ch.chapter_id}`}
                      aria-label={`Read chapter ${ch.chapter_number}: ${ch.chapter_title}`}
                    >
                      Read Chapter {ch.chapter_number}
                    </Button>
                  </Actions>
                </Box>
                {ch.relevant_sections && (
                  <Detail sx={{ mt: '10px' }}>
                    <strong>Relevant sections:</strong> {ch.relevant_sections}
                  </Detail>
                )}
                {ch.learning_evidence && (
                  <Detail sx={{ mt: '6px', color: 'success.dark' }}>
                    <strong>Learning evidence:</strong> {ch.learning_evidence}
                  </Detail>
                )}
              </Box>
            ))}
          </Box>
        </Panel>
      )}

      {error !== null ? (
        <Panel component="section" aria-label="Guide">
          <ErrorState what="Could not load your guide." saved="nothing_to_save" detail={error} />
        </Panel>
      ) : packs.length > 0 && (
        <Box sx={{ display: 'grid', gap: '16px' }}>
          {packs.map((pack) => <GuidePackPanel key={pack.pack_id} pack={pack} />)}
        </Box>
      )}
    </Section>
  );
};

// ---- 4. Reference Material ------------------------------------------------

/** The selected preparation's reference sheets, each linking to its Roadmaps tab. */
const ReferenceSheetsSection: React.FC<{ preparation: Subject | null }> = ({ preparation }) => {
  const [sheets, setSheets] = useState<ReferenceSheet[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const preparationId = preparation?.id ?? null;

  useEffect(() => {
    setSheets([]);
    setError(null);
    if (preparationId === null) return undefined;
    let cancelled = false;
    getReferenceSheets(preparationId)
      .then((result) => { if (!cancelled) setSheets(result); })
      .catch((err) => { if (!cancelled) setError(apiErrorMessage(err, '')); });
    return () => { cancelled = true; };
  }, [preparationId, attempt]);

  if (error !== null) {
    return (
      <Section>
        <Panel component="section" aria-label="Your reference sheets">
          <ErrorState
            what="Could not load your reference sheets."
            saved="nothing_to_save"
            detail={error}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        </Panel>
      </Section>
    );
  }
  if (sheets.length === 0) return null;

  return (
    <Section>
      <Panel component="section" aria-labelledby="reference-sheets-title">
        <PanelHead eyebrow="Reference Material" title="Your reference sheets" titleId="reference-sheets-title">
          <Detail>{sheets.length} {sheets.length === 1 ? 'sheet' : 'sheets'} from your roadmaps — concepts, comparisons, and mental models to study from</Detail>
        </PanelHead>
        {sheets.map((sheet) => {
          const kind = classifyResource(sheet.name, 'reference');
          return (
            <Row
              key={sheet.resource_id}
              title={sheet.name}
              detail={sheet.roadmap_title}
              middle={<Pill tone={kind.tone}>{kind.label}</Pill>}
              action={(
                <Button
                  size="small"
                  variant="outlined"
                  component={RouterLink}
                  to={`/roadmaps/${sheet.roadmap_id}?resource=${sheet.resource_id}`}
                  aria-label={`Open ${sheet.name} in ${sheet.roadmap_title}`}
                >
                  Open
                </Button>
              )}
            />
          );
        })}
      </Panel>
    </Section>
  );
};

// ---- 5. Practice ---------------------------------------------------------

const PracticeCard: React.FC<{ to: string; eyebrow: string; title: string; detail: string }> = ({
  to, eyebrow, title, detail,
}) => (
  <Box
    component={RouterLink}
    to={to}
    sx={{
      display: 'block', textDecoration: 'none', color: 'text.primary', minWidth: 0,
      bgcolor: 'surfaceContainerHigh.main', border: '1px solid', borderColor: 'divider', borderRadius: '13px', p: '18px',
      '&:hover': { borderColor: 'primary.main' },
    }}
  >
    <Eyebrow>{eyebrow}</Eyebrow>
    <Typography variant="h6" component="h3" sx={{ mt: '4px', fontSize: (t) => t.typography.pxToRem(15) }}>
      {title}
    </Typography>
    <Detail sx={{ mt: '6px' }}>{detail}</Detail>
  </Box>
);

/**
 * What this preparation can really practise (Phase 7, WP 7.5). Exam practice -- drill,
 * spaced review, question bank, mock -- only for a certification whose bank has
 * questions; a skill gets its scenarios and its lab when it has them. Nothing is
 * offered because a route exists: ADF, Databricks and Agentic AI are never offered a
 * mock, and a certification with an empty bank (Kafka) is told why it has none.
 */
const PracticeSection: React.FC<{
  preparation: Subject | null;
  weakestArea?: string | null;
}> = ({ preparation, weakestArea }) => {
  if (!preparation) return null;
  const caps = getSubjectCapabilities(preparation);
  const exam = caps.certification && caps.questionAvailability;
  const cards: { to: string; eyebrow: string; title: string; detail: string }[] = [];
  if (exam) {
    cards.push({
      to: weakestArea
        ? `/exam-setup?kind=drill&subject=${preparation.id}&domain=${encodeURIComponent(weakestArea)}`
        : `/exam-setup?kind=drill&subject=${preparation.id}`,
      eyebrow: 'Targeted Drill',
      title: weakestArea ? `Drill ${weakestArea}` : 'Weak area drill',
      detail: 'Focus on questions in your lowest-scoring area',
    });
    cards.push({ to: '/practice/spaced', eyebrow: 'Memory Retrieval', title: 'Spaced Review', detail: 'Review questions scheduled for memory retention' });
    cards.push({ to: '/question-bank', eyebrow: 'Question Bank', title: 'Browse by Topic', detail: 'Filter questions by curriculum topics and keywords' });
    cards.push({ to: `/exam-setup?kind=mock&subject=${preparation.id}`, eyebrow: 'Full Simulation', title: 'Mock Exam', detail: 'Simulate full exam conditions and update readiness' });
  }
  if (caps.scenarios) {
    cards.push({ to: '/scenarios', eyebrow: 'Scenarios', title: 'Work a scenario', detail: 'Answer its checks and write your case notes' });
  }
  if (caps.lakehouseLab) {
    cards.push({ to: '/databricks-sandbox', eyebrow: 'Learning Lab', title: 'Lakehouse Lab', detail: 'Predict, run and explain against the Delta engine' });
  } else if (caps.learningLabStatus === 'AVAILABLE') {
    cards.push({ to: '/lab', eyebrow: 'Learning Lab', title: 'Run an experiment', detail: 'Predict, change a lever, observe and explain' });
  }

  return (
    <Section>
      <Panel component="section" aria-labelledby="study-practice-title">
        <PanelHead
          eyebrow="Practice"
          title="Practise what you are learning"
          titleId="study-practice-title"
          aside={exam ? <Button variant="outlined" component={RouterLink} to="/practice">All practice formats</Button> : undefined}
        >
          <Detail>
            {exam
              ? 'Test recall and understanding against exam questions and spaced reviews.'
              : caps.certification
                ? `${preparation.name} has no questions loaded yet, so there is no drill or mock to take. Import a question bank to open them.`
                : `What ${preparation.name} can practise: what it really has, nothing else.`}
          </Detail>
        </PanelHead>
        {cards.length > 0 ? (
          <Grid columns={4} sx={{ mt: '14px' }}>
            {cards.map((c) => <PracticeCard key={c.to} {...c} />)}
          </Grid>
        ) : !caps.certification ? (
          <Detail sx={{ mt: '10px' }}>Nothing to practise here yet: this preparation has no scenarios or lab.</Detail>
        ) : null}
      </Panel>
    </Section>
  );
};

// ---- 6. Demonstrate ------------------------------------------------------

const DemonstrateSection: React.FC<{
  detail: RoadmapDetail | null;
  hasRoadmap: boolean;
}> = ({ detail, hasRoadmap }) => {
  const next = detail ? topicToContinue(detail) : null;

  return (
    <Section>
      <Panel component="section" aria-labelledby="study-demonstrate-title">
        <PanelHead
          eyebrow="Demonstrate"
          title="Prove your learning"
          titleId="study-demonstrate-title"
          aside={next ? (
            <Button
              variant="contained"
              color="ink"
              component={RouterLink}
              to={`/roadmaps/${next.topic.roadmap_id}/topics/${next.topic.id}/demonstrate`}
              state={{ from: '/learn' }}
            >
              Demonstrate topic
            </Button>
          ) : undefined}
        >
          <Detail>
            Completion is earned by demonstrating a topic unprompted against its success criterion — not by time spent or a checkbox.
          </Detail>
        </PanelHead>
        {next ? (
          <Box sx={{ mt: '14px', p: '16px', borderRadius: '9px', bgcolor: 'surfaceContainerHigh.main', border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <Box>
                <Eyebrow>Current topic to demonstrate</Eyebrow>
                <Typography variant="h6" component="h3" sx={{ mt: '2px', fontSize: (t) => t.typography.pxToRem(16) }}>
                  {next.topic.title}
                </Typography>
                <Detail sx={{ mt: '2px' }}>{next.phase.name}</Detail>
              </Box>
              <Actions>
                <Button
                  variant="outlined"
                  component={RouterLink}
                  to={`/roadmaps/${next.topic.roadmap_id}/topics/${next.topic.id}`}
                >
                  View criteria
                </Button>
                <Button
                  variant="contained"
                  color="ink"
                  component={RouterLink}
                  to={`/roadmaps/${next.topic.roadmap_id}/topics/${next.topic.id}/demonstrate`}
                  state={{ from: '/learn' }}
                >
                  Demonstrate now
                </Button>
              </Actions>
            </Box>
            {next.topic.success_criteria && (
              <Note sx={{ mt: '12px' }}>
                <Box component="b" sx={{ display: 'block', mb: '2px' }}>Criterion to meet unprompted:</Box>
                {next.topic.success_criteria}
              </Note>
            )}
          </Box>
        ) : (
          <Sub sx={{ mb: 0 }}>
            {hasRoadmap
              ? 'All topics in your active roadmap have been demonstrated! Choose another topic from your roadmap to recheck or keep skills sharp.'
              : 'Select a roadmap topic to demonstrate mastery against its success criterion.'}
          </Sub>
        )}
      </Panel>
    </Section>
  );
};

// ---- 7. Roadmap Progress -------------------------------------------------

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
        eyebrow="Roadmap Progress"
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
        const pick = chooseRoadmap(await getScopedRoadmaps(subjectId), subjectId);
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

  const activeTopic = detail ? topicToContinue(detail)?.topic ?? null : null;

  return (
    <Box>
      <PageHead
        eyebrow={selected ? `${selected.name} · Learning Workspace` : 'Learning Workspace'}
        title="Study Library"
        sub="What to study now, and how to learn and prove it."
        actions={(
          <>
            <Button variant="outlined" component={RouterLink} to="/roadmaps">Roadmaps</Button>
            {chosen && (
              <Button variant="outlined" component={RouterLink} to={`/roadmaps/${chosen.roadmap.id}`}>
                Active Plan ({chosen.roadmap.title})
              </Button>
            )}
          </>
        )}
      />

      {/* 1. Recommended & 2. Continue Learning */}
      <Section>
        <Grid columns={2}>
          <RecommendedPanel
            preparation={selected}
            loadingPreparation={loadingPreparation}
            activeRoadmap={detail}
          />
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

      {/* 3. Relevant Guide (curated mapped curriculum for active topic + content packs) */}
      <RelevantGuideSection preparation={selected} activeTopic={activeTopic} />

      {/* 4. Reference Material */}
      <ReferenceSheetsSection preparation={selected} />

      {/* 5. Practice */}
      <PracticeSection preparation={selected} weakestArea={selected?.readiness.weakest_domain} />

      {/* 6. Demonstrate */}
      <DemonstrateSection detail={detail} hasRoadmap={chosen !== null} />

      {/* 7. Roadmap Progress */}
      <Section>
        {loadingRoadmap || loadingPreparation ? null : roadmapError !== null ? null : detail && chosen ? (
          <RoadmapPanel detail={detail} linked={chosen.linked} preparation={selected} />
        ) : (
          <Panel component="section" aria-labelledby="roadmap-title">
            <PanelHead
              eyebrow="Roadmap Progress"
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
