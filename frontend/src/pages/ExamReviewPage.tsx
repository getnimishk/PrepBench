// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Alert, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import { getExamDetails, getSubject, markAnswerReviewed } from '../services/api';
import { Explanation } from '../components/common/Explanation';
import { SessionBreakdown } from '../components/exam/SessionBreakdown';
import { ExamDetail } from '../types/exam';
import { READINESS_LABELS, Subject } from '../types/subject';
import { blockerSentence, plateauSentence, readySentence } from '../services/readinessText';
import { loadFailed } from '../services/apiError';
import { LoadingState } from '../components/common/States';
import {
  Detail, Eyebrow, Grid, PageHead, Panel, Pill, Section, Sub, type Tone,
} from '../components/ui/primitives';

const DIFFICULTY_TONE: Record<string, Tone> = { easy: 'success', medium: 'warning', hard: 'danger' };

export const ExamReviewPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [exam, setExam] = useState<ExamDetail | null>(null);
  // The subject, for the one thing the session row cannot be trusted on: the
  // bar this paper should be judged against.
  const [subject, setSubject] = useState<Subject | null>(null);
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
      .then((detail) => {
        setExam(detail);
        if (detail.subject_id) {
          getSubject(detail.subject_id).then(setSubject).catch(() => {
            /* the page still works; it just cannot name the exam's own bar */
          });
        }
      })
      .catch((err) => {
        console.error(err);
        setFetchError(loadFailed('Could not load this review', err));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchExamDetails();
    // fetchExamDetails closes over sid alone; re-running on its identity
    // would refetch on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid]);

  // How many were actually got wrong, independent of the current filter --
  // the result screen needs the number before anything has been filtered.
  const wrongCount = useMemo(() => {
    if (!exam) return 0;
    const answers = new Map(exam.answers.map((a) => [a.question_id, a]));
    return exam.questions.filter((q) => !(answers.get(q.id)?.is_correct ?? false)).length;
  }, [exam]);

  const reviewRef = useRef<HTMLDivElement | null>(null);

  const readTheMisses = () => {
    setFilter('incorrect');
    setCurrentIndex(0);
    reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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

  /**
   * Record that a wrong answer has actually been looked at.
   *
   * The endpoint, the column and the count on Home all existed; nothing in
   * the browser ever called this, so "90 unreviewed answers" could only ever
   * go up. A number the learner cannot move is the guilt mechanic this
   * product refuses everywhere else -- it just arrived by omission rather
   * than by design.
   *
   * Fired when a wrong answer is on screen, because reading the explanation
   * IS the review. Asking for a second click to confirm having read
   * something is bookkeeping, and bookkeeping is what produced the backlog.
   * The backend sets reviewed_at once, so revisiting does not re-stamp it.
   */
  useEffect(() => {
    const current = filteredQuestions[currentIndex];
    if (!current || current.isCorrect || !current.wasAnswered) return;
    if (current.answer?.reviewed_at) return;
    markAnswerReviewed(sid, current.q.id).catch(() => {
      // A failed mark is not worth interrupting the review for. The count
      // stays where it was and the next visit tries again.
    });
  }, [sid, currentIndex, filteredQuestions]);

  // Clamp current index if filter changes and we lose items
  useEffect(() => {
    if (filteredQuestions.length > 0 && currentIndex >= filteredQuestions.length) {
      setCurrentIndex(0);
    }
  }, [filteredQuestions.length, currentIndex]);

  if (isNaN(sid) || sid <= 0) {
    return (
      <Box sx={{ maxWidth: 800, mt: 4 }}>
        <Alert severity="error">Invalid Exam Session ID.</Alert>
      </Box>
    );
  }

  if (loading) return <LoadingState label="Loading this review…" />;

  if (fetchError) {
    return (
      <Box sx={{ maxWidth: 800, mt: 4 }}>
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={fetchExamDetails}>Retry</Button>}>
          {fetchError}
        </Alert>
      </Box>
    );
  }

  if (!exam) return <Alert severity="error">Exam session #{sid} not found in database.</Alert>;

  const currentQData = filteredQuestions[currentIndex];

  // Which bar this paper is actually measured against.
  //
  // A mock is judged against the subject's exam profile, because that is the
  // real exam's pass mark and it is what readiness uses. The threshold stored
  // on the session was whatever the app's default happened to be the day it
  // was sat -- for five of the six papers in the working database that was
  // 95%, so this page called an 87.5% paper a failure while Home counted it
  // as clearing 85%.
  //
  // A drill has no bar at all. Scoring targeted practice against a pass mark
  // is the category error the whole mock/drill split exists to prevent.
  const isMock = exam.session_kind === 'mock';
  const examPassMark = subject?.has_exam_profile ? subject.pass_mark ?? null : null;
  const passMark = isMock ? examPassMark ?? exam.passing_percentage : null;
  const score = exam.score_percentage ?? 0;
  const isPassed = passMark != null && score >= passMark;
  const storedDiffers =
    passMark != null && Math.abs(exam.passing_percentage - passMark) > 0.01;

  const r = subject?.readiness ?? null;
  const showsVerdict = isMock && r != null && subject?.has_exam_profile === true;

  const pct = Math.round(score);
  const minutes = Math.round((exam.time_spent_seconds ?? 0) / 60);
  const evidence = `${exam.correct_count} of ${exam.total_questions} correct`;
  const time = (exam.time_spent_seconds ?? 0) > 0 ? ` · ${minutes} minutes` : '';

  return (
    <Box>
      {/* The result, interpreted: the number, what it clears, the evidence in
          one line -- then, for a mock, the verdict in the product's own
          vocabulary. One weighted action: reading the misses is the thing that
          changes the next score. */}
      <PageHead
        eyebrow={exam.title}
        title={passMark == null ? `${pct}% this session` : `${pct}%`}
        sub={passMark == null
          ? `${evidence}${time}. A drill closes gaps. It is not scored against a pass mark, and it does not move your readiness.`
          : `${evidence}, ${isPassed ? 'above' : 'under'} the ${Math.round(passMark)}% pass mark${time}.`}
        actions={(
          <>
            <Button component={RouterLink} to={isMock ? '/exam-setup' : '/practice'} variant="outlined">
              ← {isMock ? 'Mock exam' : 'Back to practice'}
            </Button>
            <Button variant="outlined" onClick={() => navigate('/practice')}>Practise again</Button>
            {wrongCount > 0 ? (
              <Button variant="contained" color="ink" onClick={readTheMisses}>
                Read the {wrongCount} you got wrong
              </Button>
            ) : (
              <Button component={RouterLink} to="/" variant="contained" color="ink">Home</Button>
            )}
          </>
        )}
      >
        {storedDiffers && (
          // Shown rather than hidden: the session really was sat with that
          // threshold, and a learner who remembers the old number deserves to
          // see where it went instead of wondering why the verdict moved.
          <Detail sx={{ mb: '10px' }}>
            Sat with a {Math.round(exam.passing_percentage)}% threshold set at the time.
            Judged here against {subject?.name}&apos;s own pass mark of {Math.round(passMark ?? 0)}%,
            which is the bar readiness uses.
          </Detail>
        )}
        <Box sx={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          <Detail component="span">Reports:</Detail>
          {[
            { label: 'PDF report', href: `/api/v1/export/pdf/${sid}` },
            { label: 'Excel report', href: `/api/v1/export/excel/${sid}` },
          ].map((a) => (
            <Button
              key={a.label}
              size="small"
              onClick={() => window.open(a.href, '_blank', 'noopener,noreferrer')}
              sx={{ p: 0, minWidth: 0, minHeight: 0 }}
            >
              {a.label}
            </Button>
          ))}
        </Box>
      </PageHead>

      {/* What the paper did to the verdict, said the way Home says it. One
          rule, one vocabulary: two surfaces explaining the same verdict
          differently is the same defect as two surfaces disagreeing about the
          score. A drill does not move readiness, so it has no verdict here. */}
      {showsVerdict && (
        <Section>
          <Panel soft component="section" aria-labelledby="verdict-heading">
            <Eyebrow id="verdict-heading" component="h2">Where this leaves you</Eyebrow>
            <Box component="p" sx={{ m: 0, mt: '8px', fontSize: (t) => t.typography.pxToRem(22), fontWeight: 750, letterSpacing: '-0.02em' }}>
              {r.mock_count === 0 && r.state === 'needs_evaluation'
                ? 'Not measured yet'
                : READINESS_LABELS[r.state]}
            </Box>
            <Sub sx={{ mb: 0 }}>
              {r.state === 'plateau'
                ? plateauSentence(r.recent_scores, r.rules)
                : r.blockers[0]
                  ? blockerSentence(r.blockers[0], r.rules)
                  : readySentence(r.pass_mark, r.rules)}
            </Sub>
          </Panel>
        </Section>
      )}

      <SessionBreakdown exam={exam} />

      {/* Every question, one at a time: the prototype's answer sheet, opened. */}
      <Section>
        <Box
          ref={reviewRef}
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px', scrollMarginTop: 16 }}
        >
          <Box>
            <Eyebrow>Answer sheet</Eyebrow>
            <Typography variant="h5" component="h2" sx={{ mt: '6px' }}>Question review</Typography>
          </Box>
          <ToggleButtonGroup
            value={filter}
            exclusive
            onChange={(_, val) => { if (val) { setFilter(val); setCurrentIndex(0); } }}
            size="small"
          >
            <ToggleButton value="all">All ({exam.questions.length})</ToggleButton>
            <ToggleButton value="incorrect">Incorrect</ToggleButton>
            <ToggleButton value="correct">Correct</ToggleButton>
            <ToggleButton value="flagged">Flagged</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {filteredQuestions.length === 0 ? (
          <Alert severity="info" sx={{ mt: '14px' }}>No questions match the current filter.</Alert>
        ) : (
          <Grid template="minmax(0, 260px) minmax(0, 1fr)" sx={{ mt: '14px', alignItems: 'start' }}>
            <Panel sx={{ position: 'sticky', top: 80 }}>
              <Eyebrow>Questions ({filteredQuestions.length})</Eyebrow>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(38px, 1fr))', gap: '5px', mt: '10px' }}>
                {filteredQuestions.map((item, idx) => {
                  const isActive = idx === currentIndex;
                  const tone = item.isCorrect ? 'success' : item.wasAnswered ? 'danger' : null;
                  return (
                    <Box
                      key={item.q.id}
                      component="button"
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      // The colour says right or wrong; the name has to say it too.
                      aria-label={`Question ${item.originalIdx + 1}, ${item.isCorrect ? 'correct' : item.wasAnswered ? 'incorrect' : 'not answered'}${item.isFlagged ? ', flagged' : ''}`}
                      aria-current={isActive ? 'true' : undefined}
                      sx={{
                        font: 'inherit', p: 0, position: 'relative', aspectRatio: '1', minWidth: 0,
                        display: 'grid', placeItems: 'center', borderRadius: '6px', cursor: 'pointer',
                        fontSize: (t) => t.typography.pxToRem(10), fontWeight: 750,
                        border: isActive ? '2px solid' : '1px solid',
                        borderColor: isActive ? 'primary.main' : 'divider',
                        bgcolor: tone ? `pb.${tone}Soft` : 'background.paper',
                        color: tone ? `pb.${tone}` : 'text.secondary',
                        '&:hover': { borderColor: 'primary.main' },
                        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                      }}
                    >
                      {item.originalIdx + 1}
                      {item.isFlagged && (
                        <Box sx={{
                          position: 'absolute', top: -3, right: -3, width: 9, height: 9, borderRadius: '50%',
                          bgcolor: 'pb.warning', border: '2px solid', borderColor: 'background.paper',
                        }} />
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Panel>

            {currentQData && (
              <Panel component="article" aria-label={`Question ${currentQData.originalIdx + 1}`}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', pb: '12px', borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="h6" component="h3">Question {currentQData.originalIdx + 1}</Typography>
                  <Box sx={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <Pill>{currentQData.q.domain}</Pill>
                    <Pill tone={DIFFICULTY_TONE[currentQData.q.difficulty] ?? 'neutral'}>{currentQData.q.difficulty}</Pill>
                    {currentQData.isFlagged && <Pill tone="warning">Flagged</Pill>}
                  </Box>
                </Box>

                {currentQData.q.case_study_text && (
                  <Box sx={{ mt: '14px', p: '12px 13px', borderRadius: '9px', bgcolor: 'surfaceContainerHigh.main' }}>
                    <Eyebrow>Case study</Eyebrow>
                    <Box component="p" sx={{ m: 0, mt: '6px' }}>{currentQData.q.case_study_text}</Box>
                  </Box>
                )}

                <Typography component="p" sx={{ mt: '14px', fontSize: (t) => t.typography.pxToRem(17), fontWeight: 640, lineHeight: 1.5 }}>
                  {currentQData.q.text}
                </Typography>

                {currentQData.q.code_snippet && (
                  <Box className="code-block" sx={{ mt: '12px' }}>
                    <pre><code>{currentQData.q.code_snippet}</code></pre>
                  </Box>
                )}

                {/* The prototype's question review: the right option green, a
                    wrong pick red, each with why. */}
                <Box component="ul" sx={{ m: 0, mt: '6px', p: 0, listStyle: 'none' }}>
                  {currentQData.q.options.map((opt, oidx) => {
                    const wasSelected = opt.id !== undefined && currentQData.answer?.selected_option_ids
                      ? currentQData.answer.selected_option_ids.includes(opt.id) : false;
                    const right = opt.is_correct;
                    const wrongPick = wasSelected && !right;
                    return (
                      <Box
                        component="li"
                        key={opt.id ?? oidx}
                        sx={{
                          mt: '8px', p: '13px', borderRadius: '10px', border: '1px solid',
                          borderColor: right ? 'success.main' : wrongPick ? 'error.main' : 'divider',
                          bgcolor: right ? 'pb.successSoft' : wrongPick ? 'pb.dangerSoft' : 'background.paper',
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                          <Box component="span" sx={{ minWidth: 0, fontWeight: wasSelected || right ? 650 : 400 }}>
                            {String.fromCharCode(65 + oidx)}. {opt.option_text}
                          </Box>
                          <Box sx={{ display: 'flex', gap: '6px', flex: '0 0 auto' }}>
                            {right && <Pill tone="success">Correct</Pill>}
                            {wasSelected && <Pill tone={right ? 'success' : 'danger'}>Your answer</Pill>}
                          </Box>
                        </Box>
                        {opt.explanation_why_incorrect && !right && (
                          <Detail sx={{ mt: '4px' }}>Why incorrect: {opt.explanation_why_incorrect}</Detail>
                        )}
                      </Box>
                    );
                  })}
                </Box>

                {currentQData.q.explanation && (
                  <Box sx={{ mt: '18px' }}>
                    <Eyebrow>Why</Eyebrow>
                    {/* Rendered rather than printed: every explanation in the
                        bank is Markdown, and this showed it raw. */}
                    <Box sx={{ mt: '8px' }}><Explanation text={currentQData.q.explanation} variant="body1" /></Box>
                  </Box>
                )}

                {currentQData.answer?.user_notes && (
                  <Box sx={{ mt: '16px', p: '12px 13px', borderRadius: '9px', border: '1px solid', borderColor: 'divider' }}>
                    <Eyebrow>Your notes</Eyebrow>
                    <Box component="p" sx={{ m: 0, mt: '6px' }}>{currentQData.answer.user_notes}</Box>
                  </Box>
                )}

                {((currentQData.answer?.confidence_level && currentQData.answer.confidence_level !== 'not_set')
                  || currentQData.answer?.time_spent_seconds != null) && (
                  <Box sx={{ display: 'flex', gap: '6px', mt: '14px', flexWrap: 'wrap' }}>
                    {currentQData.answer?.confidence_level && currentQData.answer.confidence_level !== 'not_set' && (
                      <Pill>Confidence: {currentQData.answer.confidence_level}</Pill>
                    )}
                    {currentQData.answer?.time_spent_seconds != null && (
                      <Pill>{currentQData.answer.time_spent_seconds}s spent</Pill>
                    )}
                  </Box>
                )}

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', mt: '18px', pt: '14px', borderTop: '1px solid', borderColor: 'divider' }}>
                  <Button
                    variant="outlined"
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex((i) => i - 1)}
                  >
                    Previous
                  </Button>
                  <Detail component="span">{currentIndex + 1} of {filteredQuestions.length}</Detail>
                  <Button
                    variant="outlined"
                    disabled={currentIndex === filteredQuestions.length - 1}
                    onClick={() => setCurrentIndex((i) => i + 1)}
                  >
                    Next
                  </Button>
                </Box>
              </Panel>
            )}
          </Grid>
        )}
      </Section>
    </Box>
  );
};
