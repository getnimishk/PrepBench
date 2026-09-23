// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Chip, Typography } from '@mui/material';
import { getInterviewQuestion, getInterviewRoundTypes } from '../services/api';
import { InterviewQuestion, RoundTypeInfo } from '../types/interviewQuestion';
import { AnswerConsole } from '../components/interview/AnswerConsole';
import { practisedLabel } from '../services/interviewText';
import { loadFailed } from '../services/apiError';
import { LoadingState } from '../components/common/States';

/**
 * One take of one question, outside a session.
 *
 * The answer itself is AnswerConsole, the same one a session uses. "general" is
 * "just talk": no question, so the analysis can say how it was said but has
 * nothing to grade what was said against.
 */
export const InterviewPracticeRecordPage: React.FC = () => {
  const { questionId } = useParams<{ questionId: string }>();
  const navigate = useNavigate();
  const isGeneral = questionId === 'general';
  const qid = !isGeneral && questionId ? parseInt(questionId, 10) : 0;

  const [question, setQuestion] = useState<InterviewQuestion | null>(null);
  const [round, setRound] = useState<RoundTypeInfo | null>(null);
  const [loading, setLoading] = useState(!isGeneral);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (isGeneral) return;
    if (isNaN(qid) || qid <= 0) return;
    setLoading(true);
    setFetchError(null);
    getInterviewQuestion(qid)
      .then((q) => {
        setQuestion(q);
        // The round's guidance is supporting detail; without it the take still records.
        return getInterviewRoundTypes()
          .then((rounds) => setRound(rounds.find((r) => r.value === q.round_type) ?? null))
          .catch(() => setRound(null));
      })
      .catch((err) => setFetchError(loadFailed('Could not load this question', err)))
      .finally(() => setLoading(false));
  }, [isGeneral, qid, loadAttempt]);

  if (!isGeneral && (isNaN(qid) || qid <= 0)) {
    return <Alert severity="error">Invalid question.</Alert>;
  }

  if (loading) return <LoadingState label="Loading this question…" />;

  if (!isGeneral && (fetchError || !question)) {
    return (
      <Alert severity="error" action={fetchError ? <Button color="inherit" size="small" onClick={() => setLoadAttempt((n) => n + 1)}>Retry</Button> : undefined}>
        {fetchError || 'Question not found.'}
      </Alert>
    );
  }

  const title = question
    ? `${round?.label ?? question.round_type}: ${question.question_text.slice(0, 60)}`
    : `Practice Recording ${new Date().toLocaleString()}`;

  return (
    <Box sx={{ maxWidth: 860, mx: 'auto', pb: 8 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2 }}>
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
          {isGeneral ? 'General Practice' : `Interview practice${round ? ` · ${round.label}` : ''}`}
        </Typography>
        <Button size="small" onClick={() => navigate('/interview-practice')}>
          Exit
        </Button>
      </Box>

      {question ? (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 600, lineHeight: 1.45 }}>
            “{question.question_text}”
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            {question.category && <Chip label={question.category} size="small" variant="outlined" />}
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {practisedLabel(question.practice_count ?? 0)}
            </Typography>
          </Box>
        </Box>
      ) : (
        <>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 600, mb: 2 }}>General Practice</Typography>
          <Alert severity="info" sx={{ mb: 3 }}>
            No question attached — just practise speaking. The analysis can judge how you said it,
            but there is no question to grade what you said against.
          </Alert>
        </>
      )}

      <AnswerConsole
        questionId={question ? question.id : null}
        round={round}
        thinkingSeconds={round?.thinking_seconds ?? 0}
        title={title}
        preparedAnswer={question?.prepared_answer ?? null}
        keyTalkingPoints={question?.key_talking_points ?? []}
        onSaved={(recording) => navigate(`/interview-practice/recordings/${recording.id}/results`)}
      />

    </Box>
  );
};
