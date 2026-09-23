// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import type { CertificationGoal, DailyGoals as DailyGoalsData, InterviewGoal } from '../../types/subject';
import { Actions, Bar, BigFigure, Detail, Grid, Metric, MetricRow, Panel, PanelHead, Pill } from '../ui/primitives';

/**
 * The two standing daily goals: certification practice and interview practice.
 *
 * Both numbers are derived by the server from the rows that caused them, so
 * nothing here counts anything -- it only says what the server measured.
 *
 * The wording carries the design. Home previously refused a daily goal outright,
 * because the one it had was a streak and a goal ring: a quota that turns a quiet
 * day into a failure. These are not that. The certification goal is what the
 * schedule has due, capped, and says so; a day with nothing due is described as
 * the system working. The interview goal is a flat target and admits that nothing
 * yet models which round has gone stale.
 *
 * Drawn as the prototype's Today strip: two panels, each a head with its state,
 * the count at 30px, the bar, the ways on, and the sentence that says what the
 * number is.
 */

const ROUND_LABELS: Record<string, string> = {
  hr_screening: 'HR screening',
  hiring_manager: 'Hiring manager',
  system_design: 'System design',
  behavioral: 'Behavioural',
};

const Count: React.FC<{ done: number; target: number; unit: string }> = ({ done, target, unit }) => (
  <Box>
    <BigFigure size={30}>{done} / {target}</BigFigure>
    <Detail>{unit}</Detail>
    <Bar
      // A zero target is a finished day, not an empty bar that looks like no progress.
      value={target > 0 ? Math.round((done / target) * 100) : 100}
      label={`${done} of ${target} done`}
      sx={{ mt: '10px' }}
    />
  </Box>
);

const CertificationPanel: React.FC<{ goal: CertificationGoal }> = ({ goal }) => {
  const navigate = useNavigate();
  const pill =
    goal.state === 'nothing_due' ? <Pill tone="success">Nothing due</Pill>
      : goal.state === 'done' ? <Pill tone="success">Done</Pill>
        : goal.state === 'in_progress' ? <Pill tone="warning">In progress</Pill>
          : <Pill tone="warning">Not started</Pill>;

  const reviewPending = goal.state === 'not_started' || goal.state === 'in_progress';

  return (
    <Panel component="section" aria-labelledby="goal-certification-title" data-testid="goal-certification">
      <PanelHead eyebrow="Today’s goal · 1" title="Certification practice" titleId="goal-certification-title" aside={pill} />
      <Count
        done={goal.done}
        target={goal.target}
        unit={`questions to review today · ${goal.subject_name}`}
      />

      <Actions sx={{ mt: '14px' }}>
        {reviewPending && (
          <Button variant="contained" onClick={() => navigate('/review?start=1')}>
            {goal.done > 0 ? 'Continue review' : 'Start review'}
          </Button>
        )}
        {goal.weakest_area && (
          <Button
            variant="outlined"
            onClick={() => navigate(
              `/exam-setup?kind=drill&subject=${goal.subject_id}&domain=${encodeURIComponent(goal.weakest_area ?? '')}`,
            )}
            sx={{ maxWidth: '100%', whiteSpace: 'normal', textAlign: 'left', height: 'auto' }}
          >
            Practise {goal.weakest_area}
          </Button>
        )}
        <Button variant="outlined" onClick={() => navigate(`/exam-setup?kind=mock&subject=${goal.subject_id}`)}>
          Mock exam
        </Button>
      </Actions>

      <Detail sx={{ mt: '11px' }}>
        {goal.target > 0
          ? `Your goal is what the schedule says is due, capped at ${goal.daily_cap} a day — not a quota.`
          : 'Nothing is due. That is the system working, not a missed day.'}
        {goal.queued_beyond_today > 0 && ` ${goal.queued_beyond_today} more are queued behind today.`}
      </Detail>
    </Panel>
  );
};

/** A rubric percentage, or a plain statement that there is none. */
const signal = (value?: number | null) => (value == null ? 'not analysed yet' : `${Math.round(value)}%`);

const InterviewPanel: React.FC<{ goal: InterviewGoal }> = ({ goal }) => {
  const navigate = useNavigate();
  const done = goal.state === 'done';
  const round = goal.longest_since_round ? ROUND_LABELS[goal.longest_since_round] ?? goal.longest_since_round : null;

  return (
    <Panel component="section" aria-labelledby="goal-interview-title" data-testid="goal-interview">
      <PanelHead
        eyebrow="Today’s goal · 2"
        title="Interview practice"
        titleId="goal-interview-title"
        aside={done ? <Pill tone="success">Done</Pill> : <Pill tone="warning">Not started</Pill>}
      />
      <Count done={goal.done} target={goal.target} unit="recorded answer today" />

      <MetricRow sx={{ mt: '10px', gap: '22px' }}>
        <Metric value={signal(goal.latest_content_signal)} label="latest content" sx={{ '& strong': { fontSize: (t) => t.typography.pxToRem(14) } }} />
        <Metric value={signal(goal.latest_delivery_signal)} label="latest delivery" sx={{ '& strong': { fontSize: (t) => t.typography.pxToRem(14) } }} />
      </MetricRow>

      <Actions sx={{ mt: '14px' }}>
        <Button variant={done ? 'outlined' : 'contained'} onClick={() => navigate('/interview-practice')}>
          {done ? 'Another round' : 'Practise a round'}
        </Button>
        <Button variant="outlined" onClick={() => navigate('/system-design')}>System design</Button>
        <Button variant="outlined" onClick={() => navigate('/recordings')}>Recordings</Button>
      </Actions>

      <Detail sx={{ mt: '11px' }}>
        {round && (goal.longest_since_round_never_practised
          ? `You have not practised a ${round} round yet. `
          : `${round} is the round you practised longest ago. `)}
        A flat daily target — there is no decay model yet, so nothing here can tell
        you which round has gone stale.
      </Detail>
    </Panel>
  );
};

export const DailyGoals: React.FC<{ goals: DailyGoalsData }> = ({ goals }) => (
  <Grid
    component="section"
    aria-label="Today's goals"
    columns={2}
    template={goals.certification ? 'minmax(0,1fr) minmax(0,1fr)' : 'minmax(0,1fr)'}
  >
    {goals.certification && <CertificationPanel goal={goals.certification} />}
    <InterviewPanel goal={goals.interview} />
  </Grid>
);
