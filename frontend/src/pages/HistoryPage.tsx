// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Button, LinearProgress, Alert
} from '@mui/material';
import { Eye, Download, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { getExamList } from '../services/api';
import { ExamSession } from '../types/exam';

const formatDate = (dateStr?: string) => {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchHistory = () => {
    setLoading(true);
    setFetchError(null);
    getExamList()
      .then(setSessions)
      .catch((err) => {
        console.error(err);
        setFetchError('Failed to load exam history. Please check backend connection.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  if (loading) return <LinearProgress />;

  if (fetchError) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={fetchHistory}>Retry</Button>}>
          {fetchError}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>Exam History</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {sessions.length} total exam sessions saved locally
      </Typography>

      {sessions.length === 0 ? (
        <Alert severity="info">No exam history yet. Complete your first exam to see it here.</Alert>
      ) : (
        <TableContainer component={Card} sx={{ borderRadius: '12px', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Exam Title</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Mode</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Score</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Result</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Duration</TableCell>
                <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sessions.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{s.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {s.total_questions} questions
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={s.exam_mode.replace('_', ' ').toUpperCase()} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {s.start_time ? formatDate(s.start_time) : 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {s.status === 'completed' ? (
                      <Typography variant="body1" sx={{ fontWeight: 800, color: (s.score_percentage ?? 0) >= s.passing_percentage ? '#34D399' : '#FB7185' }}>
                        {s.score_percentage ?? 0}%
                      </Typography>
                    ) : (
                      <Chip label={s.status.toUpperCase()} size="small" color="warning" />
                    )}
                  </TableCell>
                  <TableCell>
                    {s.status === 'completed' && (
                      <Chip
                        icon={s.is_passed === 'passed' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                        label={s.is_passed ? s.is_passed.toUpperCase() : 'N/A'}
                        size="small"
                        color={s.is_passed === 'passed' ? 'success' : 'error'}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Clock size={14} />
                      <Typography variant="body2">{s.time_spent_seconds != null ? Math.round(s.time_spent_seconds / 60) : 0} min</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                      <Button
                        size="small"
                        startIcon={<Eye size={14} />}
                        onClick={() => navigate(`/exam-review/${s.id}`)}
                        disabled={s.status !== 'completed'}
                      >
                        Review
                      </Button>
                      <Button
                        size="small"
                        startIcon={<Download size={14} />}
                        onClick={() => window.open(`/api/v1/export/pdf/${s.id}`, '_blank', 'noopener,noreferrer')}
                        disabled={s.status !== 'completed'}
                        variant="outlined"
                      >
                        PDF
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};
