// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, LinearProgress, Tab, Tabs, Typography,
} from '@mui/material';
import { ChevronRight } from 'lucide-react';
import { ScoreTrendChart } from '../components/analytics/ScoreTrendChart';
import { CategoryScoreList } from '../components/common/CategoryScoreList';
import {
  getDomainPerformance, getScoreTrends, getSubjects,
  getSystemDesignAnalytics, getRecordingAnalytics,
} from '../services/api';
import { usePreparation } from '../context/PreparationContext';
import { DomainMasteryItem, ScoreTrendPoint } from '../types/analytics';
import { READINESS_LABELS, ReadinessState, Subject } from '../types/subject';
import { SystemDesignAnalytics } from '../types/systemDesign';
import { RecordingAnalytics } from '../types/recording';
import { blockerSentence, pct, readySentence } from '../services/readinessText';
import { areaHref, explainVerdict } from '../services/recommendation';
import { WhyThis } from '../components/common/WhyThis';
import { loadFailed } from '../services/apiError';
import {
  Detail, Eyebrow, Grid, PageHead, Panel, PanelHead, Pill, Row, Section, Sub, type Tone,
} from '../components/ui/primitives';

/**
 * Insights & Analytics: what changed, what is holding you back, why, and what
 * to look at -- the prototype's performance trend, domain performance and
 * interpretation, for the preparation being described.
 *
 * The page once quietly disagreed with Home: the score trend plotted every
 * session, drills included, and the domain breakdown pooled every answer ever
 * given. Both numbers were correct; neither said which population it described.
 * Each panel now names its population where it is shown, and the verdict panels
 * read from the same rule Home reads, so the two pages cannot disagree.
 */

type TabKey = 'exams' | 'system_design' | 'interview_practice';

const STATE_TONE: Record<ReadinessState, Tone> = {
  ready: 'success',
  almost_there: 'accent',
  plateau: 'warning',
  developing: 'warning',
  needs_evaluation: 'neutral',
};

/** A labelled bar. Used where the comparison between rows is the point. */
const Bar: React.FC<{
  label: string;
  value: number;
  detail?: string;
  threshold?: number;
  /** Where the row opens, when it is a way into more detail. */
  to?: string;
}> = ({ label, value, detail, threshold, to }) => (
  <Box
    {...(to ? { component: RouterLink, to, 'aria-label': `${label}: ${pct(value)}. Open this area` } : {})}
    sx={{
      display: 'block', py: '12px', color: 'inherit', textDecoration: 'none',
      borderBottom: '1px solid', borderColor: 'divider',
      '&:last-of-type': { borderBottom: 0 },
      ...(to ? {
        '&:hover b': { textDecoration: 'underline' },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2, borderRadius: '6px' },
      } : {}),
    }}
  >
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
      <Typography component="b" variant="body1" sx={{ fontWeight: 700, minWidth: 0 }}>{label}</Typography>
      <Typography
        component="span"
        variant="body1"
        sx={{ fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
      >
        {pct(value)}
        {detail && <Box component="span" sx={{ color: 'text.secondary' }}>· {detail}</Box>}
        {to && <ChevronRight size={14} aria-hidden />}
      </Typography>
    </Box>
    <Box sx={{ position: 'relative', mt: '6px' }}>
      <LinearProgress
        variant="determinate"
        value={Math.min(100, value)}
        aria-label={`${label}: ${pct(value)}`}
        color={threshold != null && value < threshold ? 'warning' : 'primary'}
      />
      {threshold != null && (
        // The floor, drawn where it actually is. A bar with no line on it
        // cannot say whether the number is good.
        <Box sx={{ position: 'absolute', top: -3, bottom: -3, left: `${threshold}%`, width: '2px', bgcolor: 'text.secondary' }} />
      )}
    </Box>
  </Box>
);

export const AnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedId } = usePreparation();
  const [tab, setTab] = useState<TabKey>('exams');

  const [domains, setDomains] = useState<DomainMasteryItem[]>([]);
  const [trends, setTrends] = useState<ScoreTrendPoint[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [examsLoading, setExamsLoading] = useState(false);
  const [examsError, setExamsError] = useState<string | null>(null);

  const [sdAnalytics, setSdAnalytics] = useState<SystemDesignAnalytics | null>(null);
  const [sdLoading, setSdLoading] = useState(false);
  const [sdError, setSdError] = useState<string | null>(null);

  const [ipAnalytics, setIpAnalytics] = useState<RecordingAnalytics | null>(null);
  const [ipLoading, setIpLoading] = useState(false);
  const [ipError, setIpError] = useState<string | null>(null);

  // Only the latest request may land. Switching preparation twice quickly
  // would otherwise let the first answer arrive last and describe the wrong one.
  const examsRequest = useRef(0);

  const fetchExams = () => {
    const request = ++examsRequest.current;
    setExamsLoading(true);
    setExamsError(null);
    (async () => {
      // The preparation first, because every figure below is that preparation's
      // alone. Pooled, a second preparation's areas appeared in this one's list.
      const s = await getSubjects();
      const described = describedPreparation(s, selectedId);
      const [d, t] = described
        ? await Promise.all([getDomainPerformance(described.id), getScoreTrends(described.id)])
        : [[], []];
      if (request !== examsRequest.current) return;
      setSubjects(s);
      setDomains(d);
      setTrends(t);
    })()
      .catch((err) => {
        if (request === examsRequest.current) {
          setExamsError(loadFailed('Could not load your exam insights', err));
        }
      })
      .finally(() => {
        if (request === examsRequest.current) setExamsLoading(false);
      });
  };

  const fetchSystemDesign = () => {
    setSdLoading(true);
    setSdError(null);
    getSystemDesignAnalytics()
      .then(setSdAnalytics)
      .catch((err) => setSdError(loadFailed('Could not load System Design insights', err)))
      .finally(() => setSdLoading(false));
  };

  const fetchInterviewPractice = () => {
    setIpLoading(true);
    setIpError(null);
    getRecordingAnalytics()
      .then(setIpAnalytics)
      .catch((err) => setIpError(loadFailed('Could not load interview insights', err)))
      .finally(() => setIpLoading(false));
  };

  // Only the visible tab is fetched, and only once. All three used to load on
  // mount regardless of which was open. The exam tab is the exception: it is
  // one preparation's evidence, so a different preparation is a new fetch.
  const [loaded, setLoaded] = useState<Set<TabKey>>(new Set());
  const [examsFor, setExamsFor] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    if (tab === 'exams') {
      if (examsFor === selectedId) return;
      setExamsFor(selectedId);
      fetchExams();
      return;
    }
    if (loaded.has(tab)) return;
    setLoaded((seen) => new Set(seen).add(tab));
    if (tab === 'system_design') fetchSystemDesign();
    if (tab === 'interview_practice') fetchInterviewPractice();
    // fetch* are stable for this page's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedId]);

  const primary = describedPreparation(subjects, selectedId);

  return (
    <Box>
      <PageHead
        // The exam tab is one preparation's evidence; the other two are shared
        // across every preparation, and say so.
        eyebrow={tab === 'exams' ? primary?.name : 'Shared across preparations'}
        title="Insights & Analytics"
        sub="Understand progress after you have practised. This surface explains movement rather than creating more work for you."
      />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} aria-label="Insights" sx={{ mt: '4px', borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Exams" value="exams" />
        <Tab label="System Design" value="system_design" />
        <Tab label="Interview" value="interview_practice" />
      </Tabs>

      {tab === 'exams' && (
        examsLoading ? <Section><LinearProgress aria-label="Loading exam results" /></Section> : examsError ? (
          <Section>
            <Alert severity="error" action={<Button color="inherit" size="small" onClick={fetchExams}>Retry</Button>}>
              {examsError}
            </Alert>
          </Section>
        ) : (
          <ExamsInsights
            subject={primary}
            domains={domains}
            trends={trends}
            onPractise={(domain) => navigate(
              `/exam-setup?kind=drill&subject=${primary?.id}&domain=${encodeURIComponent(domain)}`
            )}
          />
        )
      )}

      {tab === 'system_design' && (
        sdLoading ? <Section><LinearProgress aria-label="Loading System Design results" /></Section> : sdError ? (
          <Section>
            <Alert severity="error" action={<Button color="inherit" size="small" onClick={fetchSystemDesign}>Retry</Button>}>
              {sdError}
            </Alert>
          </Section>
        ) : sdAnalytics && sdAnalytics.graded_count === 0 ? (
          <Section>
            <Panel>
              <Eyebrow>System Design</Eyebrow>
              <Sub sx={{ mb: 0 }}>
                Nothing graded yet. Complete a System Design attempt and have it graded to see anything here.
              </Sub>
            </Panel>
          </Section>
        ) : sdAnalytics && (
          <>
            <Section>
              <Panel component="section" aria-label="What changed">
                <PanelHead
                  eyebrow="What changed"
                  title={(
                    <>
                      {sdAnalytics.graded_count} of {sdAnalytics.total_attempts} attempts graded
                      {sdAnalytics.average_score !== null
                        && `, averaging ${(sdAnalytics.average_score / 10).toFixed(1)} / 10`}.
                    </>
                  )}
                />
                <Box sx={{ height: 260 }}>
                  <ScoreTrendChart
                    trends={sdAnalytics.score_trend}
                    outOf={10}
                    label="System Design score"
                    rollingLabel="5-attempt rolling average"
                    emptyMessage="Complete a System Design practice attempt to see your score trend here."
                  />
                </Box>
              </Panel>
            </Section>

            <Section>
              <Grid columns={2}>
                <Panel component="section" aria-label="Where the marks go">
                  <PanelHead eyebrow="Where the marks go" title="By rubric dimension" />
                  <CategoryScoreList scores={sdAnalytics.category_averages} />
                </Panel>
                <Panel soft component="section" aria-label="Recent attempts">
                  <PanelHead eyebrow="Recent attempts" title="Your latest answers" />
                  {sdAnalytics.recent_attempts.map((a) => (
                    <Row
                      key={a.id}
                      title={a.prompt_title}
                      detail={a.overall_score !== null ? `${(a.overall_score / 10).toFixed(1)} / 10` : 'Not graded'}
                      action={(
                        <Button variant="outlined" onClick={() => navigate(`/system-design/attempts/${a.id}`)} aria-label={`Open ${a.prompt_title}`}>
                          Open
                        </Button>
                      )}
                    />
                  ))}
                </Panel>
              </Grid>
            </Section>
          </>
        )
      )}

      {tab === 'interview_practice' && (
        ipLoading ? <Section><LinearProgress aria-label="Loading interview practice results" /></Section> : ipError ? (
          <Section>
            <Alert severity="error" action={<Button color="inherit" size="small" onClick={fetchInterviewPractice}>Retry</Button>}>
              {ipError}
            </Alert>
          </Section>
        ) : ipAnalytics && ipAnalytics.analyzed_count === 0 ? (
          <Section>
            <Panel>
              <Eyebrow>Interview</Eyebrow>
              <Sub sx={{ mb: 0 }}>Nothing analysed yet. Record an answer and have it analysed to see anything here.</Sub>
            </Panel>
          </Section>
        ) : ipAnalytics && (
          <>
            {ipAnalytics.weakest_content_category && (
              <Section>
                <Panel component="section" aria-label="What is holding you back">
                  <Eyebrow>What is holding you back</Eyebrow>
                  <Typography variant="h5" component="h2" sx={{ mt: '4px' }}>
                    {ipAnalytics.weakest_content_category.category} in{' '}
                    {ipAnalytics.weakest_content_category.round_label} rounds, averaging{' '}
                    {Math.round(ipAnalytics.weakest_content_category.avg_score_pct)}%.
                  </Typography>
                </Panel>
              </Section>
            )}

            <Section>
              <Grid columns={2}>
                <Panel component="section" aria-label="By round">
                  <Eyebrow>By round</Eyebrow>
                  {ipAnalytics.by_round.map((r) => (
                    <Box key={r.round_type} sx={{ py: '10px', borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
                      <Typography variant="h6" component="h3">
                        {r.round_label}
                        <Typography component="span" variant="body1" sx={{ color: 'text.secondary', fontWeight: 400 }}>
                          {' '}· {r.attempt_count} recording{r.attempt_count === 1 ? '' : 's'}
                        </Typography>
                      </Typography>
                      {r.avg_content_score_pct !== null
                        ? <Bar label="Content" value={r.avg_content_score_pct} />
                        : <Detail>Content — not graded</Detail>}
                      {r.avg_delivery_score_pct !== null
                        ? <Bar label="Delivery" value={r.avg_delivery_score_pct} />
                        : <Detail>Delivery — not graded</Detail>}
                    </Box>
                  ))}
                </Panel>
                <Panel component="section" aria-label="Delivery over time">
                  <Eyebrow>Delivery over time</Eyebrow>
                  <Box sx={{ height: 260, mt: '10px' }}>
                    <ScoreTrendChart
                      trends={ipAnalytics.delivery_trend}
                      label="Delivery score %"
                      rollingLabel="5-recording rolling average %"
                      emptyMessage="Analyse a practice recording to see your delivery trend here."
                    />
                  </Box>
                </Panel>
              </Grid>
            </Section>
          </>
        )
      )}
    </Box>
  );
};

/**
 * The preparation this page describes: the one chosen in the picker.
 *
 * So Insights describes the same thing Home does. The old inference -- most
 * mocks wins -- is kept only as the fallback when nothing is selected; on its
 * own it meant switching to another preparation left this page reporting on
 * PSM I.
 */
function describedPreparation(subjects: Subject[], selectedId: number | null): Subject | null {
  const inferred =
    [...subjects]
      .filter((s) => s.has_exam_profile)
      .sort((a, b) => b.readiness.mock_count - a.readiness.mock_count)[0] ?? null;
  return subjects.find((s) => s.id === selectedId) ?? inferred;
}

/**
 * The run of mocks as the prototype's .trend: one bar a mock, the latest in the
 * accent, and the pass mark drawn across them where it actually is.
 */
const MockBars: React.FC<{ scores: number[]; passMark?: number | null }> = ({ scores, passMark }) => (
  <Box
    role="img"
    aria-label={`Recent mock scores: ${scores.map((s) => pct(s)).join(', ')}${passMark != null ? `. Pass mark ${pct(passMark)}.` : '.'}`}
    sx={{ position: 'relative', height: 120, display: 'flex', alignItems: 'flex-end', gap: '8px', mt: '17px' }}
  >
    {scores.map((s, i) => (
      <Box
        key={i}
        sx={{
          width: 25, height: `${Math.max(2, Math.min(100, s))}%`, borderRadius: '4px 4px 0 0',
          bgcolor: i === scores.length - 1 ? 'primary.main' : 'pb.track2',
        }}
      />
    ))}
    {passMark != null && (
      <Box
        aria-hidden
        sx={{
          position: 'absolute', left: 0, width: Math.max(80, scores.length * 33), bottom: `${passMark}%`,
          borderTop: '1px dashed', borderColor: 'text.secondary',
        }}
      />
    )}
  </Box>
);

/**
 * The exam tab, as the prototype's three panels plus the all-history reading.
 *
 * The readiness panels read from the same rule Home reads, so the two pages
 * cannot disagree. The all-history section is kept because it answers a
 * different and real question -- how am I doing across everything I have ever
 * answered -- and it says so, in the same breath as the numbers.
 */
const ExamsInsights: React.FC<{
  subject: Subject | null;
  domains: DomainMasteryItem[];
  trends: ScoreTrendPoint[];
  onPractise: (domain: string) => void;
}> = ({ subject, domains, trends, onPractise }) => {
  const r = subject?.readiness ?? null;
  const blocker = r?.blockers[0] ?? null;
  const scored = (r?.domains ?? []).filter((d) => d.score_pct != null);
  // The rule's floor as the server applied it. The bars draw no line when it
  // is unknown rather than a guessed one.
  const floor = r?.rules?.domain_floor_pct;
  const explanation = r ? explainVerdict(r) : null;

  if (!r || r.mock_count === 0) {
    return (
      <Section>
        <Panel component="section" aria-label="Performance trend">
          <Eyebrow>Performance trend</Eyebrow>
          <Typography variant="h5" component="h2" sx={{ mt: '4px' }}>Nothing measured yet</Typography>
          <Sub sx={{ mb: 0 }}>Sit a full mock and this page will have something to interpret.</Sub>
          {subject?.has_exam_profile && (
            <Button component={RouterLink} to="/exam-setup" variant="contained" color="ink" sx={{ mt: '12px' }}>
              Take a mock
            </Button>
          )}
        </Panel>
      </Section>
    );
  }

  const latest = r.recent_scores[r.recent_scores.length - 1];

  return (
    <>
      <Section>
        <Panel component="section" aria-label="Performance trend">
          <PanelHead
            eyebrow="Performance trend"
            title={latest != null ? `${pct(latest)} latest signal` : 'Latest signal'}
            aside={<Pill tone={STATE_TONE[r.state]}>{READINESS_LABELS[r.state]}</Pill>}
          />
          {r.recent_scores.length > 0 && <MockBars scores={r.recent_scores} passMark={r.pass_mark} />}
          <Detail sx={{ mt: '8px' }}>Full mocks are readiness evidence; practice and review appear as learning signals.</Detail>

          <Box sx={{ mt: '16px', pt: '14px', borderTop: '1px solid', borderColor: 'divider' }}>
            <Eyebrow>What changed</Eyebrow>
            <Typography variant="body1" sx={{ mt: '4px' }}>
              {r.points_per_mock != null && r.points_per_mock > 0
                ? `Your mock score is rising about ${r.points_per_mock} points a mock.`
                : r.points_per_mock != null && r.points_per_mock < 0
                  ? `Your mock score is falling about ${Math.abs(r.points_per_mock)} points a mock.`
                  : r.points_per_mock == null
                    ? 'One mock so far. A trend needs at least two.'
                    : 'Your mock score has not moved much.'}
              {r.most_improved
                && ` ${r.most_improved.domain} went from ${pct(r.most_improved.before_pct)} `
                + `to ${pct(r.most_improved.after_pct)} between the last two.`}
            </Typography>
            <Detail sx={{ mt: '6px', fontVariantNumeric: 'tabular-nums' }}>
              {r.recent_scores.map((s) => pct(s)).join(' → ')}
              {r.pass_mark != null && ` · ${pct(r.pass_mark)} to pass`}
            </Detail>
            {/* The rule, stated where the count is claimed. Papers sat before
                the app could record what kind of session they were are counted
                on their shape, and a learner who does not recognise the number
                can check the sessions themselves in Review. */}
            <Detail sx={{ mt: '6px' }}>
              A paper counts as a mock when it was sat at full length and timed
              against this subject&apos;s exam profile — including papers sat before
              PrepBench could label them. They are all listed, with their dates,
              under Review.
            </Detail>
          </Box>
        </Panel>
      </Section>

      <Section>
        <Grid columns={2}>
          <Panel component="section" aria-label="Domain performance">
            <Eyebrow>Domain performance</Eyebrow>
            {scored.length > 0 ? (
              <>
                <Detail sx={{ mt: '4px' }}>
                  Accuracy by area across the{' '}
                  {r.rules ? `${Math.min(r.rules.consecutive_mocks_at_pass, r.mock_count)} ` : ''}mocks that
                  decided the verdict.{floor != null && ` The line is the ${floor}% floor every area has to clear.`}
                </Detail>
                {[...scored]
                  .sort((a, b) => (a.score_pct ?? 0) - (b.score_pct ?? 0))
                  .map((d) => (
                    <Bar
                      key={d.domain}
                      label={d.domain}
                      value={d.score_pct ?? 0}
                      detail={`${d.answered} answered`}
                      threshold={floor}
                      to={subject ? areaHref(subject.id, d.domain) : undefined}
                    />
                  ))}
              </>
            ) : (
              <Detail sx={{ mt: '4px' }}>No area has enough answers in the deciding mocks to be measured yet.</Detail>
            )}
          </Panel>

          <Panel soft component="section" aria-label="Interpretation">
            <Eyebrow>{blocker ? 'What is holding you back' : 'Where you stand'}</Eyebrow>
            <Typography variant="h5" component="h2" sx={{ mt: '4px' }}>
              {blocker ? blockerSentence(blocker, r.rules) : readySentence(r.pass_mark, r.rules)}
            </Typography>
            <Sub sx={{ mb: 0 }}>Use the recommendation in Home or Practice to turn this observation into action.</Sub>
            {explanation && <WhyThis explanation={explanation} sx={{ mt: '8px' }} />}
            {blocker?.kind === 'weak_domain' && blocker.domain && (
              <Button variant="contained" color="ink" onClick={() => onPractise(blocker.domain!)} sx={{ mt: '12px' }}>
                Practise {blocker.domain}
              </Button>
            )}
          </Panel>
        </Grid>
      </Section>

      {domains.length > 0 && subject && (
        <Section>
          <Panel component="section" aria-label="Everything you have ever answered">
            <Eyebrow>Everything you have ever answered</Eyebrow>
            <Detail sx={{ mt: '4px' }}>
              A different and larger population: every {subject.name} session, drills included.
              These numbers run lower than the ones above because a drill deliberately draws
              from what you are getting wrong. Neither figure is the other&apos;s correction.
              Open an area to see its misses and what is due.
            </Detail>
            <Grid columns={2} sx={{ mt: '6px', alignItems: 'start' }}>
              <Box>
                {[...domains]
                  .sort((a, b) => a.accuracy_percentage - b.accuracy_percentage)
                  .map((d) => (
                    <Bar
                      key={d.domain}
                      label={d.domain}
                      value={d.accuracy_percentage}
                      detail={`${d.correct_count} of ${d.total_attempted}`}
                      to={areaHref(subject.id, d.domain)}
                    />
                  ))}
              </Box>
              {trends.length > 1 && (
                <Box sx={{ height: 260, pt: '12px' }}>
                  <ScoreTrendChart trends={trends} label="Session score %" rollingLabel="5-session rolling average %" />
                </Box>
              )}
            </Grid>
          </Panel>
        </Section>
      )}
    </>
  );
};
