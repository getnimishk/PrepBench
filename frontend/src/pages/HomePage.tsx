// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Stack, Typography, useTheme } from '@mui/material';
import {
  Activity, ArrowRight, Award, BookOpen, ChevronRight, Database, FileCheck2, FlaskConical,
  FolderGit2, History, Layers, Library, Map as RouteMap, Mic, Network,
  PlayCircle, ShieldCheck, Workflow,
} from 'lucide-react';
import {
  getSubjects, getHomeSummary, getOtherPreparation, getFocusTopics, getDailyGoals, getRoadmaps,
  getEvidence, getRoles, getRole,
} from '../services/api';
import type { EvidenceResponse } from '../types/portfolio';
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
  Actions, Bar, BigFigure, Detail, Eyebrow, Good, Grid, Metric, MetricRow, Note, PageHead, Panel, PanelHead, Pill, Row, Section, Sub,
  type Tone,
} from '../components/ui/primitives';
import { usePb } from '../theme/usePb';
import { chooseRoadmap } from '../services/roadmapChoice';
import { getSubjectCapabilities, UNASSIGNED_CAPABILITIES } from '../services/capabilities';

/**
 * Unified PrepBench Home & Certification Readiness Experience.
 *
 * Grounded in the Five Connected Capabilities (Certification, Interview,
 * Learning Lab, Workspace, Evidence) and the 5 decisive architectural questions:
 * 1. What am I preparing for?
 * 2. Am I ready? (Formal verification verdict from production readiness API)
 * 3. What should I learn next?
 * 4. What can I practice?
 * 5. What can I experiment with? (Learning Lab understanding engine)
 *
 * Architectural Invariants:
 * - Uses existing production readiness engine directly (no competing calculator).
 * - Formal Certification verdict is strictly separated from coaching interpretation.
 * - All actions and CTAs are subject- and capability-aware.
 * - When no subject is selected, renders the Unassigned view without defaulting silently.
 */

const shortDate = (iso?: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

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

/**
 * Trend chart: qualifying mock exam scores drawn against the pass mark line.
 */
const TrendChart: React.FC<{ scores: number[]; passMark: number | null }> = ({
  scores, passMark,
}) => {
  const theme = useTheme();
  const pb = usePb();
  if (scores.length < 2) return null;

  const W = 460;
  const H = 116;
  const padX = 26;
  const padTop = 18;
  const padBottom = 26;

  const values = passMark != null ? [...scores, passMark] : scores;
  const lo = Math.max(0, Math.min(...values) - 8);
  const hi = Math.min(100, Math.max(...values) + 8);
  const span = hi - lo || 1;

  const x = (i: number) => padX + (i * (W - padX * 2)) / (scores.length - 1);
  const y = (v: number) => padTop + (1 - (v - lo) / span) * (H - padTop - padBottom);

  const line = scores.map((s, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(s)}`).join(' ');
  const area = `${line} L ${x(scores.length - 1)} ${H - padBottom} L ${x(0)} ${H - padBottom} Z`;
  const accent = theme.palette.primary.main;
  const textScale = theme.typography.fontSize / 14;

  return (
    <Box sx={{ width: '100%', minWidth: 0, mt: (t) => t.typography.pxToRem(17) }}>
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
 * Current Evidence component: displays the latest qualifying mock score,
 * mock count, and trend against pass mark.
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
            {weakest && weakest.score_pct != null && (
              <Metric
                value={pct(weakest.score_pct)}
                label={`${r.blockers.some((b) => b.kind === 'weak_domain' && b.domain === weakest.domain) ? 'under the floor' : 'lowest area'} · ${weakest.domain}`}
              />
            )}
            {topicsProgressed != null && <Metric value={topicsProgressed} label="topics progressed" />}
          </MetricRow>
          <Detail sx={{ mt: (t) => t.typography.pxToRem(14), fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.secondary' }}>
            Your last {scores.length} mock{scores.length === 1 ? '' : 's'}
          </Detail>
          {scores.length >= 2 ? (
            <TrendChart scores={scores} passMark={passMark} />
          ) : (
            <Detail sx={{ mt: (t) => t.typography.pxToRem(14) }}>
              One paper is a reading, not a direction. The shape of your progress appears from the second mock.
            </Detail>
          )}
          {r.most_improved && (
            <Detail sx={{ mt: (t) => t.typography.pxToRem(10) }}>
              {r.most_improved.domain} went from {pct(r.most_improved.before_pct)} to {pct(r.most_improved.after_pct)} between your last two mocks.
            </Detail>
          )}
          <Detail sx={{ mt: (t) => t.typography.pxToRem(10) }}>
            Broad assessments measure certification readiness; focused practice repairs gaps.
          </Detail>
        </>
      )}
    </Panel>
  );
};

/**
 * Next Useful Action recommendation.
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
  const plateau = r.state === 'plateau';
  const blocker = r.blockers[0] ?? null;

  return (
    <Panel component="section" aria-labelledby="home-next">
      <PanelHead eyebrow="Next useful action" title={title} titleId="home-next" sx={{ mb: 0 }} />
      <Sub sx={{ mb: 0 }}>{next.why}</Sub>
      <WhyThis explanation={next} sx={{ mt: 1 }} />
      <Actions sx={{ mt: (t) => t.typography.pxToRem(16) }}>
        {next.cta && next.to && (
          <Button variant="contained" onClick={() => navigate(next.to!)}>{next.cta}</Button>
        )}
        <Button variant="outlined" component={RouterLink} to={`/subjects/${subject.id}`}>Open preparation</Button>
      </Actions>
      {r.mock_count > 0 && (plateau || blocker ? (
        <Note sx={{ mt: (t) => t.typography.pxToRem(14) }}>
          {plateau ? plateauSentence(r.recent_scores, r.rules) : blockerSentence(blocker!, r.rules)}
        </Note>
      ) : (
        <Good sx={{ mt: (t) => t.typography.pxToRem(14) }}>{readySentence(r.pass_mark, r.rules)}</Good>
      ))}
    </Panel>
  );
};

/**
 * In Motion: ongoing mock attempts, reviews due, and active roadmap plans.
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
 * Needs Attention across other subjects.
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
    <Panel component="section" aria-labelledby="home-attention" sx={{ mt: 3 }}>
      <PanelHead eyebrow="Across other preparations" title="Needs attention" titleId="home-attention" />
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
  );
};

const FOCUS_LIMIT = 4;

/**
 * Focus topics panel for weak areas.
 */
const FocusTopics: React.FC<{ topics: FocusTopic[]; subject: Subject }> = ({ topics, subject }) => {
  const theme = useTheme();
  if (topics.length === 0) return null;
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
              to={`/exam-setup?kind=drill&subject=${subject.id}&topic=${encodeURIComponent(t.topic)}`}
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
                '&:hover': { bgcolor: 'pb.surface2' },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="body1"
                  title={t.topic}
                  sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {t.topic}
                </Typography>
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
 * Other practice formats used.
 */
const OtherPreparationPanel: React.FC<{ items: OtherPreparation[] }> = ({ items }) => (
  <Panel component="section" aria-labelledby="home-other-formats">
    <PanelHead eyebrow="Explore" title="Other formats used" titleId="home-other-formats" />
    {items.map((item) => (
      <Row
        key={item.key}
        title={item.label}
        detail={item.detail}
        action={<Button size="small" variant="outlined" component={RouterLink} to={item.href}>Open</Button>}
      />
    ))}
  </Panel>
);

/**
 * Unassigned Home State when no subject is selected (selectedId === null).
 */
const UnassignedHome: React.FC<{
  subjects: Subject[];
  onSelect: (id: number) => void;
}> = ({ subjects, onSelect }) => {
  const t = usePb();
  const navigate = useNavigate();

  return (
    <Box>
      <PageHead
        eyebrow="PrepBench · Technical Capability, Proven."
        title="Choose Your Focus Area"
        sub="Select an active subject from your workspace to track certification readiness, practice interview rounds, and explore behaviour sandboxes."
        actions={
          <Stack direction="row" spacing={1.5}>
            <Button variant="contained" component={RouterLink} to="/preparations">
              My Preparations
            </Button>
            <Button variant="outlined" component={RouterLink} to="/lab">
              All Sandboxes
            </Button>
          </Stack>
        }
      />

      <Panel component="section" aria-labelledby="unassigned-subjects-title" sx={{ mt: 3, mb: 3 }}>
        <PanelHead
          eyebrow="Available Preparations"
          title="Registered Subjects & Skill Tracks"
          titleId="unassigned-subjects-title"
        >
          <Detail>Click any preparation below to make it your active focus.</Detail>
        </PanelHead>
        <Grid columns={3}>
          {subjects.map((s) => {
            const caps = getSubjectCapabilities(s);
            return (
              <Box
                key={s.id}
                sx={{
                  p: '16px',
                  borderRadius: '9px',
                  bgcolor: t.surface2,
                  border: `1px solid ${t.line}`,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Pill tone={s.kind === 'certification' ? 'accent' : 'neutral'}>
                      {s.kind === 'certification' ? 'Certification' : 'Skill Track'}
                    </Pill>
                    {caps.learningLabStatus === 'AVAILABLE' && <Pill tone="success">Lab Live</Pill>}
                    {caps.learningLabStatus === 'INTEGRATION_PENDING' && <Pill tone="warning">Lab Pending (Phase 5)</Pill>}
                  </Box>
                  <Typography variant="h6" component="h3" sx={{ fontWeight: 800, color: t.text }}>
                    {s.name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: t.muted, mt: '4px', minHeight: 40 }}>
                    {s.description || 'Comprehensive syllabus and evaluation materials.'}
                  </Typography>
                  <Detail sx={{ mt: '10px' }}>
                    {s.kind === 'certification'
                      ? `${s.question_count} Questions · Pass: ${s.pass_mark}%`
                      : 'Skill track with active curriculum'}
                  </Detail>
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => onSelect(s.id)}
                  sx={{ mt: 2, width: '100%' }}
                >
                  Select {s.name}
                </Button>
              </Box>
            );
          })}
        </Grid>
      </Panel>
    </Box>
  );
};

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const t = usePb();
  const {
    selected,
    selectedId: ctxSelectedId,
    capabilities: ctxCapabilities,
    select,
    loading: ctxLoading,
  } = usePreparation();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [other, setOther] = useState<OtherPreparation[]>([]);
  const [roadmaps, setRoadmaps] = useState<RoadmapSummary[]>([]);
  const [focus, setFocus] = useState<FocusTopic[]>([]);
  const [goals, setGoals] = useState<DailyGoalsData | null>(null);
  // Read for the chosen preparation: what its work demonstrates (Phase 6 Evidence)
  // and the learner's own target roles that use it. Null until read, or if the read failed.
  const [evidence, setEvidence] = useState<EvidenceResponse | null>(null);
  const [targetRoles, setTargetRoles] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      getSubjects(),
      getHomeSummary(),
      getOtherPreparation().catch(() => []),
      getRoadmaps().catch(() => []),
    ])
      .then(([s, h, o, r]) => { setSubjects(s); setSummary(h); setOther(o); setRoadmaps(r); })
      .catch(() => setError('Could not reach PrepBench’s backend, so this page has nothing '
        + 'to show yet. Nothing has been lost — your history is in the database on this machine.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Determine active primary subject:
  // 1. If selectedId is explicitly specified, find the matching subject.
  // 2. If selectedId is null in a loaded PreparationContext (!ctxLoading), render the Unassigned view.
  // 3. Fallback to first subject with exam profile for standalone / unwrapped tests.
  const primary: Subject | null = useMemo(() => {
    if (subjects.length === 0) return null;
    if (ctxSelectedId === null && ctxLoading === false && typeof select === 'function') {
      return null;
    }
    if (ctxSelectedId != null) {
      return subjects.find((s) => s.id === ctxSelectedId) ?? null;
    }
    return subjects.find((s) => s.has_exam_profile) ?? subjects[0];
  }, [subjects, ctxSelectedId, ctxLoading, select]);

  const primaryId = primary?.id ?? null;
  const capabilities = useMemo(() => {
    if (primary) {
      if (ctxSelectedId === primary.id && ctxCapabilities && ctxCapabilities !== UNASSIGNED_CAPABILITIES) {
        return ctxCapabilities;
      }
      return getSubjectCapabilities(primary);
    }
    return ctxCapabilities ?? UNASSIGNED_CAPABILITIES;
  }, [primary, ctxCapabilities, ctxSelectedId]);

  useEffect(() => {
    if (primaryId == null) return undefined;
    let cancelled = false;
    getFocusTopics(primaryId)
      .then((f) => { if (!cancelled) setFocus(f); })
      .catch(() => { if (!cancelled) setFocus([]); });
    return () => { cancelled = true; };
  }, [primaryId]);

  useEffect(() => {
    if (primaryId == null) return undefined;
    let cancelled = false;
    setEvidence(null);
    Promise.resolve()
      .then(() => getEvidence(primaryId))
      .then((e) => { if (!cancelled) setEvidence(e); })
      .catch(() => { if (!cancelled) setEvidence(null); });
    return () => { cancelled = true; };
  }, [primaryId]);

  useEffect(() => {
    if (primaryId == null) return undefined;
    let cancelled = false;
    setTargetRoles(null);
    // A role names this preparation through one of its requirements; only the
    // learner's own roles are shown, never a role invented for the subject.
    Promise.resolve()
      .then(() => getRoles())
      .then((list) => Promise.all(list.map((r) => getRole(r.id))))
      .then((roles) => {
        if (cancelled) return;
        setTargetRoles(roles
          .filter((role) => role.requirements.some((req) => req.subject_id === primaryId))
          .map((role) => role.name));
      })
      .catch(() => { if (!cancelled) setTargetRoles(null); });
    return () => { cancelled = true; };
  }, [primaryId]);

  useEffect(() => {
    if (primaryId == null) return undefined;
    let cancelled = false;
    getDailyGoals(primaryId)
      .then((g) => { if (!cancelled) setGoals(g); })
      .catch(() => { if (!cancelled) setGoals(null); });
    return () => { cancelled = true; };
  }, [primaryId]);

  if (loading) {
    return <LoadingState label="Loading your progress…" />;
  }

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

  // Explicit unassigned state:
  if (primary == null) {
    return (
      <UnassignedHome
        subjects={subjects}
        onSelect={(id) => select(id)}
      />
    );
  }

  const r = primary.readiness;
  const isCertification = primary.kind === 'certification' && capabilities.certification;
  // Read from the record and its capabilities -- never from which id it has (Phase 7).
  const has0Questions = isCertification && primary.question_count === 0;
  const hasLakehouse = capabilities.lakehouseLab;

  const unmeasured = isCertification && r.mock_count === 0 && r.state === 'needs_evaluation';
  const averageScore = r.recent_scores.length > 0
    ? r.recent_scores.reduce((a, b) => a + b, 0) / r.recent_scores.length
    : null;

  const counts = summary?.per_subject.find((p) => p.subject_id === primary.id);
  const unreviewed = counts?.unreviewed ?? 0;
  const resumable = counts?.resumable ?? null;

  const own = roadmaps.filter((m) => !m.is_archived && m.subject_id === primary.id);
  const topicsProgressed = own.length > 0
    ? own.reduce((n, m) => n + m.progress.completed_count + m.progress.in_progress_count, 0)
    : null;
  const activeRoadmap = chooseRoadmap(roadmaps, primary.id);
  const description = primary.description?.trim().replace(/\.$/, '');

  // What this preparation's curriculum is, from what is really linked and attached:
  // its own roadmap, its attached packs, its question bank. A figure with no source
  // is not shown (Phase 7, WP 7.4).
  const linkedRoadmap = activeRoadmap?.linked ? activeRoadmap.roadmap : null;
  const curriculumParts: string[] = [];
  if (linkedRoadmap) {
    const p = linkedRoadmap.progress;
    const phases = linkedRoadmap.phase_count;
    curriculumParts.push(
      `${p.total_topics} topics`
      + (phases ? ` across ${phases} phases` : '')
      + (p.total_estimated_hours != null ? ` · ${Math.round(p.total_estimated_hours)}h planned` : ''),
    );
  }
  for (const pack of primary.content_packs ?? []) {
    const parts = [
      pack.chapter_count ? `${pack.chapter_count} guide chapters` : null,
      pack.written_scenario_count ? `${pack.written_scenario_count} scenarios` : null,
    ].filter(Boolean);
    curriculumParts.push(parts.length ? `${pack.title}: ${parts.join(', ')}` : pack.title);
  }
  if (isCertification) curriculumParts.push(`${primary.question_count} questions in the bank`);
  const curriculumBaseline = curriculumParts.length ? curriculumParts.join(' · ') : 'No curriculum linked yet';

  // Top Action CTA
  const isLabAvailable = capabilities.learningLabStatus === 'AVAILABLE';
  const isLabPending = capabilities.learningLabStatus === 'INTEGRATION_PENDING';

  const primaryCta = (() => {
    if (isLabAvailable) {
      return (
        <Button
          variant="contained"
          component={RouterLink}
          to={hasLakehouse ? '/databricks-sandbox' : '/lab/adf'}
        >
          {hasLakehouse ? 'Open Lakehouse Lab' : 'Open Behaviour Lab'}
        </Button>
      );
    }
    if (isLabPending) {
      return (
        <Button
          variant="contained"
          disabled
          aria-disabled="true"
          title="ADF Behaviour Lab integration pending (Phase 5)"
        >
          Behaviour Lab (Integration Pending)
        </Button>
      );
    }
    if (isCertification) {
      if (has0Questions) {
        return (
          <Button variant="contained" disabled title="Question bank required before launching exam">
            0 Questions Loaded
          </Button>
        );
      }
      return (
        <Button
          variant="contained"
          component={RouterLink}
          to={`/exam-setup?subject=${primary.id}`}
        >
          Start Practice Exam
        </Button>
      );
    }
    if (capabilities.interview) {
      return (
        <Button variant="contained" component={RouterLink} to="/interview-practice">
          Practice Interview
        </Button>
      );
    }
    return (
      <Button variant="contained" component={RouterLink} to={`/subjects/${primary.id}`}>
        Explore Preparation
      </Button>
    );
  })();

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
        actions={
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Button variant="outlined" component={RouterLink} to={`/subjects/${primary.id}`}>
              Subject Overview
            </Button>
            {primaryCta}
          </Stack>
        }
      />

      {goals && (
        <Section>
          <DailyGoals goals={goals} />
        </Section>
      )}

      {/* QUESTION 1: What am I preparing for? */}
      <Panel component="section" aria-labelledby="home-focus-title" sx={{ mb: (t) => t.typography.pxToRem(24) }}>
        <PanelHead
          title="1. What am I preparing for?"
          titleId="home-focus-title"
          aside={
            <Pill tone={isCertification ? 'accent' : 'neutral'}>
              Active Focus · {isCertification ? 'Certification Track' : 'Professional Skill Track'}
            </Pill>
          }
        >
          <Detail>The core subject anchoring your certification and professional interview goals.</Detail>
        </PanelHead>
        <Grid columns={3}>
          <Box sx={{ p: (t) => t.typography.pxToRem(14), borderRadius: '8px', bgcolor: t.surface2, border: `1px solid ${t.line}` }}>
            <Eyebrow>{isCertification ? 'Subject & Certification' : 'Subject & Skill Track'}</Eyebrow>
            <Typography variant="h6" component="p" sx={{ fontWeight: 800, mt: '4px' }}>
              {`Focus Track: ${primary.name}`}
            </Typography>
            <Typography variant="body2" sx={{ color: t.muted, mt: '2px' }}>
              {primary.description || 'Professional capability preparation'}
            </Typography>
            <Detail sx={{ mt: (t) => t.typography.pxToRem(10) }}>
              {isCertification
                ? (has0Questions
                  ? `Pass Mark: ${primary.pass_mark}% · 0 Questions loaded in current dataset`
                  : `Pass Mark: ${primary.pass_mark}% · ${primary.question_count} Questions${primary.exam_minutes != null ? ` · ${primary.exam_minutes} Minutes` : ''}`)
                : 'Skill Track · Continuous competency evaluation (no exam pass mark)'}
            </Detail>
          </Box>
          <Box sx={{ p: (t) => t.typography.pxToRem(14), borderRadius: '8px', bgcolor: t.surface2, border: `1px solid ${t.line}` }}>
            <Eyebrow>Target Professional Roles</Eyebrow>
            <Typography variant="h6" component="p" sx={{ fontWeight: 800, mt: '4px' }}>
              {targetRoles === null ? '—' : targetRoles.length ? targetRoles.join(' · ') : 'No target role linked yet'}
            </Typography>
            <Detail sx={{ mt: (t) => t.typography.pxToRem(10) }}>
              {targetRoles?.length
                ? 'Your roles that use this preparation'
                : <Box component={RouterLink} to="/preparations/roles/new" sx={{ color: 'primary.main' }}>Add a role you are preparing for</Box>}
            </Detail>
          </Box>
          <Box sx={{ p: (t) => t.typography.pxToRem(14), borderRadius: '8px', bgcolor: t.surface2, border: `1px solid ${t.line}` }}>
            <Eyebrow>Curriculum Baseline</Eyebrow>
            <Typography variant="h6" component="p" sx={{ fontWeight: 800, mt: '4px' }}>
              {curriculumBaseline}
            </Typography>
            <Detail sx={{ mt: (t) => t.typography.pxToRem(10) }}>
              {linkedRoadmap ? linkedRoadmap.title : 'Link or import a roadmap on the Roadmaps screen'}
            </Detail>
          </Box>
        </Grid>
      </Panel>

      {/* QUESTION 2: Am I ready? (Formal Verdict vs Coaching Interpretation) */}
      <Panel component="section" aria-labelledby="home-readiness-title" sx={{ mb: (t) => t.typography.pxToRem(24) }}>
        <PanelHead
          title="2. Am I ready?"
          titleId="home-readiness-title"
          aside={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isCertification ? (
                has0Questions ? (
                  <Pill tone="neutral">Verdict: DATA NOT AVAILABLE</Pill>
                ) : r.mock_count === 0 ? (
                  <Pill tone="neutral">Verdict: NOT MEASURED YET</Pill>
                ) : r.state === 'ready' ? (
                  <Pill tone="success">Verdict: READY</Pill>
                ) : (
                  <Pill tone="warning">Verdict: NOT READY</Pill>
                )
              ) : (
                <Pill tone="accent">Status: SKILL COMPETENCY TRACKING</Pill>
              )}
              {isCertification && (
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                  Coaching Note: {READINESS_LABELS[r.state]}
                  {averageScore != null ? ` (${Math.round(averageScore)}% avg)` : ''}
                </Typography>
              )}
            </Box>
          }
        >
          <Detail>
            {isCertification
              ? 'Readiness for certifications is strictly calculated from verified qualifying mock exams—never from casual reading.'
              : 'Readiness for skill tracks is demonstrated through completed behaviour experiments, technical artifacts, and verified scenarios.'}
          </Detail>
        </PanelHead>
        <Grid columns={3}>
          <Box>
            <CurrentEvidence subject={primary} topicsProgressed={topicsProgressed} />
          </Box>
          <Box sx={{ gridColumn: { xs: 'span 1', md: 'span 2' } }}>
            <Typography variant="subtitle2" component="p" sx={{ fontWeight: 700, mb: '8px' }}>
              {isCertification ? 'Domain Readiness Breakdown (Production Readiness API)' : 'Core Competency Dimensions'}
            </Typography>
            {isCertification && r.domains.length > 0 ? (
              <Stack spacing={1.5}>
                {r.domains.map((dom) => (
                  <Box key={dom.domain}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: '4px' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {dom.domain} ({dom.answered} questions answered)
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: dom.state === 'solid' ? t.success : dom.state === 'developing' ? t.accent : t.danger,
                          fontWeight: 700,
                        }}
                      >
                        {dom.score_pct != null ? `${Math.round(dom.score_pct)}%` : '—'} · {dom.state === 'solid' ? 'Solid' : dom.state === 'developing' ? 'Developing' : 'Needs work'}
                        {r.blockers.some((b) => b.kind === 'weak_domain' && b.domain === dom.domain) ? ' (Under Floor)' : ''}
                      </Typography>
                    </Box>
                    <Bar value={dom.score_pct || 0} label={dom.domain} />
                  </Box>
                ))}
              </Stack>
            ) : !isCertification && evidence && evidence.items.length > 0 ? (
              <Box>
                <MetricRow sx={{ mt: 0 }}>
                  <Metric value={evidence.counts.evidenced} label="Evidenced" />
                  <Metric value={evidence.counts.demonstrated} label="Demonstrated" />
                  <Metric value={evidence.counts.completed} label="Completed" />
                  <Metric value={evidence.counts.activity} label="Activity" />
                </MetricRow>
                <Detail sx={{ mt: '8px' }}>
                  Read from the work you did in this preparation: each item graded against the model, a
                  scenario's answer key or your own explanation.{' '}
                  <Box component={RouterLink} to="/evidence" sx={{ color: 'primary.main' }}>See the evidence</Box>
                </Detail>
              </Box>
            ) : (
              <Box sx={{ p: (t) => t.typography.pxToRem(24), textAlign: 'center', bgcolor: t.surface2, borderRadius: '8px' }}>
                <Typography variant="body2" sx={{ color: t.muted }}>
                  {has0Questions
                    ? 'Question bank not loaded in current dataset (0 questions). Mock exam readiness cannot be evaluated until questions are imported.'
                    : isCertification
                      ? 'Readiness data appears as mock exams and technical assessments are completed.'
                      : 'No evidence yet: it appears as you predict, run and explain experiments and answer scenario checks in this preparation.'}
                </Typography>
              </Box>
            )}
            <Sub sx={{ mt: (t) => t.typography.pxToRem(12) }}>
              <b>Product Invariant:</b> Completing Learning Lab experiments builds technical comprehension, but does NOT alter certification readiness verdicts until verified through formal assessment.
            </Sub>
          </Box>
        </Grid>
      </Panel>

      {/* QUESTION 3 & 4: What should I learn next? & What can I practice? */}
      <Grid columns={2} sx={{ mb: (t) => t.typography.pxToRem(24) }}>
        <NextUsefulAction subject={primary} unreviewed={unreviewed} resumable={resumable} />

        <Panel component="section" aria-labelledby="home-practice-title">
          <PanelHead title="4. What can I practice?" titleId="home-practice-title">
            <Detail>Active recall, exam simulator, and formative evaluation options.</Detail>
          </PanelHead>
          <Box sx={{ display: 'grid', gap: '10px' }}>
            {isCertification && (
              <>
                <Row
                  title={`Question Bank (${primary.question_count} Questions)`}
                  detail={`All ${primary.question_count} real questions with option breakdowns and explanations`}
                  middle={<Pill tone="accent">{primary.question_count} Qs</Pill>}
                  action={
                    <Button size="small" variant="contained" component={RouterLink} to="/question-bank">
                      Open Bank
                    </Button>
                  }
                />
                <Row
                  title="Full Mock Exam Simulator"
                  detail={primary.exam_question_count != null && primary.exam_minutes != null
                    ? `${primary.exam_question_count} questions · ${primary.exam_minutes} mins · ${primary.pass_mark}% pass threshold`
                    : 'No exam format set for this preparation'}
                  action={
                    has0Questions ? (
                      <Button size="small" variant="outlined" disabled>
                        0 Qs Loaded
                      </Button>
                    ) : (
                      <Button size="small" variant="outlined" component={RouterLink} to={`/exam-setup?subject=${primary.id}`}>
                        Start Mock
                      </Button>
                    )
                  }
                />
                <Row
                  title="Spaced Repetition Queue"
                  detail="Review misses and spaced repetition cards powered by SuperMemo SM-2 algorithm"
                  action={
                    <Button size="small" variant="outlined" component={RouterLink} to="/review">
                      Review Queue
                    </Button>
                  }
                />
              </>
            )}

            {capabilities.learningLab && (
              isLabAvailable ? (
                <Row
                  title={hasLakehouse ? 'Lakehouse Simulation Lab' : 'ADF Behaviour Labs'}
                  detail={hasLakehouse ? 'Interactive Delta Lake & ADLS Gen2 pipeline sandbox' : 'Manipulate pipeline parameters, inject transient faults, and observe mechanistic causality'}
                  action={
                    <Button size="small" variant="contained" component={RouterLink} to={hasLakehouse ? '/databricks-sandbox' : '/lab/adf'}>
                      {hasLakehouse ? 'Open Lakehouse Lab' : 'Open Behaviour Lab'}
                    </Button>
                  }
                />
              ) : (
                <Row
                  title="ADF Behaviour Labs"
                  detail="Interactive pipeline simulation & fault injection (Scheduled for Phase 5)"
                  middle={<Pill tone="warning">Phase 5</Pill>}
                  action={
                    <Button size="small" variant="outlined" disabled aria-disabled="true">
                      Integration Pending
                    </Button>
                  }
                />
              )
            )}

            {capabilities.scenarios && (
              <Row
                title="Enterprise Production Scenarios"
                detail="Real incident case studies: RACI bridges, SLA breaches, and production triage"
                action={
                  <Button size="small" variant="outlined" component={RouterLink} to="/scenarios">
                    Explore Scenarios
                  </Button>
                }
              />
            )}

            {capabilities.interview && (
              <>
                <Row
                  title="System Design Studio"
                  detail="Interactive architecture prompts: ingestion, partitioning, and service boundaries"
                  action={
                    <Button size="small" variant="outlined" component={RouterLink} to="/system-design">
                      Open Studio
                    </Button>
                  }
                />
                <Row
                  title="Verbal Interview Practice"
                  detail="Speech-recorded diagnostic questions with automated AI rubric analysis"
                  action={
                    <Button size="small" variant="outlined" component={RouterLink} to="/interview-practice">
                      Practice Rounds
                    </Button>
                  }
                />
              </>
            )}
          </Box>
        </Panel>
      </Grid>

      {/* QUESTION 5: What can I experiment with? (Learning Lab) */}
      <Panel component="section" aria-labelledby="home-lab-title" sx={{ mb: (t) => t.typography.pxToRem(24) }}>
        <PanelHead
          title="5. What can I experiment with? (Learning Lab)"
          titleId="home-lab-title"
          aside={
            isLabAvailable ? (
              <Button
                variant="outlined"
                size="small"
                component={RouterLink}
                to={hasLakehouse ? '/databricks-sandbox' : '/lab/adf'}
              >
                {hasLakehouse ? 'Lakehouse Sandbox' : 'All five experiments'}
              </Button>
            ) : isLabPending ? (
              <Pill tone="warning">Integration Pending (Phase 5)</Pill>
            ) : (
              <Pill tone="neutral">Lab Unavailable</Pill>
            )
          }
        >
          <Detail>
            The understanding engine of PrepBench: manipulate system variables, observe causality, formulate mechanistic explanations, and save artifacts.
          </Detail>
        </PanelHead>
        {!capabilities.learningLab ? (
          <Box sx={{ p: (t) => t.typography.pxToRem(24), textAlign: 'center', bgcolor: t.surface2, borderRadius: '8px', border: `1px solid ${t.line}` }}>
            <FlaskConical size={32} color={t.muted} style={{ margin: '0 auto 8px' }} />
            <Typography variant="subtitle1" component="p" sx={{ fontWeight: 800 }}>
              Learning Lab Not Configured for {primary.name}
            </Typography>
            <Typography variant="body2" sx={{ color: t.muted, mt: '6px', maxWidth: 600, mx: 'auto' }}>
              Interactive behavioural simulations and fault injection sandboxes are currently available for <b>Azure Data Factory</b> and <b>Databricks Lakehouse</b>. Preparation for {primary.name} is driven by its supported capabilities.
            </Typography>
            <Stack direction="row" spacing={1.5} sx={{ mt: (t) => t.typography.pxToRem(16), justifyContent: 'center' }}>
              {isCertification && (
                <Button variant="contained" component={RouterLink} to="/question-bank">
                  Open Question Bank
                </Button>
              )}
              {capabilities.interview && (
                <Button variant="outlined" component={RouterLink} to="/interview-practice">
                  Interview Practice
                </Button>
              )}
            </Stack>
          </Box>
        ) : isLabPending ? (
          <Box sx={{ p: (t) => t.typography.pxToRem(20), bgcolor: t.surface2, borderRadius: '8px', border: `1px solid ${t.line}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Pill tone="warning">Integration Pending · Phase 5</Pill>
              <Typography variant="caption" sx={{ color: t.muted, fontWeight: 600 }}>
                Planned Architectural Capability
              </Typography>
            </Box>
            <Typography variant="subtitle1" component="p" sx={{ fontWeight: 800 }}>
              ADF Behaviour Labs — Scheduled for Phase 5 Integration
            </Typography>
            <Typography variant="body2" sx={{ color: t.muted, mt: '6px', maxWidth: 720 }}>
              ADF Behaviour Labs teach pipeline causality through structured experimentation (Predict &rarr; Manipulate &rarr; Observe &rarr; Explain). The following behavioural experiments are part of the target capability and will be integrated in Phase 5:
            </Typography>
            <Grid columns={2} sx={{ mt: 2 }}>
              <Box sx={{ p: (t) => t.typography.pxToRem(14), borderRadius: '8px', border: `1px solid ${t.line}`, bgcolor: t.surface }}>
                <Typography variant="subtitle2" component="p" sx={{ fontWeight: 700 }}>
                  Concurrency &amp; Parallelism Budget (Phase 5)
                </Typography>
                <Typography variant="body2" sx={{ color: t.muted, mt: '4px' }}>
                  Manipulate ForEach batchCount, parallelCopies, and DIUs against source connection pool limits to observe throttling.
                </Typography>
                <Actions sx={{ mt: (t) => t.typography.pxToRem(12) }}>
                  <Button size="small" variant="outlined" disabled aria-disabled="true">
                    Scheduled for Phase 5
                  </Button>
                </Actions>
              </Box>
              <Box sx={{ p: (t) => t.typography.pxToRem(14), borderRadius: '8px', border: `1px solid ${t.line}`, bgcolor: t.surface }}>
                <Typography variant="subtitle2" component="p" sx={{ fontWeight: 700 }}>
                  Watermark CDC &amp; Fault Tolerance (Phase 5)
                </Typography>
                <Typography variant="body2" sx={{ color: t.muted, mt: '4px' }}>
                  Inject transient failures mid-copy. Compare updating watermark on completion vs success with Append vs Upsert sink.
                </Typography>
                <Actions sx={{ mt: (t) => t.typography.pxToRem(12) }}>
                  <Button size="small" variant="outlined" disabled aria-disabled="true">
                    Scheduled for Phase 5
                  </Button>
                </Actions>
              </Box>
            </Grid>
          </Box>
        ) : (
          <Grid columns={3}>
            {hasLakehouse ? (
              <Box sx={{ p: (t) => t.typography.pxToRem(14), borderRadius: '8px', border: `1px solid ${t.line}`, bgcolor: t.surface2 }}>
                <Pill tone="accent">Lakehouse System Lab</Pill>
                <Typography variant="subtitle1" component="p" sx={{ fontWeight: 800, mt: '8px' }}>
                  End-to-End Lakehouse Migration
                </Typography>
                <Typography variant="body2" sx={{ color: t.muted, mt: '4px' }}>
                  Compose Station A (Ingestion) &rarr; Station B (Storage) &rarr; Station C (Delta Lake ACID engine) with telemetry.
                </Typography>
                <Actions sx={{ mt: (t) => t.typography.pxToRem(12) }}>
                  <Button size="small" variant="contained" component={RouterLink} to="/databricks-sandbox">
                    Open Lakehouse Lab
                  </Button>
                </Actions>
              </Box>
            ) : (
              <>
                <Box sx={{ p: (t) => t.typography.pxToRem(14), borderRadius: '8px', border: `1px solid ${t.line}`, bgcolor: t.surface2 }}>
                  <Pill tone="accent">ADF Behaviour Lab</Pill>
                  <Typography variant="subtitle1" component="p" sx={{ fontWeight: 800, mt: '8px' }}>
                    Concurrency &amp; Parallelism Budget
                  </Typography>
                  <Typography variant="body2" sx={{ color: t.muted, mt: '4px' }}>
                    Manipulate ForEach batchCount, parallelCopies, and DIUs against source connection pool limits to observe throttling.
                  </Typography>
                  <Actions sx={{ mt: (t) => t.typography.pxToRem(12) }}>
                    <Button size="small" variant="contained" component={RouterLink} to="/lab/adf/concurrency" aria-label="Launch Concurrency Budget">
                      Launch Experiment
                    </Button>
                  </Actions>
                </Box>
                <Box sx={{ p: (t) => t.typography.pxToRem(14), borderRadius: '8px', border: `1px solid ${t.line}`, bgcolor: t.surface2 }}>
                  <Pill tone="accent">ADF Behaviour Lab</Pill>
                  <Typography variant="subtitle1" component="p" sx={{ fontWeight: 800, mt: '8px' }}>
                    Watermark &amp; Transient Failure
                  </Typography>
                  <Typography variant="body2" sx={{ color: t.muted, mt: '4px' }}>
                    Inject transient failures mid-copy. Compare updating watermark on completion vs success with Append vs Upsert sink.
                  </Typography>
                  <Actions sx={{ mt: (t) => t.typography.pxToRem(12) }}>
                    <Button size="small" variant="contained" component={RouterLink} to="/lab/adf/watermark" aria-label="Launch Watermark & Transient Failure">
                      Launch Experiment
                    </Button>
                  </Actions>
                </Box>
              </>
            )}
          </Grid>
        )}
      </Panel>

      {/* Continuation & Other Preparations */}
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
