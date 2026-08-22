import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Button, Chip, Alert,
  CircularProgress, LinearProgress
} from '@mui/material';
import { Mic, Square, Clock } from 'lucide-react';
import { getInterviewQuestion, uploadRecording } from '../services/api';
import { InterviewQuestion } from '../types/interviewQuestion';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { apiErrorMessage } from '../services/apiError';

const formatElapsed = (seconds: number): string => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const ROUND_LABELS: Record<string, string> = {
  hr_screening: 'HR Screening',
  hiring_manager: 'Hiring Manager',
  system_design: 'System Design',
  behavioral: 'Behavioral',
};

export const InterviewPracticeRecordPage: React.FC = () => {
  const { questionId } = useParams<{ questionId: string }>();
  const navigate = useNavigate();
  const isGeneral = questionId === 'general';
  const qid = !isGeneral && questionId ? parseInt(questionId, 10) : 0;

  const [question, setQuestion] = useState<InterviewQuestion | null>(null);
  const [loading, setLoading] = useState(!isGeneral);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (isGeneral) return;
    if (isNaN(qid) || qid <= 0) return;
    setLoading(true);
    setFetchError(null);
    getInterviewQuestion(qid)
      .then(setQuestion)
      .catch(() => setFetchError('Failed to load question. Please check backend connection.'))
      .finally(() => setLoading(false));
  }, [isGeneral, qid]);

  const handleRecordingStopped = async (blob: Blob, elapsedSeconds: number) => {
    setUploadError(null);
    setUploading(true);
    try {
      const title = question
        ? `${ROUND_LABELS[question.round_type] || question.round_type}: ${question.question_text.slice(0, 60)}`
        : `Practice Recording ${new Date().toLocaleString()}`;
      const recording = await uploadRecording(blob, title, elapsedSeconds, isGeneral ? undefined : qid);
      navigate(`/interview-practice/recordings/${recording.id}/results`);
    } catch (err) {
      setUploadError(apiErrorMessage(err, 'Failed to save recording. Please try again.'));
    } finally {
      setUploading(false);
    }
  };

  const { isRecording, elapsed, recordError, start, stop } = useAudioRecorder(handleRecordingStopped);

  if (!isGeneral && (isNaN(qid) || qid <= 0)) {
    return <Alert severity="error">Invalid question.</Alert>;
  }

  if (loading) return <LinearProgress />;

  if (!isGeneral && (fetchError || !question)) {
    return <Alert severity="error">{fetchError || 'Question not found.'}</Alert>;
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', pb: 8 }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>
        {isGeneral ? 'General Practice' : 'Interview Practice'}
      </Typography>

      {question && (
        <>
          <Chip label={ROUND_LABELS[question.round_type] || question.round_type} color="primary" sx={{ mb: 2, fontWeight: 700 }} />
          <Card sx={{ mb: 4, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent>
              <Typography variant="body1" sx={{ lineHeight: 1.7, fontWeight: 600 }}>{question.question_text}</Typography>
            </CardContent>
          </Card>
        </>
      )}

      {isGeneral && (
        <Alert severity="info" sx={{ mb: 4 }}>
          No specific question attached -- just practice speaking. You'll get delivery feedback only (no content grading, since there's no question to grade your answer against).
        </Alert>
      )}

      <Card sx={{ border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
        <CardContent sx={{ textAlign: 'center', py: 5 }}>
          {(recordError || uploadError) && <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>{recordError || uploadError}</Alert>}
          {isRecording && (
            <Typography variant="h3" sx={{ fontWeight: 800, mb: 2, color: 'error.main', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
              <Clock size={28} /> {formatElapsed(elapsed)}
            </Typography>
          )}
          {uploading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <CircularProgress />
              <Typography color="text.secondary">Saving recording…</Typography>
            </Box>
          ) : isRecording ? (
            <Button
              variant="contained"
              color="error"
              size="large"
              startIcon={<Square size={20} />}
              onClick={stop}
              sx={{ borderRadius: '100px', px: 4, py: 1.5, boxShadow: 'none' }}
            >
              Stop Recording
            </Button>
          ) : (
            <Button
              variant="contained"
              size="large"
              startIcon={<Mic size={20} />}
              onClick={start}
              sx={{ borderRadius: '100px', px: 4, py: 1.5, boxShadow: 'none' }}
            >
              Start Recording
            </Button>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};
