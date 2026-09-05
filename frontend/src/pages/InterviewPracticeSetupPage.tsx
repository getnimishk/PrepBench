// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Grid, TextField, MenuItem, Button, Alert, CircularProgress,
  Collapse, Stack, Divider, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { Sparkles, Upload, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import {
  getInterviewRoundTypes,
  getInterviewQuestions,
  getInterviewQuestionCategories,
  generateInterviewQuestion,
  updateInterviewQuestion,
  deleteInterviewQuestion,
} from '../services/api';
import { InterviewQuestion, RoundTypeInfo, InterviewRoundType } from '../types/interviewQuestion';
import { InterviewQuestionImportModal } from '../components/interview/InterviewQuestionImportModal';
import { apiErrorMessage } from '../services/apiError';

/**
 * Being interviewed, rather than configuring an interview.
 *
 * The page used to open on five icon tiles -- pick a round -- and then, once
 * you had, a button that took you to a random question sight unseen, above a
 * wall of category chips, above a grid of question cards each carrying an
 * edit pencil and a delete bin. Two decisions and a content-management
 * surface before anyone said a word out loud.
 *
 * It now opens on a question, because that is the thing an interview
 * consists of. The round is a quiet row above it, the question bank and its
 * editing tools are behind a disclosure, and generating a new question is
 * behind another. Nothing about providers or models appears anywhere: the
 * failure message names Settings and stops.
 */
export const InterviewPracticeSetupPage: React.FC = () => {
  const navigate = useNavigate();

  const [roundTypes, setRoundTypes] = useState<RoundTypeInfo[]>([]);
  const [selectedRound, setSelectedRound] = useState<InterviewRoundType | 'general' | ''>('');

  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Which of the round's questions is on offer. Bumped by "a different one".
  const [offset, setOffset] = useState(0);

  const [genTopic, setGenTopic] = useState('');
  const [genOpen, setGenOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<InterviewQuestion | null>(null);
  const [editText, setEditText] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    getInterviewRoundTypes()
      .then((types) => {
        setRoundTypes(types);
        // Land on a round so the page opens on a question. Choosing between
        // five tiles is not the skill being practised.
        if (types.length > 0) setSelectedRound((cur) => cur || types[0].value);
      })
      .catch(() => {});
  }, []);

  const refetchQuestions = () => {
    if (!selectedRound || selectedRound === 'general') return;
    setLoading(true);
    setFetchError(null);
    getInterviewQuestionCategories(selectedRound).then(setCategories).catch(() => {});
    getInterviewQuestions({
      round_type: selectedRound,
      category: categoryFilter || undefined,
      limit: 100,
    })
      .then((res) => setQuestions(res.items))
      .catch(() => setFetchError('Failed to load questions. Please check backend connection.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refetchQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRound, categoryFilter]);

  const handleSelectRound = (round: InterviewRoundType | 'general') => {
    setSelectedRound(round);
    setCategoryFilter('');
    setOffset(0);
    setGenerateError(null);
  };

  const handleGenerate = async () => {
    if (!selectedRound || selectedRound === 'general') return;
    setGenerateError(null);
    setGenerating(true);
    try {
      const question = await generateInterviewQuestion({
        round_type: selectedRound,
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
        + 'or pick a question from the bank below.'
      ));
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenEdit = (e: React.MouseEvent, q: InterviewQuestion) => {
    e.stopPropagation();
    setEditingQuestion(q);
    setEditText(q.question_text);
    setEditCategory(q.category || '');
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingQuestion) return;
    setEditSaving(true);
    setEditError(null);
    try {
      await updateInterviewQuestion(editingQuestion.id, {
        question_text: editText,
        category: editCategory || undefined,
      });
      setEditingQuestion(null);
      refetchQuestions();
    } catch (err) {
      setEditError(apiErrorMessage(err, 'Failed to save changes.'));
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, questionId: number) => {
    e.stopPropagation();
    if (!window.confirm('Delete this question? This cannot be undone.')) return;
    setDeletingId(questionId);
    try {
      await deleteInterviewQuestion(questionId);
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
    } catch {
      setFetchError('Failed to delete question. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const offered = questions.length > 0 ? questions[offset % questions.length] : null;
  const isGeneral = selectedRound === 'general';

  return (
    <Box sx={{ maxWidth: 680, pb: 8 }}>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 3 }}>Interview practice</Typography>

      {/* The round, as a quiet row rather than five icon tiles. */}
      <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap', mb: 4 }}>
        {[...roundTypes.map((rt) => ({ value: rt.value as InterviewRoundType | 'general', label: rt.label })),
          { value: 'general' as const, label: 'Just talk' }].map((rt) => (
            <Button
              key={rt.value}
              size="small"
              onClick={() => handleSelectRound(rt.value)}
              sx={{
                textTransform: 'none',
                borderRadius: '100px',
                px: 1.5,
                color: selectedRound === rt.value ? 'primary.main' : 'text.secondary',
                bgcolor: selectedRound === rt.value ? 'action.hover' : 'transparent',
                fontWeight: selectedRound === rt.value ? 600 : 400,
              }}
              aria-pressed={selectedRound === rt.value}
            >
              {rt.label}
            </Button>
          ))}
      </Stack>

      {fetchError && <Alert severity="error" sx={{ mb: 3 }}>{fetchError}</Alert>}

      {isGeneral ? (
        <Box sx={{ mb: 6 }}>
          <Typography variant="body1" sx={{ mb: 2, color: 'text.secondary' }}>
            No question — record whatever you want to practise saying.
          </Typography>
          <Button
            variant="contained"
            disableElevation
            onClick={() => navigate('/interview-practice/general/record')}
            sx={{ borderRadius: '100px', fontWeight: 600, textTransform: 'none' }}
          >
            Record
          </Button>
        </Box>
      ) : loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : offered ? (
        <Box sx={{ mb: 6 }}>
          {/* The question is the interview. It is the largest thing on the
              page for the same reason the readiness verdict is the largest
              thing on Home. */}
          <Typography variant="h5" sx={{ fontWeight: 500, lineHeight: 1.45, maxWidth: 620 }}>
            “{offered.question_text}”
          </Typography>
          <Stack direction="row" sx={{ mt: 3, gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              disableElevation
              onClick={() => navigate(`/interview-practice/${offered.id}/record`)}
              sx={{ borderRadius: '100px', fontWeight: 600, textTransform: 'none' }}
            >
              Record
            </Button>
            {questions.length > 1 && (
              <Button
                size="small"
                onClick={() => setOffset((o) => o + 1)}
                sx={{ textTransform: 'none' }}
              >
                A different one
              </Button>
            )}
            {offered.category && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {offered.category}
              </Typography>
            )}
          </Stack>
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 5 }}>
          No questions in this round yet. Import some, or have one written below.
        </Typography>
      )}

      {!isGeneral && (
        <>
          {/* The bank and its editing tools. Browsing, editing, deleting and
              importing are all content maintenance, and none of them belong
              in front of somebody about to speak. */}
          <Button
            size="small"
            onClick={() => setBrowseOpen((o) => !o)}
            endIcon={browseOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            aria-expanded={browseOpen}
            sx={{ textTransform: 'none' }}
          >
            Browse questions
          </Button>
          <Collapse in={browseOpen} unmountOnExit>
            <Box sx={{ mt: 2, mb: 4 }}>
              {categories.length > 0 && (
                <TextField
                  select
                  size="small"
                  label="Category"
                  value={categoryFilter}
                  onChange={(e) => { setCategoryFilter(e.target.value); setOffset(0); }}
                  sx={{ mb: 2, minWidth: 240 }}
                >
                  <MenuItem value="">All categories</MenuItem>
                  {categories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </TextField>
              )}

              <Stack divider={<Divider />}>
                {questions.map((q) => (
                  <Stack
                    key={q.id}
                    direction="row"
                    sx={{ alignItems: 'center', gap: 1, py: 0.5 }}
                  >
                    <Box
                      component="button"
                      type="button"
                      onClick={() => navigate(`/interview-practice/${q.id}/record`)}
                      sx={{
                        flexGrow: 1, minWidth: 0, textAlign: 'left', font: 'inherit', border: 0,
                        bgcolor: 'transparent', color: 'text.primary', cursor: 'pointer', py: 1,
                        '&:hover': { color: 'primary.main' },
                        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
                      }}
                    >
                      <Typography variant="body2">{q.question_text}</Typography>
                      {q.category && (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {q.category}
                        </Typography>
                      )}
                    </Box>
                    <IconButton
                      size="small"
                      aria-label={`Edit ${q.question_text}`}
                      onClick={(e) => handleOpenEdit(e, q)}
                    >
                      <Pencil size={15} />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={`Delete ${q.question_text}`}
                      onClick={(e) => handleDelete(e, q.id)}
                      disabled={deletingId === q.id}
                    >
                      {deletingId === q.id ? <CircularProgress size={15} /> : <Trash2 size={15} />}
                    </IconButton>
                  </Stack>
                ))}
              </Stack>

              <Button
                size="small"
                startIcon={<Upload size={15} />}
                onClick={() => setImportOpen(true)}
                sx={{ textTransform: 'none', mt: 2 }}
              >
                Import questions
              </Button>
            </Box>
          </Collapse>

          <Box>
            <Button
              size="small"
              onClick={() => setGenOpen((o) => !o)}
              endIcon={genOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              aria-expanded={genOpen}
              sx={{ textTransform: 'none' }}
            >
              Write me a new one
            </Button>
            <Collapse in={genOpen} unmountOnExit>
              <Box sx={{ mt: 2 }}>
                {generateError && <Alert severity="warning" sx={{ mb: 2 }}>{generateError}</Alert>}
                <Grid container spacing={2} sx={{ alignItems: 'center' }}>
                  <Grid size={{ xs: 12, sm: 8 }}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Topic (optional)"
                      placeholder="e.g. leadership, stakeholder management"
                      value={genTopic}
                      onChange={(e) => setGenTopic(e.target.value)}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={generating
                        ? <CircularProgress size={16} color="inherit" />
                        : <Sparkles size={16} />}
                      onClick={handleGenerate}
                      disabled={generating}
                      sx={{ borderRadius: '100px', textTransform: 'none' }}
                    >
                      {generating ? 'Writing…' : 'Write it'}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </Collapse>
          </Box>
        </>
      )}

      <Button
        size="small"
        onClick={() => navigate('/recordings')}
        sx={{ textTransform: 'none', mt: 4, display: 'block' }}
      >
        Past recordings
      </Button>

      {/* Controlled by importOpen, so it does not need a second guard. */}
      <InterviewQuestionImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={refetchQuestions}
        roundTypes={roundTypes}
        // '' and 'general' are not real rounds; the modal wants one or nothing.
        defaultRoundType={
          selectedRound && selectedRound !== 'general' ? selectedRound : undefined
        }
      />

      <Dialog open={!!editingQuestion} onClose={() => setEditingQuestion(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Edit question</DialogTitle>
        <DialogContent>
          {editError && <Alert severity="error" sx={{ mb: 2 }}>{editError}</Alert>}
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Question Text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            fullWidth
            label="Category (optional)"
            value={editCategory}
            onChange={(e) => setEditCategory(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingQuestion(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button
            variant="contained"
            disableElevation
            onClick={handleSaveEdit}
            disabled={editSaving || !editText.trim()}
            sx={{ borderRadius: '100px', textTransform: 'none' }}
          >
            {editSaving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
