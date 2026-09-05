// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, LinearProgress, Tabs, Tab, Button, Alert, Stack, Divider,
} from '@mui/material';
import { ScoreTrendChart } from '../components/analytics/ScoreTrendChart';
import { CategoryScoreList } from '../components/common/CategoryScoreList';
import {
  getDomainPerformance, getScoreTrends, getSubjects,
  getSystemDesignAnalytics, getRecordingAnalytics,
} from '../services/api';
import { DomainMasteryItem, ScoreTrendPoint } from '../types/analytics';
import { Subject } from '../types/subject';
import { SystemDesignAnalytics } from '../types/systemDesign';
import { RecordingAnalytics } from '../types/recording';
import { blockerSentence, pct, readySentence } from '../services/readinessText';

/**
 * Insights: what changed, what is holding you back, why, and what to look at.
 *
 * "Insights" rather than "Learning Analytics" -- analytics is what the system
 * does; an insight is what the learner leaves with. The rename set the test
 * each panel has to pass, and on the second pass most of them failed it.
 *
 * The page was four bordered cards containing two line charts and two bar
 * lists, with no sentence anywhere. Worse, it quietly disagreed with Home:
 * the score trend plotted every session, drills included, so the same period
 * Home showed as 70 → 83 → 88 → 93 appeared here as a graph that dipped to
 * five per cent; and the domain breakdown pooled every answer ever given,
 * so "Managing Products with Agility" read 82% here and 85% on Home. Both
 * numbers were correct. Neither said which population it described, and a
 * learner cannot reconcile two figures that do not admit they are counting
 * different things.
 *
 * Each section now opens with the reading and puts the evidence under it,
 * and every population is named where it is shown.
 */

type TabKey = 'exams' | 'system_design' | 'interview_practice';

/** A section: the reading first, the evidence under it. */
const Section: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <Box sx={{ mb: 5 }}>
    <Typography variant="overline" sx={{ color: 'text.secondary' }}>{label}</Typography>
    <Box sx={{ mt: 0.5 }}>{children}</Box>
  </Box>
);

/** A labelled bar. Used where the comparison between rows is the point. */
const Bar: React.FC<{
  label: string;
  value: number;
  detail?: string;
  threshold?: number;
}> = ({ label, value, detail, threshold }) => (
  <Box sx={{ mb: 1.75 }}>
    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
      <Typography variant="body2">{label}</Typography>
      <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', color: 'text.secondary' }}>
        {pct(value)}{detail && ` · ${detail}`}
      </Typography>
    </Stack>
    <Box sx={{ position: 'relative' }}>
      <LinearProgress
        variant="determinate"
        value={Math.min(100, value)}
        color={threshold != null && value < threshold ? 'warning' : 'primary'}
        sx={{ height: 6, borderRadius: 3, bgcolor: 'action.hover' }}
      />
      {threshold != null && (
        // The floor, drawn where it actually is. A bar with no line on it
        // cannot say whether the number is good.
        <Box
          sx={{
            position: 'absolute', top: -2, bottom: -2, left: `${threshold}%`,
            width: '1px', bgcolor: 'text.disabled',
          }}
        />
      )}
    </Box>
  </Box>
);

export const AnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
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

  const fetchExams = () => {
    setExamsLoading(true);
    setExamsError(null);
    Promise.all([getDomainPerformance(), getScoreTrends(), getSubjects()])
      .then(([d, t, s]) => { setDomains(d); setTrends(t); setSubjects(s); })
      .catch(() => setExamsError('Failed to load analytics data. Please check backend connection.'))
      .finally(() => setExamsLoading(false));
  };

  const fetchSystemDesign = () => {
    setSdLoading(true);
    setSdError(null);
    getSystemDesignAnalytics()
      .then(setSdAnalytics)
      .catch(() => setSdError('Failed to load System Design analytics. Please check backend connection.'))
      .finally(() => setSdLoading(false));
  };

  const fetchInterviewPractice = () => {
    setIpLoading(true);
    setIpError(null);
    getRecordingAnalytics()
      .then(setIpAnalytics)
      .catch(() => setIpError('Failed to load Interview Practice analytics. Please check backend connection.'))
      .finally(() => setIpLoading(false));
  };

  // Only the visible tab is fetched, and only once. All three used to load on
  // mount regardless of which was open.
  const [loaded, setLoaded] = useState<Set<TabKey>>(new Set());

  useEffect(() => {
    if (loaded.has(tab)) return;
    setLoaded((seen) => new Set(seen).add(tab));
    if (tab === 'exams') fetchExams();
    if (tab === 'system_design') fetchSystemDesign();
    if (tab === 'interview_practice') fetchInterviewPractice();
    // fetch* are stable for this page's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const primary =
    [...subjects]
      .filter((s) => s.has_exam_profile)
      .sort((a, b) => b.readiness.mock_count - a.readiness.mock_count)[0] ?? null;

  return (
    <Box sx={{ maxWidth: 760 }}>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 3 }}>Insights</Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 4, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Exams" value="exams" sx={{ textTransform: 'none' }} />
        <Tab label="System Design" value="system_design" sx={{ textTransform: 'none' }} />
        <Tab label="Interview" value="interview_practice" sx={{ textTransform: 'none' }} />
      </Tabs>

      {tab === 'exams' && (
        examsLoading ? <LinearProgress /> : examsError ? (
          <Alert
            severity="error"
            action={<Button color="inherit" size="small" onClick={fetchExams}>Retry</Button>}
          >
            {examsError}
          </Alert>
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
        sdLoading ? <LinearProgress /> : sdError ? (
          <Alert
            severity="error"
            action={<Button color="inherit" size="small" onClick={fetchSystemDesign}>Retry</Button>}
          >
            {sdError}
          </Alert>
        ) : sdAnalytics && sdAnalytics.graded_count === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nothing graded yet. Complete a System Design attempt and have it graded to see anything here.
          </Typography>
        ) : sdAnalytics && (
          <>
            <Section label="What changed">
              <Typography variant="body1" sx={{ lineHeight: 1.65 }}>
                {sdAnalytics.graded_count} of {sdAnalytics.total_attempts} attempts graded
                {sdAnalytics.average_score !== null
                  && `, averaging ${Math.round(sdAnalytics.average_score)}%`}.
              </Typography>
              <Box sx={{ height: 260, mt: 2 }}>
                <ScoreTrendChart
                  trends={sdAnalytics.score_trend}
                  label="System Design Score %"
                  rollingLabel="5-Attempt Rolling Avg %"
                  emptyMessage="Complete a System Design practice attempt to see your score trend here."
                />
              </Box>
            </Section>

            <Section label="Where the marks go">
              <CategoryScoreList scores={sdAnalytics.category_averages} />
            </Section>

            <Section label="Recent attempts">
              <Stack divider={<Divider />}>
                {sdAnalytics.recent_attempts.map((a) => (
                  <Box
                    key={a.id}
                    component="button"
                    type="button"
                    aria-label={a.prompt_title}
                    onClick={() => navigate(`/system-design/attempts/${a.id}`)}
                    sx={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                      gap: 2, py: 1.2, width: '100%', textAlign: 'left', font: 'inherit',
                      border: 0, bgcolor: 'transparent', color: 'text.primary', cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' },
                      '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
                    }}
                  >
                    <Typography variant="body2">{a.prompt_title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {a.overall_score !== null ? `${Math.round(a.overall_score)}%` : 'Not graded'}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Section>
          </>
        )
      )}

      {tab === 'interview_practice' && (
        ipLoading ? <LinearProgress /> : ipError ? (
          <Alert
            severity="error"
            action={<Button color="inherit" size="small" onClick={fetchInterviewPractice}>Retry</Button>}
          >
            {ipError}
          </Alert>
        ) : ipAnalytics && ipAnalytics.analyzed_count === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nothing analysed yet. Record an answer and have it analysed to see anything here.
          </Typography>
        ) : ipAnalytics && (
          <>
            {ipAnalytics.weakest_content_category && (
              <Section label="What is holding you back">
                <Typography variant="body1" sx={{ lineHeight: 1.65 }}>
                  {ipAnalytics.weakest_content_category.category} in{' '}
                  {ipAnalytics.weakest_content_category.round_label} rounds, averaging{' '}
                  {Math.round(ipAnalytics.weakest_content_category.avg_score_pct)}%.
                </Typography>
              </Section>
            )}

            <Section label="By round">
              {ipAnalytics.by_round.map((r) => (
                <Box key={r.round_type} sx={{ mb: 2.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                    {r.round_label}
                    <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }}>
                      {' '}· {r.attempt_count} recording{r.attempt_count === 1 ? '' : 's'}
                    </Typography>
                  </Typography>
                  {r.avg_content_score_pct !== null
                    ? <Bar label="Content" value={r.avg_content_score_pct} />
                    : <Typography variant="caption" color="text.secondary">Content — not graded</Typography>}
                  {r.avg_delivery_score_pct !== null
                    ? <Bar label="Delivery" value={r.avg_delivery_score_pct} />
                    : <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Delivery — not graded
                    </Typography>}
                </Box>
              ))}
            </Section>

            <Section label="Delivery over time">
              <Box sx={{ height: 260 }}>
                <ScoreTrendChart
                  trends={ipAnalytics.delivery_trend}
                  label="Delivery Score %"
                  rollingLabel="5-Recording Rolling Avg %"
                  emptyMessage="Analyze a practice recording to see your delivery trend here."
                />
              </Box>
            </Section>
          </>
        )
      )}
    </Box>
  );
};

/**
 * The exam tab, as four questions rather than four charts.
 *
 * The readiness sections read from the same rule Home reads, so the two
 * pages cannot disagree. The all-history section is kept because it answers
 * a different and real question -- how am I doing across everything I have
 * ever answered -- and it now says so, in the same breath as the numbers,
 * instead of leaving the learner to reconcile it with Home unaided.
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
  const floor = 80;

  if (!r || r.mock_count === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Nothing measured yet. Sit a full mock and this page will have something to interpret.
      </Typography>
    );
  }

  return (
    <>
      <Section label="What changed">
        <Typography variant="body1" sx={{ lineHeight: 1.65 }}>
          {r.points_per_mock != null && r.points_per_mock > 0
            ? `Your mock score is rising about ${r.points_per_mock} points a mock.`
            : r.points_per_mock != null && r.points_per_mock < 0
              ? `Your mock score is falling about ${Math.abs(r.points_per_mock)} points a mock.`
              : 'Your mock score has not moved much.'}
          {r.most_improved
            && ` ${r.most_improved.domain} went from ${pct(r.most_improved.before_pct)} `
            + `to ${pct(r.most_improved.after_pct)} between the last two.`}
        </Typography>
        <Typography variant="body2" sx={{ mt: 1.5, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
          {r.recent_scores.map((s) => pct(s)).join('  →  ')}
          {r.pass_mark != null && `   ·   ${pct(r.pass_mark)} to pass`}
        </Typography>
        {/* The rule, stated where the count is claimed.
            The six papers in the working database were sat before the app
            could record what kind of session they were -- the column was
            added later with a "drill" default -- so they are counted on their
            shape. A learner who does not recognise the number can read what
            it means here and check the sessions themselves in Review. */}
        <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'text.secondary' }}>
          A paper counts as a mock when it was sat at full length and timed
          against this subject&apos;s exam profile — including papers sat before
          PrepBench could label them. They are all listed, with their dates,
          under Review.
        </Typography>
      </Section>

      <Section label={blocker ? 'What is holding you back' : 'Where you stand'}>
        <Typography variant="body1" sx={{ lineHeight: 1.65 }}>
          {blocker ? blockerSentence(blocker) : readySentence(r.pass_mark)}
        </Typography>
        {blocker?.kind === 'weak_domain' && blocker.domain && (
          <Button
            variant="contained"
            disableElevation
            onClick={() => onPractise(blocker.domain!)}
            sx={{ mt: 2, borderRadius: '100px', fontWeight: 600, textTransform: 'none' }}
          >
            Practise {blocker.domain}
          </Button>
        )}
      </Section>

      {scored.length > 0 && (
        <Section label="Why">
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            Accuracy by area across the {Math.min(3, r.mock_count)} mocks that decided the
            verdict. The line is the {floor}% floor every area has to clear.
          </Typography>
          {[...scored]
            .sort((a, b) => (a.score_pct ?? 0) - (b.score_pct ?? 0))
            .map((d) => (
              <Bar
                key={d.domain}
                label={d.domain}
                value={d.score_pct ?? 0}
                detail={`${d.answered} answered`}
                threshold={floor}
              />
            ))}
        </Section>
      )}

      {domains.length > 0 && (
        <Section label="Everything you have ever answered">
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            A different and larger population: every session, drills included. These numbers
            run lower than the ones above because a drill deliberately draws from what you
            are getting wrong. Neither figure is the other&apos;s correction.
          </Typography>
          {[...domains]
            .sort((a, b) => a.accuracy_percentage - b.accuracy_percentage)
            .map((d) => (
              <Bar
                key={d.domain}
                label={d.domain}
                value={d.accuracy_percentage}
                detail={`${d.correct_count} of ${d.total_attempted}`}
              />
            ))}
          {trends.length > 1 && (
            <Box sx={{ height: 260, mt: 3 }}>
              <ScoreTrendChart trends={trends} />
            </Box>
          )}
        </Section>
      )}
    </>
  );
};
