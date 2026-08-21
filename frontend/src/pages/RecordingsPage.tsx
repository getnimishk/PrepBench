import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Chip, Alert,
  CircularProgress, LinearProgress, IconButton,
  Accordion, AccordionSummary, AccordionDetails, MenuItem, Select
} from '@mui/material';
import { Mic, Square, Trash2, Sparkles, ChevronDown } from 'lucide-react';
import {
  getRecordings, uploadRecording, deleteRecording, getRecordingAudioUrl,
  getRecordingProviders, analyzeRecording, getRecordingAnalysis,
} from '../services/api';
import { PracticeRecording, RecordingAnalysis, ProviderInfo } from '../types/recording';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { CategoryScoreList } from '../components/common/CategoryScoreList';
import { apiErrorMessage } from '../services/apiError';

const formatElapsed = (seconds: number): string => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export const RecordingsPage: React.FC = () => {
  const [recordings, setRecordings] = useState<PracticeRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('');

  const [uploading, setUploading] = useState(false);

  const [analyses, setAnalyses] = useState<Record<number, RecordingAnalysis>>({});
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [analyzeErrors, setAnalyzeErrors] = useState<Record<number, string>>({});

  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleRecordingStopped = async (blob: Blob, elapsedSeconds: number) => {
    setUploadError(null);
    setUploading(true);
    try {
      await uploadRecording(blob, `Practice Recording ${new Date().toLocaleString()}`, elapsedSeconds);
      fetchRecordings();
    } catch (err) {
      setUploadError(apiErrorMessage(err, 'Failed to save recording. Please try again.'));
    } finally {
      setUploading(false);
    }
  };

  const { isRecording, elapsed, recordError, start: handleStartRecording, stop: handleStopRecording } = useAudioRecorder(handleRecordingStopped);

  const fetchRecordings = () => {
    setLoading(true);
    setFetchError(null);
    getRecordings({ limit: 100 })
      .then((res) => setRecordings(res.items))
      .catch(() => setFetchError('Failed to load recordings. Please check backend connection.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRecordings();
    getRecordingProviders()
      .then((res) => {
        setProviders(res);
        const firstAvailable = res.find((p) => p.is_available);
        setSelectedProvider(firstAvailable ? firstAvailable.name : (res[0]?.name || ''));
      })
      .catch(() => {});
  }, []);

  const handleDelete = async (id: number) => {
    await deleteRecording(id);
    setRecordings((prev) => prev.filter((r) => r.id !== id));
  };

  const handleAnalyze = async (id: number) => {
    setAnalyzingId(id);
    setAnalyzeErrors((prev) => ({ ...prev, [id]: '' }));
    try {
      const result = await analyzeRecording(id, selectedProvider || undefined);
      setAnalyses((prev) => ({ ...prev, [id]: result }));
    } catch (err) {
      setAnalyzeErrors((prev) => ({
        ...prev,
        [id]: apiErrorMessage(err, 'Failed to analyze recording.'),
      }));
    } finally {
      setAnalyzingId(null);
    }
  };

  const loadExistingAnalysis = async (id: number) => {
    try {
      const result = await getRecordingAnalysis(id);
      setAnalyses((prev) => ({ ...prev, [id]: result }));
    } catch {
      // No analysis yet -- fine, nothing to show.
    }
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', pb: 8 }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>Practice Recordings</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Record yourself answering a practice question out loud, listen back, and optionally get AI feedback on your delivery.
      </Typography>

      <Card sx={{ mb: 4, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          {(recordError || uploadError) && <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>{recordError || uploadError}</Alert>}
          {isRecording && (
            <Typography variant="h3" sx={{ fontWeight: 800, mb: 2, color: 'error.main' }}>
              {formatElapsed(elapsed)}
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
              onClick={handleStopRecording}
              sx={{ borderRadius: '100px', px: 4, py: 1.5, boxShadow: 'none' }}
            >
              Stop Recording
            </Button>
          ) : (
            <Button
              variant="contained"
              size="large"
              startIcon={<Mic size={20} />}
              onClick={handleStartRecording}
              sx={{ borderRadius: '100px', px: 4, py: 1.5, boxShadow: 'none' }}
            >
              Start Recording
            </Button>
          )}
        </CardContent>
      </Card>

      {providers.length > 1 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="body2" color="text.secondary">Analysis provider:</Typography>
          <Select
            size="small"
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
          >
            {providers.map((p) => (
              <MenuItem key={p.name} value={p.name} disabled={!p.is_available}>
                {p.name}{!p.is_available ? ' (unavailable)' : ''}
              </MenuItem>
            ))}
          </Select>
        </Box>
      )}

      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Your Recordings</Typography>

      {fetchError && (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={fetchRecordings}>Retry</Button>} sx={{ mb: 3 }}>
          {fetchError}
        </Alert>
      )}

      {loading ? (
        <LinearProgress />
      ) : recordings.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No recordings yet. Record your first practice answer above.</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {recordings.map((r) => {
            const analysis = analyses[r.id];
            const analyzeError = analyzeErrors[r.id];
            return (
              <Card key={r.id} sx={{ border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{r.title}</Typography>
                    <IconButton size="small" onClick={() => handleDelete(r.id)} aria-label={`Delete ${r.title}`}>
                      <Trash2 size={18} />
                    </IconButton>
                  </Box>

                  <audio controls src={getRecordingAudioUrl(r.id)} style={{ width: '100%', marginBottom: 12 }} />

                  {!analysis && !analyzeError && (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        startIcon={analyzingId === r.id ? <CircularProgress size={14} color="inherit" /> : <Sparkles size={16} />}
                        onClick={() => handleAnalyze(r.id)}
                        disabled={analyzingId === r.id}
                        variant="outlined"
                      >
                        {analyzingId === r.id ? 'Analyzing…' : 'Analyze'}
                      </Button>
                      <Button size="small" onClick={() => loadExistingAnalysis(r.id)}>
                        Check for existing analysis
                      </Button>
                    </Box>
                  )}

                  {analyzeError && <Alert severity="warning" sx={{ mt: 1 }}>{analyzeError}</Alert>}

                  {analysis && analysis.analysis_status !== 'analyzed' && (
                    <Alert severity={analysis.analysis_status === 'unavailable' ? 'info' : 'warning'} sx={{ mt: 1 }}>
                      {analysis.analysis_status === 'unavailable'
                        ? 'Not analyzed -- no AI provider is configured for analysis.'
                        : `Analysis failed: ${analysis.analysis_error}`}
                    </Alert>
                  )}

                  {analysis && analysis.analysis_status === 'analyzed' && (
                    <Box sx={{ mt: 2 }}>
                      {analysis.summary && <Alert severity="info" sx={{ mb: 2 }}>{analysis.summary}</Alert>}

                      {analysis.filler_word_count !== null && (
                        <Chip
                          label={`${analysis.filler_word_count} filler words`}
                          size="small"
                          sx={{ mb: 2 }}
                        />
                      )}

                      <Box sx={{ mb: 2 }}>
                        <CategoryScoreList scores={analysis.communication_scores} />
                      </Box>

                      {analysis.transcript && (
                        <Accordion sx={{ boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                          <AccordionSummary expandIcon={<ChevronDown size={18} />}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>Transcript</Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Typography variant="body2" color="text.secondary">{analysis.transcript}</Typography>
                          </AccordionDetails>
                        </Accordion>
                      )}
                    </Box>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}
    </Box>
  );
};
