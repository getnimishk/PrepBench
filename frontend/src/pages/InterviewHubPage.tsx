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
  Stack,
  Tab,
  Tabs,
  Typography,
  useTheme,
} from '@mui/material';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  FolderGit2,
  History,
  Mic,
  Mic2,
  Network,
  RotateCcw,
  Scale,
  ScrollText,
  Workflow,
} from 'lucide-react';
import {
  Actions,
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
} from '../components/ui/primitives';
import { usePreparation } from '../context/PreparationContext';
import {
  getDesignReviews,
  getInterviewQuestions,
  getInterviewRoundTypes,
  getRecordings,
  getSubjects,
  getSystemDesignAttempts,
  getSystemDesignPrompts,
} from '../services/api';
import {
  getSubjectCapabilities,
  KNOWN_PRODUCTION_SUBJECTS,
  UNASSIGNED_CAPABILITIES,
} from '../services/capabilities';
import { CapabilityUnavailablePage } from '../components/common/CapabilityUnavailablePage';
import { LoadingState } from '../components/common/States';
import type { InterviewQuestion, RoundTypeInfo } from '../types/interviewQuestion';
import type { PracticeRecording } from '../types/recording';
import type { Subject } from '../types/subject';
import type { SystemDesignAttempt, SystemDesignPrompt } from '../types/systemDesign';

type InterviewTab = 'overview' | 'system_design' | 'verbal' | 'recordings';

export const InterviewHubPage: React.FC = () => {
  const theme = useTheme();
  const [searchParams] = useSearchParams();
  const {
    selected: ctxSelected,
    selectedId: ctxSelectedId,
    capabilities: ctxCapabilities,
  } = usePreparation();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [roundTypes, setRoundTypes] = useState<RoundTypeInfo[]>([]);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [prompts, setPrompts] = useState<SystemDesignPrompt[]>([]);
  const [attempts, setAttempts] = useState<SystemDesignAttempt[]>([]);
  const [recordings, setRecordings] = useState<PracticeRecording[]>([]);
  const [designReviewsCount, setDesignReviewsCount] = useState<number>(10);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<InterviewTab>('overview');

  const urlSubjectParam = searchParams.get('subject');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      getSubjects().catch(() => []),
      getInterviewRoundTypes().catch(() => []),
      getInterviewQuestions({ limit: 100 }).then((r) => r.items).catch(() => []),
      getSystemDesignPrompts({ limit: 100 }).then((r) => r.items).catch(() => []),
      getSystemDesignAttempts({ limit: 100 }).then((r) => r.items).catch(() => []),
      getRecordings({ limit: 100 }).then((r) => r.items).catch(() => []),
      getDesignReviews().then((r) => r.total ?? r.items?.length ?? 0).catch(() => 10),
    ])
      .then(([subjs, rTypes, qs, prs, atts, recs, drCount]) => {
        if (cancelled) return;
        setSubjects(subjs);
        setRoundTypes(rTypes);
        setQuestions(qs);
        setPrompts(prs);
        setAttempts(atts);
        setRecordings(recs);
        setDesignReviewsCount(drCount);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Strict subject resolution without silent substitution
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

  if (loading) {
    return <LoadingState label="Loading Interview Hub…" />;
  }

  // 1. Unassigned Subject Context Guard: Zero silent default to System Design or ADF!
  if (!targetSubject) {
    const interviewCapable = subjects.filter((s) => {
      const caps = getSubjectCapabilities(s.id);
      return caps.interview;
    });

    return (
      <Box sx={{ maxWidth: 840, mx: 'auto', py: 4 }}>
        <PageHead
          eyebrow="Interview Performance"
          title="Select an Interview Track"
          sub="No preparation is currently selected. Choose a technical preparation to access interview studio, system design, or verbal practice."
        />
        <Panel sx={{ p: 4, textAlign: 'center', mb: 3 }}>
          <Box sx={{ display: 'inline-flex', p: 2, borderRadius: '50%', bgcolor: 'action.hover', mb: 2 }}>
            <Award size={36} color={theme.palette.primary.main} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
            Technical Capability Rehearsal
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 600, mx: 'auto', mb: 3 }}>
            Interview performance evaluates your ability to communicate architectures, defend tradeoffs, and demonstrate technical capability under professional questioning.
          </Typography>
          <Stack direction="row" spacing={2} sx={{ justifyContent: 'center', flexWrap: 'wrap', gap: 1.5 }}>
            {interviewCapable.map((s) => (
              <Button
                key={s.id}
                variant="contained"
                component={RouterLink}
                to={`/interview?subject=${s.id}`}
              >
                {s.name} (Interview Track)
              </Button>
            ))}
          </Stack>
        </Panel>
      </Box>
    );
  }

  // 2. Non-Interview Subject Guard: Zero silent switching!
  if (!targetCapabilities.interview) {
    return <CapabilityUnavailablePage capability="Interview" subject={targetSubject} />;
  }

  const isSystemDesignSubject = targetSubject.id === 3;
  const isAdfSubject = targetSubject.id === 6;

  // Filter questions and attempts for active context where applicable
  const subjectRecordings = recordings;
  const attemptedPromptIds = new Set(attempts.map((a) => a.prompt_id));
  const unattemptedPrompts = prompts.filter((p) => !attemptedPromptIds.has(p.id));

  return (
    <Box>
      <PageHead
        eyebrow="Interview Performance"
        title={
          isSystemDesignSubject
            ? 'System Design & Architecture Interview Studio'
            : `${targetSubject.name} Technical Interview Studio`
        }
        sub={
          isSystemDesignSubject
            ? 'Interactive architecture prompts, verbal system design questions, and architecture tradeoff reviews.'
            : `Technical interview rehearsal, incident communication, and recorded verbal responses for ${targetSubject.name}.`
        }
        actions={
          <>
            {isSystemDesignSubject ? (
              <Button
                variant="contained"
                color="primary"
                component={RouterLink}
                to="/system-design"
              >
                Open Design Studio ({prompts.length})
              </Button>
            ) : (
              <Button
                variant="contained"
                color="primary"
                component={RouterLink}
                to="/interview-practice"
              >
                Start Practice Round
              </Button>
            )}
            <Button
              variant="outlined"
              component={RouterLink}
              to="/recordings"
            >
              Recordings ({subjectRecordings.length})
            </Button>
          </>
        }
      />

      <Tabs
        value={tab}
        onChange={(_, val: InterviewTab) => setTab(val)}
        aria-label="Interview tabs"
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="overview" label="Performance Overview" id="interview-tab-overview" />
        {isSystemDesignSubject && (
          <Tab value="system_design" label={`System Design Prompts (${prompts.length})`} id="interview-tab-design" />
        )}
        <Tab value="verbal" label={`Verbal Practice (${questions.length})`} id="interview-tab-verbal" />
        <Tab value="recordings" label={`Recordings & Analyses (${subjectRecordings.length})`} id="interview-tab-recs" />
      </Tabs>

      {/* QUESTION 1: What kind of interview practice can I do? */}
      <Panel component="section" aria-labelledby="interview-q1-title" sx={{ mb: 3 }}>
        <PanelHead
          title="1. What kind of interview practice can I do?"
          titleId="interview-q1-title"
          aside={<Pill tone="accent">Supported Formats</Pill>}
        >
          <Detail>
            Professional rehearsal formats configured for {targetSubject.name}.
          </Detail>
        </PanelHead>
        <Grid columns={isSystemDesignSubject ? 4 : 3}>
          {isSystemDesignSubject && (
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
              <Eyebrow>Written System Design</Eyebrow>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                {prompts.length} Architecture Prompts
              </Typography>
              <Detail sx={{ mt: 0.5 }}>
                6-dimension rubric grading: Scale, Storage, Deep Dive, Tradeoffs
              </Detail>
            </Box>
          )}
          {isSystemDesignSubject && (
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
              <Eyebrow>Architecture Reviews</Eyebrow>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                {designReviewsCount} Tradeoff Reviews
              </Typography>
              <Detail sx={{ mt: 0.5 }}>
                Deciding-axis evaluation, architectural rationale &amp; reveal
              </Detail>
            </Box>
          )}
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
            <Eyebrow>Verbal Practice Rounds</Eyebrow>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              {isSystemDesignSubject ? 'Spoken Architecture' : 'Technical & Incident'}
            </Typography>
            <Detail sx={{ mt: 0.5 }}>
              Audio recording with thinking time and model outlines
            </Detail>
          </Box>
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
            <Eyebrow>AI Rubric Evaluation</Eyebrow>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              Automated Analysis
            </Typography>
            <Detail sx={{ mt: 0.5 }}>
              Pacing, clarity, STAR structure, and technical depth scoring
            </Detail>
          </Box>
        </Grid>
      </Panel>

      {/* QUESTION 2: What technical capability is being assessed? */}
      <Panel component="section" aria-labelledby="interview-q2-title" sx={{ mb: 3 }}>
        <PanelHead
          title="2. What technical capability is being assessed?"
          titleId="interview-q2-title"
          aside={<Pill tone="neutral">Assessment Competency</Pill>}
        >
          <Detail>
            The engineering competence and professional communication criteria being verified.
          </Detail>
        </PanelHead>
        <Grid columns={2}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
              {isSystemDesignSubject
                ? 'Distributed Architecture & Tradeoff Defense'
                : 'Pipeline Reliability & Incident Communication'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              {isSystemDesignSubject
                ? 'System Design interviews evaluate whether you can decompose complex, ambiguous requirements into reliable, scalable services. Key dimensions include data partition strategy, high-availability guarantees, caching topologies, and explicit tradeoff justification.'
                : 'Data engineering interviews assess operational rigor: diagnosing pipeline backpressure, recovering from mid-batch failures, managing watermark CDC progression, and explaining architectural root causes clearly to engineering leaders.'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {isSystemDesignSubject ? (
                <>
                  <Chip size="small" label="Scale & Storage" color="primary" variant="outlined" />
                  <Chip size="small" label="High-Level Architecture" color="primary" variant="outlined" />
                  <Chip size="small" label="Component Deep Dive" color="primary" variant="outlined" />
                  <Chip size="small" label="Failure Modes" color="primary" variant="outlined" />
                  <Chip size="small" label="Tradeoff Defense" color="primary" variant="outlined" />
                </>
              ) : (
                <>
                  <Chip size="small" label="ETL / Pipeline Coupling" color="primary" variant="outlined" />
                  <Chip size="small" label="Fault Tolerance" color="primary" variant="outlined" />
                  <Chip size="small" label="Watermark CDC" color="primary" variant="outlined" />
                  <Chip size="small" label="Technical Explanation" color="primary" variant="outlined" />
                </>
              )}
            </Box>
          </Box>

          <Box sx={{ p: 2.5, borderRadius: 2, bgcolor: 'action.hover' }}>
            <Eyebrow>Evaluation Invariant</Eyebrow>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Technical Capability vs Certification Readiness
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Interview performance measures <b>demonstrated capability</b> through structured artifacts and speech takes. It does NOT generate or imply a certification exam readiness score.
            </Typography>
          </Box>
        </Grid>
      </Panel>

      {/* QUESTION 3: Which interview modes are available? */}
      <Panel component="section" aria-labelledby="interview-q3-title" sx={{ mb: 3 }}>
        <PanelHead
          title="3. Which interview modes are available?"
          titleId="interview-q3-title"
        >
          <Detail>Live production modes available right now for rehearsal.</Detail>
        </PanelHead>
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {isSystemDesignSubject && (
            <>
              <Row
                title="System Design Studio"
                detail="32 typed architecture prompts across Request Serving, Data Platform, and AI Platform"
                middle={<Pill tone="accent">{prompts.length} Prompts</Pill>}
                action={
                  <Button
                    size="small"
                    variant="contained"
                    component={RouterLink}
                    to="/system-design"
                  >
                    Open Studio
                  </Button>
                }
              />
              <Row
                title="Architecture Design Reviews"
                detail="Tradeoff decisions: evaluate two design options along a decisive architectural axis"
                middle={<Pill tone="accent">{designReviewsCount} Reviews</Pill>}
                action={
                  <Button
                    size="small"
                    variant="outlined"
                    component={RouterLink}
                    to="/design-reviews"
                  >
                    Open Reviews
                  </Button>
                }
              />
            </>
          )}

          <Row
            title="Verbal Interview Practice Rounds"
            detail={
              isSystemDesignSubject
                ? 'Spoken system design questions: record verbal walkthroughs for URL shorteners, distributed caches, etc.'
                : 'Technical, Behavioral, and Hiring Manager interview questions with audio recorder'
            }
            middle={<Pill tone="accent">Audio Rehearsal</Pill>}
            action={
              <Button
                size="small"
                variant="outlined"
                component={RouterLink}
                to={isSystemDesignSubject ? '/interview-practice?round=system_design' : '/interview-practice'}
              >
                Practice Rounds
              </Button>
            }
          />

          <Row
            title="Audio Recordings &amp; Rubric Feedback"
            detail="Playback previous takes, review AI transcripts, filler-word counts, and rubric scoring"
            middle={<Pill tone="neutral">{subjectRecordings.length} Recorded</Pill>}
            action={
              <Button
                size="small"
                variant="outlined"
                component={RouterLink}
                to="/recordings"
              >
                Open Recordings
              </Button>
            }
          />

          {isAdfSubject && (
            <Row
              title="Applied Scenario Say-It Questions"
              detail="Enterprise incident scenarios produce Say-it verbal communication challenges"
              middle={<Pill tone="accent">Scenarios</Pill>}
              action={
                <Button
                  size="small"
                  variant="outlined"
                  component={RouterLink}
                  to="/scenarios"
                >
                  Explore Scenarios
                </Button>
              }
            />
          )}
        </Box>
      </Panel>

      {/* QUESTION 4: What evidence/results have I generated? & 5. What should I improve next? */}
      <Grid columns={2} sx={{ mb: 4 }}>
        <Panel component="section" aria-labelledby="interview-q4-title">
          <PanelHead
            title="4. What evidence/results have I generated?"
            titleId="interview-q4-title"
          >
            <Detail>Historical attempts and recording ledger.</Detail>
          </PanelHead>
          <Grid columns={isSystemDesignSubject ? 3 : 2}>
            {isSystemDesignSubject && (
              <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 800 }}>
                  {attempts.length}
                </Typography>
                <Detail sx={{ mt: 0.5 }}>Studio Attempts</Detail>
              </Box>
            )}
            <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>
                {subjectRecordings.length}
              </Typography>
              <Detail sx={{ mt: 0.5 }}>Audio Takes</Detail>
            </Box>
            <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>
                {subjectRecordings.filter((r) => r.analysis_status === 'analyzed').length}
              </Typography>
              <Detail sx={{ mt: 0.5 }}>AI Analyzed</Detail>
            </Box>
          </Grid>
          <Actions sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              size="small"
              component={RouterLink}
              to="/recordings"
            >
              Inspect Recording Ledger
            </Button>
          </Actions>
        </Panel>

        <Panel component="section" aria-labelledby="interview-q5-title">
          <PanelHead
            title="5. What should I improve next?"
            titleId="interview-q5-title"
          >
            <Detail>Targeted actions to build capability.</Detail>
          </PanelHead>
          <Box sx={{ display: 'grid', gap: 1.5 }}>
            {isSystemDesignSubject && unattemptedPrompts.length > 0 ? (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Next Unattempted Architecture Challenge:
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, mb: 1.5 }}>
                  {unattemptedPrompts[0].title} ({unattemptedPrompts[0].category})
                </Typography>
                <Button
                  size="small"
                  variant="contained"
                  component={RouterLink}
                  to={`/system-design/${unattemptedPrompts[0].id}/answer`}
                >
                  Start Architecture Answer
                </Button>
              </Box>
            ) : (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Take an Audio Recording Practice Round:
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, mb: 1.5 }}>
                  Practice structuring technical answers cleanly with 60s thinking time.
                </Typography>
                <Button
                  size="small"
                  variant="contained"
                  component={RouterLink}
                  to="/interview-practice"
                >
                  Start Verbal Practice
                </Button>
              </Box>
            )}
          </Box>
        </Panel>
      </Grid>
    </Box>
  );
};
