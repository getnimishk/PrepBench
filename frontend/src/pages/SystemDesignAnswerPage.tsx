// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, TextField, Button, Chip,
  Alert, CircularProgress, LinearProgress
} from '@mui/material';
import { ArrowRight, Clock } from 'lucide-react';
import { getSystemDesignPrompt, submitSystemDesignAttempt, getSettings } from '../services/api';
import { SystemDesignPrompt } from '../types/systemDesign';
import { apiErrorMessage } from '../services/apiError';

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

  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (isNaN(pid) || pid <= 0) return;
    setLoading(true);
    setFetchError(null);
    getSystemDesignPrompt(pid)
      .then((p) => {
        setPrompt(p);
        startTimeRef.current = Date.now();
      })
      .catch(() => setFetchError('Failed to load prompt. Please check backend connection.'))
      .finally(() => setLoading(false));

    getSettings()
      .then((s) => {
        if (s?.default_target_role) setTargetRole(s.default_target_role);
      })
      .catch(console.error);
  }, [pid]);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async () => {
    if (!prompt || answerText.trim().length === 0) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const attempt = await submitSystemDesignAttempt({
        prompt_id: prompt.id,
        answer_text: answerText,
        target_role: targetRole || undefined,
        time_spent_seconds: elapsed,
      });
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
    <Box sx={{ maxWidth: 900, mx: 'auto', pb: 8 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>{prompt.title}</Typography>
        <Chip icon={<Clock size={16} />} label={formatElapsed(elapsed)} sx={{ fontWeight: 700 }} />
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        <Chip label={prompt.category} size="small" variant="outlined" />
        <Chip
          label={prompt.difficulty.toUpperCase()}
          size="small"
          color={prompt.difficulty === 'easy' ? 'success' : prompt.difficulty === 'medium' ? 'warning' : 'error'}
        />
      </Box>

      <Card sx={{ mb: 3, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
        <CardContent>
          <Typography variant="body1" sx={{ lineHeight: 1.7 }}>{prompt.prompt_text}</Typography>
        </CardContent>
      </Card>

      {submitError && <Alert severity="error" sx={{ mb: 3 }}>{submitError}</Alert>}

      <TextField
        fullWidth
        label="Target role (optional)"
        placeholder="e.g. Senior Backend Engineer, fintech"
        value={targetRole}
        onChange={(e) => setTargetRole(e.target.value)}
        sx={{ mb: 3 }}
        helperText="If set, feedback is calibrated to what a strong candidate for this specific role would be expected to demonstrate."
      />

      <TextField
        fullWidth
        multiline
        minRows={14}
        label="Your Answer"
        placeholder="Walk through your design: requirements, high-level architecture, data model, scaling considerations, trade-offs..."
        value={answerText}
        onChange={(e) => setAnswerText(e.target.value)}
        sx={{ mb: 3 }}
      />

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          size="large"
          endIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <ArrowRight size={20} />}
          onClick={handleSubmit}
          disabled={submitting || answerText.trim().length === 0}
          sx={{ px: 4, py: 1.5, fontWeight: 700, borderRadius: '100px', boxShadow: 'none' }}
        >
          {submitting ? 'Grading…' : 'Submit for Feedback'}
        </Button>
      </Box>
    </Box>
  );
};
