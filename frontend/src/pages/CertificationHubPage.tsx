// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  Stack,
  Tab,
  Tabs,
  Typography,
  useTheme,
} from '@mui/material';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileCheck2,
  History,
  Library,
  PlayCircle,
  Route as RouteIcon,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {
  Actions,
  Bar,
  BigFigure,
  Detail,
  Eyebrow,
  Grid,
  PageHead,
  Panel,
  PanelHead,
  Pill,
  Row,
  Section,
  Sub,
  type Tone,
} from '../components/ui/primitives';
import { usePreparation } from '../context/PreparationContext';
import {
  getHomeSummary,
  getMockHistory,
  getReviewCounts,
  getSubjects,
} from '../services/api';
import {
  getSubjectCapabilities,
  KNOWN_PRODUCTION_SUBJECTS,
  UNASSIGNED_CAPABILITIES,
} from '../services/capabilities';
import { CapabilityUnavailablePage } from '../components/common/CapabilityUnavailablePage';
import { LoadingState } from '../components/common/States';
import type { MockHistoryItem } from '../types/exam';
import type { HomeSummary, Subject } from '../types/subject';

type CertTab = 'overview' | 'simulator' | 'bank' | 'spaced';

export const CertificationHubPage: React.FC = () => {
  const theme = useTheme();
  const [searchParams] = useSearchParams();
  const {
    selected: ctxSelected,
    selectedId: ctxSelectedId,
    capabilities: ctxCapabilities,
  } = usePreparation();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [history, setHistory] = useState<MockHistoryItem[] | null>(null);
  const [spacedDue, setSpacedDue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<CertTab>('overview');

  const urlSubjectParam = searchParams.get('subject');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    Promise.all([getSubjects(), getHomeSummary()])
      .then(([subjs, home]) => {
        if (cancelled) return;
        setSubjects(subjs);
        setSummary(home);
      })
      .catch((err) => {
        if (!cancelled) setLoadError('Could not load certification data.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Resolve target subject strictly without silent switching
  const targetSubject = useMemo(() => {
    if (urlSubjectParam) {
      const num = Number(urlSubjectParam);
      if (!Number.isNaN(num)) {
        return subjects.find((s) => s.id === num) ?? null;
      }
      return subjects.find((s) => s.slug === urlSubjectParam) ?? null;
    }
    if (ctxSelectedId != null) {
      return subjects.find((s) => s.id === ctxSelectedId) ?? ctxSelected ?? null;
    }
    return null;
  }, [urlSubjectParam, ctxSelectedId, ctxSelected, subjects]);

  const targetCapabilities = useMemo(() => {
    if (!targetSubject) return UNASSIGNED_CAPABILITIES;
    return getSubjectCapabilities(targetSubject.id);
  }, [targetSubject]);

  const targetId = targetSubject?.id ?? null;

  useEffect(() => {
    if (targetId == null) {
      setHistory(null);
      setSpacedDue(null);
      return undefined;
    }

    let cancelled = false;
    getMockHistory(targetId)
      .then((h) => {
        if (!cancelled) setHistory(h);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      });

    getReviewCounts(targetId)
      .then((c) => {
        if (!cancelled) setSpacedDue(c.spaced_due);
      })
      .catch(() => {
        if (!cancelled) setSpacedDue(null);
      });

    return () => {
      cancelled = true;
    };
  }, [targetId]);

  if (loading) {
    return <LoadingState label="Loading Certification Hub…" />;
  }

  // 1. Unassigned Subject Context Guard: Zero silent default to PSM I!
  if (!targetSubject) {
    const certCapable = subjects.filter((s) => {
      const caps = getSubjectCapabilities(s.id);
      return caps.certification;
    });

    return (
      <Box sx={{ maxWidth: 840, mx: 'auto', py: 4 }}>
        <PageHead
          eyebrow="Certification Hub"
          title="Select a Certification"
          sub="No certification preparation is currently selected. Choose a certified track to inspect formal readiness and exam tools."
        />
        <Panel sx={{ p: 4, textAlign: 'center', mb: 3 }}>
          <Box sx={{ display: 'inline-flex', p: 2, borderRadius: '50%', bgcolor: 'action.hover', mb: 2 }}>
            <FileCheck2 size={36} color={theme.palette.primary.main} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
            Certification Readiness Scoping
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 600, mx: 'auto', mb: 3 }}>
            PrepBench certification assessments require formal subject scoping. Mocks, question bank verification, and qualifying streaks are scoped to an explicit credential.
          </Typography>
          <Stack direction="row" spacing={2} sx={{ justifyContent: 'center', flexWrap: 'wrap', gap: 1.5 }}>
            {certCapable.map((s) => (
              <Button
                key={s.id}
                variant="contained"
                component={RouterLink}
                to={`/certification?subject=${s.id}`}
              >
                {s.name} ({s.certification ?? 'Exam'})
              </Button>
            ))}
          </Stack>
        </Panel>
      </Box>
    );
  }

  // 2. Non-Certification Subject Guard: Zero silent subject switching!
  if (!targetCapabilities.certification) {
    return <CapabilityUnavailablePage capability="Certification" subject={targetSubject} />;
  }

  // Authoritative data truth
  const isPsm = targetSubject.id === 1;
  const isKafka = targetSubject.id === 4;
  const hasQuestions = targetCapabilities.questionAvailability && targetSubject.question_count > 0;
  const questionCount = targetSubject.question_count ?? targetCapabilities.questionCount ?? 0;
  const passMark = targetSubject.pass_mark ?? 85;
  const examQuestions = targetSubject.exam_question_count ?? 80;
  const examMinutes = targetSubject.exam_minutes ?? 60;

  // Authoritative production readiness verdict from subject model
  const readiness = targetSubject.readiness;
  const mockCount = readiness?.mock_count ?? 0;
  const recentScores = readiness?.recent_scores ?? [];
  const latestScore = recentScores.length > 0 ? recentScores[recentScores.length - 1] : null;
  const streak = recentScores.slice(-3);
  const isStreakMet = streak.length >= 3 && streak.every((s) => s >= passMark);
  const isRecencyMet = Boolean(readiness?.latest_taken_at && !readiness?.is_stale);

  const verdict = !hasQuestions
    ? 'DATA NOT AVAILABLE'
    : isStreakMet && isRecencyMet
    ? 'READY'
    : 'NOT READY';

  const verdictTone: Tone =
    verdict === 'READY' ? 'success' : verdict === 'NOT READY' ? 'danger' : 'neutral';

  return (
    <Box>
      <PageHead
        eyebrow="Certification Readiness"
        title={targetSubject.certification ?? `${targetSubject.name} Certification`}
        sub={`Formal exam readiness, question bank verification, and timed mock simulator for ${targetSubject.name}.`}
        actions={
          <>
            {hasQuestions ? (
              <Button
                variant="contained"
                color="primary"
                component={RouterLink}
                to={`/exam-setup?kind=mock&subject=${targetSubject.id}`}
              >
                Start Mock Exam
              </Button>
            ) : (
              <Button variant="contained" disabled aria-disabled="true">
                0 Questions Loaded
              </Button>
            )}
            <Button
              variant="outlined"
              component={RouterLink}
              to={`/question-bank?subject=${targetSubject.id}`}
            >
              Question Bank ({questionCount})
            </Button>
          </>
        }
      />

      <Tabs
        value={tab}
        onChange={(_, val: CertTab) => setTab(val)}
        aria-label="Certification tabs"
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="overview" label="Readiness Overview" id="cert-tab-overview" />
        <Tab value="simulator" label="Exam Simulator" id="cert-tab-simulator" />
        <Tab value="bank" label={`Question Bank (${questionCount})`} id="cert-tab-bank" />
        <Tab value="spaced" label={`Review Queue ${spacedDue ? `(${spacedDue})` : ''}`} id="cert-tab-spaced" />
      </Tabs>

      {/* QUESTION 1: What certification am I preparing for? */}
      <Panel component="section" aria-labelledby="cert-q1-title" sx={{ mb: 3 }}>
        <PanelHead
          title="1. What certification am I preparing for?"
          titleId="cert-q1-title"
          aside={<Pill tone="accent">Credential Profile</Pill>}
        >
          <Detail>
            Formal credential parameters set by external examining body. PrepBench enforces fixed exam constraints.
          </Detail>
        </PanelHead>
        <Grid columns={4}>
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
            <Eyebrow>Credential Name</Eyebrow>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              {targetSubject.certification ?? targetSubject.name}
            </Typography>
            <Detail sx={{ mt: 0.5 }}>Standard External Syllabus</Detail>
          </Box>
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
            <Eyebrow>Pass Threshold</Eyebrow>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              {passMark}% Pass Mark
            </Typography>
            <Detail sx={{ mt: 0.5 }}>Strict score required to pass</Detail>
          </Box>
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
            <Eyebrow>Exam Paper Format</Eyebrow>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              {examQuestions} Questions · {examMinutes} Mins
            </Typography>
            <Detail sx={{ mt: 0.5 }}>Fixed timed conditions</Detail>
          </Box>
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
            <Eyebrow>Question Bank Truth</Eyebrow>
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 800, color: hasQuestions ? 'success.main' : 'warning.main' }}
            >
              {questionCount} Questions Loaded
            </Typography>
            <Detail sx={{ mt: 0.5 }}>
              {hasQuestions ? 'Authoritative vetted bank' : 'Bank empty — imports needed'}
            </Detail>
          </Box>
        </Grid>
      </Panel>

      {/* QUESTION 2 & 3: How ready am I? & What evidence supports that assessment? */}
      <Panel component="section" aria-labelledby="cert-q2-title" sx={{ mb: 3 }}>
        <PanelHead
          title="2. How ready am I? & 3. What evidence supports that assessment?"
          titleId="cert-q2-title"
          aside={<Pill tone={verdictTone}>Verdict: {verdict}</Pill>}
        >
          <Detail>
            Formal certification verdict derived from the authoritative production readiness engine.
          </Detail>
        </PanelHead>

        {!hasQuestions ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <b>Certification configured, but question content is currently unavailable.</b>
            <Box sx={{ mt: 0.5 }}>
              The credential profile for <b>{targetSubject.name}</b> exists with an {passMark}% pass threshold, but 0 questions are currently loaded in the database. A runnable mock exam cannot be generated until questions are imported into the question bank.
            </Box>
          </Alert>
        ) : (
          <Grid columns={2} sx={{ gap: 3 }}>
            <Box>
              <Eyebrow>Authoritative Readiness Rules</Eyebrow>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                Formal Verdict: {verdict === 'READY' ? 'VERIFIED READY' : 'NOT YET READY'}
              </Typography>
              <Detail sx={{ mb: 2 }}>
                Passing requires satisfying three strict criteria: a 3-mock qualifying streak $\ge {passMark}\%$, a qualifying mock sitting within the last 14 days, and all core domains above floor target.
              </Detail>

              <Box sx={{ display: 'grid', gap: 1.5 }}>
                <Row
                  title="3-Mock Qualifying Streak"
                  detail={`${streak.filter((s) => s >= passMark).length} / 3 consecutive mocks at or above ${passMark}%`}
                  middle={
                    isStreakMet ? (
                      <CheckCircle2 size={18} color={theme.palette.success.main} />
                    ) : (
                      <XCircle size={18} color={theme.palette.error.main} />
                    )
                  }
                  action={<Pill tone={isStreakMet ? 'success' : 'danger'}>{isStreakMet ? 'Satisfied' : 'Pending'}</Pill>}
                />
                <Row
                  title="14-Day Recency Requirement"
                  detail={
                    readiness?.latest_taken_at
                      ? `Last mock taken ${new Date(readiness.latest_taken_at).toLocaleDateString()}`
                      : 'No qualifying mock taken within 14-day window'
                  }
                  middle={
                    isRecencyMet ? (
                      <CheckCircle2 size={18} color={theme.palette.success.main} />
                    ) : (
                      <XCircle size={18} color={theme.palette.error.main} />
                    )
                  }
                  action={<Pill tone={isRecencyMet ? 'success' : 'danger'}>{isRecencyMet ? 'Active' : 'Stale / Missing'}</Pill>}
                />
                <Row
                  title="Total Qualifying Sittings"
                  detail={`${mockCount} full mock exam${mockCount === 1 ? '' : 's'} recorded`}
                  action={<Pill tone="neutral">{mockCount} sittings</Pill>}
                />
              </Box>
            </Box>

            <Box>
              <Eyebrow>Domain Performance Evidence</Eyebrow>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                Core Syllabus Domains
              </Typography>
              <Detail sx={{ mb: 2 }}>
                Real domain breakdown evaluated across historical exam attempts.
              </Detail>

              {readiness?.domains && readiness.domains.length > 0 ? (
                <Stack spacing={2}>
                  {readiness.domains.map((d) => {
                    const score = d.score_pct ?? 0;
                    const domainFloor = readiness.rules?.domain_floor_pct ?? 75;
                    const isFloorMet = score >= domainFloor;
                    return (
                      <Box key={d.domain}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {d.domain}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 700,
                              color: isFloorMet ? 'success.main' : 'warning.main',
                            }}
                          >
                            {d.score_pct != null
                              ? `${Math.round(score)}% (Floor: ${Math.round(domainFloor)}%)`
                              : 'Needs more questions'}
                          </Typography>
                        </Box>
                        <Bar
                          value={score}
                          label={d.domain}
                          color={isFloorMet ? 'success' : 'warning'}
                        />
                      </Box>
                    );
                  })}
                </Stack>
              ) : (
                <Box sx={{ p: 3, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 2 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Sit full qualifying mocks to populate domain floor analysis.
                  </Typography>
                </Box>
              )}
            </Box>
          </Grid>
        )}
      </Panel>

      {/* QUESTION 4: What should I practice next? & 5. Can I start an exam now? */}
      <Grid columns={2} sx={{ mb: 4 }}>
        <Panel component="section" aria-labelledby="cert-q4-title">
          <PanelHead
            title="4. What should I practice next?"
            titleId="cert-q4-title"
          >
            <Detail>Targeted active recall to remediate blockers and establish readiness.</Detail>
          </PanelHead>
          <Box sx={{ display: 'grid', gap: 1.5 }}>
            {hasQuestions ? (
              <>
                <Row
                  title="Targeted Practice Drill"
                  detail="Untimed active recall narrowed by weak domain or question topic"
                  action={
                    <Button
                      size="small"
                      variant="outlined"
                      component={RouterLink}
                      to={`/exam-setup?kind=drill&subject=${targetSubject.id}`}
                    >
                      Start Drill
                    </Button>
                  }
                />
                <Row
                  title="Spaced Repetition Queue"
                  detail={`${spacedDue ?? 0} cards due for SuperMemo SM-2 memory retention review`}
                  middle={<Pill tone={spacedDue ? 'accent' : 'neutral'}>{spacedDue ?? 0} due</Pill>}
                  action={
                    <Button
                      size="small"
                      variant="outlined"
                      component={RouterLink}
                      to={`/practice/spaced?subject=${targetSubject.id}`}
                    >
                      Review Queue
                    </Button>
                  }
                />
                <Row
                  title="Question Bank Inspection"
                  detail={`Browse all ${questionCount} real questions, filter by domain, or review full explanations`}
                  action={
                    <Button
                      size="small"
                      variant="outlined"
                      component={RouterLink}
                      to={`/question-bank?subject=${targetSubject.id}`}
                    >
                      Open Bank
                    </Button>
                  }
                />
              </>
            ) : (
              <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 2 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Question practice is unavailable because 0 questions are loaded for {targetSubject.name}.
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  component={RouterLink}
                  to={`/question-bank?subject=${targetSubject.id}`}
                  sx={{ mt: 1.5 }}
                >
                  Import Questions in Question Bank
                </Button>
              </Box>
            )}
          </Box>
        </Panel>

        <Panel component="section" aria-labelledby="cert-q5-title">
          <PanelHead
            title="5. Can I start an exam now?"
            titleId="cert-q5-title"
          >
            <Detail>Authoritative status for launching an exam under official conditions.</Detail>
          </PanelHead>

          {hasQuestions ? (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                <b>Ready to launch full mock.</b> {questionCount} verified questions available in question bank.
              </Alert>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                Sitting a mock creates a formal assessment record. The mock will present {examQuestions} questions in {examMinutes} minutes with an {passMark}% pass threshold.
              </Typography>
              <Actions>
                <Button
                  variant="contained"
                  color="primary"
                  component={RouterLink}
                  to={`/exam-setup?kind=mock&subject=${targetSubject.id}`}
                >
                  Configure & Start Mock Exam
                </Button>
                <Button
                  variant="outlined"
                  component={RouterLink}
                  to={`/exam-review/${history?.[0]?.session_id ?? ''}`}
                  disabled={!history || history.length === 0}
                >
                  Latest Mock Review
                </Button>
              </Actions>
            </Box>
          ) : (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                <b>Exam Simulator Locked (0 Questions Loaded).</b>
              </Alert>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                PrepBench strictly enforces data truth. Exams cannot be started for <b>{targetSubject.name}</b> until genuine questions are added to the question bank. Silently substituting other credentials' questions is prohibited.
              </Typography>
              <Actions>
                <Button variant="contained" disabled aria-disabled="true">
                  Start Mock (0 Qs Loaded)
                </Button>
                <Button
                  variant="outlined"
                  component={RouterLink}
                  to={`/question-bank?subject=${targetSubject.id}`}
                >
                  Open Question Bank to Import
                </Button>
              </Actions>
            </Box>
          )}
        </Panel>
      </Grid>
    </Box>
  );
};
