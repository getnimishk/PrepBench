// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Stack, Typography, useTheme } from '@mui/material';
import { ChevronRight, Map as RouteMap } from 'lucide-react';
import {
  getSubjects, getHomeSummary, getOtherPreparation, getFocusTopics, getDailyGoals, getRoadmaps,
} from '../services/api';
import { DailyGoals } from '../components/home/DailyGoals';
import { usePreparation } from '../context/PreparationContext';
import {
  Blocker, DailyGoals as DailyGoalsData,
  FocusTopic, HomeSummary, OtherPreparation, Readiness, Resumable, Subject, READINESS_LABELS,
} from '../types/subject';
import type { RoadmapSummary } from '../types/roadmap';
import { blockerSentence, pct, plateauSentence, readySentence } from '../services/readinessText';
import { nextAction } from '../services/recommendation';
import { WhyThis } from '../components/common/WhyThis';
import { LoadingState } from '../components/common/States';
import {
  Actions, BigFigure, Detail, Good, Grid, Metric, MetricRow, Note, PageHead, Panel, PanelHead, Pill, Row, Section, Sub,
  type Tone,
} from '../components/ui/primitives';
import { usePb } from '../theme/usePb';
import { chooseRoadmap } from '../services/roadmapChoice';

/**
 * Where you stand, why, and the one thing worth doing about it.
 *
 * Laid out as the unified prototype's Home: the verdict with the preparation as
 * its eyebrow; today's two goals; the current evidence beside the next useful
 * action; what is already in motion; and, across the other preparations, what
 * needs attention. The topics to focus on and the rest of the preparation stay
 * under it, quieter.
 *
 * Four rounds of correction landed here before the prototype did, and what
 * they refused is still refused: a streak, a goal ring, a second chart, an
 * activity feed, a wall of unrelated KPI cards, and an invented "weakest area".
 * Every figure is read from the rows that caused it, and the one chart is the
 * mocks readiness is computed from, drawn against the pass mark.
 *
 * A daily goal was on that list, and was put back in Phase 4 by decision,
 * against the unified prototype. What was refused was a quota that turns a
 * quiet day into a failure; the two goals here are not that. See
 * components/home/DailyGoals.tsx.
 */

/** How many focus topics the panel shows before deferring to Insights. */
const FOCUS_LIMIT = 4;

/**
 * The subject being prepared for: the one chosen in the header's picker.
 *
 * This used to be inferred -- the subject with an exam profile and the most
 * evidence behind it -- which meant Home ignored the picker entirely: switch to
 * Databricks and Home went on describing PSM I. The inference stays only as the
 * fallback for when nothing is selected, which is also what keeps this page
 * rendering outside a PreparationProvider.
 */
const pickPrimary = (subjects: Subject[], selectedId: number | null): Subject => {
  const inferred =
    [...subjects]
      .filter((s) => s.has_exam_profile)
      .sort((a, b) => b.readiness.mock_count - a.readiness.mock_count)[0]
    ?? subjects[0];
  return subjects.find((s) => s.id === selectedId) ?? inferred;
};

const shortDate = (iso?: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

/** "today" where that is true, and a date where it is not. */
const worked = (iso?: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  const sameDay = d.getFullYear() === today.getFullYear()
    && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  return sameDay ? 'today' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

const hours = (h: number) => (Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`);

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedId } = usePreparation();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [other, setOther] = useState<OtherPreparation[]>([]);
  const [roadmaps, setRoadmaps] = useState<RoadmapSummary[]>([]);
  const [focus, setFocus] = useState<FocusTopic[]>([]);
  const [goals, setGoals] = useState<DailyGoalsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      getSubjects(),
      getHomeSummary(),
      getOtherPreparation().catch(() => []),
      // Supporting detail: a roadmap that cannot be read costs its one row, not the page.
      getRoadmaps().catch(() => []),
    ])
      .then(([s, h, o, r]) => { setSubjects(s); setSummary(h); setOther(o); setRoadmaps(r); })
      .catch(() => setError('Could not reach PrepBench’s backend, so this page has nothing '
        + 'to show yet. Nothing has been lost — your history is in the database on this machine.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Worked out before the early returns below, because the focus list is
  // fetched for it and hooks cannot follow a return.
  const primaryId = useMemo(
    () => (subjects.length === 0 ? null : pickPrimary(subjects, selectedId).id),
    [subjects, selectedId],
  );

  // The weak topics of the preparation on screen. Topic names repeat across
  // banks, so a pooled list named another preparation's topics here -- and
  // linked each one to a drill of this preparation that would refuse it. The
  // list is supporting detail, so losing it must not cost the verdict.
  useEffect(() => {
    if (primaryId == null) return undefined;
    let cancelled = false;
    getFocusTopics(primaryId)
      .then((f) => { if (!cancelled) setFocus(f); })
      .catch(() => { if (!cancelled) setFocus([]); });
    return () => { cancelled = true; };
  }, [primaryId]);

  // The goals are fetched on their own, and again whenever the preparation
  // changes -- the certification goal belongs to one preparation, so switching
  // must replace it. Separate from the main load so that a failure here costs
  // the learner the goals and not the verdict, which is why they opened the page.
  useEffect(() => {
    let cancelled = false;
    getDailyGoals(selectedId)
      .then((g) => { if (!cancelled) setGoals(g); })
      .catch(() => { if (!cancelled) setGoals(null); });
    return () => { cancelled = true; };
  }, [selectedId]);

  if (loading) {
    return <LoadingState label="Loading your progress…" />;
  }
  // Actionable rather than merely truthful: an error the reader can only
  // look at is a dead end, and this is the first screen of the product.
  if (error) {
    return (
      <Alert
        severity="error"
        action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}
      >
        {error}
      </Alert>
    );
  }

  if (subjects.length === 0) {
    return (
      <PageHead
        title="Nothing to measure yet"
        sub="Import a question bank and PrepBench will start keeping track of where you stand."
        actions={<Button variant="contained" onClick={() => navigate('/question-bank')}>Import questions</Button>}
      />
    );
  }

  const primary = pickPrimary(subjects, selectedId);
  const r = primary.readiness;
  const unmeasured = r.mock_count === 0 && r.state === 'needs_evaluation';

  const counts = summary?.per_subject.find((p) => p.subject_id === primary.id);
  const unreviewed = counts?.unreviewed ?? 0;
  // This preparation's unfinished session only. The top-level one is the newest
  // across all preparations, and "Pick it up" on it opened another preparation.
  const resumable = counts?.resumable ?? null;

  // The preparation's own roadmaps count toward it; another preparation's never do.
  const own = roadmaps.filter((m) => !m.is_archived && m.subject_id === primary.id);
  const topicsProgressed = own.length > 0
    ? own.reduce((n, m) => n + m.progress.completed_count + m.progress.in_progress_count, 0)
    : null;
  const activeRoadmap = chooseRoadmap(roadmaps, primary.id);

  const description = primary.description?.trim().replace(/\.$/, '');

  return (
    <Box>
      <PageHead
        eyebrow={(
          <Box
            component={RouterLink}
            to={`/subjects/${primary.id}`}
            sx={{
              color: 'inherit', textDecoration: 'none',
              '&:hover': { color: 'primary.main' },
            }}
          >
            {primary.name}
          </Box>
        )}
        title={unmeasured ? 'Not measured yet' : READINESS_LABELS[r.state]}
        sub={`${description ? `${description}. ` : ''}Two things stay warm every day: certification readiness and interview readiness.`}
      />

      {goals && (
        <Section>
          <DailyGoals goals={goals} />
        </Section>
      )}

      <Section>
        <Grid columns={2}>
          <CurrentEvidence subject={primary} topicsProgressed={topicsProgressed} />
          <NextUsefulAction subject={primary} unreviewed={unreviewed} resumable={resumable} />
        </Grid>
      </Section>

      <Section>
        <InMotion
          subject={primary}
          resumable={resumable}
          goals={goals}
          unreviewed={unreviewed}
          roadmap={activeRoadmap?.roadmap ?? null}
        />
      </Section>

      <NeedsAttention subjects={subjects.filter((s) => s.id !== primary.id)} />

      {(focus.length > 0 || other.length > 0) && (
        <Section>
          <Grid columns={2}>
            {focus.length > 0 && <FocusTopics topics={focus} subject={primary} />}
            {other.length > 0 && <OtherPreparationPanel items={other} />}
          </Grid>
        </Section>
      )}
    </Box>
  );
};

/**
 * The shape of the last few papers, drawn.
 *
 * Four numbers in a row answer "what did I get". They do not answer "am I
 * improving" without the reader doing the arithmetic, and that is the question
 * this picture exists for -- so the pass mark is drawn as a line rather than
 * printed as a figure, and whether the run has crossed it is then something
 * you see rather than something you work out.
 *
 * It is deliberately NOT built on /analytics/score-trends, which is the series
 * Insights charts. That endpoint pools every completed session: on this
 * database it contains a 5.0%, a 36.2% and a 60.0% from drills and practice
 * runs. Charting those under "your progress" would contradict the verdict
 * printed directly above it, which is computed from mocks alone. The series
 * here is `recent_scores` -- the same numbers, from the same rule, as the
 * state it is evidence for.
 *
 * The prototype draws five bars of invented height here. A line against the
 * pass mark is kept instead: the bars had no pass mark to be read against.
 */
const TrendChart: React.FC<{ scores: number[]; passMark: number | null }> = ({
  scores, passMark,
}) => {
  const theme = useTheme();
  const pb = usePb();
  // One point is a dot, not a trend. Say nothing rather than draw nothing.
  if (scores.length < 2) return null;

  const W = 460;
  const H = 116;
  const padX = 26;
  const padTop = 18;
  const padBottom = 26;

  // Scaled to the run and the pass mark together, so the line's relationship
  // to the mark is the thing the height encodes.
  const values = passMark != null ? [...scores, passMark] : scores;
  const lo = Math.max(0, Math.min(...values) - 8);
  const hi = Math.min(100, Math.max(...values) + 8);
  const span = hi - lo || 1;

  const x = (i: number) => padX + (i * (W - padX * 2)) / (scores.length - 1);
  const y = (v: number) => padTop + (1 - (v - lo) / span) * (H - padTop - padBottom);

  const line = scores.map((s, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(s)}`).join(' ');
  const area = `${line} L ${x(scores.length - 1)} ${H - padBottom} L ${x(0)} ${H - padBottom} Z`;
  const accent = theme.palette.primary.main;
  // Scale SVG text labels when Large text setting is active (fontSize scales from 14 to 16)
  const textScale = theme.typography.fontSize / 14;

  return (
    <Box sx={{ width: '100%', minWidth: 0, mt: '17px' }}>
      <Box
        component="svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={
          `Your last ${scores.length} ${scores.length === 1 ? 'mock' : 'mocks'}: ${scores.map((s) => `${Math.round(s)}%`).join(', ')}.`
          + (passMark != null ? ` The pass mark is ${Math.round(passMark)}%.` : '')
        }
        sx={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="prepbench-trend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.16" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>

        {passMark != null && (
          <>
            <line
              x1={padX - 10} y1={y(passMark)} x2={W - padX + 10} y2={y(passMark)}
              stroke={pb.rule} strokeWidth="1"
              strokeDasharray="4 4"
            />
            {/* Left end, above the rule. Anchored to the right it landed on
                top of the final point, which is exactly where the eye goes. */}
            <text
              x={padX - 10} y={y(passMark) - 7} textAnchor="start"
              fontSize={Math.round(11 * textScale)} fontWeight="600"
              fill={theme.palette.text.secondary}
            >
              {Math.round(passMark)}% to pass
            </text>
          </>
        )}

        <path d={area} fill="url(#prepbench-trend)" />
        <path d={line} fill="none" stroke={accent} strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" />

        {scores.map((s, i) => {
          const under = passMark != null && s < passMark;
          return (
            <g key={i}>
              <circle
                cx={x(i)} cy={y(s)} r={i === scores.length - 1 ? 5.5 : 4}
                fill={under ? theme.palette.background.paper : accent}
                stroke={accent} strokeWidth="2.5"
              />
              <text
                x={x(i)} y={H - 8} textAnchor="middle"
                fontSize={Math.round(12 * textScale)} fontWeight={i === scores.length - 1 ? 700 : 500}
                fill={i === scores.length - 1
                  ? theme.palette.text.primary : theme.palette.text.secondary}
              >
                {Math.round(s)}%
              </text>
            </g>
          );
        })}
      </Box>
    </Box>
  );
};

/**
 * The prototype's "Current evidence": the latest qualifying run against the
 * pass mark, the evidence behind it, the lowest area, the roadmap work done,
 * and the run drawn.
 */
const CurrentEvidence: React.FC<{ subject: Subject; topicsProgressed: number | null }> = ({
  subject, topicsProgressed,
}) => {
  const r: Readiness = subject.readiness;
  const passMark = r.pass_mark ?? null;
  const scores = r.recent_scores ?? [];
  const latest = scores.length > 0 ? scores[scores.length - 1] : null;
  const weakest = r.weakest_domain ? r.domains.find((d) => d.domain === r.weakest_domain) : null;
  const last = shortDate(r.latest_taken_at);
  const moved = r.points_per_mock != null && r.points_per_mock !== 0
    ? `${r.points_per_mock > 0 ? '+' : ''}${r.points_per_mock} a mock`
    : null;

  return (
    <Panel component="section" aria-labelledby="home-evidence">
      <Typography variant="overline" component="h2" id="home-evidence" sx={{ display: 'block', color: 'pb.faint' }}>
        Current evidence
      </Typography>

      {r.mock_count === 0 ? (
        <>
          {/* No mocks means no evidence, and an empty band of zeroes would read
              as failure rather than as absence. */}
          <BigFigure>—</BigFigure>
          <Sub sx={{ mb: 0 }}>
            Readiness is read from full mocks under exam conditions, and none has been sat yet.
            Drills and review are practice; they do not move it.
          </Sub>
        </>
      ) : (
        <>
          <BigFigure detail={[passMark != null ? `· ${pct(passMark)} to pass` : null, moved ? `· ${moved}` : null].filter(Boolean).join(' ') || undefined}>
            {latest != null ? pct(latest) : '—'}
          </BigFigure>
          <MetricRow>
            <Metric value={`${r.mock_count} ${r.mock_count === 1 ? 'mock' : 'mocks'}`} label={last ? `evidence · last sat ${last}` : 'evidence'} />
            {/* The lowest area, named for what it is: under the floor only when
                the verdict says so. Calling an area above the floor "weakest"
                invents a problem a learner cannot tell from a real one. */}
            {weakest && weakest.score_pct != null && (
              <Metric
                value={pct(weakest.score_pct)}
                label={`${r.blockers.some((b) => b.kind === 'weak_domain' && b.domain === weakest.domain) ? 'under the floor' : 'lowest area'} · ${weakest.domain}`}
              />
            )}
            {topicsProgressed != null && <Metric value={topicsProgressed} label="topics progressed" />}
          </MetricRow>
          <Detail sx={{ mt: '14px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.secondary' }}>
            Your last {scores.length} mock{scores.length === 1 ? '' : 's'}
          </Detail>
          {scores.length >= 2 ? (
            <TrendChart scores={scores} passMark={passMark} />
          ) : (
            <Detail sx={{ mt: '14px' }}>
              One paper is a reading, not a direction. The shape of your progress appears from the second mock.
            </Detail>
          )}
          {r.most_improved && (
            <Detail sx={{ mt: '10px' }}>
              {r.most_improved.domain} went from {pct(r.most_improved.before_pct)} to {pct(r.most_improved.after_pct)} between your last two mocks.
            </Detail>
          )}
          <Detail sx={{ mt: '10px' }}>
            Broad assessments measure certification readiness; focused practice repairs gaps.
          </Detail>
        </>
      )}
    </Panel>
  );
};

/**
 * The prototype's "Next useful action": the one action, chosen from the
 * evidence rather than offered as a menu, and why the verdict is what it is.
 *
 * The ladder in services/recommendation reads the same blockers the verdict is
 * computed from, so the button changes as the evidence changes -- and "Why am
 * I seeing this?" shows the evidence and what would change it.
 */
const NextUsefulAction: React.FC<{
  subject: Subject;
  unreviewed: number;
  resumable: Resumable | null;
}> = ({ subject, unreviewed, resumable }) => {
  const navigate = useNavigate();
  const next = nextAction({ subject, unreviewed, resumable });
  const r = subject.readiness;
  const weak = r.blockers.find((b) => b.kind === 'weak_domain');
  const title = next.label === 'Weak area' && weak?.domain ? weak.domain : next.label;
  // A plateau is read from the state rather than from `blockers[0]`: PLATEAU is
  // a state, not an unmet condition, so the blocker list describes the score
  // and never the shape of it.
  const plateau = r.state === 'plateau';
  const blocker = r.blockers[0] ?? null;

  return (
    <Panel component="section" aria-labelledby="home-next">
      <PanelHead eyebrow="Next useful action" title={title} titleId="home-next" sx={{ mb: 0 }} />
      <Sub sx={{ mb: 0 }}>{next.why}</Sub>
      <WhyThis explanation={next} sx={{ mt: 1 }} />
      <Actions sx={{ mt: '16px' }}>
        {next.cta && next.to && (
          <Button variant="contained" onClick={() => navigate(next.to!)}>{next.cta}</Button>
        )}
        <Button variant="outlined" component={RouterLink} to={`/subjects/${subject.id}`}>Open preparation</Button>
      </Actions>
      {r.mock_count > 0 && (plateau || blocker ? (
        <Note sx={{ mt: '14px' }}>
          {plateau ? plateauSentence(r.recent_scores, r.rules) : blockerSentence(blocker!, r.rules)}
        </Note>
      ) : (
        <Good sx={{ mt: '14px' }}>{readySentence(r.pass_mark, r.rules)}</Good>
      ))}
    </Panel>
  );
};

/**
 * The prototype's "Continue -- Already in motion": work started and not
 * finished. Each row is only drawn when that work exists.
 */
const InMotion: React.FC<{
  subject: Subject;
  resumable: Resumable | null;
  goals: DailyGoalsData | null;
  unreviewed: number;
  roadmap: RoadmapSummary | null;
}> = ({ subject, resumable, goals, unreviewed, roadmap }) => {
  const goal = goals?.certification && goals.certification.subject_id === subject.id ? goals.certification : null;
  const dueToday = goal ? goal.remaining : 0;
  const rows: React.ReactNode[] = [];

  if (resumable) {
    const remaining = resumable.total - resumable.answered;
    const when = worked(resumable.started_at);
    rows.push(
      <Row
        key="session"
        title={resumable.title}
        detail={`${remaining} ${remaining === 1 ? 'question' : 'questions'} remaining${when ? ` · started ${when}` : ''}`}
        middle={<Pill>In progress</Pill>}
        action={<Button variant="outlined" component={RouterLink} to={`/exam/${resumable.session_id}`}>Continue</Button>}
      />,
    );
  }

  if (dueToday > 0 || unreviewed > 0) {
    const parts = [
      ...(goal && goal.due_for_review > 0 ? [`${goal.due_for_review} due from the schedule`] : []),
      ...(unreviewed > 0 ? [`${unreviewed} ${unreviewed === 1 ? 'miss' : 'misses'} not yet read`] : []),
    ];
    rows.push(
      <Row
        key="review"
        title="Review due today"
        detail={parts.join(' · ') || 'Misses from your mocks waiting to be read'}
        middle={<Pill tone="warning">{dueToday > 0 ? `${dueToday} due` : `${unreviewed} to read`}</Pill>}
        action={<Button variant="outlined" component={RouterLink} to="/review">Review</Button>}
      />,
    );
  }

  if (roadmap) {
    const p = roadmap.progress;
    const facts = [
      `${p.completed_count} of ${p.total_topics} topics complete${p.completion_percentage != null ? ` (${Math.round(p.completion_percentage)}%)` : ''}`,
      ...(p.total_estimated_hours != null ? [`${hours(p.total_estimated_hours)} estimated study plan`] : []),
    ];
    rows.push(
      <Row
        key="roadmap"
        title={(
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <RouteMap size={16} aria-hidden />
            {roadmap.title}
          </Box>
        )}
        detail={facts.join(' · ')}
        middle={<Pill tone="accent">Active plan</Pill>}
        action={(
          <Button variant="contained" component={RouterLink} to={`/roadmaps/${roadmap.id}`}>
            Continue roadmap →
          </Button>
        )}
        sx={{
          bgcolor: (t) => `color-mix(in srgb, ${t.palette.primary.main} 3%, transparent)`,
          border: '1px solid', borderColor: (t) => `color-mix(in srgb, ${t.palette.primary.main} 15%, transparent)`,
          '&:last-child': { borderBottom: '1px solid' },
        }}
      />,
    );
  }

  return (
    <Panel component="section" aria-labelledby="home-in-motion">
      <PanelHead eyebrow="Continue" title="Already in motion" titleId="home-in-motion" />
      {rows.length > 0 ? rows : (
        <Detail>Nothing is in motion. A mock you start, a review that comes due or a roadmap you work from shows here.</Detail>
      )}
    </Panel>
  );
};

const ATTENTION: Partial<Record<Blocker['kind'], { label: string; tone: Tone; order: number }>> = {
  below_pass: { label: 'Below pass mark', tone: 'danger', order: 0 },
  weak_domain: { label: 'Weak area', tone: 'warning', order: 1 },
  stale: { label: 'Out of date', tone: 'warning', order: 2 },
};

/**
 * The prototype's "Needs attention", across the other preparations: each one
 * whose own readiness rules name a problem, in their own words. A preparation
 * those rules have nothing against is not listed.
 */
const NeedsAttention: React.FC<{ subjects: Subject[] }> = ({ subjects }) => {
  const items = subjects
    .filter((s) => s.readiness.mock_count > 0)
    .map((s) => {
      const blocker = s.readiness.blockers.find((b) => ATTENTION[b.kind]);
      return blocker ? { subject: s, blocker, meta: ATTENTION[blocker.kind]! } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.meta.order - b.meta.order);

  if (items.length === 0) return null;
  return (
    <Section>
      <Panel component="section" aria-labelledby="home-attention">
        <PanelHead
          eyebrow="Across your preparations"
          title="Needs attention"
          titleId="home-attention"
          aside={<Button variant="text" component={RouterLink} to="/preparations">All preparations</Button>}
        />
        {items.map(({ subject, blocker, meta }) => (
          <Row
            key={subject.id}
            title={subject.name}
            detail={blockerSentence(blocker, subject.readiness.rules)}
            middle={<Pill tone={meta.tone}>{meta.label}</Pill>}
            action={<Button variant="outlined" component={RouterLink} to={`/subjects/${subject.id}`}>Open</Button>}
          />
        ))}
      </Panel>
    </Section>
  );
};

/**
 * The topics the one action would actually draw from.
 *
 * The counts are real and come from the same query the weak-topic drill uses,
 * so this list cannot name something Practice would then refuse to offer. And
 * every row here is below the floor -- a panel headed "Topics to focus on"
 * that lists topics you are fine at would be a list of topics you are fine at.
 */
const FocusTopics: React.FC<{ topics: FocusTopic[]; subject: Subject }> = ({ topics, subject }) => {
  const theme = useTheme();
  const shown = topics.slice(0, FOCUS_LIMIT);

  return (
    <Panel component="section" aria-labelledby="home-focus">
      <PanelHead eyebrow="From your mocks" title="Topics to focus on" titleId="home-focus" sx={{ mb: '4px' }} />
      <Detail>Over at least three answers each.</Detail>

      <Stack sx={{ mt: '12px' }} spacing={0.5}>
        {shown.map((t) => {
          const ratio = t.answered > 0 ? t.correct / t.answered : 0;
          const severe = t.accuracy_percentage < 50;
          const barColor = severe ? theme.palette.error.main : theme.palette.warning.main;
          return (
            <Box
              key={t.topic}
              component={RouterLink}
              to={`/exam-setup?kind=drill&subject=${subject.id}`
                + `&topic=${encodeURIComponent(t.topic)}`}
              aria-label={`Practise ${t.topic} — ${t.correct} of ${t.answered} correct in your mocks`}
              sx={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto auto',
                alignItems: 'center',
                gap: 1.5,
                px: 1, py: 0.8, mx: -1,
                borderRadius: '9px',
                textDecoration: 'none',
                color: 'text.primary',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="body1"
                  // Topics in this bank run to sixty characters, so the row
                  // truncates. The full name is on the link's accessible name
                  // and here, so nothing is only available to a mouse.
                  title={t.topic}
                  sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {t.topic}
                </Typography>
                {/* The bar restates the fraction beside it, so nothing here
                    depends on reading a colour. */}
                <Box aria-hidden sx={{ mt: '6px', height: 7, borderRadius: '8px', bgcolor: 'pb.track', overflow: 'hidden' }}>
                  <Box sx={{ width: `${Math.round(ratio * 100)}%`, height: '100%', bgcolor: barColor, borderRadius: '8px' }} />
                </Box>
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {t.correct} / {t.answered}
              </Typography>
              <ChevronRight size={16} aria-hidden style={{ opacity: 0.45 }} />
            </Box>
          );
        })}
      </Stack>

      {topics.length > shown.length && (
        <Button variant="text" component={RouterLink} to="/analytics" sx={{ mt: 1.5, ml: '-6px' }}>
          {topics.length - shown.length} more in Insights
        </Button>
      )}
    </Panel>
  );
};

/**
 * Everything else being prepared: a record, not a launcher -- counts of work
 * already done, each a way into where that work lives.
 */
const OtherPreparationPanel: React.FC<{ items: OtherPreparation[] }> = ({ items }) => (
  <Panel component="section" aria-labelledby="home-other">
    <PanelHead eyebrow="Counted from work already done" title="Other preparation" titleId="home-other" sx={{ mb: '4px' }} />
    <Detail>None of it moves the verdict above.</Detail>
    <Box sx={{ mt: '6px' }}>
      {items.map((it) => (
        <Row
          key={it.key}
          title={it.label}
          detail={it.detail}
          action={<Button variant="outlined" component={RouterLink} to={it.href} aria-label={`${it.label} — ${it.detail}`}>Open</Button>}
        />
      ))}
    </Box>
  </Panel>
);
