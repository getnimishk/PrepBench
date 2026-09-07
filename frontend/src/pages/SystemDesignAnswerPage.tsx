// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, TextField, Button, Chip,
  Alert, CircularProgress, LinearProgress,
} from '@mui/material';
import { ArrowRight, Clock } from 'lucide-react';
import {
  getSettings, getSystemDesignDraft, getSystemDesignPrompt, saveSystemDesignDraft,
  submitSystemDesignAttempt,
} from '../services/api';
import { SystemDesignPrompt } from '../types/systemDesign';
import { apiErrorMessage } from '../services/apiError';

/**
 * Write the design, and do not lose it.
 *
 * This page used to hold its answer in React state and nowhere else. No
 * autosave, no localStorage, no beforeunload guard: forty minutes of work was
 * one stray sidebar click away from being gone, and nothing on the screen
 * suggested otherwise. The exam runner has warned before unloading since it
 * was written -- the one surface in the product where a learner types for half
 * an hour had no protection at all.
 *
 * Three things now stand between the learner and that:
 *
 *   The text is saved to the database as it is typed, debounced, and the page
 *   says when it last landed. localStorage would have been less code and the
 *   wrong answer: everything else in this product lives in the SQLite file,
 *   and a draft that only exists in one browser profile is a draft the
 *   learner cannot be told about anywhere else.
 *
 *   Reopening the prompt restores it -- and, once an answer has been
 *   submitted, restores that instead, because a revision that starts from a
 *   blank box is a rewrite.
 *
 *   The browser asks before unloading while there is unsaved text. That is a
 *   backstop for the second between a keystroke and the debounce, not the
 *   mechanism.
 */

/** Long enough not to write on every keystroke, short enough to be a safety net. */
const AUTOSAVE_MS = 1200;

const formatElapsed = (seconds: number): string => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export const SystemDesignAnswerPage: React.FC = () => {
  const { promptId } = useParams<{ promptId: string }>();
  const navigate = useNavigate();
  const pid = promptId ? parseInt(promptId, 10) : 0;

  const [prompt, setPrompt] = useState<SystemDesignPrompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [answerText, setAnswerText] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [resumed, setResumed] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [dirty, setDirty] = useState(false);

  const startTimeRef = useRef<number>(Date.now());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef({ answerText: '', targetRole: '' });
  const submittedRef = useRef(false);
  // What was on screen when the page finished loading. Until an edit moves
  // away from it there is nothing to save and nothing to warn about --
  // otherwise merely opening a prompt wrote a draft and armed the
  // leave-the-page prompt over text the learner had not touched.
  const baselineRef = useRef<{ answerText: string; targetRole: string } | null>(null);

  useEffect(() => {
    latestRef.current = { answerText, targetRole };
  }, [answerText, targetRole]);

  useEffect(() => {
    if (isNaN(pid) || pid <= 0) return;
    setLoading(true);
    setFetchError(null);

    Promise.all([
      getSystemDesignPrompt(pid),
      // A failed draft read must not stop the page: a learner who cannot
      // resume can still write. It must not silently look like an empty
      // draft either, which is why `resumed` is only set on success.
      getSystemDesignDraft(pid).catch(() => null),
      getSettings().catch(() => null),
    ])
      .then(([p, draft, settings]) => {
        setPrompt(p);
        startTimeRef.current = Date.now();
        if (draft?.exists) {
          setAnswerText(draft.answer_text ?? '');
          setResumed((draft.answer_text ?? '').trim().length > 0);
        }
        // The draft's role wins where it has one; the Settings default is what
        // a *new* attempt starts from, which is exactly what that setting's
        // own helper text promises.
        const role = (draft?.exists ? draft.target_role : null)
          ?? settings?.default_target_role ?? '';
        setTargetRole(role);
        baselineRef.current = {
          answerText: draft?.exists ? draft.answer_text ?? '' : '',
          targetRole: role,
        };
      })
      .catch(() => setFetchError('Failed to load prompt. Please check backend connection.'))
      .finally(() => setLoading(false));
  }, [pid]);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const persist = useCallback(async () => {
    if (isNaN(pid) || pid <= 0 || submittedRef.current) return;
    try {
      await saveSystemDesignDraft(pid, {
        answer_text: latestRef.current.answerText,
        target_role: latestRef.current.targetRole || null,
      });
      setSavedAt(new Date());
      setSaveFailed(false);
      setDirty(false);
    } catch {
      // Said, not swallowed. A draft the server never received must not look
      // like one it accepted -- that is the whole failure this page exists to
      // stop happening.
      setSaveFailed(true);
    }
  }, [pid]);

  /** Debounced autosave. Every edit restarts the clock. */
  useEffect(() => {
    if (loading || !prompt || baselineRef.current === null) return;
    if (
      answerText === baselineRef.current.answerText
      && targetRole === baselineRef.current.targetRole
    ) return;
    setDirty(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(persist, AUTOSAVE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // `persist` reads the latest text from a ref, so it is stable.
  }, [answerText, targetRole, loading, prompt, persist]);

  // The backstop, covering the second between a keystroke and the debounce.
  useEffect(() => {
    if (!dirty || submitting) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, submitting]);

  const handleSubmit = async () => {
    if (!prompt || answerText.trim().length === 0) return;
    setSubmitError(null);
    setSubmitting(true);
    // Flush first: submitting with a pending debounce and a failing grade
    // would lose whatever was typed in the last second.
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    await persist();
    try {
      const attempt = await submitSystemDesignAttempt({
        prompt_id: prompt.id,
        answer_text: answerText,
        target_role: targetRole || undefined,
        time_spent_seconds: elapsed,
      });
      submittedRef.current = true;
      setDirty(false);
      navigate(`/system-design/attempts/${attempt.id}`);
    } catch (err) {
      setSubmitError(apiErrorMessage(err, 'Failed to submit your answer. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (isNaN(pid) || pid <= 0) {
    return <Alert severity="error">Invalid prompt.</Alert>;
  }

  if (loading) return <LinearProgress />;

  if (fetchError || !prompt) {
    return <Alert severity="error">{fetchError || 'Prompt not found.'}</Alert>;
  }

  return (
    <Box sx={{ maxWidth: 860, mx: 'auto', pb: 8 }}>
      <Box sx={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        gap: 2, mb: 1, flexWrap: 'wrap',
      }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>{prompt.title}</Typography>
        <Chip icon={<Clock size={16} />} label={formatElapsed(elapsed)} size="small" />
      </Box>

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        {prompt.category} · {prompt.difficulty}
      </Typography>

      {/* The problem, and it is the point of the screen. Not a card: the
          brief and the answer are one continuous piece of work, and a border
          round the first half said they were two objects. */}
      <Typography variant="body1" sx={{ lineHeight: 1.75, fontSize: 17 }}>
        {prompt.prompt_text}
      </Typography>

      {resumed && (
        <Alert severity="info" sx={{ mt: 3 }}>
          Picked up where you left off.
        </Alert>
      )}
      {submitError && <Alert severity="error" sx={{ mt: 3 }}>{submitError}</Alert>}
      {saveFailed && (
        <Alert severity="warning" sx={{ mt: 3 }}>
          Your last few edits have not reached the database. Keep this tab open — copy the
          text somewhere safe if you need to leave.
        </Alert>
      )}

      <Box sx={{ mt: 4 }}>
        <TextField
          fullWidth
          size="small"
          label="Target role (optional)"
          placeholder="e.g. Senior Backend Engineer, fintech"
          value={targetRole}
          onChange={(e) => setTargetRole(e.target.value)}
          helperText="If set, feedback is calibrated to what a strong candidate for this specific role would be expected to demonstrate."
        />
      </Box>

      <Box sx={{ mt: 3 }}>
        <TextField
          fullWidth
          multiline
          minRows={16}
          label="Your answer"
          placeholder="Walk through your design: requirements, high-level architecture, data model, scaling considerations, trade-offs..."
          value={answerText}
          onChange={(e) => setAnswerText(e.target.value)}
        />
      </Box>

      <Box sx={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 2, mt: 2, flexWrap: 'wrap',
      }}>
        {/* Stated, because a learner who cannot see the saving cannot trust
            it, and this page's whole history is of work going missing. */}
        <Typography variant="caption" sx={{ color: 'text.secondary' }} aria-live="polite">
          {saveFailed
            ? 'Not saved.'
            : dirty
              ? 'Saving…'
              : savedAt
                ? `Saved at ${savedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}. You can leave and come back.`
                : 'Saved as you type.'}
        </Typography>

        <Button
          variant="contained"
          disableElevation
          size="large"
          endIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <ArrowRight size={20} />}
          onClick={handleSubmit}
          disabled={submitting || answerText.trim().length === 0}
          sx={{ px: 4, fontWeight: 600, borderRadius: '100px', textTransform: 'none' }}
        >
          {submitting ? 'Grading…' : 'Submit for feedback'}
        </Button>
      </Box>
    </Box>
  );
};
