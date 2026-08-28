// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Grid, TextField, MenuItem,
  Slider, Switch, FormControlLabel, Button, Chip, Alert,
  CircularProgress
} from '@mui/material';
import { PlayCircle, Clock, Zap, BookOpen, Brain, Target } from 'lucide-react';
import { startExam, getQuestionFilters, getSettings } from '../services/api';
import { ExamMode } from '../types/exam';
import { apiErrorMessage } from '../services/apiError';

const EXAM_MODES = [
  { value: 'practice', label: 'Practice Mode', description: 'Unlimited time. Instant explanations after each question.', icon: BookOpen, color: '#34D399' },
  { value: 'timed', label: 'Timed Exam', description: 'Official exam conditions. Timer running. No hints.', icon: Clock, color: '#FB7185' },
  { value: 'custom', label: 'Custom Exam', description: 'Choose topics, difficulty, question count, randomization.', icon: Target, color: '#6366F1' },
  { value: 'weak_topic', label: 'Weak Topic Focus', description: 'Auto-selects your weakest domains for targeted practice.', icon: Brain, color: '#FBBF24' },
  { value: 'spaced_repetition', label: 'Spaced Repetition (SM-2)', description: 'AI-scheduled review of questions due for revision today.', icon: Zap, color: '#D946EF' },
];

export const ExamSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const configSectionRef = useRef<HTMLDivElement>(null);

  const rawParamMode = searchParams.get('mode');
  const initialMode: ExamMode = EXAM_MODES.some((m) => m.value === rawParamMode)
    ? (rawParamMode as ExamMode)
    : 'timed';

  const [mode, setMode] = useState<ExamMode>(initialMode);
  const [certification, setCertification] = useState('');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(80);
  const [timeLimitMins, setTimeLimitMins] = useState(60);
  const [passingPct, setPassingPct] = useState(95);
  const [randomizeQ, setRandomizeQ] = useState(true);
  const [randomizeOpts, setRandomizeOpts] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dynamic filter options fetched from database
  const [dbCertifications, setDbCertifications] = useState<string[]>([]);
  const [dbTopics, setDbTopics] = useState<string[]>([]);
  const [dbDifficulties, setDbDifficulties] = useState<string[]>([]);

  useEffect(() => {
    getQuestionFilters()
      .then((filters) => {
        setDbCertifications(filters.certifications || []);
        setDbTopics(filters.topics || []);
        setDbDifficulties(filters.difficulties || ['easy', 'medium', 'hard']);
      })
      .catch(console.error);

    getSettings()
      .then((s) => {
        if (s) {
          if (!searchParams.get('mode') && s.default_exam_mode) {
            setMode(s.default_exam_mode as ExamMode);
          }
          if (s.default_questions_count) setTotalQuestions(s.default_questions_count);
          if (s.default_passing_percentage) setPassingPct(s.default_passing_percentage);
          if (s.shuffle_questions !== undefined) setRandomizeQ(s.shuffle_questions);
          if (s.shuffle_options !== undefined) setRandomizeOpts(s.shuffle_options);
        }
      })
      .catch(console.error);
  }, []);

  const handleSelectMode = (newMode: ExamMode) => {
    setMode(newMode);
    // Smooth scroll down to Configure Settings section
    setTimeout(() => {
      configSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleToggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const handleToggleDifficulty = (diff: string) => {
    setSelectedDifficulties((prev) =>
      prev.includes(diff) ? prev.filter((d) => d !== diff) : [...prev, diff]
    );
  };

  const handleStart = async () => {
    setError(null);
    if (totalQuestions < 1 || totalQuestions > 100) {
      setError('Question count must be between 1 and 100.');
      return;
    }
    if (passingPct < 1 || passingPct > 100) {
      setError('Passing percentage must be between 1% and 100%.');
      return;
    }
    if (mode === 'timed' && timeLimitMins < 1) {
      setError('Time limit must be at least 1 minute.');
      return;
    }

    setLoading(true);
    try {
      const session = await startExam({
        title: `${EXAM_MODES.find(m => m.value === mode)?.label || 'Exam'} — ${certification || 'All Topics'}`,
        exam_mode: mode,
        certification: certification || undefined,
        topics: selectedTopics.length > 0 ? selectedTopics : undefined,
        difficulties: selectedDifficulties.length > 0 ? selectedDifficulties : undefined,
        total_questions: totalQuestions,
        time_allowed_minutes: mode === 'timed' ? timeLimitMins : undefined,
        passing_percentage: passingPct,
        randomize_questions: randomizeQ,
        randomize_options: randomizeOpts,
      });
      navigate(`/exam/${session.id}`);
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to start exam. Please check your filter criteria.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', pb: 8 }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>Start New Exam</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Configure your exam mode and settings, then click Launch to begin.
      </Typography>

      {/* Step Indicator */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 6, position: 'relative' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', zIndex: 1, gap: 1 }}>
          {['Choose Mode', 'Configure', 'Launch'].map((step, idx) => {
            const isActive = idx === 0 || (idx === 1 && !!mode) || (idx === 2 && !!mode);
            return (
              <React.Fragment key={step}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <Box sx={{
                    width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: isActive ? 'primary.main' : 'background.paper',
                    color: isActive ? '#fff' : 'text.secondary',
                    border: isActive ? 'none' : '1px solid',
                    borderColor: 'divider',
                    fontWeight: 700,
                    boxShadow: 'none'
                  }}>
                    {idx + 1}
                  </Box>
                  <Typography variant="caption" sx={{ fontWeight: isActive ? 700 : 500, color: isActive ? 'text.primary' : 'text.secondary' }}>
                    {step}
                  </Typography>
                </Box>
                {idx < 2 && (
                  <Box sx={{ width: 60, height: 2, bgcolor: isActive ? 'primary.main' : 'divider', mb: 3 }} />
                )}
              </React.Fragment>
            );
          })}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 4 }}>{error}</Alert>}

      {/* Mode Selector */}
      <Grid container spacing={2} sx={{ mb: 6 }}>
        {EXAM_MODES.map((m) => {
          const Icon = m.icon;
          const isSelected = mode === m.value;
          return (
            <Grid
              key={m.value}
              size={{
                xs: 12,
                sm: 6,
                md: 4
              }}>
              <Card
                onClick={() => handleSelectMode(m.value as ExamMode)}
                sx={{
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: isSelected ? m.color : 'divider',
                  bgcolor: isSelected ? 'action.selected' : 'background.paper',
                  transform: 'none',
                  transition: 'none',
                  boxShadow: 'none',
                  borderRadius: 3,
                  '&:hover': {
                    borderColor: m.color,
                    bgcolor: 'action.hover'
                  }
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                    <Box sx={{
                      p: 1, borderRadius: 1.5,
                      background: isSelected ? m.color : 'transparent',
                      color: isSelected ? '#fff' : m.color
                    }}>
                      <Icon size={20} />
                    </Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{m.label}</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">{m.description}</Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Configuration Panel Target */}
      <Box ref={configSectionRef} sx={{ scrollMarginTop: 80, mb: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>Configuration Settings</Typography>
        <Card sx={{ p: 1 }}>
          <CardContent>
            <Grid container spacing={4}>
              {/* Dynamic Certification Dropdown */}
              <Grid
                size={{
                  xs: 12,
                  sm: 6
                }}>
                <TextField
                  select
                  fullWidth
                  label="Certification / Exam Pack"
                  value={certification}
                  onChange={(e) => setCertification(e.target.value)}
                  helperText="Populated dynamically from imported question packs"
                >
                  <MenuItem value="">All Certifications & Domains</MenuItem>
                  {dbCertifications.map((c) => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid
                size={{
                  xs: 12,
                  sm: 6
                }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Number of Questions: <Chip label={totalQuestions} size="small" color="primary" />
                </Typography>
                <Slider
                  value={totalQuestions}
                  onChange={(_, val) => setTotalQuestions(val as number)}
                  min={5}
                  max={100}
                  step={5}
                  marks={[{ value: 25, label: '25' }, { value: 50, label: '50' }, { value: 75, label: '75' }, { value: 100, label: '100' }]}
                />
              </Grid>

              {mode === 'timed' && (
                <Grid
                  size={{
                    xs: 12,
                    sm: 6
                  }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                    Time Limit: <Chip label={`${timeLimitMins} minutes`} size="small" color="warning" />
                  </Typography>
                  <Slider
                    value={timeLimitMins}
                    onChange={(_, val) => setTimeLimitMins(val as number)}
                    min={10}
                    max={180}
                    step={10}
                    marks={[{ value: 30, label: '30m' }, { value: 60, label: '1h' }, { value: 120, label: '2h' }]}
                  />
                </Grid>
              )}

              <Grid
                size={{
                  xs: 12,
                  sm: 6
                }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Passing Score: <Chip label={`${passingPct}%`} size="small" color="success" />
                </Typography>
                <Slider
                  value={passingPct}
                  onChange={(_, val) => setPassingPct(val as number)}
                  min={50}
                  max={95}
                  step={5}
                  marks={[{ value: 70, label: '70%' }, { value: 80, label: '80%' }]}
                />
              </Grid>

              {/* Difficulty Filter Chips */}
              <Grid size={12}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1.5 }}>
                  Difficulty Level Filter:
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {(dbDifficulties.length > 0 ? dbDifficulties : ['easy', 'medium', 'hard']).map((diff) => {
                    const isSelected = selectedDifficulties.includes(diff);
                    return (
                      <Chip
                        key={diff}
                        label={diff.toUpperCase()}
                        clickable
                        sx={{
                          bgcolor: isSelected ? (diff === 'easy' ? 'success.main' : diff === 'medium' ? 'warning.main' : 'error.main') : 'background.paper',
                          color: isSelected ? '#fff' : 'text.primary',
                          border: '1px solid',
                          borderColor: isSelected ? 'transparent' : 'divider',
                          borderRadius: 2
                        }}
                        color={isSelected ? (diff === 'easy' ? 'success' : diff === 'medium' ? 'warning' : 'error') : 'default'}
                        variant={isSelected ? 'filled' : 'outlined'}
                        onClick={() => handleToggleDifficulty(diff)}
                      />
                    );
                  })}
                  {selectedDifficulties.length > 0 && (
                    <Button size="small" onClick={() => setSelectedDifficulties([])}>Clear</Button>
                  )}
                </Box>
              </Grid>

              {/* Dynamic Topic Filter Chips */}
              {dbTopics.length > 0 && (
                <Grid size={12}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1.5 }}>
                    Filter by Topic ({selectedTopics.length > 0 ? `${selectedTopics.length} selected` : 'All Topics'}):
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', maxHeight: 200, overflowY: 'auto', p: 2, border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.default' }}>
                    {dbTopics.map((t) => {
                      const isSelected = selectedTopics.includes(t);
                      return (
                        <Chip
                          key={t}
                          label={t}
                          size="small"
                          clickable
                          color={isSelected ? 'primary' : 'default'}
                          sx={{
                            border: '1px solid',
                            borderColor: isSelected ? 'primary.main' : 'divider',
                            bgcolor: isSelected ? 'primary.main' : 'background.paper',
                            color: isSelected ? 'primary.contrastText' : 'text.primary',
                            borderRadius: 2
                          }}
                          onClick={() => handleToggleTopic(t)}
                        />
                      );
                    })}
                  </Box>
                </Grid>
              )}

              <Grid size={12}>
                <Box sx={{ display: 'flex', gap: 4 }}>
                  <FormControlLabel
                    control={<Switch checked={randomizeQ} onChange={(e) => setRandomizeQ(e.target.checked)} />}
                    label="Randomize Question Order"
                  />
                  <FormControlLabel
                    control={<Switch checked={randomizeOpts} onChange={(e) => setRandomizeOpts(e.target.checked)} />}
                    label="Randomize Answer Choices"
                  />
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
        <Button
          variant="contained"
          size="large"
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <PlayCircle size={22} />}
          onClick={handleStart}
          disabled={loading}
          sx={{
            px: 4, py: 1.5, fontSize: '1.1rem', fontWeight: 700,
            borderRadius: '100px',
            boxShadow: 'none',
            bgcolor: 'primary.main',
            '&:hover': {
              bgcolor: 'primary.dark',
              boxShadow: 'none'
            }
          }}
        >
          {loading ? 'Generating Exam…' : 'Launch Exam'}
        </Button>
      </Box>
    </Box>
  );
};
