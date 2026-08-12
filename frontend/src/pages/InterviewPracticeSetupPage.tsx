import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Grid, TextField, MenuItem,
  Chip, Button, Alert, CircularProgress, Switch, FormControlLabel, Divider,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { Sparkles, Users, Briefcase, Network, MessageCircle, Mic, Upload, Pencil, Trash2 } from 'lucide-react';
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

const ROUND_ICONS: Record<InterviewRoundType, React.ComponentType<any>> = {
  hr_screening: Users,
  hiring_manager: Briefcase,
  system_design: Network,
  behavioral: MessageCircle,
};

export const InterviewPracticeSetupPage: React.FC = () => {
  const navigate = useNavigate();

  const [roundTypes, setRoundTypes] = useState<RoundTypeInfo[]>([]);
  const [selectedRound, setSelectedRound] = useState<InterviewRoundType | 'general' | ''>('');

  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [genTopic, setGenTopic] = useState('');
  const [saveToBank, setSaveToBank] = useState(true);
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
    getInterviewRoundTypes().then(setRoundTypes).catch(() => {});
  }, []);

  const refetchQuestions = () => {
    if (!selectedRound || selectedRound === 'general') return;
    setLoading(true);
    setFetchError(null);
    getInterviewQuestionCategories(selectedRound).then(setCategories).catch(() => {});
    getInterviewQuestions({ round_type: selectedRound, category: categoryFilter || undefined, limit: 100 })
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
    setGenerateError(null);
  };

  const handleSelectQuestion = (questionId: number) => {
    navigate(`/interview-practice/${questionId}/record`);
  };

  const handleStartGeneralPractice = () => {
    navigate(`/interview-practice/general/record`);
  };

  const handleGenerate = async () => {
    if (!selectedRound || selectedRound === 'general') return;
    setGenerateError(null);
    setGenerating(true);
    try {
      const question = await generateInterviewQuestion({
        round_type: selectedRound,
        topic: genTopic || undefined,
        save_to_bank: saveToBank,
      });
      if (question.id === 0) {
        setGenerateError('Question generated but not saved (enable "Save to bank" to practice it).');
        return;
      }
      navigate(`/interview-practice/${question.id}/record`);
    } catch (err: any) {
      setGenerateError(
        err?.response?.data?.detail ||
        'AI question generation is unavailable. Configure GEMINI_API_KEY, or pick a question from the bank below.'
      );
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
      await updateInterviewQuestion(editingQuestion.id, { question_text: editText, category: editCategory || undefined });
      setEditingQuestion(null);
      refetchQuestions();
    } catch (err: any) {
      setEditError(err?.response?.data?.detail || 'Failed to save changes.');
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

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', pb: 8 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Interview Practice</Typography>
        <Button size="small" onClick={() => navigate('/recordings')}>View All Recordings</Button>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Pick an interview round, then a question, record your spoken answer, and get feedback on both content and delivery.
      </Typography>

      {/* Round selector */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {roundTypes.map((rt) => {
          const Icon = ROUND_ICONS[rt.value];
          const isSelected = selectedRound === rt.value;
          return (
            <Grid item xs={12} sm={6} md={3} key={rt.value}>
              <Card
                onClick={() => handleSelectRound(rt.value)}
                sx={{
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: isSelected ? 'primary.main' : 'divider',
                  bgcolor: isSelected ? 'action.selected' : 'background.paper',
                  borderRadius: 3,
                  boxShadow: 'none',
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                }}
              >
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <Icon size={28} style={{ marginBottom: 8 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{rt.label}</Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
        <Grid item xs={12} sm={6} md={3}>
          <Card
            onClick={() => handleSelectRound('general')}
            sx={{
              cursor: 'pointer',
              border: '1px solid',
              borderColor: selectedRound === 'general' ? 'primary.main' : 'divider',
              bgcolor: selectedRound === 'general' ? 'action.selected' : 'background.paper',
              borderRadius: 3,
              boxShadow: 'none',
              '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
            }}
          >
            <CardContent sx={{ textAlign: 'center', py: 3 }}>
              <Mic size={28} style={{ marginBottom: 8 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>General Practice</Typography>
              <Typography variant="caption" color="text.secondary">No specific question</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {selectedRound === 'general' && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<Mic size={20} />}
            onClick={handleStartGeneralPractice}
            sx={{ borderRadius: '100px', px: 4, py: 1.5, boxShadow: 'none' }}
          >
            Start Recording
          </Button>
        </Box>
      )}

      {selectedRound && selectedRound !== 'general' && (
        <>
          {/* Generate New Question */}
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Sparkles size={20} /> Generate New Question
              </Typography>
              {generateError && <Alert severity="warning" sx={{ mb: 2 }}>{generateError}</Alert>}
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={5}>
                  <TextField
                    fullWidth
                    label="Topic (optional)"
                    placeholder="e.g. leadership, stakeholder management"
                    value={genTopic}
                    onChange={(e) => setGenTopic(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControlLabel
                    control={<Switch checked={saveToBank} onChange={(e) => setSaveToBank(e.target.checked)} />}
                    label="Save to bank"
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={generating ? <CircularProgress size={18} color="inherit" /> : <Sparkles size={18} />}
                    onClick={handleGenerate}
                    disabled={generating}
                    sx={{ borderRadius: '100px', boxShadow: 'none' }}
                  >
                    {generating ? 'Generating…' : 'Generate'}
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Divider sx={{ mb: 4 }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Question Bank</Typography>
            <Button size="small" startIcon={<Upload size={16} />} onClick={() => setImportOpen(true)}>
              Import Questions
            </Button>
          </Box>

          {categories.length > 0 && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
              <Chip
                label="All Categories"
                clickable
                color={categoryFilter === '' ? 'primary' : 'default'}
                onClick={() => setCategoryFilter('')}
              />
              {categories.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  clickable
                  color={categoryFilter === c ? 'primary' : 'default'}
                  onClick={() => setCategoryFilter(c)}
                />
              ))}
            </Box>
          )}

          {fetchError && <Alert severity="error" sx={{ mb: 3 }}>{fetchError}</Alert>}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : questions.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No questions match this filter.</Typography>
          ) : (
            <Grid container spacing={2}>
              {questions.map((q) => (
                <Grid item xs={12} sm={6} key={q.id}>
                  <Card
                    onClick={() => handleSelectQuestion(q.id)}
                    sx={{
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 3,
                      boxShadow: 'none',
                      height: '100%',
                      '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Typography variant="body1" sx={{ fontWeight: 600, mb: 1, flexGrow: 1 }}>{q.question_text}</Typography>
                        <Box sx={{ display: 'flex', flexShrink: 0 }}>
                          <IconButton size="small" aria-label={`Edit ${q.question_text}`} onClick={(e) => handleOpenEdit(e, q)}>
                            <Pencil size={16} />
                          </IconButton>
                          <IconButton
                            size="small"
                            aria-label={`Delete ${q.question_text}`}
                            onClick={(e) => handleDelete(e, q.id)}
                            disabled={deletingId === q.id}
                          >
                            {deletingId === q.id ? <CircularProgress size={16} /> : <Trash2 size={16} />}
                          </IconButton>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {q.category && <Chip label={q.category} size="small" variant="outlined" />}
                        {q.is_ai_generated && <Chip label="AI-generated" size="small" variant="outlined" color="secondary" />}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      {selectedRound && selectedRound !== 'general' && (
        <InterviewQuestionImportModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onSuccess={refetchQuestions}
          roundTypes={roundTypes}
          defaultRoundType={selectedRound}
        />
      )}

      <Dialog open={!!editingQuestion} onClose={() => setEditingQuestion(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Question</DialogTitle>
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
          <Button onClick={() => setEditingQuestion(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveEdit}
            disabled={editSaving || !editText.trim()}
            sx={{ borderRadius: '100px', boxShadow: 'none' }}
          >
            {editSaving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
