// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert, Box, Button, CircularProgress, Collapse, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { usePreparation } from '../context/PreparationContext';
import {
  getInterviewRoundTypes,
  getRecordings,
  generateInterviewQuestion,
} from '../services/api';
import { getInterviewLibrary } from '../services/interviewLibrary';
import { getSubjectCapabilities } from '../services/capabilities';
import { InterviewQuestion, RoundTypeInfo, InterviewRoundType } from '../types/interviewQuestion';
import { apiErrorMessage, loadFailed } from '../services/apiError';
import { formatClock, practisedLabel } from '../services/interviewText';
import { LoadingState } from '../components/common/States';
import { Actions, Detail, Grid, PageHead, Panel, PanelHead, Pill, Section } from '../components/ui/primitives';

/**
 * The Interview Practice Studio: every question in the bank, by round, each a
 * card with the one way in -- record a take. The prototype's studio.
 *
 * A whole session -- several questions, least-practised first, on its own
 * screen -- is one click away, and so is the question library, where the bank is
 * edited and imported. "Just talk" records with no question, and a new question
 * can be written by the configured AI and saved to the bank first.
 *
 * Interview practice belongs to no preparation: it is shared across all of them,
 * as the prototype has it, and Home's interview goal counts it once.
 */

type RoundTab = 'all' | InterviewRoundType;

/** The round's shape and window, as the card's footer: "Situation → action → result · 01:30–03:00". */
const footerFor = (round: RoundTypeInfo | undefined, question: InterviewQuestion): string => {
  const parts: string[] = [];
  if (round?.target_min_seconds != null && round.target_max_seconds != null) {
    parts.push(`${formatClock(round.target_min_seconds)}–${formatClock(round.target_max_seconds)}`);
  }
  parts.push(practisedLabel(question.practice_count ?? 0));
  return parts.join(' · ');
};

export const InterviewPracticeSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selected, capabilities, preparations } = usePreparation();
  // Where to go for interview rounds: the learner's own preparations that have them, read
  // from their records and addressed by slug -- never a fixed list of numeric ids, which
  // point at nothing (or at someone else) once a preparation is recreated.
  const interviewTracks = (preparations ?? [])
    .filter((p) => p.id !== selected?.id && getSubjectCapabilities(p).interview);

  const [roundTypes, setRoundTypes] = useState<RoundTypeInfo[]>([]);
  const [roundsError, setRoundsError] = useState<string | null>(null);
  const [roundsAttempt, setRoundsAttempt] = useState(0);

  const [questions, setQuestions] = useState<InterviewQuestion[] | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [questionsAttempt, setQuestionsAttempt] = useState(0);
  const [recordingCount, setRecordingCount] = useState<number | null>(null);

  const roundParam = searchParams.get('round') as RoundTab | null;
  const initialTab: RoundTab =
    roundParam ?? (capabilities?.systemDesignStudio ? 'system_design' : 'all');

  const [tab, setTab] = useState<RoundTab>(initialTab);

  const [genRound, setGenRound] = useState<InterviewRoundType | ''>('');
  const [genTopic, setGenTopic] = useState('');
  const [genOpen, setGenOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  useEffect(() => {
    setRoundsError(null);
    getInterviewRoundTypes()
      .then(setRoundTypes)
      .catch((err) => setRoundsError(loadFailed('Could not load the interview rounds', err)));
  }, [roundsAttempt]);

  useEffect(() => {
    setFetchError(null);
    setQuestions(null);
    let cancelled = false;
    // The shared library plus this preparation's own questions, never another's (Phase 8).
    getInterviewLibrary(selected?.id ?? null, 500)
      // Least-practised first, so the top of each round is what is new.
      .then((res) => { if (!cancelled) setQuestions([...res.items].sort((a, b) => (a.practice_count ?? 0) - (b.practice_count ?? 0))); })
      .catch((err) => {
        if (cancelled) return;
        setQuestions([]);
        setFetchError(loadFailed('Could not load interview questions', err));
      });
    return () => { cancelled = true; };
  }, [questionsAttempt, selected?.id]);

  // Supporting detail for the "Recordings library" button: left unsaid, not zero, when unreadable.
  useEffect(() => {
    getRecordings({ limit: 200 })
      .then((res) => setRecordingCount(res.items.length))
      .catch(() => setRecordingCount(null));
  }, []);

  const byRound = useMemo(() => {
    const map = new Map<InterviewRoundType, RoundTypeInfo>();
    roundTypes.forEach((r) => map.set(r.value, r));
    return map;
  }, [roundTypes]);

  // The tab on screen must be one that exists: a round asked for (System Design's default,
  // or ?round=) is only selected once the round tabs have loaded and include it -- until then,
  // or if they could not be read, everything is shown under "All questions".
  const activeTab: RoundTab = tab === 'all' || roundTypes.some((r) => r.value === tab) ? tab : 'all';
  const shown = (questions ?? []).filter((q) => activeTab === 'all' || q.round_type === activeTab);

  const randomPractice = () => {
    const pool = shown.length > 0 ? shown : questions ?? [];
    if (pool.length === 0) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    navigate(`/interview-practice/${pick.id}/record`);
  };

  const handleGenerate = async () => {
    const round = genRound || (activeTab !== 'all' ? activeTab : roundTypes[0]?.value);
    if (!round) return;
    setGenerateError(null);
    setGenerating(true);
    try {
      const question = await generateInterviewQuestion({
        round_type: round,
        topic: genTopic || undefined,
        // Always persisted. The un-saved path produced a question with id 0
        // that could not be practised, and then said so -- a control whose
        // only effect was to make the feature fail.
        save_to_bank: true,
      });
      if (question.id === 0) {
        setGenerateError('The question could not be saved, so it cannot be practised.');
        return;
      }
      navigate(`/interview-practice/${question.id}/record`);
    } catch (err) {
      setGenerateError(apiErrorMessage(
        err,
        'AI question generation is unavailable. Set up a provider in Settings -> AI Providers, '
        + 'or pick a question from the library.'
      ));
    } finally {
      setGenerating(false);
    }
  };

  const count = (round: RoundTab) =>
    (questions ?? []).filter((q) => round === 'all' || q.round_type === round).length;

  return (
    <Box>
      <PageHead
        eyebrow="Interview preparation"
        title="Interview Practice Studio"
        sub="Practice spoken answers to real engineering and behavioral questions. Content structure and vocal delivery are analysed separately."
        actions={(
          <>
            <Button variant="contained" onClick={randomPractice} disabled={!questions || questions.length === 0}>
              ● Quick random practice
            </Button>
            <Button component={RouterLink} to="/recordings" variant="outlined">
              Recordings library{recordingCount != null ? ` (${recordingCount >= 200 ? '200+' : recordingCount})` : ''}
            </Button>
            <Button
              component={RouterLink}
              to={`/interview-practice/setup${activeTab !== 'all' ? `?round=${activeTab}` : ''}`}
              variant="outlined"
            >
              Set up a session
            </Button>
            <Button component={RouterLink} to="/interview-practice/library" variant="outlined">
              Question library
            </Button>
          </>
        )}
      />

      {roundsError && (
        <Alert
          severity="error"
          sx={{ mt: 2 }}
          action={<Button color="inherit" size="small" onClick={() => setRoundsAttempt((n) => n + 1)}>Retry</Button>}
        >
          {roundsError}
        </Alert>
      )}

      {capabilities?.systemDesignStudio && (
        <Alert severity="info" sx={{ mt: 2, mb: 1 }}>
          <b>System Design Track:</b> Practicing verbal architecture explanations? You can also practice written challenges in the{' '}
          <Box component={RouterLink} to="/system-design" sx={{ color: 'primary.main', fontWeight: 600 }}>
            System Design Studio
          </Box>{' '}
          or tradeoff decisions in{' '}
          <Box component={RouterLink} to="/design-reviews" sx={{ color: 'primary.main', fontWeight: 600 }}>
            Architecture Design Reviews
          </Box>.
        </Alert>
      )}

      {selected && capabilities?.scenarios && (
        <Alert severity="info" sx={{ mt: 2, mb: 1 }}>
          <b>{selected.name}:</b> Practicing incident communication? Say-it answers saved from{' '}
          <Box component={RouterLink} to="/scenarios" sx={{ color: 'primary.main', fontWeight: 600 }}>
            its scenarios
          </Box>{' '}
          are saved to this library.
        </Alert>
      )}

      {selected && capabilities && !capabilities.interview && (
        <Alert severity="warning" sx={{ mt: 2, mb: 1 }}>
          <b>Interview Practice Guard:</b> Verbal interviews are not configured for <b>{selected.name}</b>. You are viewing the general interview library.{' '}
          {interviewTracks.length > 0 ? (
            <>
              Switch to{' '}
              {interviewTracks.map((p, i) => (
                <React.Fragment key={p.id}>
                  {i > 0 && (i === interviewTracks.length - 1 ? ' or ' : ', ')}
                  <Box component={RouterLink} to={`/interview?subject=${encodeURIComponent(p.slug)}`} sx={{ color: 'primary.main', fontWeight: 600 }}>
                    {p.name}
                  </Box>
                </React.Fragment>
              ))}{' '}
              for subject-specific interview rounds.
            </>
          ) : (
            <>None of your preparations has interview rounds yet.</>
          )}
        </Alert>
      )}
      {fetchError && (
        <Alert
          severity="error"
          sx={{ mt: 2 }}
          action={<Button color="inherit" size="small" onClick={() => setQuestionsAttempt((n) => n + 1)}>Retry</Button>}
        >
          {fetchError}
        </Alert>
      )}

      <Tabs
        value={activeTab}
        onChange={(_, v: RoundTab) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        aria-label="Interview rounds"
        sx={{ mt: '22px', mb: '20px', borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="all" label={`All questions (${count('all')})`} />
        {roundTypes.map((r) => <Tab key={r.value} value={r.value} label={`${r.label} (${count(r.value)})`} />)}
      </Tabs>

      {questions === null ? (
        <LoadingState label="Loading interview questions…" />
      ) : shown.length === 0 && !fetchError ? (
        <Panel>
          <Detail>
            No questions in this round yet.{' '}
            <Box component={RouterLink} to="/interview-practice/library" sx={{ color: 'primary.main' }}>Import some in the library</Box>,
            or have one written below.
          </Detail>
        </Panel>
      ) : (
        <Grid template="repeat(2, minmax(0,1fr))" aria-label="Questions">
          {shown.map((q) => {
            const round = byRound.get(q.round_type);
            return (
              <Panel
                key={q.id}
                component="article"
                aria-label={q.question_text}
                sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderLeft: '4px solid', borderLeftColor: 'primary.main' }}
              >
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', mb: '8px' }}>
                    <Pill tone="accent">{round?.label ?? q.round_type}</Pill>
                    <Detail component="span" sx={{ fontWeight: 600, fontSize: (t) => t.typography.pxToRem(11) }}>{q.category ?? 'General'}</Detail>
                  </Box>
                  <Typography variant="h6" component="h2" sx={{ lineHeight: 1.4, mt: '4px', mb: '12px' }}>
                    “{q.question_text}”
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px',
                    mt: '14px', pt: '12px', borderTop: '1px solid', borderColor: 'divider',
                  }}
                >
                  <Detail component="span">{footerFor(round, q)}</Detail>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => navigate(`/interview-practice/${q.id}/record`)}
                    aria-label={`Record a take: ${q.question_text}`}
                  >
                    ● Record take →
                  </Button>
                </Box>
              </Panel>
            );
          })}
        </Grid>
      )}

      <Section>
        <Grid columns={2}>
          <Panel component="section" aria-labelledby="just-talk">
            <PanelHead
              eyebrow="No question"
              title="Just talk"
              titleId="just-talk"
              aside={<Button variant="outlined" onClick={() => navigate('/interview-practice/general/record')}>Record</Button>}
            />
            <Detail>Record whatever you want to practise saying. The delivery is analysed the same way.</Detail>
          </Panel>

          {/* A question is written for a round, so there is nothing to offer
              while the rounds themselves could not be read. */}
          {!roundsError && (
          <Panel soft component="section" aria-labelledby="write-one">
            <PanelHead
              eyebrow="AI"
              title="Write me a new one"
              titleId="write-one"
              aside={(
                <Button
                  variant="outlined"
                  onClick={() => setGenOpen((o) => !o)}
                  endIcon={genOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  aria-expanded={genOpen}
                >
                  {genOpen ? 'Close' : 'Write a question'}
                </Button>
              )}
            />
            <Detail>A question written by the configured AI, saved to the bank, and opened to record.</Detail>
            <Collapse in={genOpen} unmountOnExit>
              <Box sx={{ mt: '12px' }}>
                {generateError && <Alert severity="warning" sx={{ mb: 2 }}>{generateError}</Alert>}
                <Actions>
                  <TextField
                    select
                    label="Round"
                    value={genRound || (activeTab !== 'all' ? activeTab : roundTypes[0]?.value ?? '')}
                    onChange={(e) => setGenRound(e.target.value as InterviewRoundType)}
                    slotProps={{ select: { native: true } }}
                    sx={{ minWidth: 170 }}
                  >
                    {roundTypes.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </TextField>
                  <TextField
                    label="Topic (optional)"
                    placeholder="e.g. leadership, stakeholder management"
                    value={genTopic}
                    onChange={(e) => setGenTopic(e.target.value)}
                    sx={{ flex: '1 1 200px' }}
                  />
                  <Button
                    variant="contained"
                    color="ink"
                    startIcon={generating ? <CircularProgress aria-hidden size={16} color="inherit" /> : <Sparkles size={16} />}
                    onClick={handleGenerate}
                    disabled={generating || roundTypes.length === 0}
                  >
                    {generating ? 'Writing…' : 'Write it'}
                  </Button>
                </Actions>
              </Box>
            </Collapse>
          </Panel>
          )}
        </Grid>
      </Section>
    </Box>
  );
};
