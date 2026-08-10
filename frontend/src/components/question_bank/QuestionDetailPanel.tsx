import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Drawer, Card, CardContent, Typography, Button, Chip, Divider,
  Grid, CircularProgress, Alert, Paper, IconButton
} from '@mui/material';
import {
  X, Brain, CheckCircle2, Edit2, Trash2,
  BookOpen, Sparkles, Tag, Layers
} from 'lucide-react';
import { Question, QuestionDifficulty } from '../../types/question';
import { researchQuestion, QuestionResearchResponse, updateQuestion } from '../../services/api';

interface QuestionDetailPanelProps {
  open: boolean;
  question: Question | null;
  mode: 'bank' | 'staging';
  onClose: () => void;
  onEdit: (q: Question) => void;
  onDelete: (id: number) => void;
  onRefresh: () => void;
  onToggleReviewed?: (q: Question) => void;
}

const DIFFICULTY_COLOR: Record<QuestionDifficulty, 'success' | 'warning' | 'error'> = {
  easy: 'success',
  medium: 'warning',
  hard: 'error',
};

export const QuestionDetailPanel: React.FC<QuestionDetailPanelProps> = ({
  open,
  question,
  mode,
  onClose,
  onEdit,
  onDelete,
  onRefresh,
  onToggleReviewed,
}) => {
  const [researchData, setResearchData] = useState<QuestionResearchResponse | null>(null);
  const [researching, setResearching] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const researchCache = useRef<Map<number, QuestionResearchResponse>>(new Map());

  useEffect(() => {
    if (!open) return;
    setResearchData(null);
    setActionError(null);
  }, [open, question?.id]);

  if (!question) return null;

  const currentQ = question;

  const handleResearch = async () => {
    setActionError(null);
    if (researchCache.current.has(currentQ.id)) {
      setResearchData(researchCache.current.get(currentQ.id)!);
      return;
    }
    setResearching(true);
    try {
      const data = await researchQuestion(currentQ.id);
      researchCache.current.set(currentQ.id, data);
      setResearchData(data);
    } catch (err: any) {
      console.error('Failed to perform LLM research:', err);
      setActionError(err?.response?.data?.detail || 'Failed to perform LLM research');
    } finally {
      setResearching(false);
    }
  };

  const handleApplyAiExplanation = async () => {
    if (!researchData?.suggested_explanation) return;
    setActionError(null);
    try {
      await updateQuestion(currentQ.id, { explanation: researchData.suggested_explanation });
      onRefresh();
    } catch (err: any) {
      console.error('Failed to update explanation:', err);
      setActionError(err?.response?.data?.detail || 'Failed to update explanation');
    }
  };

  const handleApplyAiOptionSuggestions = async () => {
    if (!researchData?.distractor_analyses) return;
    setActionError(null);
    const updatedOptions = currentQ.options.map((opt, idx) => {
      const letter = String.fromCharCode(65 + idx);
      const analysis = researchData.distractor_analyses.find((d) => d.option_letter === letter);
      return {
        ...opt,
        option_text: analysis?.suggested_option_text || opt.option_text,
      };
    });

    try {
      await updateQuestion(currentQ.id, { options: updatedOptions });
      onRefresh();
    } catch (err: any) {
      console.error('Failed to update option text:', err);
      setActionError(err?.response?.data?.detail || 'Failed to update option text');
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', md: '75vw' }, maxWidth: 1100, p: 3 } }}
    >
      {/* Top Bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          #{currentQ.id} — {currentQ.domain}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <X size={20} />
        </IconButton>
      </Box>

      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {actionError}
        </Alert>
      )}

      {/* Main Review Grid */}
      <Grid container spacing={2}>
        {/* Left Column: Full Question & Answers Inspector */}
        <Grid item xs={12} md={researchData ? 7 : 12}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent sx={{ p: 3 }}>
              {/* Question Metadata Chips */}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                <Chip icon={<Layers size={14} />} label={currentQ.domain} size="small" color="primary" variant="outlined" />
                <Chip icon={<Tag size={14} />} label={currentQ.topic} size="small" variant="outlined" />
                <Chip
                  label={currentQ.difficulty.toUpperCase()}
                  size="small"
                  color={DIFFICULTY_COLOR[currentQ.difficulty]}
                />
                <Chip label={currentQ.question_type.replace(/_/g, ' ').toUpperCase()} size="small" />
                {currentQ.certification && <Chip label={currentQ.certification} size="small" color="secondary" variant="outlined" />}
                {mode === 'bank' && (
                  <Chip
                    icon={<CheckCircle2 size={14} />}
                    label={currentQ.is_reviewed ? 'Reviewed' : 'Not Reviewed'}
                    size="small"
                    color={currentQ.is_reviewed ? 'success' : 'default'}
                    variant={currentQ.is_reviewed ? 'filled' : 'outlined'}
                  />
                )}
              </Box>

              {/* Question Scenario Text */}
              <Paper variant="outlined" sx={{ p: 2.5, mb: 3, bgcolor: 'action.hover', borderRadius: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.6 }}>
                  #{currentQ.id}. {currentQ.text}
                </Typography>
              </Paper>

              {/* Options Breakdown List */}
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                Answer Options & Correct Key:
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
                {currentQ.options.map((opt, idx) => {
                  const letter = String.fromCharCode(65 + idx);
                  const isCorrect = opt.is_correct;
                  return (
                    <Paper
                      key={opt.id ? `opt-id-${opt.id}-${idx}` : `opt-idx-${idx}`}
                      variant="outlined"
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        borderColor: isCorrect ? 'success.main' : 'divider',
                        bgcolor: isCorrect ? 'success.50' : 'background.paper',
                        borderWidth: isCorrect ? 2 : 1,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 2,
                      }}
                    >
                      <Chip
                        label={letter}
                        color={isCorrect ? 'success' : 'default'}
                        size="small"
                        sx={{ fontWeight: 800 }}
                      />
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: isCorrect ? 700 : 400 }}>
                          {opt.option_text}
                        </Typography>
                      </Box>
                      {isCorrect && (
                        <Chip
                          icon={<CheckCircle2 size={14} />}
                          label="Correct Choice"
                          color="success"
                          size="small"
                          sx={{ fontWeight: 700 }}
                        />
                      )}
                    </Paper>
                  );
                })}
              </Box>

              {/* Detailed Explanation Box */}
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Official Explanation:
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'action.hover', borderRadius: 2 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                  {currentQ.explanation || 'No explanation specified for this question.'}
                </Typography>
              </Paper>

              <Divider sx={{ my: 2 }} />

              {/* Action Toolbar */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
                {mode === 'bank' ? (
                  <Button
                    variant="contained"
                    color="secondary"
                    startIcon={researching ? <CircularProgress size={16} color="inherit" /> : <Brain size={18} />}
                    onClick={handleResearch}
                    disabled={researching}
                  >
                    {researching ? 'Analyzing with LLM…' : 'Research & Refine with LLM'}
                  </Button>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    Use "Auto-Refine Entire Batch" to run LLM research on staged questions.
                  </Typography>
                )}

                <Box sx={{ display: 'flex', gap: 1 }}>
                  {mode === 'bank' && (
                    <Button
                      variant={currentQ.is_reviewed ? 'contained' : 'outlined'}
                      color={currentQ.is_reviewed ? 'success' : 'inherit'}
                      startIcon={<CheckCircle2 size={16} />}
                      onClick={() => onToggleReviewed?.(currentQ)}
                    >
                      {currentQ.is_reviewed ? 'Reviewed' : 'Mark Reviewed'}
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    startIcon={<Edit2 size={16} />}
                    onClick={() => onEdit(currentQ)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<Trash2 size={16} />}
                    onClick={() => { onDelete(currentQ.id); }}
                  >
                    Delete
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column: LLM Research & Refinement Panel */}
        {researchData && (
          <Grid item xs={12} md={5}>
            <Card sx={{ height: '100%', borderRadius: 2, borderColor: 'secondary.main', border: 2 }}>
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Sparkles color="#D946EF" size={22} />
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      LLM Research Assistant
                    </Typography>
                  </Box>
                  <Chip
                    label={researchData.accuracy_status.toUpperCase()}
                    color={researchData.accuracy_status === 'compliant' ? 'success' : 'warning'}
                    size="small"
                    sx={{ fontWeight: 800 }}
                  />
                </Box>

                {/* Official Source Citation Box */}
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BookOpen size={16} /> Official Source Citation:
                </Typography>
                <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: 'action.hover', maxHeight: 140, overflowY: 'auto' }}>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                    {researchData.scrum_guide_citation}
                  </Typography>
                </Paper>

                {/* Technical Justification */}
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Accuracy & Justification:
                </Typography>
                <Alert severity={researchData.accuracy_status === 'compliant' ? 'success' : 'warning'} sx={{ mb: 2 }}>
                  <Typography variant="body2">{researchData.accuracy_explanation}</Typography>
                </Alert>

                {/* Distractor & Option Analyses */}
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  Option Critique & AI Refinement Suggestions:
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2, maxHeight: 240, overflowY: 'auto' }}>
                  {researchData.distractor_analyses.map((d) => (
                    <Paper key={d.option_letter} variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
                      <Typography variant="caption" sx={{ fontWeight: 800, display: 'block', mb: 0.5 }}>
                        Option {d.option_letter} ({d.is_correct ? 'Correct Choice' : 'Distractor'}):
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {d.critique}
                      </Typography>
                      {d.suggested_option_text && d.suggested_option_text !== d.option_text && (
                        <Alert severity="info" sx={{ py: 0.5, px: 1 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                            Suggested Option Refinement:
                          </Typography>
                          <Typography variant="caption" sx={{ fontStyle: 'italic' }}>
                            "{d.suggested_option_text}"
                          </Typography>
                        </Alert>
                      )}
                    </Paper>
                  ))}
                </Box>

                {/* Apply AI Action Buttons */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
                  {researchData.distractor_analyses.some((d) => d.suggested_option_text && d.suggested_option_text !== d.option_text) && (
                    <Button
                      variant="contained"
                      color="primary"
                      fullWidth
                      startIcon={<Sparkles size={16} />}
                      onClick={handleApplyAiOptionSuggestions}
                    >
                      Apply AI Option Refinements
                    </Button>
                  )}
                  {researchData.suggested_explanation && (
                    <Button
                      variant="contained"
                      color="success"
                      fullWidth
                      startIcon={<CheckCircle2 size={16} />}
                      onClick={handleApplyAiExplanation}
                    >
                      Apply AI Explanation Improvement
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Drawer>
  );
};
