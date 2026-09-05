// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Typography, Button, CircularProgress, Stack, Divider } from '@mui/material';
import { getHomeSummary, getSubjects } from '../services/api';
import { HomeSummary, Subject } from '../types/subject';

/**
 * Practice and Learn.
 *
 * These pages used to be identical lists of doors -- a card, a divider, a row
 * per destination, an "Open" button. That is a directory, and the sidebar was
 * already the directory. Practice now leads with what you were already doing,
 * then with what your evidence points at, and only then with the list of
 * formats.
 *
 * The second correction fixed the part that was still a lie: "Practise this"
 * under a named weakness went to a generic setup form with the weakness
 * dropped, so the one button on the page did not do what it said. The domain
 * now travels with the link, and the setup page starts on it.
 */

/** A plain, keyboard-reachable row. Used wherever a list is a list of links. */
const Row: React.FC<{
  label: string;
  detail: string;
  onClick: () => void;
}> = ({ label, detail, onClick }) => (
  <Box
    component="button"
    type="button"
    aria-label={`${label} — ${detail}`}
    onClick={onClick}
    sx={{
      display: 'flex', alignItems: 'baseline', gap: 2, py: 1.4, width: '100%',
      textAlign: 'left', font: 'inherit', border: 0, bgcolor: 'transparent',
      color: 'text.primary', cursor: 'pointer', flexWrap: 'wrap',
      '&:hover': { bgcolor: 'action.hover' },
      '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
    }}
  >
    <Typography variant="body1" sx={{ minWidth: 150 }}>{label}</Typography>
    <Typography variant="body2" sx={{ color: 'text.secondary', flexGrow: 1 }}>{detail}</Typography>
  </Box>
);

export const PracticeHubPage: React.FC = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    Promise.all([getHomeSummary(), getSubjects()])
      .then(([h, s]) => { setSummary(h); setSubjects(s); })
      // The exercise list still works without any of this, but the page must
      // say so: dropping "Take a mock" without a word looks like the product
      // deciding you should not sit one.
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;
  }

  // A subject with no questions cannot be practised at all, so it is not the
  // one to lead with -- a fresh install has three subjects and an empty bank.
  const primary = [...subjects]
    .filter((s) => s.has_exam_profile && s.question_count > 0)
    .sort((a, b) => b.readiness.mock_count - a.readiness.mock_count)[0] ?? null;
  const resumable = summary?.resumable ?? null;
  const weak = primary?.readiness.blockers.find((b) => b.kind === 'weak_domain') ?? null;

  // "Full mock" is listed only when it is not already the thing at the top
  // of the page. Offering the same action twice is not two options.
  const mockIsPrimary = !!primary && !resumable && !weak;
  const exercises = [
    ...(primary && !mockIsPrimary
      ? [{
        label: 'Full mock',
        detail: `${primary.exam_question_count} questions, ${primary.exam_minutes} minutes, timed`,
        path: `/exam-setup?kind=mock&subject=${primary.id}`,
      }]
      : []),
    ...(primary
      ? [{ label: 'Drill', detail: 'Targeted questions, untimed', path: '/exam-setup?kind=drill' }]
      : []),
    { label: 'Design Review', detail: 'Two defensible architectures; name the deciding axis', path: '/design-reviews' },
    { label: 'System Design', detail: 'Blank-page design, graded against a rubric', path: '/system-design' },
    { label: 'Interview Answer', detail: 'Answer out loud and have the delivery analysed', path: '/interview-practice' },
    { label: 'Chart Sandbox', detail: 'Change one thing and see what moves', path: '/chart-sandbox' },
  ];

  return (
    <Box sx={{ maxWidth: 680 }}>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 5 }}>Practice</Typography>

      {/* One dominant thing to do, chosen by evidence. Two filled buttons
          side by side is not a recommendation, it is a fork. */}
      {resumable ? (
        <Box sx={{ mb: 6 }}>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>Continue</Typography>
          <Typography variant="body1" sx={{ mt: 0.5, mb: 2 }}>
            {resumable.title} — you stopped at question {resumable.answered + 1} of {resumable.total}.
          </Typography>
          <Button
            variant="contained"
            disableElevation
            onClick={() => navigate(`/exam/${resumable.session_id}`)}
            sx={{ borderRadius: '100px', fontWeight: 600, textTransform: 'none' }}
          >
            Continue
          </Button>
        </Box>
      ) : weak && primary ? (
        <Box sx={{ mb: 6 }}>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>Target a weakness</Typography>
          <Typography variant="body1" sx={{ mt: 0.5, mb: 2 }}>
            {weak.domain} is at {Math.round(weak.value ?? 0)}%, under the{' '}
            {Math.round(weak.target ?? 0)}% floor — the only area that is.
          </Typography>
          <Button
            variant="contained"
            disableElevation
            onClick={() => navigate(
              `/exam-setup?kind=drill&subject=${primary.id}`
              + `&domain=${encodeURIComponent(weak.domain ?? '')}`
            )}
            sx={{ borderRadius: '100px', fontWeight: 600, textTransform: 'none' }}
          >
            Practise {weak.domain}
          </Button>
        </Box>
      ) : loadFailed ? (
        <Alert severity="warning" sx={{ mb: 6 }}>
          Could not reach your subjects, so this page cannot tell you which mock
          to sit. The exercises below still work.
        </Alert>
      ) : primary ? (
        <Box sx={{ mb: 6 }}>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
            Measure where you stand
          </Typography>
          <Typography variant="body1" sx={{ mt: 0.5, mb: 2 }}>
            {primary.name} — {primary.exam_question_count} questions,{' '}
            {primary.exam_minutes} minutes, timed. Nothing else changes your readiness.
          </Typography>
          <Button
            variant="contained"
            disableElevation
            onClick={() => navigate(`/exam-setup?kind=mock&subject=${primary.id}`)}
            sx={{ borderRadius: '100px', fontWeight: 600, textTransform: 'none' }}
          >
            Take a mock
          </Button>
        </Box>
      ) : null}

      <Typography variant="overline" sx={{ color: 'text.secondary' }}>Choose an exercise</Typography>
      <Stack sx={{ mt: 0.5 }} divider={<Divider />}>
        {exercises.map((e) => (
          <Row key={e.path} label={e.label} detail={e.detail} onClick={() => navigate(e.path)} />
        ))}
      </Stack>
    </Box>
  );
};

/**
 * Learn: the material, rather than a test of it.
 *
 * The Question Bank is content maintenance -- import, edit, bulk delete --
 * and is labelled as such rather than sitting beside a roadmap as though the
 * two were the same kind of activity.
 */
export const LearnHubPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <Box sx={{ maxWidth: 680 }}>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 5 }}>Learn</Typography>

      <Typography variant="overline" sx={{ color: 'text.secondary' }}>Study</Typography>
      <Stack sx={{ mt: 0.5, mb: 6 }} divider={<Divider />}>
        <Row
          label="Roadmaps"
          detail="Imported study plans with tracked topics"
          onClick={() => navigate('/roadmaps')}
        />
      </Stack>

      <Typography variant="overline" sx={{ color: 'text.secondary' }}>Your material</Typography>
      <Stack sx={{ mt: 0.5 }} divider={<Divider />}>
        <Row
          label="Question Bank"
          detail="Browse, edit and import the questions everything else draws from"
          onClick={() => navigate('/question-bank')}
        />
      </Stack>
    </Box>
  );
};
