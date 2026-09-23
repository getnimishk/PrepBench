// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useState, useEffect } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Slider, Button, Chip, Alert, CircularProgress, Collapse, Stack,
} from '@mui/material';
import { PageHead } from '../components/ui/primitives';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { startExam, getQuestionFilters, getSubjects } from '../services/api';
import { usePreparation } from '../context/PreparationContext';
import { ExamMode, SessionKind } from '../types/exam';
import { Subject } from '../types/subject';
import { apiErrorMessage, loadFailed } from '../services/apiError';
import { MockExamSetup } from '../components/exam/MockExamSetup';
import { LoadingState } from '../components/common/States';

/**
 * Mock Exam, and the drill setup that deep links land on.
 *
 * A MOCK is the full paper under exam conditions. It is the only thing that
 * moves readiness, and it takes its shape from the subject's exam profile --
 * the learner does not choose its length, its timer or its pass mark, because
 * the real exam does not let them either. Its setup is MockExamSetup.
 *
 * A DRILL is targeted practice: untimed, and as narrow as you like. Home's
 * "Practise Managing Products with Agility" and "Practise Daily Scrum" land here
 * with the domain or topic in the address, and the drill starts on it -- it used
 * to land on generic practice with the choice silently dropped, which made the
 * sentence on the previous screen false.
 *
 * Both follow the preparation picked in the header. The page used to offer its
 * own Subject menu, so the header could say Databricks while the paper was set
 * up for PSM I. A preparation named in the address is used only when nothing is
 * picked.
 */

/** What a drill can be narrowed to. A mock has no equivalent list by design. */
const DRILL_MODES: { value: ExamMode; label: string; detail: string }[] = [
  { value: 'practice', label: 'Practice', detail: 'The explanation after each question' },
  { value: 'weak_topic', label: 'Weak topics', detail: 'Drawn from what you are getting wrong' },
  { value: 'spaced_repetition', label: 'Due for review', detail: 'What the schedule has brought round' },
];

export const ExamSetupPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const isDrill = searchParams.get('kind') === 'drill';
  const requested = Number(searchParams.get('subject')) || null;
  const { selectedId } = usePreparation();

  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    setLoadError(null);
    getSubjects()
      .then(setSubjects)
      .catch((err) => setLoadError(loadFailed('Could not load your preparations', err)));
  }, [loadAttempt]);

  if (loadError) {
    return <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => setLoadAttempt((n) => n + 1)}>Retry</Button>}>{loadError}</Alert>;
  }
  if (!subjects) {
    return <LoadingState label="Loading your preparations…" />;
  }

  const subject =
    subjects.find((s) => s.id === selectedId)
    ?? subjects.find((s) => s.id === requested)
    ?? subjects.find((s) => s.has_exam_profile)
    ?? subjects[0]
    ?? null;

  if (!subject) {
    return (
      <PageHead
        title="Nothing to sit yet"
        sub="Add a preparation with an exam profile, then import its questions."
        actions={<Button component={RouterLink} to="/preparations/new" variant="contained">Add a preparation</Button>}
      />
    );
  }

  // Keyed by preparation, so switching in the header starts the page afresh
  // rather than carrying one bank's topic choices into another.
  return isDrill
    ? <DrillSetup key={subject.id} subject={subject} />
    : <MockExamSetup key={subject.id} subject={subject} />;
};

const DrillSetup: React.FC<{ subject: Subject }> = ({ subject }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const domainParam = searchParams.get('domain');
  const topicParam = searchParams.get('topic');

  const [drillMode, setDrillMode] = useState<ExamMode>('practice');
  const [selectedTopics, setSelectedTopics] = useState<string[]>(topicParam ? [topicParam] : []);
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(20);
  const [moreOpen, setMoreOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dbTopics, setDbTopics] = useState<string[]>([]);
  const [dbDifficulties, setDbDifficulties] = useState<string[]>([]);

  // The narrowing choices are the preparation's own. Offered from every bank, a
  // PSM I drill could be narrowed to a Databricks topic and match nothing.
  useEffect(() => {
    let cancelled = false;
    getQuestionFilters(subject.id)
      .then((filters) => {
        if (cancelled) return;
        setDbTopics(filters.topics || []);
        setDbDifficulties(filters.difficulties || ['easy', 'medium', 'hard']);
      })
      .catch(() => { /* narrowing is optional; the page works without it */ });
    return () => { cancelled = true; };
  }, [subject.id]);

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const focus = domainParam ?? topicParam;

  const start = async () => {
    setError(null);
    setLoading(true);
    try {
      const session = await startExam({
        title: focus ? `${focus} — drill` : `${subject.name} — drill`,
        exam_mode: drillMode,
        domains: domainParam ? [domainParam] : undefined,
        topics: selectedTopics.length ? selectedTopics : undefined,
        difficulties: selectedDifficulties.length ? selectedDifficulties : undefined,
        total_questions: totalQuestions,
        // A drill is untimed. Timing is what makes a mock a measurement.
        time_allowed_minutes: undefined,
        passing_percentage: subject.pass_mark ?? 70,
        randomize_questions: true,
        session_kind: 'drill' as SessionKind,
        subject_id: subject.id,
      });
      navigate(`/exam/${session.id}`);
    } catch (err) {
      // The server refuses to widen a selection that matches nothing and says
      // which selection it was, so its message beats anything generic here.
      setError(apiErrorMessage(err, 'Could not start this drill.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 820 }}>
      <PageHead
        eyebrow={`Focused practice · ${subject.name}`}
        title={focus ?? 'What do you want to practise?'}
        sub="Drills close gaps; they do not measure. The mock is the measurement."
        sx={{ mb: '28px' }}
      />

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Stack spacing={2.5} sx={{ mb: 4 }}>
        <Choice
          title={focus ? `Drill ${focus}` : 'Practise'}
          detail={focus
            ? `${totalQuestions} questions from this area alone, untimed, with the explanation as you go.`
            : `${totalQuestions} questions, untimed, with the explanation after each one. `
              + 'Drills close gaps; they do not measure.'}
          primary
          disabled={loading}
          onClick={start}
        />
        {subject.has_exam_profile && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Want the measurement instead?{' '}
            <Box component={RouterLink} to="/exam-setup" sx={{ color: 'primary.main' }}>Set up a mock</Box>.
          </Typography>
        )}
      </Stack>

      {/* Advanced configuration is available and secondary. Seven controls at
          equal weight above a start button is what made this an admin form. */}
      <Button
        variant="text"
        onClick={() => setMoreOpen((o) => !o)}
        endIcon={moreOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        aria-expanded={moreOpen}
      >
        More options
      </Button>

      <Collapse in={moreOpen} unmountOnExit>
        <Box sx={{ mt: 3 }}>
          <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>Where the questions come from</Typography>
          <Stack spacing={1} sx={{ mb: 3 }}>
            {DRILL_MODES.map((m) => (
              <Box
                key={m.value}
                component="button"
                type="button"
                onClick={() => setDrillMode(m.value)}
                aria-pressed={drillMode === m.value}
                // The prototype's .choice.
                sx={{
                  textAlign: 'left', cursor: 'pointer', font: 'inherit', width: '100%',
                  p: '13px', borderRadius: '10px', border: 1,
                  bgcolor: drillMode === m.value ? 'pb.accentSoft' : 'background.paper',
                  borderColor: drillMode === m.value ? 'primary.main' : 'divider',
                  color: 'text.primary',
                  '&:hover': { borderColor: 'primary.main' },
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: drillMode === m.value ? 600 : 400 }}>
                  {m.label}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>{m.detail}</Typography>
              </Box>
            ))}
          </Stack>

          <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
            Questions: <Chip label={totalQuestions} size="small" />
          </Typography>
          <Slider
            value={totalQuestions}
            onChange={(_, v) => setTotalQuestions(v as number)}
            min={5}
            max={100}
            step={5}
            aria-label="Number of questions"
            sx={{ mb: 3 }}
          />

          <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>Difficulty</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
            {(dbDifficulties.length ? dbDifficulties : ['easy', 'medium', 'hard']).map((d) => (
              <Chip
                key={d}
                label={d}
                clickable
                variant={selectedDifficulties.includes(d) ? 'filled' : 'outlined'}
                color={selectedDifficulties.includes(d) ? 'primary' : 'default'}
                onClick={() => setSelectedDifficulties((prev) => toggle(prev, d))}
              />
            ))}
          </Box>

          {dbTopics.length > 0 && (
            <>
              <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                Topics {selectedTopics.length > 0 && `(${selectedTopics.length} selected)`}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', maxHeight: 170, overflowY: 'auto' }}>
                {dbTopics.map((t) => (
                  <Chip
                    key={t}
                    label={t}
                    size="small"
                    clickable
                    variant={selectedTopics.includes(t) ? 'filled' : 'outlined'}
                    color={selectedTopics.includes(t) ? 'primary' : 'default'}
                    onClick={() => setSelectedTopics((prev) => toggle(prev, t))}
                  />
                ))}
              </Box>
            </>
          )}
        </Box>
      </Collapse>

      {loading && (
        <Stack direction="row" spacing={1.5} sx={{ mt: 3, alignItems: 'center' }}>
          <CircularProgress size={16} />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>Assembling the drill…</Typography>
        </Stack>
      )}
    </Box>
  );
};

/**
 * One intent, stated as what happens rather than as a setting.
 *
 * A bordered row rather than a card: it needs an edge to be a target, and
 * nothing more than an edge.
 */
const Choice: React.FC<{
  title: string;
  detail: string;
  primary: boolean;
  disabled: boolean;
  onClick: () => void;
}> = ({ title, detail, primary, disabled, onClick }) => (
  <Box
    component="button"
    type="button"
    onClick={onClick}
    disabled={disabled}
    // The prototype's .panel as a target: 13px corners, 20px in, the accent edge
    // on the one to press.
    sx={{
      display: 'block', width: '100%', textAlign: 'left', font: 'inherit', cursor: 'pointer',
      p: '20px', borderRadius: '13px',
      border: 1,
      borderColor: primary ? 'primary.main' : 'divider',
      bgcolor: primary ? 'pb.accentSoft' : 'background.paper',
      color: 'text.primary',
      '&:hover': { borderColor: 'primary.main' },
      '&:disabled': { opacity: 0.5, cursor: 'default' },
    }}
  >
    <Typography variant="h6" component="span" sx={{ display: 'block' }}>{title}</Typography>
    <Typography variant="body1" sx={{ color: 'text.secondary', mt: '4px' }}>
      {detail}
    </Typography>
  </Box>
);
