import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Button, Alert,
  LinearProgress, Divider, List, ListItem, ListItemIcon, ListItemText
} from '@mui/material';
import { CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { getSystemDesignAttempt } from '../services/api';
import { SystemDesignAttempt } from '../types/systemDesign';
import { CategoryScoreList, scoreColor } from '../components/common/CategoryScoreList';

export const SystemDesignResultsPage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const aid = attemptId ? parseInt(attemptId, 10) : 0;

  const [attempt, setAttempt] = useState<SystemDesignAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (isNaN(aid) || aid <= 0) return;
    setLoading(true);
    setFetchError(null);
    getSystemDesignAttempt(aid)
      .then(setAttempt)
      .catch(() => setFetchError('Failed to load results. Please check backend connection.'))
      .finally(() => setLoading(false));
  }, [aid]);

  if (isNaN(aid) || aid <= 0) {
    return <Alert severity="error">Invalid attempt.</Alert>;
  }

  if (loading) return <LinearProgress />;

  if (fetchError || !attempt) {
    return <Alert severity="error">{fetchError || 'Attempt not found.'}</Alert>;
  }

  const notGraded = attempt.grading_status !== 'graded';

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', pb: 8 }}>
      <Button startIcon={<ArrowLeft size={18} />} onClick={() => navigate('/system-design')} sx={{ mb: 2 }}>
        Back to System Design
      </Button>

      <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
        {attempt.prompt?.title || 'System Design Feedback'}
      </Typography>
      {attempt.target_role && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Graded for: <strong>{attempt.target_role}</strong>
        </Typography>
      )}

      {notGraded ? (
        <Alert severity={attempt.grading_status === 'unavailable' ? 'info' : 'warning'} sx={{ mb: 3 }}>
          {attempt.grading_status === 'unavailable'
            ? 'This answer was saved but not graded — no AI provider is set up yet. Add one in Settings → AI Providers to enable feedback.'
            : `Grading failed: ${attempt.grading_error || 'Unknown error'}. Your answer was saved; try again later.`}
        </Alert>
      ) : (
        <>
          {/* Overall score */}
          <Card sx={{ mb: 3, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h2" sx={{ fontWeight: 800, color: `${scoreColor(attempt.overall_score || 0)}.main` }}>
                {Math.round(attempt.overall_score || 0)}%
              </Typography>
              <Typography variant="body2" color="text.secondary">Overall Score</Typography>
            </CardContent>
          </Card>

          {attempt.summary && (
            <Alert severity="info" sx={{ mb: 3 }}>{attempt.summary}</Alert>
          )}

          {/* Category scores */}
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Category Breakdown</Typography>
          <Card sx={{ mb: 4, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent>
              <CategoryScoreList scores={attempt.category_scores} gap={2} />
            </CardContent>
          </Card>

          <Divider sx={{ mb: 4 }} />

          {/* Strengths / Improvements */}
          <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', sm: 'row' } }}>
            <Card sx={{ flex: 1, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Strengths</Typography>
                <List dense>
                  {attempt.strengths.map((s, i) => (
                    <ListItem key={i} disableGutters>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <CheckCircle2 size={18} color="#34D399" />
                      </ListItemIcon>
                      <ListItemText primary={s} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Areas to Improve</Typography>
                <List dense>
                  {attempt.improvements.map((s, i) => (
                    <ListItem key={i} disableGutters>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <AlertTriangle size={18} color="#FBBF24" />
                      </ListItemIcon>
                      <ListItemText primary={s} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Box>
        </>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <Button
          variant="contained"
          onClick={() => navigate('/system-design')}
          sx={{ borderRadius: '100px', boxShadow: 'none', px: 4 }}
        >
          Practice Another Prompt
        </Button>
      </Box>
    </Box>
  );
};
