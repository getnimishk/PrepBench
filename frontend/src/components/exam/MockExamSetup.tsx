// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Table, TableBody,
  TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import {
  discardExam, getHomeSummary, getMockHistory, getReviewQueue, getRoadmaps, previewExam, startExam,
} from '../../services/api';
import { apiErrorMessage } from '../../services/apiError';
import { mockRequest } from '../../services/practiceRequests';
import type { ExamPreview, MockHistoryItem, QuestionSource } from '../../types/exam';
import type { Resumable, Subject } from '../../types/subject';
import type { ReviewQueue } from '../../types/review';
import type { RoadmapSummary } from '../../types/roadmap';
import {
  Actions, CheckRow, Detail, Eyebrow, Grid, Metric, MetricRow, Note, PageHead, Panel, PanelHead, Pill, Row, Section,
  Sub, type Tone,
} from '../ui/primitives';

/**
 * Exam Setup: the full paper, set up the way the real exam is.
 *
 * The mock takes its length, time and pass mark from the preparation's exam
 * profile, and none of them is a choice here -- a paper the learner shortened is
 * not evidence of anything. What is left to choose is where the questions come
 * from, and every other panel is a fact about the paper or about the learner's
 * evidence, read from the server. Nothing on this page is a placeholder.
 */

const SOURCES: { value: QuestionSource; label: string; detail: string }[] = [
  { value: 'all', label: 'Whole bank', detail: 'every question is eligible' },
  { value: 'not_recent', label: 'Exclude recently seen', detail: 'nothing you answered in the last 7 days' },
  { value: 'unseen', label: 'Unseen only', detail: 'only questions you have never answered' },
];

// Read by a screen reader, not drawn.
// Strings, not numbers: in sx a width of 1 means 100%, which pushed this
// "invisible" label a page-width off the right edge.
const visuallyHidden = {
  position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden',
  clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
} as const;

type StatusTone = 'ok' | 'attention' | 'none';
const TONE_OF: Record<StatusTone, Tone> = { ok: 'success', attention: 'warning', none: 'neutral' };

const minutes = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const daysAgo = (iso?: string | null): string | null => {
  if (!iso) return null;
  const withZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const then = new Date(withZone);
  if (Number.isNaN(then.getTime())) return null;
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
};

/** A preparation with no exam: nothing to mirror, and the page says where to go instead. */
const NoExam: React.FC<{ subject: Subject }> = ({ subject }) => (
  <Box>
    <PageHead
      eyebrow={subject.name}
      title="Exam Setup"
      sub="This preparation has no certification exam behind it, so there is nothing to mirror."
    />
    <Section>
      <Grid columns={2}>
        <Panel>
          <Eyebrow>Why there is no mock</Eyebrow>
          <Typography variant="h5" component="h2">{subject.name} is a skill, not an exam</Typography>
          <Sub sx={{ mb: 0 }}>
            A pass mark only means something when an external body sets it. Progress here is
            measured by practice and analysed answers instead.
          </Sub>
        </Panel>
        <Panel soft>
          <Eyebrow>Use instead</Eyebrow>
          <Row title="Practice" action={<Button component={RouterLink} to="/practice" variant="outlined">Open</Button>} />
          <Row title="Insights" action={<Button component={RouterLink} to="/analytics" variant="outlined">Open</Button>} />
        </Panel>
      </Grid>
    </Section>
  </Box>
);

export const MockExamSetup: React.FC<{ subject: Subject }> = ({ subject }) => {
  if (!subject.has_exam_profile) return <NoExam subject={subject} />;
  return <CertificationSetup subject={subject} />;
};

const CertificationSetup: React.FC<{ subject: Subject }> = ({ subject }) => {
  const navigate = useNavigate();
  const total = subject.exam_question_count ?? 0;
  const passMark = subject.pass_mark ?? 0;

  const [source, setSource] = useState<QuestionSource>('all');
  const [previews, setPreviews] = useState<Partial<Record<QuestionSource, ExamPreview>>>({});
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [openMock, setOpenMock] = useState<Resumable | null>(null);
  const [queue, setQueue] = useState<ReviewQueue | null>(null);
  const [roadmaps, setRoadmaps] = useState<RoadmapSummary[] | null>(null);
  const [history, setHistory] = useState<MockHistoryItem[] | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'start' | 'discard' | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPreviews({});
    setPreviewError(null);
    Promise.all(SOURCES.map((s) => previewExam({ ...mockRequest(subject), question_source: s.value })))
      .then((results) => {
        if (cancelled) return;
        setPreviews(Object.fromEntries(SOURCES.map((s, i) => [s.value, results[i]])));
      })
      .catch((err) => { if (!cancelled) setPreviewError(apiErrorMessage(err, 'Could not check your question bank.')); });

    // Each of these is supporting detail: a failure costs its own panel, not the page.
    getHomeSummary()
      .then((h) => {
        if (cancelled) return;
        const mine = h.per_subject.find((p) => p.subject_id === subject.id)?.resumable ?? null;
        setOpenMock(mine && mine.session_kind === 'mock' ? mine : null);
      })
      .catch(() => { if (!cancelled) setOpenMock(null); });
    getReviewQueue(subject.id)
      .then((q) => { if (!cancelled) setQueue(q); })
      .catch(() => { if (!cancelled) setQueue(null); });
    getRoadmaps()
      .then((r) => { if (!cancelled) setRoadmaps(r.filter((x) => x.subject_id === subject.id)); })
      .catch(() => { if (!cancelled) setRoadmaps(null); });
    getMockHistory(subject.id)
      .then((m) => { if (!cancelled) setHistory(m); })
      .catch(() => { if (!cancelled) setHistory(null); });
    return () => { cancelled = true; };
  }, [subject]);

  const chosen = previews[source];
  const request = useMemo(() => ({ ...mockRequest(subject), question_source: source }), [subject, source]);

  const start = async () => {
    setStarting(true);
    setStartError(null);
    try {
      if (openMock) await discardExam(openMock.session_id);
      const session = await startExam(request);
      navigate(`/exam/${session.id}`);
    } catch (err) {
      setStartError(apiErrorMessage(err, 'Could not start the mock.'));
      setStarting(false);
      setConfirm(null);
    }
  };

  const discard = async () => {
    if (!openMock) return;
    try {
      await discardExam(openMock.session_id);
      setOpenMock(null);
    } catch (err) {
      setStartError(apiErrorMessage(err, 'Could not discard the open mock.'));
    } finally {
      setConfirm(null);
    }
  };

  const roadmapTotals = roadmaps && roadmaps.length > 0
    ? roadmaps.reduce(
      (acc, r) => ({ done: acc.done + r.progress.completed_count, all: acc.all + r.progress.total_topics }),
      { done: 0, all: 0 },
    )
    : null;
  const lastScore = subject.readiness.recent_scores.length
    ? subject.readiness.recent_scores[subject.readiness.recent_scores.length - 1]
    : null;
  const available = previews.all?.available;
  const reviewDebt = queue ? queue.total_unreviewed : null;

  const checks: { label: string; detail: string; status: [StatusTone, string] | null }[] = [
    {
      label: 'Question bank',
      detail: available == null ? 'Checking…' : `${available} available · ${total} needed`,
      status: available == null ? null : available >= total ? ['ok', 'Ready'] : ['attention', 'Too few'],
    },
    {
      label: 'Roadmap',
      detail: roadmaps == null
        ? 'Could not load'
        : roadmapTotals && roadmapTotals.all > 0
          ? `${roadmapTotals.done} / ${roadmapTotals.all} topics complete`
          : 'No roadmap linked to this preparation',
      status: roadmapTotals && roadmapTotals.all > 0
        ? roadmapTotals.done === roadmapTotals.all ? ['ok', 'Complete'] : ['none', 'In progress']
        : null,
    },
    {
      label: 'Review debt',
      detail: queue == null
        ? 'Could not load'
        : `${queue.total_unreviewed} unread miss${queue.total_unreviewed === 1 ? '' : 'es'} · ${queue.spaced_due} due from memory`,
      status: reviewDebt == null ? null : reviewDebt > 0 ? ['attention', 'Attention'] : ['ok', 'Ready'],
    },
    {
      label: 'Last mock',
      detail: subject.readiness.mock_count > 0 && lastScore != null
        ? `${daysAgo(subject.readiness.latest_taken_at) ?? 'earlier'} · ${Math.round(lastScore)}%`
        : 'No mock yet',
      status: subject.readiness.is_stale ? ['attention', 'Out of date'] : subject.readiness.mock_count > 0 ? ['ok', 'Ready'] : null,
    },
  ];

  return (
    <Box>
      <PageHead
        eyebrow={subject.name}
        title="Exam Setup"
        sub="The mock mirrors the exam profile. You do not choose its length, timing or pass mark — that fixed shape is what makes the score usable as evidence."
        actions={(
          <>
            <Detail component="span">{total} questions · {subject.exam_minutes} minutes</Detail>
            <Button component={RouterLink} to="/practice" variant="outlined">Back to practice</Button>
            <Button
              variant="contained"
              color="ink"
              disabled={!chosen?.can_start || starting}
              onClick={() => (openMock ? setConfirm('start') : start())}
            >
              {starting ? 'Starting…' : 'Start mock'}
            </Button>
          </>
        )}
      />

      {startError && <Alert severity="error" sx={{ mt: 2.5 }}>{startError}</Alert>}
      {chosen && !chosen.can_start && <Alert severity="info" sx={{ mt: 2.5 }}>{chosen.reason}</Alert>}

      {openMock && (
        <Section>
          <Note sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <Box>
              <b>A mock is still open</b>
              <Box>
                {openMock.answered} of {openMock.total} answered
                {openMock.seconds_remaining != null && ` · ${minutes(openMock.seconds_remaining)} remaining`}.
                {' '}Starting a new mock discards it.
              </Box>
            </Box>
            <Actions>
              <Button variant="outlined" onClick={() => setConfirm('discard')}>Discard</Button>
              <Button variant="contained" color="ink" onClick={() => navigate(`/exam/${openMock.session_id}`)}>
                Resume mock
              </Button>
            </Actions>
          </Note>
        </Section>
      )}

      <Section>
        <Grid columns={2} sx={{ alignItems: 'start' }}>
          <Panel component="section" aria-labelledby="exam-profile">
            <PanelHead eyebrow="Exam profile" title="What you will sit" titleId="exam-profile" aside={<Pill>Set by the preparation</Pill>} />
            <MetricRow>
              <Metric value={total} label="questions" />
              <Metric value={`${subject.exam_minutes} minutes`} label="time limit" />
              <Metric value={`${passMark}%`} label="pass mark" />
              <Metric value={Math.ceil((total * passMark) / 100)} label="to pass" />
            </MetricRow>
            <Box sx={{ mt: '8px' }}>
              <Row title="Format" detail="Single and multiple choice, as the bank has them" action={<Detail component="span">Fixed</Detail>} middle={<span />} />
              <Row title="Navigation" detail="Move freely, flag and return" action={<Detail component="span">Fixed</Detail>} middle={<span />} />
              <Row title="Negative marking" detail="None" action={<Detail component="span">Fixed</Detail>} middle={<span />} />
            </Box>
            <Detail sx={{ mt: '10px' }}>
              From {subject.name}&apos;s exam profile. Letting you change these here would make the result meaningless as
              readiness evidence; if the real exam changed,{' '}
              <Box component={RouterLink} to={`/preparations/${subject.id}/edit`} sx={{ color: 'primary.main' }}>
                edit the profile
              </Box>.
            </Detail>
          </Panel>

          <Panel component="section" aria-labelledby="readiness-check">
            <PanelHead eyebrow="Readiness check" title="Before you start" titleId="readiness-check" />
            {checks.map((c) => (
              <CheckRow
                key={c.label}
                mark={c.status == null ? null : (
                  <Box component="span" aria-hidden sx={{ color: c.status[0] === 'ok' ? 'success.main' : c.status[0] === 'attention' ? 'warning.main' : 'text.secondary', fontWeight: 800 }}>
                    {c.status[0] === 'ok' ? '✓' : c.status[0] === 'attention' ? '!' : '·'}
                  </Box>
                )}
                aside={c.status && <Pill tone={TONE_OF[c.status[0]]}>{c.status[1]}</Pill>}
              >
                <Typography variant="subtitle2" component="div">{c.label}</Typography>
                <Detail>{c.detail}</Detail>
              </CheckRow>
            ))}
            {reviewDebt != null && reviewDebt > 0 && (
              <Note sx={{ mt: '12px' }}>
                Nothing here blocks you. But misses you have not read tend to come back —{' '}
                <Box component={RouterLink} to="/review" sx={{ color: 'primary.main', fontWeight: 700 }}>review them first</Box>.
              </Note>
            )}
          </Panel>
        </Grid>
      </Section>

      <Section>
        <Grid columns={2} sx={{ alignItems: 'start' }}>
          <Panel component="section" aria-labelledby="question-source">
            <PanelHead eyebrow="What this mock draws from" title="Question source" titleId="question-source" sx={{ mb: '4px' }} />
            <Detail>
              The only real choice on this screen. Drawing only from unseen questions gives a harder, more honest reading.
            </Detail>
            {previewError && <Alert severity="error" sx={{ mt: 2 }}>{previewError}</Alert>}
            <Box sx={{ mt: '6px' }}>
              {SOURCES.map((s) => {
                const p = previews[s.value];
                const selected = source === s.value;
                return (
                  <Box
                    key={s.value}
                    component="button"
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSource(s.value)}
                    // The prototype's .choice.
                    sx={{
                      display: 'block', textAlign: 'left', font: 'inherit', cursor: 'pointer', width: '100%',
                      p: '13px', mt: '8px', borderRadius: '10px', color: 'text.primary',
                      bgcolor: selected ? 'pb.accentSoft' : 'background.paper',
                      border: '1px solid', borderColor: selected ? 'primary.main' : 'divider',
                      '&:hover': { borderColor: 'primary.main' },
                    }}
                  >
                    <Typography variant="subtitle2" component="div">{s.label}</Typography>
                    <Detail>
                      {p ? `${p.can_start ? p.available : 0} questions · ${s.detail}` : `Checking… · ${s.detail}`}
                    </Detail>
                    {p && !p.can_start && (
                      <Detail sx={{ color: 'warning.main', mt: '2px' }}>{p.reason}</Detail>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Panel>

          <Panel component="section" aria-labelledby="domain-weighting">
            <PanelHead eyebrow="Domain weighting" title="In proportion to your bank" titleId="domain-weighting" />
            {!chosen && !previewError && <CircularProgress size={18} sx={{ mt: 1 }} />}
            {chosen?.can_start && (chosen.domain_plan?.length ?? 0) > 0 && (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" aria-label="Questions per domain">
                  <TableHead>
                    <TableRow>
                      <TableCell>Domain</TableCell>
                      <TableCell align="right">In the pool</TableCell>
                      <TableCell align="right">In this mock</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {chosen.domain_plan!.map((d) => (
                      <TableRow key={d.domain}>
                        <TableCell sx={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.domain}>
                          {d.domain}
                        </TableCell>
                        <TableCell align="right">{d.available}</TableCell>
                        <TableCell align="right">{d.will_draw}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
            <Detail sx={{ mt: '12px' }}>
              PrepBench has no official blueprint for this exam, so each domain gets its share of the questions you are
              drawing from, not of your weak areas. A mock that over-sampled your gaps would understate your readiness.
            </Detail>
          </Panel>
        </Grid>
      </Section>

      <Section>
        <Panel component="section" aria-labelledby="exam-conditions">
          <PanelHead eyebrow="Exam conditions" title="How the mock behaves" titleId="exam-conditions" />
          {([
            ['Timer visible', 'Counts down from the start and submits the paper at zero', 'ok', 'On'],
            ['Flag for review', 'Mark questions and come back to them before submitting', 'ok', 'On'],
            ['Pause', 'The real exam has no pause, so neither does this. Leaving the page does not stop the clock.', 'none', 'Off'],
            ['Explanations during the mock', 'In the review, once you submit', 'none', 'Off'],
          ] as const).map(([label, detail, tone, word]) => (
            <Row key={label} title={label} detail={detail} middle={<Pill tone={TONE_OF[tone]}>{word}</Pill>} />
          ))}
        </Panel>
      </Section>

      <Section>
        <Panel component="section" aria-labelledby="mock-history">
          <PanelHead
            eyebrow="History"
            title="Previous mocks"
            titleId="mock-history"
            aside={<Button component={RouterLink} to="/analytics" variant="outlined">See trend</Button>}
          />
          {history == null && <Detail>Could not load your mocks.</Detail>}
          {history && history.length === 0 && <Detail>No mocks sat for {subject.name} yet.</Detail>}
          {history && history.length > 0 && (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small" aria-label="Previous mocks">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Score</TableCell>
                    <TableCell>Result</TableCell>
                    <TableCell align="right">Time used</TableCell>
                    {/* Positioned, so the hidden label is placed (and clipped) inside the
                        table's scroller rather than out on the page. */}
                    <TableCell sx={{ position: 'relative' }}><Box component="span" sx={visuallyHidden}>Actions</Box></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.map((m) => (
                    <TableRow key={m.session_id}>
                      <TableCell>
                        {new Date(/[zZ]$/.test(m.taken_at) ? m.taken_at : `${m.taken_at}Z`)
                          .toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </TableCell>
                      <TableCell align="right">{m.score_percentage != null ? `${Math.round(m.score_percentage)}%` : '—'}</TableCell>
                      <TableCell>
                        {m.passed == null ? 'Recorded' : <Pill tone={m.passed ? 'success' : 'warning'}>{m.passed ? 'Pass' : 'Not yet'}</Pill>}
                      </TableCell>
                      <TableCell align="right">{minutes(m.time_spent_seconds)}</TableCell>
                      <TableCell align="right">
                        <Button component={RouterLink} to={`/exam-review/${m.session_id}`} variant="outlined" size="small">
                          Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </Panel>
      </Section>

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {confirm === 'start' ? 'Start a new mock?' : 'Discard the open mock?'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ lineHeight: 1.6 }}>
            {openMock && `The open mock has ${openMock.answered} of ${openMock.total} answered. `}
            An unfinished mock is not evidence, so nothing you have sat is lost — but its answers
            cannot be brought back.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setConfirm(null)}>Keep it</Button>
          <Button
            variant="contained"
            color="warning"
            disabled={starting}
            onClick={confirm === 'start' ? start : discard}
          >
            {confirm === 'start' ? 'Discard and start' : 'Discard'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
