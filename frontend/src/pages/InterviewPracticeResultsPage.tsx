import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Chip, Button, Alert,
  LinearProgress, Divider, CircularProgress,
  Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { getRecording, getRecordingAudioUrl, getRecordingAnalysis, analyzeRecording } from '../services/api';
import { PracticeRecording, RecordingAnalysis } from '../types/recording';
import { CategoryScoreList } from '../components/common/CategoryScoreList';
import { apiErrorMessage } from '../services/apiError';

export const InterviewPracticeResultsPage: React.FC = () => {
  const { recordingId } = useParams<{ recordingId: string }>();
  const navigate = useNavigate();
  const rid = recordingId ? parseInt(recordingId, 10) : 0;

  const [recording, setRecording] = useState<PracticeRecording | null>(null);
  const [analysis, setAnalysis] = useState<RecordingAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNaN(rid) || rid <= 0) return;
    setLoading(true);
    setError(null);
    getRecording(rid)
      .then((r) => {
        setRecording(r);
        return getRecordingAnalysis(rid).catch(() => null);
      })
      .then((existing) => {
        if (existing) {
          setAnalysis(existing);
          setLoading(false);
        } else {
          // Not analyzed yet -- this page is reached right after recording,
          // so auto-trigger analysis instead of requiring an extra click.
          setAnalyzing(true);
          setLoading(false);
          analyzeRecording(rid)
            .then(setAnalysis)
            .catch((err) => setError(apiErrorMessage(err, 'Failed to analyze recording.')))
            .finally(() => setAnalyzing(false));
        }
      })
      .catch(() => {
        setError('Failed to load recording. Please check backend connection.');
        setLoading(false);
      });
  }, [rid]);

  if (isNaN(rid) || rid <= 0) {
    return <Alert severity="error">Invalid recording.</Alert>;
  }

  if (loading) return <LinearProgress />;

  if (error && !recording) {
    return <Alert severity="error">{error}</Alert>;
  }

  const hasContent = analysis && analysis.analysis_status === 'analyzed' && analysis.content_scores.length > 0;
  const isGraded = analysis && analysis.analysis_status === 'analyzed';

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', pb: 8 }}>
      <Button startIcon={<ArrowLeft size={18} />} onClick={() => navigate('/interview-practice')} sx={{ mb: 2 }}>
        Back to Interview Practice
      </Button>

      <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>{recording?.title || 'Results'}</Typography>

      {recording && (
        <audio controls src={getRecordingAudioUrl(recording.id)} style={{ width: '100%', marginBottom: 24 }} />
      )}

      {analyzing && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 6 }}>
          <CircularProgress />
          <Typography color="text.secondary">Analyzing your answer…</Typography>
        </Box>
      )}

      {error && !analyzing && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {analysis && !analyzing && analysis.analysis_status !== 'analyzed' && (
        <Alert severity={analysis.analysis_status === 'unavailable' ? 'info' : 'warning'} sx={{ mb: 3 }}>
          {analysis.analysis_status === 'unavailable'
            ? 'This answer was saved but not analyzed -- no AI provider is set up yet. Add one in Settings -> AI Providers to enable feedback.'
            : `Analysis failed: ${analysis.analysis_error}`}
        </Alert>
      )}

      {isGraded && (
        <>
          {hasContent && (
            <>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Content -- What You Said</Typography>
              {analysis!.content_summary && <Alert severity="info" sx={{ mb: 2 }}>{analysis!.content_summary}</Alert>}
              <Card sx={{ mb: 4, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
                <CardContent>
                  <CategoryScoreList scores={analysis!.content_scores} />
                </CardContent>
              </Card>
              <Divider sx={{ mb: 4 }} />
            </>
          )}

          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Delivery -- How You Said It</Typography>
          {analysis!.summary && <Alert severity="info" sx={{ mb: 2 }}>{analysis!.summary}</Alert>}
          <Card sx={{ mb: 4, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent>
              {analysis!.filler_word_count !== null && (
                <Chip label={`${analysis!.filler_word_count} filler words`} size="small" sx={{ mb: 2 }} />
              )}
              <CategoryScoreList scores={analysis!.communication_scores} />
            </CardContent>
          </Card>

          {analysis!.transcript && (
            <Accordion sx={{ boxShadow: 'none', border: '1px solid', borderColor: 'divider', mb: 4 }}>
              <AccordionSummary expandIcon={<ChevronDown size={18} />}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>Transcript</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary">{analysis!.transcript}</Typography>
              </AccordionDetails>
            </Accordion>
          )}
        </>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
        <Button
          variant="contained"
          onClick={() => navigate('/interview-practice')}
          sx={{ borderRadius: '100px', boxShadow: 'none', px: 4 }}
        >
          Practice Another Question
        </Button>
      </Box>
    </Box>
  );
};
