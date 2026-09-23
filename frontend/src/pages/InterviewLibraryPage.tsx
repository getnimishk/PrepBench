// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, IconButton, MenuItem, Stack, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import { Pencil, Trash2, Upload } from 'lucide-react';
import {
  deleteInterviewQuestion, getInterviewQuestions, getInterviewRoundTypes, updateInterviewQuestion,
} from '../services/api';
import { apiErrorMessage, loadFailed } from '../services/apiError';
import { practisedLabel } from '../services/interviewText';
import { InterviewQuestionImportModal } from '../components/interview/InterviewQuestionImportModal';
import type { InterviewQuestion, RoundTypeInfo } from '../types/interviewQuestion';
import { PageHead } from '../components/ui/primitives';

/**
 * Natural progression of real-world interviews:
 * 1. Warm-up & Elevator Pitch (Intro)
 * 2. Background & Motivation
 * 3. Core Competencies & Behavioral Leadership
 * 4. Technical Architecture
 * 5. Wrap-up & Logistics
 */
const STAGE_WEIGHTS: Record<string, number> = {
  introduction: 10,
  background: 20,
  'motivation & fit': 30,
  'team fit': 35,
  leadership: 40,
  ownership: 42,
  prioritization: 44,
  accountability: 50,
  initiative: 52,
  'conflict resolution': 54,
  adaptability: 56,
  collaboration: 58,
  'self-awareness': 60,
  'self-assessment': 62,
  'distributed systems': 70,
  'real-time systems': 72,
  caching: 74,
  'data systems': 76,
  logistics: 90,
};

export function getStageWeight(category?: string | null, text?: string): number {
  const normText = (text || '').toLowerCase();
  if (normText.includes('tell me about yourself') || normText.includes('walk me through your background')) {
    return 1;
  }
  const normCat = (category || '').toLowerCase();
  return STAGE_WEIGHTS[normCat] ?? 50;
}

const LIMIT = 500;

export const InterviewLibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const [rounds, setRounds] = useState<RoundTypeInfo[]>([]);
  const [questions, setQuestions] = useState<InterviewQuestion[] | null>(null);
  const [total, setTotal] = useState(0);
  const [tab, setTab] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'flow' | 'least_practised' | 'most_practised' | 'newest'>('flow');
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const [editing, setEditing] = useState<InterviewQuestion | null>(null);
  const [editText, setEditText] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editPreparedAnswer, setEditPreparedAnswer] = useState('');
  const [editKeyPoints, setEditKeyPoints] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<InterviewQuestion | null>(null);

  const load = () => {
    setLoadError(null);
    getInterviewQuestions({ limit: LIMIT })
      .then((res) => { setQuestions(res.items); setTotal(res.total); })
      .catch((err) => setLoadError(loadFailed('Could not load the question library', err)));
  };

  useEffect(() => {
    getInterviewRoundTypes().then(setRounds).catch(() => setRounds([]));
    load();
  }, []);

  const shown = useMemo(() => {
    const filtered = (questions ?? []).filter((q) => tab === 'all' || q.round_type === tab);
    return [...filtered].sort((a, b) => {
      if (sortBy === 'flow') {
        const weightA = getStageWeight(a.category, a.question_text);
        const weightB = getStageWeight(b.category, b.question_text);
        if (weightA !== weightB) return weightA - weightB;
        const countA = a.practice_count ?? 0;
        const countB = b.practice_count ?? 0;
        if (countA !== countB) return countA - countB;
        return a.id - b.id;
      }
      if (sortBy === 'least_practised') {
        return (a.practice_count ?? 0) - (b.practice_count ?? 0) || a.id - b.id;
      }
      if (sortBy === 'most_practised') {
        return (b.practice_count ?? 0) - (a.practice_count ?? 0) || a.id - b.id;
      }
      if (sortBy === 'newest') {
        return b.id - a.id;
      }
      return 0;
    });
  }, [questions, tab, sortBy]);

  const countFor = (value: string) => (questions ?? []).filter((q) => q.round_type === value).length;
  const labelFor = (value: string) => rounds.find((r) => r.value === value)?.label ?? value;

  const saveEdit = async () => {
    if (!editing) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const pointsArray = editKeyPoints
        .split('\n')
        .map((p) => p.trim())
        .filter(Boolean);
      await updateInterviewQuestion(editing.id, {
        question_text: editText,
        category: editCategory || undefined,
        prepared_answer: editPreparedAnswer.trim() || undefined,
        key_talking_points: pointsArray.length ? pointsArray : undefined,
      });
      setEditing(null);
      load();
    } catch (err) {
      setEditError(apiErrorMessage(err, 'Could not save the change.'));
    } finally {
      setEditSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteInterviewQuestion(deleting.id);
      setQuestions((prev) => (prev ?? []).filter((q) => q.id !== deleting.id));
      setTotal((t) => t - 1);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not delete the question.'));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Box>
      <PageHead
        eyebrow="Interview practice"
        title="Question library"
        sub={questions
          ? `${total} question${total === 1 ? '' : 's'}${rounds.length ? ` across ${rounds.length} round${rounds.length === 1 ? '' : 's'}` : ''}.`
          : loadError ? 'Question count unavailable.' : 'Loading…'}
        actions={(
          <>
            <Button component={RouterLink} to="/interview-practice" variant="outlined">← Interview practice</Button>
            <Button startIcon={<Upload size={16} />} variant="outlined" onClick={() => setImportOpen(true)}>
              Import questions
            </Button>
            <Button component={RouterLink} to="/interview-practice/setup" variant="contained" color="ink">
              Set up a session
            </Button>
          </>
        )}
      />

      {error && <Alert severity="error" sx={{ mt: 2.5 }}>{error}</Alert>}
      {loadError && (
        <Alert severity="error" sx={{ mt: 2.5 }} action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}>
          {loadError}
        </Alert>
      )}
      {total > LIMIT && (
        <Alert severity="info" sx={{ mt: 2.5 }}>Showing the first {LIMIT} of {total} questions.</Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile aria-label="Rounds" sx={{ mt: 3, borderBottom: 1, borderColor: 'divider' }}>
        {/* No count until there is one: "All · 0" beside a failed load reads as an empty library. */}
        <Tab value="all" label={questions ? `All · ${questions.length}` : 'All'} sx={{ textTransform: 'none' }} />
        {rounds.map((r) => (
          <Tab key={r.value} value={r.value} label={questions ? `${r.label} · ${countFor(r.value)}` : r.label} sx={{ textTransform: 'none' }} />
        ))}
      </Tabs>

      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mt: 2.5, mb: 1, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
          {questions ? `Showing ${shown.length} question${shown.length === 1 ? '' : 's'}` : ''}
        </Typography>
        <TextField
          select
          size="small"
          label="Sort by"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          sx={{ minWidth: 210 }}
        >
          <MenuItem value="flow">Interview Flow (Intro first)</MenuItem>
          <MenuItem value="least_practised">Least answered first</MenuItem>
          <MenuItem value="most_practised">Most answered first</MenuItem>
          <MenuItem value="newest">Recently added</MenuItem>
        </TextField>
      </Stack>

      {!questions && !loadError && <CircularProgress size={22} sx={{ mt: 3 }} />}
      {questions && shown.length === 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 3 }}>
          No questions here yet. Import some, or have one written on the practice page.
        </Typography>
      )}

      <Stack divider={<Divider />} sx={{ mt: 1 }}>
        {shown.map((q) => (
          <Stack key={q.id} direction="row" sx={{ alignItems: 'center', gap: 1.5, py: 1.25 }}>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {q.question_text}
                {getStageWeight(q.category, q.question_text) <= 10 && (
                  <Chip
                    component="span"
                    size="small"
                    label="Opening question"
                    variant="outlined"
                    color="secondary"
                    sx={{
                      minHeight: 20,
                      height: 'auto',
                      fontSize: (t) => t.typography.pxToRem(11),
                      ml: 1,
                      verticalAlign: 'middle',
                      fontWeight: 600,
                    }}
                  />
                )}
                {(q.prepared_answer || (q.key_talking_points && q.key_talking_points.length > 0)) && (
                  <Chip component="span" size="small" label="Has prepared answer" variant="outlined" color="primary" sx={{ minHeight: 20, height: 'auto', fontSize: (t) => t.typography.pxToRem(11), ml: 1, verticalAlign: 'middle' }} />
                )}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {labelFor(q.round_type)}{q.category ? ` · ${q.category}` : ''} · {practisedLabel(q.practice_count ?? 0)}
              </Typography>
            </Box>
            <Button size="small" variant="outlined" onClick={() => navigate(`/interview-practice/${q.id}/record`)}>
              Practise
            </Button>
            <IconButton
              size="small"
              aria-label={`Edit ${q.question_text}`}
              onClick={() => {
                setEditing(q);
                setEditText(q.question_text);
                setEditCategory(q.category ?? '');
                setEditPreparedAnswer(q.prepared_answer ?? '');
                setEditKeyPoints((q.key_talking_points ?? []).join('\n'));
                setEditError(null);
              }}
            >
              <Pencil size={15} />
            </IconButton>
            <IconButton size="small" aria-label={`Delete ${q.question_text}`} onClick={() => setDeleting(q)}>
              <Trash2 size={15} />
            </IconButton>
          </Stack>
        ))}
      </Stack>

      <InterviewQuestionImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={load}
        roundTypes={rounds}
        defaultRoundType={tab !== 'all' ? (tab as RoundTypeInfo['value']) : undefined}
      />

      <Dialog open={editing !== null} onClose={() => setEditing(null)} maxWidth="md" fullWidth>
        <DialogTitle>Edit question & preparation</DialogTitle>
        <DialogContent>
          {editError && <Alert severity="error" sx={{ mb: 2 }}>{editError}</Alert>}
          <TextField label="Question text" fullWidth multiline minRows={2} value={editText} onChange={(e) => setEditText(e.target.value)} sx={{ mt: 1 }} />
          <TextField label="Category" fullWidth value={editCategory} onChange={(e) => setEditCategory(e.target.value)} sx={{ mt: 2 }} />
          <Divider sx={{ my: 2.5 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>Prepared Answer (Optional)</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
            Your structured model answer (e.g. STAR: Situation, Task, Action, Result) or reference cheat sheet.
          </Typography>
          <TextField
            placeholder={'Situation: ...\nTask: ...\nAction: ...\nResult: ...'}
            fullWidth
            multiline
            minRows={4}
            value={editPreparedAnswer}
            onChange={(e) => setEditPreparedAnswer(e.target.value)}
          />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 2.5, mb: 0.5 }}>Key Talking Points to Hit (Optional)</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
            Essential metrics, outcomes, or facts (enter one per line). During practice, AI evaluates whether you covered each point.
          </Typography>
          <TextField
            placeholder={'Reduced database latency by 40%\nLed team of 6 engineers\nZero customer downtime'}
            fullWidth
            multiline
            minRows={3}
            value={editKeyPoints}
            onChange={(e) => setEditKeyPoints(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="contained" disabled={editSaving || !editText.trim()} onClick={saveEdit}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleting !== null} onClose={() => setDeleting(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete this question?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
            “{deleting?.question_text}” is removed from the library. Answers already recorded to it are
            kept, without the question attached.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)}>Keep it</Button>
          <Button color="error" variant="contained" onClick={confirmDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
