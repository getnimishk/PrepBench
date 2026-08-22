import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Grid, Chip, Button,
  LinearProgress, Paper, Alert, ToggleButton, ToggleButtonGroup
} from '@mui/material';
import {
  CheckCircle2, XCircle, Clock, Award, RotateCcw,
  Download, Home, Minus, ArrowLeft, ArrowRight, Flag
} from 'lucide-react';
import { getExamDetails } from '../services/api';
import { ExamDetail } from '../types/exam';

export const ExamReviewPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [filter, setFilter] = useState<'all' | 'incorrect' | 'correct' | 'flagged'>('all');
  const [currentIndex, setCurrentIndex] = useState(0);

  const sid = sessionId ? parseInt(sessionId, 10) : 0;

  const fetchExamDetails = () => {
    if (isNaN(sid) || sid <= 0) return;
    setLoading(true);
    setFetchError(null);
    getExamDetails(sid)
      .then(setExam)
      .catch((err) => {
        console.error(err);
        setFetchError('Failed to load exam review details. Please check backend connection.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchExamDetails();
  }, [sid]);

  const filteredQuestions = useMemo(() => {
    if (!exam) return [];
    const answersMap = new Map(exam.answers.map((a) => [a.question_id, a]));
    const mappedQuestions = exam.questions.map((q, originalIdx) => {
      const answer = answersMap.get(q.id);
      const isCorrect = answer?.is_correct ?? false;
      const isFlagged = answer?.is_flagged ?? false;
      const wasAnswered = (answer?.selected_option_ids?.length ?? 0) > 0;
      return { q, originalIdx, answer, isCorrect, isFlagged, wasAnswered };
    });
    return mappedQuestions.filter(({ isCorrect, isFlagged }) => {
      if (filter === 'all') return true;
      if (filter === 'incorrect') return !isCorrect;
      if (filter === 'correct') return isCorrect;
      if (filter === 'flagged') return isFlagged;
      return true;
    });
  }, [exam, filter]);

  // Clamp current index if filter changes and we lose items
  useEffect(() => {
    if (filteredQuestions.length > 0 && currentIndex >= filteredQuestions.length) {
      setCurrentIndex(0);
    }
  }, [filteredQuestions.length, currentIndex]);

  if (isNaN(sid) || sid <= 0) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
        <Alert severity="error">Invalid Exam Session ID.</Alert>
      </Box>
    );
  }

  if (loading) return <LinearProgress />;

  if (fetchError) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={fetchExamDetails}>Retry</Button>}>
          {fetchError}
        </Alert>
      </Box>
    );
  }

  if (!exam) return <Alert severity="error">Exam session #{sid} not found in database.</Alert>;

  const isPassed = exam.is_passed === 'passed';
  const currentQData = filteredQuestions[currentIndex];

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Result Hero Banner */}
      <Card sx={{
        bgcolor: isPassed ? 'success.dark' : 'error.dark',
        color: 'white',
        borderRadius: '12px',
        boxShadow: 'none',
        border: '1px solid',
        borderColor: isPassed ? 'success.main' : 'error.main'
      }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            {isPassed
              ? <CheckCircle2 size={40} color="inherit" />
              : <XCircle size={40} color="inherit" />}
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                {isPassed ? 'Congratulations! You Passed!' : 'Keep Practicing — You Got This!'}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {exam.title}
              </Typography>
            </Box>
          </Box>

          <Grid container spacing={2} sx={{ mt: 1 }}>
            {[
              { label: 'Score', value: `${exam.score_percentage ?? 0}%`, icon: Award, color: isPassed ? '#34D399' : '#FB7185' },
              { label: 'Passing', value: `${exam.passing_percentage}%`, icon: CheckCircle2, color: '#94A3B8' },
              { label: 'Correct', value: `${exam.correct_count} / ${exam.total_questions}`, icon: CheckCircle2, color: '#6366F1' },
              { label: 'Time', value: `${Math.round((exam.time_spent_seconds ?? 0) / 60)} min`, icon: Clock, color: '#FBBF24' },
            ].map((item) => (
              <Grid
                key={item.label}
                size={{
                  xs: 6,
                  sm: 3
                }}>
                <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'background.paper', borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: item.color }}>{item.value}</Typography>
                  <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>

          <Box sx={{ display: 'flex', gap: 2, mt: 3, flexWrap: 'wrap' }}>
            <Button variant="outlined" startIcon={<Home size={18} />} onClick={() => navigate('/')} sx={{ borderRadius: '100px', color: 'inherit', borderColor: 'inherit' }}>
              Dashboard
            </Button>
            <Button variant="contained" startIcon={<RotateCcw size={18} />} onClick={() => navigate('/exam-setup')} sx={{ borderRadius: '100px', bgcolor: 'white', color: 'black', '&:hover': { bgcolor: 'grey.200' } }}>
              New Exam
            </Button>
            <Button
              variant="outlined"
              startIcon={<Download size={18} />}
              onClick={() => window.open(`/api/v1/export/pdf/${sid}`, '_blank', 'noopener,noreferrer')}
              sx={{ borderRadius: '100px', color: 'inherit', borderColor: 'inherit' }}
            >
              PDF Report
            </Button>
            <Button
              variant="outlined"
              startIcon={<Download size={18} />}
              onClick={() => window.open(`/api/v1/export/excel/${sid}`, '_blank', 'noopener,noreferrer')}
              sx={{ borderRadius: '100px', color: 'inherit', borderColor: 'inherit' }}
            >
              Excel Report
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Review Section Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Question Review</Typography>
        <ToggleButtonGroup
          value={filter}
          exclusive
          onChange={(_, val) => { if (val) { setFilter(val); setCurrentIndex(0); } }}
          size="small"
          sx={{ bgcolor: 'background.paper' }}
        >
          <ToggleButton value="all" sx={{ px: 2 }}>All ({exam.questions.length})</ToggleButton>
          <ToggleButton value="incorrect" sx={{ px: 2 }}>Incorrect</ToggleButton>
          <ToggleButton value="correct" sx={{ px: 2 }}>Correct</ToggleButton>
          <ToggleButton value="flagged" sx={{ px: 2 }}>Flagged</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {filteredQuestions.length === 0 ? (
        <Alert severity="info">No questions match the current filter.</Alert>
      ) : (
        <Grid container spacing={3}>
          {/* Left Pane: Question Palette */}
          <Grid
            size={{
              xs: 12,
              md: 3.5,
              lg: 3
            }}>
            <Card sx={{ borderRadius: '12px', boxShadow: 'none', border: '1px solid', borderColor: 'divider', position: 'sticky', top: 80 }}>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, fontWeight: 700 }}>
                  Questions ({filteredQuestions.length})
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {filteredQuestions.map((item, idx) => {
                    const isActive = idx === currentIndex;
                    let bg = 'background.default';
                    let fg = 'text.primary';
                    let border = '1px solid';
                    let borderColor = 'divider';

                    if (item.isCorrect) {
                      bg = 'success.light'; fg = 'success.contrastText'; borderColor = 'success.main';
                    } else if (item.wasAnswered) {
                      bg = 'error.light'; fg = 'error.contrastText'; borderColor = 'error.main';
                    }

                    if (isActive) {
                      borderColor = 'primary.main';
                      border = '2px solid';
                    }

                    return (
                      <Box
                        key={item.q.id}
                        onClick={() => setCurrentIndex(idx)}
                        sx={{
                          position: 'relative',
                          width: 40, height: 40,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          borderRadius: '8px',
                          bgcolor: bg, color: fg,
                          border, borderColor,
                          cursor: 'pointer',
                          fontWeight: isActive ? 700 : 500,
                          '&:hover': { opacity: 0.8 }
                        }}
                      >
                        {item.originalIdx + 1}
                        {item.isFlagged && (
                          <Box sx={{
                            position: 'absolute', top: -4, right: -4,
                            width: 12, height: 12, borderRadius: '50%',
                            bgcolor: 'warning.main', border: '2px solid', borderColor: 'background.paper'
                          }} />
                        )}
                      </Box>
                    );
                  })}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Right Pane: Focused Question View */}
          <Grid
            size={{
              xs: 12,
              md: 8.5,
              lg: 9
            }}>
            {currentQData && (
              <Card sx={{ borderRadius: '12px', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  
                  {/* Header: Number & Metadata */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      Question {currentQData.originalIdx + 1}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Chip label={currentQData.q.domain} size="small" variant="outlined" />
                      <Chip label={currentQData.q.difficulty} size="small"
                        color={currentQData.q.difficulty === 'easy' ? 'success' : currentQData.q.difficulty === 'medium' ? 'warning' : 'error'} />
                      {currentQData.isFlagged && <Chip icon={<Flag size={14} />} label="Flagged" size="small" color="warning" />}
                    </Box>
                  </Box>

                  {/* Case Study & Text */}
                  {currentQData.q.case_study_text && (
                    <Paper sx={{ p: 2, borderLeft: '4px solid', borderColor: 'secondary.main', bgcolor: 'background.default', boxShadow: 'none' }}>
                      <Typography variant="caption" color="secondary" sx={{ fontWeight: 700 }}>Case Study</Typography>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>{currentQData.q.case_study_text}</Typography>
                    </Paper>
                  )}

                  <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
                    {currentQData.q.text}
                  </Typography>

                  {currentQData.q.code_snippet && (
                    <Box className="code-block">
                      <pre><code>{currentQData.q.code_snippet}</code></pre>
                    </Box>
                  )}

                  {/* Options */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {currentQData.q.options.map((opt, oidx) => {
                      const wasSelected = opt.id !== undefined && currentQData.answer?.selected_option_ids ? currentQData.answer.selected_option_ids.includes(opt.id) : false;
                      const isOptCorrect = opt.is_correct;
                      let bgColor = 'background.default';
                      let borderColor = 'divider';
                      
                      if (isOptCorrect) { bgColor = 'success.light'; borderColor = 'success.main'; }
                      else if (wasSelected && !isOptCorrect) { bgColor = 'error.light'; borderColor = 'error.main'; }

                      return (
                        <Box key={opt.id} sx={{ p: 2, borderRadius: '8px', bgcolor: bgColor, border: '1px solid', borderColor, display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                          <Box sx={{ mt: 0.3 }}>
                            {isOptCorrect
                              ? <CheckCircle2 size={20} color="#146C2E" />
                              : wasSelected
                              ? <XCircle size={20} color="#B3261E" />
                              : <Minus size={20} color="#94A3B8" />}
                          </Box>
                          <Box>
                            <Typography variant="body1" sx={{ fontWeight: wasSelected || isOptCorrect ? 700 : 400 }}>
                              {String.fromCharCode(65 + oidx)}. {opt.option_text}
                            </Typography>
                            {opt.explanation_why_incorrect && !isOptCorrect && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                Why incorrect: {opt.explanation_why_incorrect}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>

                  {/* Official Explanation */}
                  {currentQData.q.explanation && (
                    <Paper sx={{ p: 2.5, borderLeft: '4px solid', borderColor: 'primary.main', bgcolor: 'primary.light', boxShadow: 'none', color: 'primary.contrastText', opacity: 0.9 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                        Official Explanation
                      </Typography>
                      <Typography variant="body2">{currentQData.q.explanation}</Typography>
                    </Paper>
                  )}

                  {/* User Notes */}
                  {currentQData.answer?.user_notes && (
                    <Paper sx={{ p: 2, bgcolor: 'background.default', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Your Notes</Typography>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>{currentQData.answer.user_notes}</Typography>
                    </Paper>
                  )}

                  {/* Footer Stats */}
                  <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                    {currentQData.answer?.confidence_level && currentQData.answer.confidence_level !== 'not_set' && (
                      <Chip label={`Confidence: ${currentQData.answer.confidence_level.toUpperCase()}`} size="small" variant="outlined" />
                    )}
                    {currentQData.answer?.time_spent_seconds != null && (
                      <Chip label={`${currentQData.answer.time_spent_seconds}s spent`} size="small" variant="outlined" icon={<Clock size={12} />} />
                    )}
                  </Box>

                </CardContent>

                {/* Navigation Footer */}
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.default' }}>
                  <Button
                    startIcon={<ArrowLeft />}
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex((i) => i - 1)}
                    sx={{ borderRadius: '100px' }}
                  >
                    Previous
                  </Button>
                  <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
                    {currentIndex + 1} of {filteredQuestions.length}
                  </Typography>
                  <Button
                    endIcon={<ArrowRight />}
                    disabled={currentIndex === filteredQuestions.length - 1}
                    onClick={() => setCurrentIndex((i) => i + 1)}
                    sx={{ borderRadius: '100px' }}
                  >
                    Next
                  </Button>
                </Box>
              </Card>
            )}
          </Grid>
        </Grid>
      )}
    </Box>
  );
};
