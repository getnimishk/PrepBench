import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Button, LinearProgress, Alert
} from '@mui/material';
import { Eye, Clock } from 'lucide-react';
import { getSystemDesignAttempts } from '../services/api';
import { SystemDesignAttempt } from '../types/systemDesign';

const formatDate = (dateStr?: string) => {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

export const SystemDesignHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState<SystemDesignAttempt[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchHistory = () => {
    setLoading(true);
    setFetchError(null);
    getSystemDesignAttempts({ skip: 0, limit: 200 })
      .then((res) => {
        setAttempts(res.items);
        setTotal(res.total);
      })
      .catch((err) => {
        console.error(err);
        setFetchError('Failed to load System Design history. Please check backend connection.');
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
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>System Design History</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {total} total attempt{total === 1 ? '' : 's'} saved locally
      </Typography>

      {attempts.length === 0 ? (
        <Alert severity="info">No System Design attempts yet. Complete your first one to see it here.</Alert>
      ) : (
        <TableContainer component={Card} sx={{ borderRadius: '12px', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Prompt</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Target Role</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Score</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Duration</TableCell>
                <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {attempts.map((a) => (
                <TableRow key={a.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {a.prompt?.title || 'Untitled Prompt'}
                    </Typography>
                    {a.prompt?.category && (
                      <Typography variant="caption" color="text.secondary">{a.prompt.category}</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color={a.target_role ? 'text.primary' : 'text.secondary'}>
                      {a.target_role || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{formatDate(a.created_at)}</Typography>
                  </TableCell>
                  <TableCell>
                    {a.grading_status === 'graded' ? (
                      <Typography variant="body1" sx={{ fontWeight: 800 }}>
                        {a.overall_score ?? 0}%
                      </Typography>
                    ) : (
                      <Chip
                        label={a.grading_status === 'unavailable' ? 'Not Graded' : 'Grading Error'}
                        size="small"
                        color={a.grading_status === 'unavailable' ? 'default' : 'warning'}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Clock size={14} />
                      <Typography variant="body2">{Math.round(a.time_spent_seconds / 60)} min</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                      <Button
                        size="small"
                        startIcon={<Eye size={14} />}
                        onClick={() => navigate(`/system-design/attempts/${a.id}`)}
                      >
                        View
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
