import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Grid, TextField, MenuItem,
  Chip, Button, Alert, CircularProgress, Switch, FormControlLabel, Divider
} from '@mui/material';
import { Sparkles } from 'lucide-react';
import {
  getSystemDesignPrompts,
  getSystemDesignPromptCategories,
  generateSystemDesignPrompt,
} from '../services/api';
import { SystemDesignPrompt } from '../types/systemDesign';
import { QuestionDifficulty } from '../types/question';
import { apiErrorMessage } from '../services/apiError';

const DIFFICULTIES: QuestionDifficulty[] = ['easy', 'medium', 'hard'];

export const SystemDesignSetupPage: React.FC = () => {
  const navigate = useNavigate();

  const [prompts, setPrompts] = useState<SystemDesignPrompt[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<QuestionDifficulty | ''>('');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [genTopic, setGenTopic] = useState('');
  const [genDifficulty, setGenDifficulty] = useState<QuestionDifficulty | ''>('');
  const [saveToBank, setSaveToBank] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const fetchPrompts = () => {
    setLoading(true);
    setFetchError(null);
    getSystemDesignPrompts({
      category: categoryFilter || undefined,
      difficulty: (difficultyFilter as QuestionDifficulty) || undefined,
      limit: 100,
    })
      .then((res) => setPrompts(res.items))
      .catch(() => setFetchError('Failed to load prompts. Please check backend connection.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    getSystemDesignPromptCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    fetchPrompts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, difficultyFilter]);

  const handleSelectPrompt = (promptId: number) => {
    navigate(`/system-design/${promptId}/answer`);
  };

  const handleGenerate = async () => {
    setGenerateError(null);
    setGenerating(true);
    try {
      const prompt = await generateSystemDesignPrompt({
        topic: genTopic || undefined,
        difficulty: (genDifficulty as QuestionDifficulty) || undefined,
        save_to_bank: saveToBank,
      });
      if (prompt.id === 0) {
        // Not persisted (save_to_bank was false) -- can't navigate to a real
        // prompt id, so just surface it was generated but not saved.
        setGenerateError('Prompt generated but not saved (enable "Save to bank" to practice it).');
        return;
      }
      navigate(`/system-design/${prompt.id}/answer`);
    } catch (err) {
      setGenerateError(
        apiErrorMessage(err, 'AI prompt generation is unavailable. Set up a provider in Settings -> AI Providers, or pick a prompt from the bank below.')
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', pb: 8 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>System Design Practice</Typography>
        <Button size="small" onClick={() => navigate('/system-design/history')}>View History</Button>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Pick a prompt from the bank, or generate a new one, then write your answer for AI-graded feedback.
      </Typography>

      {/* Generate New Prompt */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Sparkles size={20} /> Generate New Prompt
          </Typography>
          {generateError && <Alert severity="warning" sx={{ mb: 2 }}>{generateError}</Alert>}
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Topic (optional)"
                placeholder="e.g. rate limiting, chat systems"
                value={genTopic}
                onChange={(e) => setGenTopic(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                select
                fullWidth
                label="Difficulty (optional)"
                value={genDifficulty}
                onChange={(e) => setGenDifficulty(e.target.value as QuestionDifficulty | '')}
              >
                <MenuItem value="">Any</MenuItem>
                {DIFFICULTIES.map((d) => (
                  <MenuItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControlLabel
                control={<Switch checked={saveToBank} onChange={(e) => setSaveToBank(e.target.checked)} />}
                label="Save to bank"
              />
            </Grid>
            <Grid item xs={12} sm={2}>
              <Button
                fullWidth
                variant="contained"
                startIcon={generating ? <CircularProgress size={18} color="inherit" /> : <Sparkles size={18} />}
                onClick={handleGenerate}
                disabled={generating}
                sx={{ borderRadius: '100px', boxShadow: 'none' }}
              >
                {generating ? 'Generating…' : 'Generate'}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Divider sx={{ mb: 4 }} />

      {/* Bank browser */}
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Prompt Bank</Typography>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
        <Chip
          label="All Categories"
          clickable
          color={categoryFilter === '' ? 'primary' : 'default'}
          onClick={() => setCategoryFilter('')}
        />
        {categories.map((c) => (
          <Chip
            key={c}
            label={c}
            clickable
            color={categoryFilter === c ? 'primary' : 'default'}
            onClick={() => setCategoryFilter(c)}
          />
        ))}
        <Box sx={{ flexGrow: 1 }} />
        {DIFFICULTIES.map((d) => (
          <Chip
            key={d}
            label={d.toUpperCase()}
            clickable
            variant={difficultyFilter === d ? 'filled' : 'outlined'}
            color={difficultyFilter === d ? (d === 'easy' ? 'success' : d === 'medium' ? 'warning' : 'error') : 'default'}
            onClick={() => setDifficultyFilter(difficultyFilter === d ? '' : d)}
          />
        ))}
      </Box>

      {fetchError && (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={fetchPrompts}>Retry</Button>} sx={{ mb: 3 }}>
          {fetchError}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : prompts.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No prompts match this filter.</Typography>
      ) : (
        <Grid container spacing={2}>
          {prompts.map((p) => (
            <Grid item xs={12} sm={6} key={p.id}>
              <Card
                onClick={() => handleSelectPrompt(p.id)}
                sx={{
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 3,
                  boxShadow: 'none',
                  height: '100%',
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{p.title}</Typography>
                    <Chip
                      label={p.difficulty.toUpperCase()}
                      size="small"
                      color={p.difficulty === 'easy' ? 'success' : p.difficulty === 'medium' ? 'warning' : 'error'}
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {p.prompt_text}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip label={p.category} size="small" variant="outlined" />
                    {p.is_ai_generated && <Chip label="AI-generated" size="small" variant="outlined" color="secondary" />}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};
