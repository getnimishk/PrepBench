// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Alert, Autocomplete, Box, Button, CircularProgress, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import {
  getFocusTopics, getQuestionFilters, getSpacedDeck, previewExam, startExam,
} from '../../services/api';
import { apiErrorMessage } from '../../services/apiError';
import {
  compositionText, customRequest, mockRequest, weakTopicRequest,
} from '../../services/practiceRequests';
import type { ExamCreateRequest, ExamPreview } from '../../types/exam';
import type { FocusTopic, Subject } from '../../types/subject';
import type { SpacedDeck } from '../../types/spaced';
import {
  Actions, BigFigure, Detail, Eyebrow, Good, Grid, Metric, MetricRow, Note, Panel, Row, Sub,
} from '../ui/primitives';

/**
 * The practice formats, each one a real session.
 *
 * Every panel previews the exact request it will start: the same selection the
 * exam engine runs, so a count shown here is the pool the session draws from,
 * and a format the engine would refuse says why before the button is pressed
 * rather than after. Nothing on these panels is a placeholder number.
 *
 * Laid out as the prototype's practice tabs: a panel with an eyebrow and a
 * title, the figures in a metric row, the one way to start.
 */

const Title: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography variant="h5" component="h2" sx={{ mt: '2px' }}>{children}</Typography>
);

/**
 * The preview for a request, kept current as the request changes.
 *
 * Keyed on the request's JSON so a new object with the same content does not
 * refetch, and debounced because Custom changes it on every keystroke.
 */
function usePreview(req: ExamCreateRequest | null) {
  const key = req ? JSON.stringify(req) : null;
  const [state, setState] = useState<{
    key: string | null; preview: ExamPreview | null; error: string | null;
  }>({ key: null, preview: null, error: null });

  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;
    const handle = setTimeout(() => {
      previewExam(JSON.parse(key) as ExamCreateRequest)
        .then((preview) => { if (!cancelled) setState({ key, preview, error: null }); })
        .catch((err) => {
          if (!cancelled) {
            setState({
              key, preview: null,
              error: apiErrorMessage(err, 'Could not check what this session would draw.'),
            });
          }
        });
    }, 250);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [key]);

  const current = state.key === key;
  return {
    loading: key !== null && !current,
    preview: current ? state.preview : null,
    error: current ? state.error : null,
  };
}

function useStart() {
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = async (req: ExamCreateRequest) => {
    setStarting(true);
    setError(null);
    try {
      const session = await startExam(req);
      navigate(`/exam/${session.id}`);
    } catch (err) {
      // The engine's refusal names the reason; it is worth more than a generic line.
      setError(apiErrorMessage(err, 'Could not start this session.'));
      setStarting(false);
    }
  };
  return { start, starting, error };
}

const Checking: React.FC = () => (
  <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', mt: 2 }}>
    <CircularProgress size={16} />
    <Detail component="span">Checking your bank…</Detail>
  </Stack>
);

/** The pool, by what your own answers say about it. Four numbers, all counted. */
export const Composition: React.FC<{ preview: ExamPreview }> = ({ preview }) => (
  <MetricRow>
    <Metric value={preview.previously_missed} label="missed before" />
    <Metric value={preview.due_for_review} label="due for review" />
    <Metric value={preview.never_attempted} label="never attempted" />
    <Metric value={preview.answered_correctly} label="right every time" />
  </MetricRow>
);

// ---- weak topic focus -------------------------------------------------------

export const WeakTopicFocus: React.FC<{ subject: Subject }> = ({ subject }) => {
  const req = useMemo(() => weakTopicRequest(subject), [subject]);
  const { preview, loading, error } = usePreview(req);
  const { start, starting, error: startError } = useStart();
  const [topics, setTopics] = useState<FocusTopic[]>([]);

  useEffect(() => {
    let cancelled = false;
    getFocusTopics(subject.id)
      .then((t) => { if (!cancelled) setTopics(t); })
      .catch(() => { if (!cancelled) setTopics([]); });
    return () => { cancelled = true; };
  }, [subject.id]);

  return (
    <Grid columns={2} sx={{ alignItems: 'start' }}>
      <Panel component="section" aria-label="Focused practice">
        <Eyebrow>Focused practice</Eyebrow>
        {loading && <Checking />}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {preview && !preview.can_start && (
          <>
            <Title>Nothing to focus on yet</Title>
            <Sub sx={{ mb: 0 }}>{preview.reason}</Sub>
          </>
        )}
        {preview?.can_start && (
          <>
            <Title>{preview.will_draw} questions from your weakest topics</Title>
            <Sub sx={{ mb: 0 }}>
              Drawn at random from the {preview.available} {subject.name} questions in topics your
              mocks put under 70%: {compositionText(preview)}.
            </Sub>
            <Composition preview={preview} />
            <Actions sx={{ mt: '16px' }}>
              <Button variant="contained" disabled={starting} onClick={() => start(req)}>
                {starting ? 'Starting…' : `Start ${preview.will_draw} questions`}
              </Button>
            </Actions>
          </>
        )}
        {startError && <Alert severity="error" sx={{ mt: 2 }}>{startError}</Alert>}
      </Panel>

      {topics.length > 0 && (
        <Panel component="section" aria-label="Where the questions come from">
          {/* The prototype lists the first five questions. A weak-topic set is
              drawn at random when it starts, so there is no first five to show
              beforehand; the topics it draws from are what is known. */}
          <Eyebrow>Where the questions come from</Eyebrow>
          <Box sx={{ mt: '4px' }}>
            {topics.slice(0, 5).map((t) => (
              <Row
                key={t.topic}
                title={<Typography component="span" sx={{ fontWeight: 600 }} title={t.topic}>{t.topic}</Typography>}
                action={<Detail component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>{t.correct} / {t.answered}</Detail>}
                sx={{ py: '10px' }}
              />
            ))}
          </Box>
          <Detail sx={{ mt: '8px' }}>Correct out of answered, in your mocks only.</Detail>
        </Panel>
      )}
    </Grid>
  );
};

// ---- spaced repetition --------------------------------------------------------

export const SpacedRepetition: React.FC<{ subject: Subject }> = ({ subject }) => {
  const navigate = useNavigate();
  const [deck, setDeck] = useState<SpacedDeck | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDeck(null);
    setError(null);
    getSpacedDeck(subject.id)
      .then((d) => { if (!cancelled) setDeck(d); })
      .catch((err) => { if (!cancelled) setError(apiErrorMessage(err, 'Could not check what is due.')); })
    return () => { cancelled = true; };
  }, [subject.id]);

  return (
    <Panel component="section" aria-label="Spaced repetition" sx={{ maxWidth: 820 }}>
      <Eyebrow>Spaced repetition</Eyebrow>
      {!deck && !error && <Checking />}
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      {deck && (
        <>
          <BigFigure size={34}>{deck.due_total} due today</BigFigure>
          <Sub sx={{ mt: '6px', mb: 0 }}>
            Questions you have answered before, brought round again on the schedule. Recall each
            one before revealing it, then grade how well it came back; your grade sets when it returns.
          </Sub>
          <Note sx={{ mt: '14px' }}>Reading an explanation alone does not count as verified learning.</Note>
          {deck.cards.length > 0 ? (
            <Actions sx={{ mt: '16px' }}>
              <Button variant="contained" onClick={() => navigate('/practice/spaced')}>
                Review {deck.cards.length} now
              </Button>
            </Actions>
          ) : (
            <Good sx={{ mt: '14px' }}>Nothing is due. That is the system working, not a missed day.</Good>
          )}
        </>
      )}
    </Panel>
  );
};

// ---- custom -------------------------------------------------------------------

const MAX_CUSTOM = 50;

export const CustomPractice: React.FC<{ subject: Subject }> = ({ subject }) => {
  const [domain, setDomain] = useState('');
  const [topic, setTopic] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState('');
  const [countText, setCountText] = useState('10');
  const [options, setOptions] = useState<{ domains: string[]; topics: string[]; difficulties: string[] } | null>(null);
  const { start, starting, error: startError } = useStart();

  // The choices are this preparation's own. Offered from every bank, a PSM I set
  // could be narrowed to a Databricks domain and then match nothing.
  useEffect(() => {
    let cancelled = false;
    setDomain('');
    setTopic(null);
    setDifficulty('');
    getQuestionFilters(subject.id)
      .then((f) => {
        if (!cancelled) setOptions({ domains: f.domains ?? [], topics: f.topics ?? [], difficulties: f.difficulties ?? [] });
      })
      .catch(() => { if (!cancelled) setOptions({ domains: [], topics: [], difficulties: [] }); });
    return () => { cancelled = true; };
  }, [subject.id]);

  const parsed = Number.parseInt(countText, 10);
  const countValid = Number.isFinite(parsed) && parsed >= 1 && parsed <= MAX_CUSTOM;
  const req = useMemo(
    () => (countValid ? customRequest(subject, { domain, topic: topic || undefined, difficulty, count: parsed }) : null),
    [subject, domain, topic, difficulty, parsed, countValid],
  );
  const { preview, loading, error } = usePreview(req);

  return (
    <Panel component="section" aria-label="Custom practice">
      <Eyebrow>Custom practice</Eyebrow>
      <Title>Build a focused set</Title>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.2fr 1.8fr 1fr 1fr' }, gap: '13px', mt: '16px' }}>
        <TextField
          select
          label="Domain"
          value={domain}
          // Shows "All domains" / "Mixed" when nothing is chosen, rather than an
          // empty box that reads as unanswered.
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
          onChange={(e) => setDomain(e.target.value)}
        >
          <MenuItem value="">All domains</MenuItem>
          {(options?.domains ?? []).map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
        </TextField>
        <Autocomplete
          options={options?.topics ?? []}
          value={topic}
          onChange={(_, val) => setTopic(val)}
          autoHighlight
          clearOnEscape
          openOnFocus
          filterOptions={(opts, state) => {
            const query = state.inputValue.trim().toLowerCase();
            if (!query) return opts;
            const tokens = query.split(/\s+/).filter(Boolean);
            return opts.filter((opt) => {
              const text = opt.toLowerCase();
              return tokens.every((t) => text.includes(t));
            });
          }}
          noOptionsText="No topics found"
          renderInput={(params) => (
            <TextField
              {...params}
              label="Topic"
              placeholder="All topics"
              slotProps={{
                ...params.slotProps,
                inputLabel: {
                  ...params.slotProps?.inputLabel,
                  shrink: true,
                },
              }}
            />
          )}
        />
        <TextField
          select
          label="Difficulty"
          value={difficulty}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
          onChange={(e) => setDifficulty(e.target.value)}
        >
          <MenuItem value="">Mixed</MenuItem>
          {(options?.difficulties ?? []).map((d) => (
            <MenuItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</MenuItem>
          ))}
        </TextField>
        <TextField
          label="Question count"
          type="number"
          value={countText}
          onChange={(e) => setCountText(e.target.value)}
          error={!countValid}
          helperText={countValid ? ' ' : `A whole number from 1 to ${MAX_CUSTOM}`}
          slotProps={{ htmlInput: { min: 1, max: MAX_CUSTOM, inputMode: 'numeric' }, inputLabel: { shrink: true } }}
        />
      </Box>

      <Box aria-live="polite">
        {loading && <Checking />}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {preview && !preview.can_start && (
          <Note sx={{ mt: '8px' }}>{preview.reason}</Note>
        )}
        {preview?.can_start && (
          <>
            <Good sx={{ mt: '8px' }}>
              <strong>{preview.will_draw} questions</strong> will be drawn from the {preview.available} that
              match: {compositionText(preview)}.
            </Good>
            <Composition preview={preview} />
          </>
        )}
      </Box>

      <Actions sx={{ mt: '16px' }}>
        <Button
          variant="contained"
          disabled={!req || !preview?.can_start || loading || starting}
          onClick={() => req && start(req)}
        >
          {starting ? 'Starting…' : 'Start set'}
        </Button>
      </Actions>
      {startError && <Alert severity="error" sx={{ mt: 2 }}>{startError}</Alert>}
    </Panel>
  );
};

// ---- full mock ------------------------------------------------------------------

export const FullMock: React.FC<{ subject: Subject }> = ({ subject }) => {
  const req = useMemo(() => (subject.has_exam_profile ? mockRequest(subject) : null), [subject]);
  const { preview, loading, error } = usePreview(req);
  const { start, starting, error: startError } = useStart();

  if (!subject.has_exam_profile) {
    return (
      <Panel component="section" aria-label="Full mock" sx={{ maxWidth: 820 }}>
        <Eyebrow>Full mock</Eyebrow>
        <Title>{subject.name} has no exam</Title>
        <Sub sx={{ mb: 0 }}>
          A pass mark only means something when an external body sets it, so this preparation is
          practised rather than sat.
        </Sub>
      </Panel>
    );
  }

  return (
    <Panel component="section" aria-label="Full mock" sx={{ maxWidth: 820 }}>
      <Eyebrow>Full mock</Eyebrow>
      <Title>{subject.name}</Title>
      <MetricRow>
        <Metric value={subject.exam_question_count ?? '—'} label="questions" />
        <Metric value={subject.exam_minutes != null ? `${subject.exam_minutes} minutes` : '—'} label="time" />
        <Metric value={subject.pass_mark != null ? `${subject.pass_mark}%` : '—'} label="pass mark" />
      </MetricRow>
      <Note sx={{ mt: '14px' }}>
        A full mock is the readiness measurement: timed, and drawn at random from the whole
        {' '}{subject.name} bank rather than from your weak areas.
      </Note>

      {loading && <Checking />}
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      {preview && !preview.can_start && <Alert severity="info" sx={{ mt: 2 }}>{preview.reason}</Alert>}

      <Actions sx={{ mt: '14px' }}>
        <Button component={RouterLink} to={`/exam-setup?kind=mock&subject=${subject.id}`} variant="outlined">
          Exam setup
        </Button>
        <Button
          variant="contained"
          color="ink"
          disabled={!preview?.can_start || starting}
          onClick={() => req && start(req)}
        >
          {starting ? 'Starting…' : 'Start full mock'}
        </Button>
      </Actions>
      {startError && <Alert severity="error" sx={{ mt: 2 }}>{startError}</Alert>}
    </Panel>
  );
};
