// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Button, Chip, CircularProgress,
  Stack, Divider, Alert,
} from '@mui/material';
import { getActivity, getHomeSummary } from '../services/api';
import { ActivityItem, HomeSummary } from '../types/subject';

/**
 * The three verb hubs.
 *
 * These are the entry point for when you know the activity but not the
 * subject. Subjects are reached from Home instead, which is what keeps the
 * navigation at four items however many subjects arrive.
 *
 * Deliberately thin: each hub is a list of doors, not a dashboard. The
 * interesting state lives on the subject pages.
 */

interface Door {
  label: string;
  detail: string;
  path: string;
}

const HubList: React.FC<{ title: string; blurb: string; doors: Door[] }> = ({
  title, blurb, doors,
}) => {
  const navigate = useNavigate();
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>{title}</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, maxWidth: 680 }}>
        {blurb}
      </Typography>
      <Card>
        <CardContent>
          <Stack divider={<Divider />}>
            {doors.map((d) => (
              <Box
                key={d.path}
                sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5, flexWrap: 'wrap' }}
              >
                <Box sx={{ flexGrow: 1, minWidth: 220 }}>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>{d.label}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>{d.detail}</Typography>
                </Box>
                <Button size="small" variant="outlined" onClick={() => navigate(d.path)}>
                  Open
                </Button>
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export const PracticeHubPage: React.FC = () => (
  <HubList
    title="Practice"
    blurb="Everything that tests you. A mock measures where you stand; everything else closes gaps."
    doors={[
      { label: 'Exams — mock or drill', detail: 'Only a full timed mock moves your readiness', path: '/exam-setup' },
      { label: 'Design Review', detail: 'Two defensible architectures; name the deciding axis', path: '/design-reviews' },
      { label: 'System Design Practice', detail: 'Blank-page design, graded against a rubric', path: '/system-design' },
      { label: 'Interview Practice', detail: 'Answer out loud and have the delivery analysed', path: '/interview-practice' },
      { label: 'Chart Sandbox', detail: 'Agile metrics you can pull apart', path: '/chart-sandbox' },
    ]}
  />
);

export const LearnHubPage: React.FC = () => (
  <HubList
    title="Learn"
    blurb="The material itself, rather than a test of it."
    doors={[
      { label: 'Roadmaps', detail: 'Imported study plans with tracked topics', path: '/roadmaps' },
      { label: 'Question Bank', detail: 'Browse, edit and import questions', path: '/question-bank' },
    ]}
  />
);

/**
 * Review merges what used to be two separate history pages plus an
 * exam-only analytics page. Two of four practice modes had their own
 * history and the other two had none, so nowhere answered "what have I
 * been doing".
 */
export const ReviewHubPage: React.FC = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getHomeSummary(), getActivity(40)])
      .then(([h, a]) => { setSummary(h); setActivity(a); })
      .catch(() => setError('Failed to load your activity.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>Review</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, maxWidth: 680 }}>
        Reviewing wrong answers is where a score actually moves. Everything you have done
        across every format is here, in one timeline.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {summary && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack spacing={1.5}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ flexGrow: 1, minWidth: 220 }}>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    Due for memory review
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {summary.due_for_review > 0
                      ? `${summary.due_for_review} question${summary.due_for_review === 1 ? '' : 's'} scheduled by the spaced-repetition engine`
                      : 'Nothing due. Items become due as the engine schedules them after you answer.'}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={summary.due_for_review === 0}
                  onClick={() => navigate('/exam-setup')}
                >
                  Start
                </Button>
              </Box>

              <Divider />

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ flexGrow: 1, minWidth: 220 }}>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    Unreviewed mock answers
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {summary.unreviewed_total > 0
                      ? `${summary.unreviewed_total} wrong answer${summary.unreviewed_total === 1 ? '' : 's'} you have not looked at yet`
                      : 'Nothing outstanding.'}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  variant="outlined"
                  color={summary.unreviewed_total > 0 ? 'warning' : 'default'}
                  label={summary.unreviewed_total}
                />
              </Box>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
            Activity — all subjects, all formats
          </Typography>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
          ) : activity.length === 0 ? (
            <Typography variant="body2" sx={{ mt: 1.5, color: 'text.secondary' }}>
              Nothing yet. Anything you complete in any format will appear here.
            </Typography>
          ) : (
            <Stack divider={<Divider />} sx={{ mt: 1 }}>
              {activity.map((item, i) => (
                <Box
                  key={`${item.kind}-${i}`}
                  onClick={() => navigate(item.href)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 2, py: 1.25,
                    cursor: 'pointer', flexWrap: 'wrap',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Typography variant="caption" sx={{ width: 84, color: 'text.secondary' }}>
                    {item.at ? new Date(item.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ''}
                  </Typography>
                  <Chip size="small" variant="outlined" label={item.kind.replace(/_/g, ' ')} />
                  <Typography variant="body2" sx={{ flexGrow: 1, minWidth: 160 }}>{item.title}</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>{item.detail}</Typography>
                </Box>
              ))}
            </Stack>
          )}
          <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'text.secondary' }}>
            Detailed exam statistics are at{' '}
            <Box component="span" sx={{ color: 'primary.main', cursor: 'pointer' }}
                 onClick={() => navigate('/analytics')}>
              Analytics
            </Box>.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};
