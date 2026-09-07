// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Button, Alert,
  LinearProgress, Divider, List, ListItem, ListItemIcon, ListItemText
} from '@mui/material';
import { CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';
import {
  getSystemDesignAttempt, getSystemDesignPromptAttempts,
  SystemDesignAttemptHistoryItem,
} from '../services/api';
import { SystemDesignAttempt } from '../types/systemDesign';
import { CategoryScoreList, scoreColor } from '../components/common/CategoryScoreList';

export const SystemDesignResultsPage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const aid = attemptId ? parseInt(attemptId, 10) : 0;

  const [attempt, setAttempt] = useState<SystemDesignAttempt | null>(null);
  const [history, setHistory] = useState<SystemDesignAttemptHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (isNaN(aid) || aid <= 0) return;
    setLoading(true);
    setFetchError(null);
    getSystemDesignAttempt(aid)
      .then((a) => {
        setAttempt(a);
        // History is a second question, so a failure to answer it must not
        // take the feedback down with it.
        getSystemDesignPromptAttempts(a.prompt_id)
          .then((h) => setHistory(h.items))
          .catch(() => setHistory([]));
      })
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
    <Box sx={{ maxWidth: 900, pb: 8 }}>
      <Button startIcon={<ArrowLeft size={18} />} onClick={() => navigate('/system-design')} sx={{ mb: 2 }}>
        Back to System Design
      </Button>

      <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
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
      <AttemptHistory items={history} currentId={aid} />
    </Box>
  );
};

/**
 * Every attempt at this prompt, and what actually changed.
 *
 * `GET /system-design/attempts` shipped with the feature and no page ever
 * called it, so someone who answered the same prompt three times could not
 * find out whether the third was better than the first. "Am I improving at
 * this?" was a question the product stored the answer to and never asked.
 *
 * The change is shown only between two graded attempts. An ungraded one has no
 * score, and a line drawn through a missing number is a fabricated trend --
 * which is the same defect as a fabricated score, one step further away from
 * where anyone would look for it.
 */
const AttemptHistory: React.FC<{
  items: SystemDesignAttemptHistoryItem[];
  currentId: number;
}> = ({ items, currentId }) => {
  if (items.length <= 1) return null;

  const graded = items.filter((i) => i.overall_score !== null).length;

  return (
    <Box sx={{ mt: 6 }}>
      <Typography variant="overline" sx={{ color: 'text.secondary' }}>
        Your attempts at this prompt
      </Typography>

      <Box sx={{ mt: 1 }}>
        {items.map((i) => (
          <Box
            key={i.attempt_id}
            sx={{
              display: 'flex', alignItems: 'baseline', gap: 2, py: 1.1,
              borderBottom: 1, borderColor: 'divider', flexWrap: 'wrap',
              fontWeight: i.attempt_id === currentId ? 600 : 400,
            }}
          >
            <Typography variant="body2" sx={{ width: 92, color: 'text.secondary' }}>
              {new Date(i.created_at).toLocaleDateString(undefined, {
                day: 'numeric', month: 'short',
              })}
            </Typography>
            <Typography variant="body2" sx={{ flexGrow: 1, fontWeight: 'inherit' }}>
              {i.attempt_id === currentId ? 'This one' : 'Earlier attempt'}
            </Typography>
            <Typography
              variant="body2"
              sx={{ width: 64, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
            >
              {/* Never a zero for an attempt that was never graded. */}
              {i.overall_score !== null ? `${Math.round(i.overall_score)}%` : 'not graded'}
            </Typography>
            <Typography
              variant="body2"
              sx={{ width: 74, textAlign: 'right', color: 'text.secondary' }}
            >
              {i.change_vs_previous === null
                ? ''
                : `${i.change_vs_previous > 0 ? '+' : ''}${Math.round(i.change_vs_previous)} pts`}
            </Typography>
          </Box>
        ))}
      </Box>

      {graded < 2 && (
        <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'text.secondary' }}>
          {graded === 0
            ? 'None of these were graded, so there is nothing to compare yet.'
            : 'Only one of these was graded, so there is nothing to compare it with yet.'}
        </Typography>
      )}
    </Box>
  );
};
