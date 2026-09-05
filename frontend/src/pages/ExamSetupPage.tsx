// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Typography, TextField, MenuItem, Slider, Button, Chip, Alert,
  CircularProgress, Collapse, Stack,
} from '@mui/material';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { startExam, getQuestionFilters, getSubjects } from '../services/api';
import { ExamMode, SessionKind } from '../types/exam';
import { Subject } from '../types/subject';
import { apiErrorMessage } from '../services/apiError';

/**
 * "I want to practise", not "I am configuring an exam engine".
 *
 * A MOCK is the full paper under exam conditions. It is the only thing that
 * moves readiness, and it takes its shape from the subject's exam profile --
 * the learner does not choose its length, its timer or its pass mark, because
 * the real exam does not let them either.
 *
 * A DRILL is targeted practice: untimed, and as narrow as you like.
 *
 * Two corrections landed here. The first replaced five "exam modes" at equal
 * weight above seven controls, and started sending session_kind at all -- so
 * every session the browser could create had been a drill, and readiness
 * could never leave "needs evaluation" however many full papers were sat.
 *
 * The second removed the last piece of configuration-first thinking: the
 * page opened on a subject dropdown and a mode toggle even when the link
 * that brought you here had already said both. Arriving from "Practise
 * Managing Products with Agility" now starts on that domain, filtered, one
 * button from beginning -- it used to land on generic practice with the
 * domain silently dropped, which made the sentence on the previous screen
 * false.
 */

/** What a drill can be narrowed to. A mock has no equivalent list by design. */
const DRILL_MODES: { value: ExamMode; label: string; detail: string }[] = [
  { value: 'practice', label: 'Practice', detail: 'The explanation after each question' },
  { value: 'weak_topic', label: 'Weak topics', detail: 'Drawn from what you are getting wrong' },
  { value: 'spaced_repetition', label: 'Due for review', detail: 'What the schedule has brought round' },
];

export const ExamSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const kindParam = searchParams.get('kind');
  const domainParam = searchParams.get('domain');

  const [kind, setKind] = useState<SessionKind>(kindParam === 'mock' ? 'mock' : 'drill');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState<number | ''>('');

  const [drillMode, setDrillMode] = useState<ExamMode>('practice');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(20);
  const [moreOpen, setMoreOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dbTopics, setDbTopics] = useState<string[]>([]);
  const [dbDifficulties, setDbDifficulties] = useState<string[]>([]);

  useEffect(() => {
    getSubjects()
      .then((all) => {
        setSubjects(all);
        const requested = Number(searchParams.get('subject'));
        const wanted =
          all.find((s) => s.id === requested)
          ?? all.find((s) => s.has_exam_profile)
          ?? all[0];
        if (wanted) setSubjectId(wanted.id);
      })
      .catch(() => setError('Could not load your subjects.'));

    getQuestionFilters()
      .then((filters) => {
        setDbTopics(filters.topics || []);
        setDbDifficulties(filters.difficulties || ['easy', 'medium', 'hard']);
      })
      .catch(() => { /* narrowing is optional; the page works without it */ });
    // Runs once. searchParams is read for its initial value only -- reacting
    // to it would reset a choice the learner had since made by hand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subject = subjects.find((s) => s.id === subjectId) ?? null;
  const canMock = !!subject?.has_exam_profile;
  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const start = async (chosen: SessionKind) => {
    setError(null);
    if (!subject) { setError('Choose a subject first.'); return; }
    setKind(chosen);
    setLoading(true);
    try {
      // The mock takes every parameter from the exam profile; the drill takes
      // them from the learner. Neither reads a default the other one set,
      // which is what stops a 20-question warm-up being recorded against an
      // 80-question pass mark.
      const req = chosen === 'mock'
        ? {
          title: `${subject.name} — full mock`,
          exam_mode: 'timed' as ExamMode,
          total_questions: subject.exam_question_count ?? 80,
          time_allowed_minutes: subject.exam_minutes ?? 60,
          passing_percentage: subject.pass_mark ?? 85,
          randomize_questions: true,
          session_kind: 'mock' as SessionKind,
          subject_id: subject.id,
        }
        : {
          title: domainParam ? `${domainParam} — drill` : `${subject.name} — drill`,
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
        };

      const session = await startExam(req);
      navigate(`/exam/${session.id}`);
    } catch (err) {
      // The server refuses to widen a selection that matches nothing and says
      // which selection it was, so its message beats anything generic here.
      setError(apiErrorMessage(err, 'Could not start this exam.'));
    } finally {
      setLoading(false);
    }
  };

  if (subjects.length === 0 && !error) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ maxWidth: 640 }}>
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary', letterSpacing: '0.08em',
          textTransform: 'uppercase', fontSize: 12, fontWeight: 500,
        }}
      >
        {subject?.name ?? 'Practice'}
      </Typography>
      <Typography variant="h4" sx={{ fontWeight: 600, mt: 0.5, mb: 4 }}>
        {domainParam ? domainParam : 'What do you want to do?'}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* The one you were sent here to do comes first. Arriving from
          "Practise Managing Products with Agility" and finding "Take a
          mock" at the top is the screen disagreeing with the button that
          opened it. */}
      <Stack spacing={2.5} sx={{ mb: 4 }}>
        {[
          ...(canMock ? [{
            key: 'mock' as SessionKind,
            title: 'Take a mock',
            detail: `${subject?.exam_question_count} questions, ${subject?.exam_minutes} minutes, `
              + 'timed. The only thing that moves your readiness.',
            primary: !domainParam,
          }] : []),
          {
            key: 'drill' as SessionKind,
            title: domainParam ? `Drill ${domainParam}` : 'Practise',
            detail: domainParam
              ? `${totalQuestions} questions from this area alone, untimed, `
                + 'with the explanation as you go.'
              : `${totalQuestions} questions, untimed, with the explanation after each one. `
                + 'Drills close gaps; they do not measure.',
            primary: !!domainParam || !canMock,
          },
        ]
          .sort((a, b) => Number(b.primary) - Number(a.primary))
          .map((c) => (
            <Choice
              key={c.key}
              title={c.title}
              detail={c.detail}
              primary={c.primary}
              disabled={loading}
              onClick={() => start(c.key)}
            />
          ))}
      </Stack>

      {/* Advanced configuration is available and secondary. Seven controls at
          equal weight above a start button is what made this an admin form. */}
      <Button
        size="small"
        onClick={() => setMoreOpen((o) => !o)}
        endIcon={moreOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        aria-expanded={moreOpen}
        sx={{ textTransform: 'none' }}
      >
        More options
      </Button>

      <Collapse in={moreOpen} unmountOnExit>
        <Box sx={{ mt: 3 }}>
          {subjects.length > 1 && (
            <TextField
              select
              fullWidth
              size="small"
              label="Subject"
              value={subjectId}
              onChange={(e) => setSubjectId(Number(e.target.value))}
              sx={{ mb: 3 }}
            >
              {subjects.map((s) => (
                <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
              ))}
            </TextField>
          )}

          <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>Where the questions come from</Typography>
          <Stack spacing={1} sx={{ mb: 3 }}>
            {DRILL_MODES.map((m) => (
              <Box
                key={m.value}
                component="button"
                type="button"
                onClick={() => setDrillMode(m.value)}
                aria-pressed={drillMode === m.value}
                sx={{
                  textAlign: 'left', cursor: 'pointer', font: 'inherit', width: '100%',
                  px: 2, py: 1.1, borderRadius: 2, bgcolor: 'transparent', border: 1,
                  borderColor: drillMode === m.value ? 'primary.main' : 'divider',
                  color: 'text.primary',
                  '&:hover': { bgcolor: 'action.hover' },
                  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
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
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Assembling {kind === 'mock' ? 'the paper' : 'the drill'}…
          </Typography>
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
    sx={{
      display: 'block', width: '100%', textAlign: 'left', font: 'inherit', cursor: 'pointer',
      px: 2.5, py: 2, borderRadius: 2,
      border: 1,
      borderColor: primary ? 'primary.main' : 'divider',
      bgcolor: primary ? 'action.hover' : 'transparent',
      color: 'text.primary',
      '&:hover': { borderColor: 'primary.main' },
      '&:disabled': { opacity: 0.5, cursor: 'default' },
      '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
    }}
  >
    <Typography variant="body1" sx={{ fontWeight: 600 }}>{title}</Typography>
    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25, lineHeight: 1.55 }}>
      {detail}
    </Typography>
  </Box>
);
