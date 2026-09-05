// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Grid, TextField, MenuItem, Button, Alert,
  CircularProgress, Collapse, Stack, Divider,
} from '@mui/material';
import { Sparkles, ChevronDown, ChevronRight } from 'lucide-react';
import {
  getSystemDesignPrompts,
  getSystemDesignPromptCategories,
  generateSystemDesignPrompt,
  getSystemDesignAttempts,
} from '../services/api';
import { SystemDesignPrompt } from '../types/systemDesign';
import { QuestionDifficulty } from '../types/question';
import { apiErrorMessage } from '../services/apiError';

/**
 * A problem to design, not a library to administer.
 *
 * Two corrections. The first moved prompt generation -- a topic field, a
 * difficulty select, a save-to-bank switch and a button -- from the top of
 * the page to a disclosure at the bottom: four decisions about the content
 * pipeline used to stand between arriving and designing anything.
 *
 * The second dealt with what was still in the way. The page led with a
 * button labelled "Give me a problem" and then a wall of twenty-four
 * category chips and three difficulty chips above a grid of cards with
 * coloured difficulty badges -- a catalogue. It now shows the problem
 * itself, so the decision is "yes, this one" rather than "which of these
 * twenty-nine filters do I want first", and browsing is one disclosure away
 * for when you do want to choose.
 */

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
  const [genOpen, setGenOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [attemptedIds, setAttemptedIds] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Which of the candidates is on offer. Bumped by "give me a different one".
  const [offset, setOffset] = useState(0);

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
    // Which prompts have already been answered, so the offer prefers one
    // that has not: re-answering a problem you have already written up is a
    // different exercise from meeting a new one.
    getSystemDesignAttempts({ limit: 200 })
      .then((res) => setAttemptedIds(new Set(res.items.map((a) => a.prompt_id))))
      .catch(() => { /* a fresh problem is still a problem */ });
  }, []);

  useEffect(() => {
    fetchPrompts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, difficultyFilter]);

  const pool = useMemo(() => {
    const unattempted = prompts.filter((p) => !attemptedIds.has(p.id));
    return unattempted.length > 0 ? unattempted : prompts;
  }, [prompts, attemptedIds]);

  const offered = pool.length > 0 ? pool[offset % pool.length] : null;

  const handleGenerate = async () => {
    setGenerateError(null);
    setGenerating(true);
    try {
      const prompt = await generateSystemDesignPrompt({
        topic: genTopic || undefined,
        difficulty: (genDifficulty as QuestionDifficulty) || undefined,
        // Always persisted. The un-saved path produced a prompt with id 0
        // that could not be opened, and then told the learner so -- a
        // control whose only effect was to make the feature fail.
        save_to_bank: true,
      });
      navigate(`/system-design/${prompt.id}/answer`);
    } catch (err) {
      setGenerateError(apiErrorMessage(
        err,
        'AI prompt generation is unavailable. Set up a provider in Settings -> AI Providers, '
        + 'or pick a prompt from the bank below.'
      ));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 680, pb: 8 }}>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>System Design</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 5 }}>
        Write the design, get it graded against a rubric.
      </Typography>

      {fetchError && (
        <Alert
          severity="error"
          action={<Button color="inherit" size="small" onClick={fetchPrompts}>Retry</Button>}
          sx={{ mb: 3 }}
        >
          {fetchError}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : offered ? (
        <Box sx={{ mb: 6 }}>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>Your problem</Typography>
          <Typography variant="h6" sx={{ fontWeight: 600, mt: 0.5 }}>{offered.title}</Typography>
          <Typography variant="body1" sx={{ mt: 1.5, lineHeight: 1.7, color: 'text.secondary' }}>
            {offered.prompt_text}
          </Typography>
          <Stack direction="row" sx={{ mt: 3, gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              disableElevation
              onClick={() => navigate(`/system-design/${offered.id}/answer`)}
              sx={{ borderRadius: '100px', fontWeight: 600, textTransform: 'none' }}
            >
              Start
            </Button>
            {pool.length > 1 && (
              <Button
                size="small"
                onClick={() => setOffset((o) => o + 1)}
                sx={{ textTransform: 'none' }}
              >
                Give me a different one
              </Button>
            )}
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {offered.category} · {offered.difficulty}
            </Typography>
          </Stack>
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 5 }}>
          No prompts match this filter.
        </Typography>
      )}

      {/* Choosing a specific problem, and writing a new one, are both real
          things to want and neither is what most visits are for. */}
      <Button
        size="small"
        onClick={() => setBrowseOpen((o) => !o)}
        endIcon={browseOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        aria-expanded={browseOpen}
        sx={{ textTransform: 'none' }}
      >
        Browse prompts
      </Button>
      <Collapse in={browseOpen} unmountOnExit>
        <Box sx={{ mt: 2, mb: 4 }}>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={{ xs: 12, sm: 7 }}>
              <TextField
                select
                fullWidth
                size="small"
                label="Category"
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setOffset(0); }}
              >
                <MenuItem value="">All categories</MenuItem>
                {categories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 5 }}>
              <TextField
                select
                fullWidth
                size="small"
                label="Difficulty"
                value={difficultyFilter}
                onChange={(e) => {
                  setDifficultyFilter(e.target.value as QuestionDifficulty | '');
                  setOffset(0);
                }}
              >
                <MenuItem value="">Any</MenuItem>
                {DIFFICULTIES.map((d) => (
                  <MenuItem key={d} value={d} sx={{ textTransform: 'capitalize' }}>{d}</MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>

          <Stack divider={<Divider />}>
            {prompts.map((p) => (
              <Box
                key={p.id}
                component="button"
                type="button"
                aria-label={`${p.title} — ${p.category}, ${p.difficulty}`}
                onClick={() => navigate(`/system-design/${p.id}/answer`)}
                sx={{
                  display: 'flex', alignItems: 'baseline', gap: 2, py: 1.3, width: '100%',
                  textAlign: 'left', font: 'inherit', border: 0, bgcolor: 'transparent',
                  color: 'text.primary', cursor: 'pointer', flexWrap: 'wrap',
                  '&:hover': { bgcolor: 'action.hover' },
                  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
                }}
              >
                <Typography variant="body2" sx={{ flexGrow: 1, minWidth: 200 }}>{p.title}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {p.category} · {p.difficulty}
                  {attemptedIds.has(p.id) && ' · answered'}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      </Collapse>

      <Box sx={{ mt: 1 }}>
        <Button
          size="small"
          onClick={() => setGenOpen((o) => !o)}
          endIcon={genOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          aria-expanded={genOpen}
          sx={{ textTransform: 'none' }}
        >
          Write me a new one
        </Button>
        <Collapse in={genOpen} unmountOnExit>
          <Box sx={{ mt: 2 }}>
            {generateError && <Alert severity="warning" sx={{ mb: 2 }}>{generateError}</Alert>}
            <Grid container spacing={2} sx={{ alignItems: 'center' }}>
              <Grid size={{ xs: 12, sm: 5 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Topic (optional)"
                  placeholder="e.g. rate limiting, chat systems"
                  value={genTopic}
                  onChange={(e) => setGenTopic(e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Difficulty (optional)"
                  value={genDifficulty}
                  onChange={(e) => setGenDifficulty(e.target.value as QuestionDifficulty | '')}
                >
                  <MenuItem value="">Any</MenuItem>
                  {DIFFICULTIES.map((d) => (
                    <MenuItem key={d} value={d} sx={{ textTransform: 'capitalize' }}>{d}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={generating
                    ? <CircularProgress size={16} color="inherit" />
                    : <Sparkles size={16} />}
                  onClick={handleGenerate}
                  disabled={generating}
                  sx={{ borderRadius: '100px', textTransform: 'none' }}
                >
                  {generating ? 'Writing…' : 'Write it'}
                </Button>
              </Grid>
            </Grid>
          </Box>
        </Collapse>
      </Box>
    </Box>
  );
};
