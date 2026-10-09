// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import { Award } from 'lucide-react';
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
} from '../components/ui/primitives';
import { usePreparation } from '../context/PreparationContext';
import {
  getDesignReviews,
  getInterviewQuestions,
  getRecordings,
  getSubjects,
  getSystemDesignAttempts,
  getSystemDesignPrompts,
} from '../services/api';
import {
  getSubjectCapabilities,
  UNASSIGNED_CAPABILITIES,
} from '../services/capabilities';
import { CapabilityUnavailablePage } from '../components/common/CapabilityUnavailablePage';
import { LoadingState } from '../components/common/States';
import type { PracticeRecording } from '../types/recording';
import type { Subject } from '../types/subject';
import type { SystemDesignAttempt, SystemDesignPrompt } from '../types/systemDesign';

/** How many recordings are read; a full page means there may be more. */
const RECORDINGS_LIMIT = 100;

/**
 * A figure as it was read, or a plain statement that it could not be. Never a
 * stand-in number: a count the page invented on failure (this hub used to show
 * "10 Tradeoff Reviews" whenever that list failed to load) is a fabricated
 * result, and the learner cannot tell it apart from a real one.
 */
const countOr = (n: number | null, noun: string, nounPlural = `${noun}s`): string =>
  n == null ? `${noun[0].toUpperCase()}${nounPlural.slice(1)} unavailable` : `${n} ${n === 1 ? noun : nounPlural}`;

export const InterviewHubPage: React.FC = () => {
  const theme = useTheme();
  const [searchParams] = useSearchParams();
  const {
    selected: ctxSelected,
    selectedId: ctxSelectedId,
    capabilities: ctxCapabilities,
    select,
  } = usePreparation();

  // Each source is held as what was read, or null when the read failed, so a
  // failure is shown as a failure rather than as zero or as a guess.
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [libraryTotal, setLibraryTotal] = useState<number | null>(null);
  const [prompts, setPrompts] = useState<SystemDesignPrompt[] | null>(null);
  const [attempts, setAttempts] = useState<SystemDesignAttempt[] | null>(null);
  const [recordings, setRecordings] = useState<PracticeRecording[] | null>(null);
  const [designReviewsCount, setDesignReviewsCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  // Questions saved under this preparation (a Skill's scenarios save their
  // Say-it question here). undefined while unread.
  const [subjectQuestionTotal, setSubjectQuestionTotal] = useState<number | null | undefined>(undefined);

  const urlSubjectParam = searchParams.get('subject');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      getSubjects().catch(() => [] as Subject[]),
      getInterviewQuestions({ limit: 1 }).then((r) => r.total).catch(() => null),
      getSystemDesignPrompts({ limit: 500 }).then((r) => r.items).catch(() => null),
      getSystemDesignAttempts({ limit: 500 }).then((r) => r.items).catch(() => null),
      getRecordings({ limit: RECORDINGS_LIMIT }).then((r) => r.items).catch(() => null),
      getDesignReviews().then((r) => r.total).catch(() => null),
    ])
      .then(([subjs, qTotal, prs, atts, recs, drCount]) => {
        if (cancelled) return;
        setSubjects(subjs);
        setLibraryTotal(qTotal);
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
    return getSubjectCapabilities(targetSubject);
  }, [targetSubject]);

  const targetId = targetSubject?.id ?? null;
  useEffect(() => {
    setSubjectQuestionTotal(undefined);
    if (targetId == null) return undefined;
    let cancelled = false;
    getInterviewQuestions({ subject_id: targetId, limit: 1 })
      .then((r) => { if (!cancelled) setSubjectQuestionTotal(r.total); })
      .catch(() => { if (!cancelled) setSubjectQuestionTotal(null); });
    return () => { cancelled = true; };
  }, [targetId]);

  if (loading) {
    return <LoadingState label="Loading Interview Hub…" />;
  }

  // 1. Unassigned Subject Context Guard: Zero silent default to System Design or ADF!
  if (!targetSubject) {
    const interviewCapable = subjects.filter((s) => {
      const caps = getSubjectCapabilities(s);
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
          <Box sx={{ display: 'inline-flex', p: 2, borderRadius: '50%', bgcolor: 'pb.surface2', mb: 2 }}>
            <Award size={36} color={theme.palette.primary.main} />
          </Box>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 800, mb: 1 }}>
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

  // Whether the System Design Studio and design reviews are this preparation's: a capability
  // read from its record (the `system-design` slug), never its id.
  const isSystemDesignSubject = targetCapabilities.systemDesignStudio;

  // This hub can show a preparation other than the one in the header: its own
  // track chooser and CapabilityUnavailablePage link here with ?subject=. The
  // screens it links on to are scoped by the header's preparation, so following
  // one of those links unchanged opened another preparation's scenarios.
  // Clicking one makes the shown preparation the one being worked in first:
  // the learner's own action, on a page titled with it, not a silent switch.
  const adoptTarget = () => {
    if (targetSubject.id !== ctxSelectedId) select(targetSubject.id);
  };

  // Recordings are kept across every preparation; the page says so where it
  // counts them rather than presenting them as this preparation's.
  const recordingCount = recordings == null ? null : recordings.length;
  const recordingLabel = recordingCount == null
    ? 'Recordings unavailable'
    : `${recordingCount}${recordingCount >= RECORDINGS_LIMIT ? '+' : ''} across all preparations`;
  const analysedCount = recordings == null ? null : recordings.filter((r) => r.analysis_status === 'analyzed').length;
  // "Next unattempted" needs both lists: with the attempts unread, every prompt
  // would look unattempted.
  const attemptedPromptIds = new Set((attempts ?? []).map((a) => a.prompt_id));
  const unattemptedPrompts = prompts != null && attempts != null
    ? prompts.filter((p) => !attemptedPromptIds.has(p.id))
    : [];
  const promptCount = prompts == null ? null : prompts.length;

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
                Open Design Studio
              </Button>
            ) : (
              <Button
                variant="contained"
                color="primary"
                component={RouterLink}
                onClick={adoptTarget}
                to="/scenarios"
              >
                Practise from {targetSubject.name} scenarios
              </Button>
            )}
            <Button
              variant="outlined"
              component={RouterLink}
              to="/recordings"
            >
              Recordings
            </Button>
          </>
        }
      />

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
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'pb.surface2' }}>
              <Eyebrow>Written System Design</Eyebrow>
              <Typography variant="subtitle1" component="p" sx={{ fontWeight: 800 }}>
                {countOr(promptCount, 'architecture prompt')}
              </Typography>
              <Detail sx={{ mt: 0.5 }}>
                6-dimension rubric grading: Scale, Storage, Deep Dive, Tradeoffs
              </Detail>
            </Box>
          )}
          {isSystemDesignSubject && (
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'pb.surface2' }}>
              <Eyebrow>Architecture Reviews</Eyebrow>
              <Typography variant="subtitle1" component="p" sx={{ fontWeight: 800 }}>
                {countOr(designReviewsCount, 'tradeoff review')}
              </Typography>
              <Detail sx={{ mt: 0.5 }}>
                Deciding-axis evaluation, architectural rationale &amp; reveal
              </Detail>
            </Box>
          )}
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'pb.surface2' }}>
            <Eyebrow>Verbal Practice Rounds</Eyebrow>
            <Typography variant="subtitle1" component="p" sx={{ fontWeight: 800 }}>
              {isSystemDesignSubject ? 'Spoken Architecture' : 'Technical & Incident'}
            </Typography>
            <Detail sx={{ mt: 0.5 }}>
              Audio recording with thinking time and model outlines
            </Detail>
          </Box>
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'pb.surface2' }}>
            <Eyebrow>AI Rubric Evaluation</Eyebrow>
            <Typography variant="subtitle1" component="p" sx={{ fontWeight: 800 }}>
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
            <Typography variant="subtitle1" component="p" sx={{ fontWeight: 800, mb: 1 }}>
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

          <Box sx={{ p: 2.5, borderRadius: 2, bgcolor: 'pb.surface2' }}>
            <Eyebrow>Evaluation Invariant</Eyebrow>
            <Typography variant="subtitle2" component="p" sx={{ fontWeight: 700, mb: 1 }}>
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
                detail="Typed architecture prompts, graded against a six-dimension rubric"
                middle={<Pill tone={promptCount == null ? 'warning' : 'accent'}>{countOr(promptCount, 'prompt')}</Pill>}
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
                middle={<Pill tone={designReviewsCount == null ? 'warning' : 'accent'}>{countOr(designReviewsCount, 'review')}</Pill>}
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
                : 'Technical, Behavioral, and Hiring Manager questions from the interview library, which is shared across preparations'
            }
            middle={<Pill tone={libraryTotal == null ? 'warning' : 'accent'}>{countOr(libraryTotal, 'library question')}</Pill>}
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
            middle={<Pill tone={recordingCount == null ? 'warning' : 'neutral'}>{recordingLabel}</Pill>}
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

          {!isSystemDesignSubject && (
            <Row
              title={`${targetSubject.name} scenario Say-it questions`}
              detail={
                'Each scenario ends with a Say-it question for your role. Saving your answer adds it to the '
                + `interview library under ${targetSubject.name}, where you can rehearse it aloud.`
              }
              middle={
                <Pill tone={subjectQuestionTotal === null ? 'warning' : 'accent'}>
                  {subjectQuestionTotal === undefined
                    ? 'Counting…'
                    : subjectQuestionTotal === null
                      ? 'Saved questions unavailable'
                      : `${subjectQuestionTotal} saved`}
                </Pill>
              }
              action={
                <Button
                  size="small"
                  variant="outlined"
                  component={RouterLink}
                  onClick={adoptTarget}
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
              <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'pb.surface2', borderRadius: 2 }}>
                <Typography variant="h4" component="p" sx={{ fontWeight: 800 }}>
                  {attempts == null ? '—' : attempts.length}
                </Typography>
                <Detail sx={{ mt: 0.5 }}>Studio Attempts</Detail>
              </Box>
            )}
            <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'pb.surface2', borderRadius: 2 }}>
              <Typography variant="h4" component="p" sx={{ fontWeight: 800 }}>
                {recordingCount == null ? '—' : recordingCount}
              </Typography>
              <Detail sx={{ mt: 0.5 }}>Audio takes, all preparations</Detail>
            </Box>
            <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'pb.surface2', borderRadius: 2 }}>
              <Typography variant="h4" component="p" sx={{ fontWeight: 800 }}>
                {analysedCount == null ? '—' : analysedCount}
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
                <Typography variant="subtitle2" component="p" sx={{ fontWeight: 700 }}>
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
                <Typography variant="subtitle2" component="p" sx={{ fontWeight: 700 }}>
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
