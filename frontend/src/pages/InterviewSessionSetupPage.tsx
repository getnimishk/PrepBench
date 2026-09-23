// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert, Box, Button, CircularProgress, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import {
  createInterviewSession, getInterviewQuestionCategories, getInterviewRoundTypes, planInterviewSession,
} from '../services/api';
import { apiErrorMessage, loadFailed } from '../services/apiError';
import { formatClock, practisedLabel } from '../services/interviewText';
import type { InterviewRoundType, RoundTypeInfo } from '../types/interviewQuestion';
import type { PlannedQuestion } from '../types/interviewSession';
import { PageHead } from '../components/ui/primitives';

/**
 * Set up an interview session: a round, how many questions, and whether to think first.
 *
 * The list of questions is the server's own plan -- least-practised first -- and
 * it is exactly what the session will ask, because the session is created from
 * the same selection. The session then runs on its own screen with nothing else
 * reachable until it ends.
 */

const COUNTS = [1, 3, 5];

const panel = {
  bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 3.5, p: { xs: 2.5, sm: 3 },
} as const;

export const InterviewSessionSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [rounds, setRounds] = useState<RoundTypeInfo[]>([]);
  const [round, setRound] = useState<InterviewRoundType | ''>((searchParams.get('round') as InterviewRoundType) || '');
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [count, setCount] = useState(3);
  const [thinking, setThinking] = useState(true);
  const [plan, setPlan] = useState<PlannedQuestion[] | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    setLoadError(null);
    getInterviewRoundTypes()
      .then((r) => {
        setRounds(r);
        setRound((current) => current || r[0]?.value || '');
      })
      .catch((err) => setLoadError(loadFailed('Could not load the interview rounds', err)));
  }, [loadAttempt]);

  useEffect(() => {
    if (!round) return undefined;
    let cancelled = false;
    setCategory('');
    getInterviewQuestionCategories(round)
      .then((c) => { if (!cancelled) setCategories(c); })
      .catch(() => { if (!cancelled) setCategories([]); });
    return () => { cancelled = true; };
  }, [round]);

  useEffect(() => {
    if (!round) return undefined;
    let cancelled = false;
    setPlan(null);
    setPlanError(null);
    planInterviewSession({ round_type: round, category: category || undefined, question_count: count })
      .then((p) => { if (!cancelled) setPlan(p); })
      .catch((err) => { if (!cancelled) setPlanError(apiErrorMessage(err, 'Could not choose the questions.')); });
    return () => { cancelled = true; };
  }, [round, category, count]);

  const info = rounds.find((r) => r.value === round) ?? null;

  const start = async () => {
    if (!round) return;
    setStarting(true);
    setStartError(null);
    try {
      const session = await createInterviewSession({
        round_type: round, category: category || undefined, question_count: count, thinking,
      });
      navigate(`/interview-practice/sessions/${session.id}`);
    } catch (err) {
      setStartError(apiErrorMessage(err, 'Could not start the session.'));
      setStarting(false);
    }
  };

  if (loadError) {
    return <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => setLoadAttempt((n) => n + 1)}>Retry</Button>}>{loadError}</Alert>;
  }

  return (
    <Box sx={{ maxWidth: 1000 }}>
      <PageHead
        eyebrow="Interview practice"
        title="Set up a session"
        sub="The session runs on its own screen. Nothing else is reachable until it ends."
        actions={(
          <>
            <Button component={RouterLink} to="/interview-practice" variant="outlined">
              ← Interview practice
            </Button>
            <Button
              variant="contained"
              color="ink"
              disabled={!plan || plan.length === 0 || starting}
              onClick={start}
            >
              {starting ? 'Starting…' : 'Start session'}
            </Button>
          </>
        )}
      />

      {startError && <Alert severity="error" sx={{ mt: 2.5 }}>{startError}</Alert>}

      <Box sx={{ display: 'grid', gap: 2, mt: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' } }}>
        <Box sx={panel}>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>Round</Typography>
          <ToggleButtonGroup
            exclusive
            value={round}
            onChange={(_, v) => { if (v) setRound(v); }}
            size="small"
            aria-label="Round"
            sx={{ display: 'flex', flexWrap: 'wrap', mt: 1 }}
          >
            {rounds.map((r) => (
              <ToggleButton key={r.value} value={r.value} sx={{ textTransform: 'none' }}>{r.label}</ToggleButton>
            ))}
          </ToggleButtonGroup>
          {categories.length > 0 && (
            <TextField
              select
              fullWidth
              size="small"
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              sx={{ mt: 2.5 }}
              slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
            >
              <MenuItem value="">All categories</MenuItem>
              {categories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
          )}
        </Box>

        <Box sx={panel}>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>Shape of the session</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>Questions</Typography>
          <ToggleButtonGroup exclusive value={count} onChange={(_, v) => { if (v) setCount(v); }} size="small" aria-label="Questions">
            {COUNTS.map((n) => <ToggleButton key={n} value={n}>{n}</ToggleButton>)}
          </ToggleButtonGroup>
          <Typography variant="body2" sx={{ fontWeight: 600, mt: 2 }}>Thinking time before each answer</Typography>
          <ToggleButtonGroup
            exclusive
            value={thinking ? 'on' : 'off'}
            onChange={(_, v) => { if (v) setThinking(v === 'on'); }}
            size="small"
            aria-label="Thinking time"
          >
            {/* The round's own thinking time, once the round is known: "0s" before then is a number nobody set. */}
            <ToggleButton value="on" sx={{ textTransform: 'none' }}>{info ? `${info.thinking_seconds}s` : 'On'}</ToggleButton>
            <ToggleButton value="off" sx={{ textTransform: 'none' }}>None</ToggleButton>
          </ToggleButtonGroup>
          {info?.target_max_seconds ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 2, lineHeight: 1.6 }}>
              A good {info.label.toLowerCase()} answer runs {formatClock(info.target_min_seconds ?? 0)}–{formatClock(info.target_max_seconds)}.
              Each answer shows where it landed against that.
            </Typography>
          ) : null}
        </Box>
      </Box>

      <Box sx={{ ...panel, mt: 2 }}>
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>You will be asked</Typography>
        {!plan && !planError && <CircularProgress size={18} sx={{ display: 'block', mt: 1 }} />}
        {planError && <Alert severity="error" sx={{ mt: 1 }}>{planError}</Alert>}
        {plan && plan.length === 0 && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
            No questions in this round{category ? ' and category' : ''} yet.{' '}
            <Box component={RouterLink} to="/interview-practice/library" sx={{ color: 'primary.main' }}>Add some in the library</Box>.
          </Typography>
        )}
        {plan && plan.length > 0 && (
          <>
            <Typography component="h2" sx={{ fontSize: (t) => t.typography.pxToRem(19), fontWeight: 700 }}>
              {plan.length} question{plan.length === 1 ? '' : 's'}, least-practised first
            </Typography>
            <Stack sx={{ mt: 1.5 }} spacing={1.25}>
              {plan.map((q) => (
                <Box key={q.id} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center' }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{q.question_text}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {q.category ? `${q.category} · ` : ''}{practisedLabel(q.practice_count)}
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: q.practice_count ? 'text.secondary' : 'warning.dark' }}>
                    {q.practice_count ? 'seen' : 'new'}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </>
        )}
      </Box>

      <Box sx={{ ...panel, mt: 2 }}>
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>During the session</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
          The sidebar and the preparation picker are hidden while you answer. Space starts and stops
          an answer, and every answer is saved as you give it — ending early keeps what you have said.
        </Typography>
      </Box>
    </Box>
  );
};
