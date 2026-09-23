// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, CircularProgress, Collapse, MenuItem, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import { Sparkles } from 'lucide-react';
import {
  getSystemDesignPrompts,
  generateSystemDesignPrompt,
  getSystemDesignAttempts,
} from '../services/api';
import { SystemDesignPrompt } from '../types/systemDesign';
import { QuestionDifficulty } from '../types/question';
import { apiErrorMessage, loadFailed } from '../services/apiError';
import { LoadingState } from '../components/common/States';
import { Actions, Detail, Grid, PageHead, Panel, PanelHead, Pill, type Tone } from '../components/ui/primitives';

/**
 * System Design Practice: every prompt in the bank, by category, each a card
 * with the one way in -- start an answer. The prototype's studio grid.
 *
 * "Random practice challenge" prefers a prompt that has not been answered yet,
 * within the category on screen: re-answering a problem you have already
 * written up is a different exercise from meeting a new one. A new prompt can
 * be written by the configured AI; it is saved to the bank and opened.
 */

const DIFFICULTIES: QuestionDifficulty[] = ['easy', 'medium', 'hard'];

const DIFFICULTY_TONE: Record<QuestionDifficulty, Tone> = { easy: 'success', medium: 'warning', hard: 'danger' };

/** The categories the grader scores every answer on (CATEGORIES in the backend's system_design_service). */
const RUBRIC_DIMENSIONS = 6;

/** How much of a prompt a card shows. */
const EXCERPT = 140;

const excerpt = (text: string) =>
  text.length > EXCERPT ? `${text.slice(0, EXCERPT).trimEnd()}…` : text;

const answeredLabel = (n: number) => (n === 1 ? 'answered once' : `answered ${n} times`);

export const SystemDesignSetupPage: React.FC = () => {
  const navigate = useNavigate();

  const [prompts, setPrompts] = useState<SystemDesignPrompt[] | null>(null);
  const [total, setTotal] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [answered, setAnswered] = useState<Map<number, number>>(new Map());
  const [tab, setTab] = useState('all');

  const [genOpen, setGenOpen] = useState(false);
  const [genTopic, setGenTopic] = useState('');
  const [genDifficulty, setGenDifficulty] = useState<QuestionDifficulty | ''>('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  useEffect(() => {
    setFetchError(null);
    setPrompts(null);
    getSystemDesignPrompts({ limit: 500 })
      .then((res) => {
        setPrompts(res.items);
        setTotal(res.total);
      })
      .catch((err) => {
        setPrompts([]);
        setFetchError(loadFailed('Could not load System Design prompts', err));
      });
  }, [attempt]);

  useEffect(() => {
    getSystemDesignAttempts({ limit: 500 })
      .then((res) => {
        const counts = new Map<number, number>();
        res.items.forEach((a) => counts.set(a.prompt_id, (counts.get(a.prompt_id) ?? 0) + 1));
        setAnswered(counts);
      })
      // Without the history every prompt reads as new, which is still a fair offer.
      .catch(() => {});
  }, []);

  // Categories in the order the bank first mentions them, as the prototype draws its tabs.
  const categories = useMemo(() => {
    const seen: string[] = [];
    (prompts ?? []).forEach((p) => {
      if (p.category && !seen.includes(p.category)) seen.push(p.category);
    });
    return seen;
  }, [prompts]);

  const shown = (prompts ?? []).filter((p) => tab === 'all' || p.category === tab);

  const randomChallenge = () => {
    const fresh = shown.filter((p) => !answered.has(p.id));
    const pool = fresh.length > 0 ? fresh : shown;
    if (pool.length === 0) return;
    navigate(`/system-design/${pool[Math.floor(Math.random() * pool.length)].id}/answer`);
  };

  const handleGenerate = async () => {
    setGenerateError(null);
    setGenerating(true);
    try {
      const prompt = await generateSystemDesignPrompt({
        topic: genTopic || undefined,
        difficulty: genDifficulty || undefined,
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
    <Box>
      <PageHead
        eyebrow="Skill preparation"
        title="System Design Practice"
        sub="Blank-page architecture practice. Formulate requirements, high-level architectures, data models, scalability patterns, and trade-offs graded against standard engineering rubrics."
        actions={(
          <>
            <Button variant="contained" onClick={randomChallenge} disabled={shown.length === 0}>
              Random practice challenge
            </Button>
            <Button variant="outlined" onClick={() => setGenOpen((o) => !o)} aria-expanded={genOpen}>
              Write me a new one
            </Button>
          </>
        )}
      />

      <Collapse in={genOpen} unmountOnExit>
        <Panel soft component="section" aria-labelledby="write-one" sx={{ mt: '14px' }}>
          <PanelHead eyebrow="AI" title="Write me a new one" titleId="write-one" />
          <Detail>A prompt written by the configured AI, saved to the bank, and opened to answer.</Detail>
          {generateError && <Alert severity="warning" sx={{ mt: '12px' }}>{generateError}</Alert>}
          <Actions sx={{ mt: '12px' }}>
            <TextField
              label="Topic (optional)"
              placeholder="e.g. rate limiting, chat systems"
              value={genTopic}
              onChange={(e) => setGenTopic(e.target.value)}
              sx={{ flex: '1 1 220px' }}
            />
            <TextField
              select
              label="Difficulty (optional)"
              value={genDifficulty}
              onChange={(e) => setGenDifficulty(e.target.value as QuestionDifficulty | '')}
              sx={{ minWidth: 170 }}
            >
              <MenuItem value="">Any</MenuItem>
              {DIFFICULTIES.map((d) => (
                <MenuItem key={d} value={d} sx={{ textTransform: 'capitalize' }}>{d}</MenuItem>
              ))}
            </TextField>
            <Button
              variant="contained"
              color="ink"
              startIcon={generating ? <CircularProgress size={16} color="inherit" /> : <Sparkles size={16} />}
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? 'Writing…' : 'Write it'}
            </Button>
          </Actions>
        </Panel>
      </Collapse>

      {fetchError && (
        <Alert
          severity="error"
          sx={{ mt: 2 }}
          action={<Button color="inherit" size="small" onClick={() => setAttempt((n) => n + 1)}>Retry</Button>}
        >
          {fetchError}
        </Alert>
      )}

      {prompts === null ? (
        <LoadingState label="Loading prompts…" />
      ) : prompts.length === 0 ? (
        !fetchError && (
          <Panel sx={{ mt: '22px' }}>
            <Detail>
              There are no prompts yet. Write one with AI, or reset the application to restore the built-in set.
            </Detail>
          </Panel>
        )
      ) : (
        <>
          <Tabs
            value={tab}
            onChange={(_, v: string) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            aria-label="Prompt categories"
            sx={{ mt: '22px', mb: '20px', borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab value="all" label={`All prompts (${total})`} />
            {categories.map((c) => <Tab key={c} value={c} label={c} />)}
          </Tabs>

          {total > prompts.length && (
            <Detail sx={{ mb: '12px' }}>Showing the first {prompts.length} of {total} prompts.</Detail>
          )}

          <Grid template="repeat(2, minmax(0,1fr))" aria-label="Prompts">
            {shown.map((p) => {
              const times = answered.get(p.id) ?? 0;
              const footer = [
                `Rubric scored · ${RUBRIC_DIMENSIONS} dimensions`,
                times > 0 ? answeredLabel(times) : null,
              ].filter(Boolean).join(' · ');
              return (
                <Panel
                  key={p.id}
                  component="article"
                  aria-label={p.title}
                  sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                >
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', mb: '8px' }}>
                      <Pill
                        tone={DIFFICULTY_TONE[p.difficulty] ?? 'neutral'}
                        sx={{ fontSize: (t) => t.typography.pxToRem(11), fontWeight: 700, border: '1px solid currentColor', textTransform: 'uppercase' }}
                      >
                        {p.difficulty}
                      </Pill>
                      <Detail component="span" sx={{ fontWeight: 600, textAlign: 'right' }}>
                        {p.category}{p.is_ai_generated ? ' · AI-written' : ''}
                      </Detail>
                    </Box>
                    <Typography variant="h2" sx={{ fontSize: (t) => t.typography.pxToRem(19), fontWeight: 800, lineHeight: 1.35, my: '6px' }}>
                      {p.title}
                    </Typography>
                    <Typography sx={{ fontSize: (t) => t.typography.pxToRem(13), lineHeight: 1.5, mt: '6px' }}>{excerpt(p.prompt_text)}</Typography>
                  </Box>
                  <Box
                    sx={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
                      mt: '16px', pt: '12px', borderTop: '1px solid', borderColor: 'divider',
                    }}
                  >
                    <Detail component="span">{footer}</Detail>
                    <Button
                      variant="contained"
                      color="ink"
                      size="small"
                      onClick={() => navigate(`/system-design/${p.id}/answer`)}
                      aria-label={`Start architecture answer: ${p.title}`}
                    >
                      Start architecture answer →
                    </Button>
                  </Box>
                </Panel>
              );
            })}
          </Grid>
        </>
      )}
    </Box>
  );
};
