import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Grid, Card, CardContent, Typography, Button, LinearProgress,
  Divider, Alert, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions
} from '@mui/material';
import { ArrowLeft, ArrowRight, CheckSquare, Clock } from 'lucide-react';
import { QuestionView } from '../components/exam/QuestionView';
import { ExplanationDrawer } from '../components/exam/ExplanationDrawer';
import { ExamTimer } from '../components/exam/ExamTimer';
import { QuestionPalette } from '../components/exam/QuestionPalette';
import { getExamDetails, saveExamAnswer, finishExam } from '../services/api';
import { ExamDetail, ConfidenceLevel } from '../types/exam';
import { Question } from '../types/question';

export const ExamRunnerPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const sid = sessionId ? parseInt(sessionId, 10) : 0;

  const [examDetail, setExamDetail] = useState<ExamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOptionIds, setSelectedOptionIds] = useState<number[]>([]);
  const [answeredMap, setAnsweredMap] = useState<Map<number, number[]>>(new Map());
  const [flaggedSet, setFlaggedSet] = useState<Set<number>>(new Set());
  const [bookmarkedSet, setBookmarkedSet] = useState<Set<number>>(new Set());
  const [confidenceMap, setConfidenceMap] = useState<Map<number, ConfidenceLevel>>(new Map());
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [showExplanation, setShowExplanation] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [timeUpDialog, setTimeUpDialog] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const currentQuestion: Question | undefined = examDetail?.questions[currentIdx];
  const isPracticeMode = examDetail?.exam_mode === 'practice';

  // Refs to prevent stale closures in timers and callbacks
  const currentQuestionRef = useRef<Question | undefined>(currentQuestion);
  const selectedOptionIdsRef = useRef<number[]>(selectedOptionIds);
  const confidenceMapRef = useRef<Map<number, ConfidenceLevel>>(confidenceMap);
  const flaggedSetRef = useRef<Set<number>>(flaggedSet);
  const bookmarkedSetRef = useRef<Set<number>>(bookmarkedSet);

  const questionStartTimeRef = useRef<number>(questionStartTime);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const finishingRef = useRef<boolean>(false);

  useEffect(() => { currentQuestionRef.current = currentQuestion; }, [currentQuestion]);
  useEffect(() => { selectedOptionIdsRef.current = selectedOptionIds; }, [selectedOptionIds]);
  useEffect(() => { confidenceMapRef.current = confidenceMap; }, [confidenceMap]);
  useEffect(() => { flaggedSetRef.current = flaggedSet; }, [flaggedSet]);
  useEffect(() => { bookmarkedSetRef.current = bookmarkedSet; }, [bookmarkedSet]);
  useEffect(() => { questionStartTimeRef.current = questionStartTime; }, [questionStartTime]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const fetchExam = useCallback(() => {
    if (isNaN(sid) || sid <= 0) return;
    setLoading(true);
    setFetchError(null);
    getExamDetails(sid)
      .then((detail) => {
        setExamDetail(detail);
        const map = new Map<number, number[]>();
        const flags = new Set<number>();
        const bookmarks = new Set<number>();
        const conf = new Map<number, ConfidenceLevel>();

        detail.answers.forEach((a) => {
          if (a.selected_option_ids?.length > 0) map.set(a.question_id, a.selected_option_ids);
          if (a.is_flagged) flags.add(a.question_id);
          if (a.is_bookmarked) bookmarks.add(a.question_id);
          if (a.confidence_level) conf.set(a.question_id, a.confidence_level);
        });
        setAnsweredMap(map);
        setFlaggedSet(flags);
        setBookmarkedSet(bookmarks);
        setConfidenceMap(conf);
      })
      .catch((err) => {
        console.error(err);
        setFetchError('Failed to load exam details. Please check backend connection.');
      })
      .finally(() => setLoading(false));
  }, [sid]);

  useEffect(() => {
    fetchExam();
  }, [fetchExam]);

  useEffect(() => {
    if (currentQuestion) {
      setSelectedOptionIds(answeredMap.get(currentQuestion.id) || []);
      setShowExplanation(isPracticeMode && (answeredMap.get(currentQuestion.id) || []).length > 0);
      setQuestionStartTime(Date.now());
    }
  }, [currentIdx, currentQuestion?.id]);

  const handleSelectOption = useCallback((optionIds: number[]) => {
    if (!currentQuestion) return;
    setSelectedOptionIds(optionIds);
  }, [currentQuestion]);

  const persistAnswer = useCallback(async (
    questionId: number,
    optIds: number[],
    overrideFlagged?: boolean,
    overrideBookmarked?: boolean,
    overrideConfidence?: ConfidenceLevel
  ) => {
    if (!examDetail) return;
    const timeSpent = Math.round((Date.now() - questionStartTimeRef.current) / 1000);

    const isFlaggedVal = overrideFlagged !== undefined ? overrideFlagged : flaggedSetRef.current.has(questionId);
    const isBookmarkedVal = overrideBookmarked !== undefined ? overrideBookmarked : bookmarkedSetRef.current.has(questionId);
    const confVal = overrideConfidence !== undefined ? overrideConfidence : (confidenceMapRef.current.get(questionId) || 'not_set');

    // Snapshot only this question's previous entry (via functional update) so a
    // failed save can't clobber other answers that were saved concurrently.
    let previousEntry: number[] | undefined;
    setAnsweredMap((prev) => {
      previousEntry = prev.get(questionId);
      const updated = new Map(prev);
      if (optIds.length > 0) {
        updated.set(questionId, optIds);
      } else {
        updated.delete(questionId);
      }
      return updated;
    });

    try {
      await saveExamAnswer(sid, {
        question_id: questionId,
        selected_option_ids: optIds,
        time_spent_seconds: timeSpent,
        confidence_level: confVal,
        is_flagged: isFlaggedVal,
        is_bookmarked: isBookmarkedVal,
      });
    } catch (err: any) {
      console.error('Failed to save answer', err);
      setAnsweredMap((prev) => {
        const reverted = new Map(prev);
        if (previousEntry !== undefined) {
          reverted.set(questionId, previousEntry);
        } else {
          reverted.delete(questionId);
        }
        return reverted;
      });
      setSaveError('Network error: Answer failed to save to server.');
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => setSaveError(null), 4000);
    }
  }, [examDetail, sid]);

  const goToIndex = async (targetIdx: number) => {
    if (currentQuestion) {
      await persistAnswer(currentQuestion.id, selectedOptionIds);
    }
    setCurrentIdx(targetIdx);
  };

  const handleNext = async () => {
    if (!currentQuestion) return;
    await persistAnswer(currentQuestion.id, selectedOptionIds);
    if (isPracticeMode && selectedOptionIds.length > 0) {
      setShowExplanation(true);
      return;
    }
    if (examDetail && currentIdx < examDetail.questions.length - 1) {
      setCurrentIdx((i) => i + 1);
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) goToIndex(currentIdx - 1);
  };

  const handleToggleFlag = () => {
    if (!currentQuestion) return;
    const nextState = !flaggedSet.has(currentQuestion.id);
    setFlaggedSet((prev) => {
      const next = new Set(prev);
      nextState ? next.add(currentQuestion.id) : next.delete(currentQuestion.id);
      return next;
    });
    persistAnswer(currentQuestion.id, selectedOptionIds, nextState, undefined, undefined);
  };

  const handleToggleBookmark = () => {
    if (!currentQuestion) return;
    const nextState = !bookmarkedSet.has(currentQuestion.id);
    setBookmarkedSet((prev) => {
      const next = new Set(prev);
      nextState ? next.add(currentQuestion.id) : next.delete(currentQuestion.id);
      return next;
    });
    persistAnswer(currentQuestion.id, selectedOptionIds, undefined, nextState, undefined);
  };

  const handleChangeConfidence = (lvl: ConfidenceLevel) => {
    if (!currentQuestion) return;
    setConfidenceMap((prev) => new Map(prev).set(currentQuestion.id, lvl));
    persistAnswer(currentQuestion.id, selectedOptionIds, undefined, undefined, lvl);
  };

  const handleFinish = async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    try {
      if (currentQuestion) {
        await persistAnswer(currentQuestion.id, selectedOptionIds);
      }
      await finishExam(sid);
      setConfirmFinish(false);
      navigate(`/exam-review/${sid}`);
    } catch (err) {
      console.error(err);
      setSaveError('Failed to submit exam. Please try again.');
    } finally {
      finishingRef.current = false;
      setFinishing(false);
    }
  };

  const handleTimeUp = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    try {
      const q = currentQuestionRef.current;
      const opts = selectedOptionIdsRef.current;
      if (q) {
        await persistAnswer(q.id, opts);
      }
      await finishExam(sid);
      setTimeUpDialog(true);
    } catch (err) {
      console.error('Failed to auto-finish exam on time up', err);
    } finally {
      finishingRef.current = false;
      setFinishing(false);
    }
  }, [persistAnswer, sid]);

  const paletteAnswers = useMemo(() => {
    if (!examDetail) return [];
    return examDetail.question_ids_order.map((qid) => ({
      question_id: qid,
      selected_option_ids: answeredMap.get(qid) || [],
      is_flagged: flaggedSet.has(qid),
    }));
  }, [examDetail, answeredMap, flaggedSet]);

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
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={fetchExam}>Retry</Button>}>
          {fetchError}
        </Alert>
      </Box>
    );
  }

  if (!examDetail) return <Alert severity="error">Exam session not found.</Alert>;

  const totalQ = examDetail.questions.length;
  const answeredCount = answeredMap.size;
  const progress = totalQ > 0 ? (answeredCount / totalQ) * 100 : 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
      {saveError && <Alert severity="error">{saveError}</Alert>}

      {/* Top Bar */}
      <Card sx={{ 
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        boxShadow: 'none',
        borderRadius: 0
      }}>
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3 }}>
            <Box sx={{ flexGrow: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {examDetail.title} — Question {currentIdx + 1} / {totalQ}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {answeredCount} answered
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={progress} 
                sx={{ 
                  height: 8, 
                  borderRadius: 4,
                  bgcolor: 'action.hover',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: 'primary.main',
                  }
                }} 
              />
            </Box>
            <ExamTimer
              startTime={examDetail.start_time}
              timeAllowedSeconds={examDetail.time_allowed_seconds ?? undefined}
              onTimeUp={handleTimeUp}
            />
            <Button
              variant="contained"
              startIcon={<CheckSquare size={18} />}
              onClick={() => setConfirmFinish(true)}
              sx={{ 
                whiteSpace: 'nowrap',
                borderRadius: '100px',
                bgcolor: 'success.main',
                boxShadow: 'none',
                '&:hover': {
                  bgcolor: 'success.dark',
                  boxShadow: 'none'
                }
              }}
            >
              Finish Exam
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Main Content: Question + Palette */}
      <Grid container spacing={3} sx={{ flexGrow: 1 }}>
        {/* Question Panel */}
        <Grid item xs={12} md={8}>
          <Card sx={{ height: '100%', border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              {currentQuestion ? (
                <>
                  <QuestionView
                    question={currentQuestion}
                    selectedOptionIds={selectedOptionIds}
                    onSelectOption={handleSelectOption}
                    examMode={examDetail.exam_mode}
                    isFlagged={flaggedSet.has(currentQuestion.id)}
                    isBookmarked={bookmarkedSet.has(currentQuestion.id)}
                    onToggleFlag={handleToggleFlag}
                    onToggleBookmark={handleToggleBookmark}
                    confidenceLevel={confidenceMap.get(currentQuestion.id) || 'not_set'}
                    onChangeConfidence={handleChangeConfidence}
                  />

                  {/* Explanation (Practice Mode only) */}
                  {isPracticeMode && showExplanation && (
                    <ExplanationDrawer question={currentQuestion} selectedOptionIds={selectedOptionIds} />
                  )}
                </>
              ) : (
                <Alert severity="warning">No questions loaded.</Alert>
              )}

              {/* Navigation Buttons */}
              <Divider sx={{ my: 3 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Button
                  startIcon={<ArrowLeft size={18} />}
                  onClick={handlePrev}
                  disabled={currentIdx === 0}
                  variant="outlined"
                  sx={{ borderColor: 'divider', borderRadius: '100px' }}
                >
                  Previous
                </Button>

                {isPracticeMode && showExplanation ? (
                  <Button
                    variant="contained"
                    endIcon={<ArrowRight size={18} />}
                    onClick={() => {
                      setShowExplanation(false);
                      if (currentIdx < totalQ - 1) goToIndex(currentIdx + 1);
                    }}
                    disabled={currentIdx === totalQ - 1}
                    sx={{
                      borderRadius: '100px',
                      boxShadow: 'none',
                      bgcolor: 'primary.main',
                      '&:hover': { bgcolor: 'primary.dark', boxShadow: 'none' }
                    }}
                  >
                    Next Question
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    endIcon={currentIdx === totalQ - 1 ? <CheckSquare size={18} /> : <ArrowRight size={18} />}
                    onClick={currentIdx === totalQ - 1 ? () => setConfirmFinish(true) : handleNext}
                    disabled={selectedOptionIds.length === 0 && !isPracticeMode}
                    sx={{
                      borderRadius: '100px',
                      boxShadow: 'none',
                      bgcolor: currentIdx === totalQ - 1 ? 'success.main' : 'primary.main',
                      '&:hover': { bgcolor: currentIdx === totalQ - 1 ? 'success.dark' : 'primary.dark', boxShadow: 'none' }
                    }}
                  >
                    {currentIdx === totalQ - 1 ? 'Submit & Finish' : 'Save & Next'}
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Question Palette */}
        <Grid item xs={12} md={4}>
          <QuestionPalette
            totalQuestions={totalQ}
            currentIndex={currentIdx}
            questionIdsOrder={examDetail.question_ids_order}
            answers={paletteAnswers}
            onSelectIndex={(idx) => goToIndex(idx)}
          />
        </Grid>
      </Grid>

      {/* Finish Confirm Dialog */}
      <Dialog open={confirmFinish} onClose={() => setConfirmFinish(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Finish & Submit Exam?</DialogTitle>
        <DialogContent>
          <Typography>
            You have answered {answeredCount} of {totalQ} questions.
            {answeredCount < totalQ && (
              <Box component="span" sx={{ color: 'warning.main', fontWeight: 700 }}>
                {' '}({totalQ - answeredCount} unanswered)
              </Box>
            )} Are you sure you want to submit?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmFinish(false)}>Continue Exam</Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleFinish}
            disabled={finishing}
            startIcon={finishing ? <CircularProgress size={16} /> : <CheckSquare size={16} />}
            sx={{
              borderRadius: '100px',
              boxShadow: 'none',
              bgcolor: 'success.main',
              '&:hover': { bgcolor: 'success.dark', boxShadow: 'none' }
            }}
          >
            {finishing ? 'Submitting…' : 'Yes, Submit'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Time Up Dialog */}
      <Dialog open={timeUpDialog} onClose={() => navigate(`/exam-review/${sid}`)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700, color: 'warning.main' }}>
          <Clock size={20} /> Time is Up!
        </DialogTitle>
        <DialogContent>
          <Typography>
            Your time for this exam session has expired. Your answers have been automatically submitted.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => navigate(`/exam-review/${sid}`)}>
            View Exam Results
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
