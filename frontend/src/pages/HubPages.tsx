// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Alert, Box, Typography, Button, CircularProgress, Stack, Divider, alpha, useTheme,
} from '@mui/material';
import {
  AlertCircle, ArrowRight, BarChart3, Compass, FileText, MessageSquare, PenLine, Play, Target,
} from 'lucide-react';
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

/**
 * One contextual recommendation: a mark, what it is, and the way in.
 *
 * `tone` is the only thing that varies between the three states, and it varies
 * because the states mean different things -- something you left running,
 * something measured as under the floor, something there is no reason not to
 * do. The mark and the eyebrow carry that; the copy never has to shout it.
 */
const Recommendation: React.FC<{
  tone: 'continue' | 'attention' | 'ready';
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  cta: string;
  href: string;
  /** Filled when this is the one dominant action, outlined when it is not. */
  primary: boolean;
  icon: React.ReactNode;
}> = ({ tone, eyebrow, title, children, cta, href, primary, icon }) => {
  const theme = useTheme();
  const accent = tone === 'attention'
    ? theme.palette.error.main
    : tone === 'continue'
      ? theme.palette.success.main
      : theme.palette.primary.main;

  return (
    <Box
      sx={{
        display: 'grid',
        // One column on a phone. The mark is decorative -- the eyebrow says
        // which state this is -- and holding a column for it left the title
        // about two hundred pixels, which wrapped "Managing Products with
        // Agility" onto three lines under a 46px circle.
        gridTemplateColumns: { xs: '1fr', sm: 'auto minmax(0, 1fr) auto' },
        alignItems: { xs: 'stretch', sm: 'center' },
        columnGap: { xs: 2, sm: 2.5 },
        rowGap: 2,
        p: { xs: 2.5, sm: 3 },
        borderRadius: 3.5,
        border: '1px solid',
        // The attention state is the only tinted surface in the product. It
        // earns it by being the one block that reports a measurement failing
        // a threshold; everything else here is neutral.
        borderColor: tone === 'attention' ? alpha(accent, 0.3) : 'divider',
        bgcolor: tone === 'attention' ? alpha(accent, 0.05) : 'background.paper',
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
          display: { xs: 'none', sm: 'grid' }, placeItems: 'center',
          bgcolor: alpha(accent, 0.13), color: accent,
        }}
      >
        {icon}
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="h2"
          sx={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: tone === 'attention' ? accent : 'text.secondary',
          }}
        >
          {eyebrow}
        </Typography>
        <Typography sx={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.015em', mt: 0.25 }}>
          {title}
        </Typography>
        {children}
      </Box>

      <Box sx={{ gridColumn: 'auto' }}>
        <Button
          component={RouterLink}
          to={href}
          variant={primary ? 'contained' : 'outlined'}
          disableElevation
          endIcon={<ArrowRight size={18} />}
          fullWidth
          sx={{
            borderRadius: '100px', fontWeight: 600, textTransform: 'none',
            px: 3, py: 1.15, fontSize: 15, whiteSpace: 'nowrap',
            width: { sm: 'auto' },
          }}
        >
          {cta}
        </Button>
      </Box>
    </Box>
  );
};

/** One alternative. A link in a list, never a button in a card. */
const PracticeRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  detail: string;
  href: string;
  verb: string;
}> = ({ icon, label, detail, href, verb }) => {
  const theme = useTheme();
  return (
    <Box component="li" sx={{ listStyle: 'none' }}>
      <Box
        component={RouterLink}
        to={href}
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', sm: 'auto minmax(0, 260px) minmax(0, 1fr) auto' },
          alignItems: 'center',
          gap: { xs: 1.75, sm: 2.5 },
          px: { xs: 2, sm: 2.5 }, py: 1.6,
          textDecoration: 'none', color: 'text.primary',
          borderBottom: '1px solid', borderColor: 'divider',
          '&:hover': { bgcolor: 'action.hover' },
          '&:focus-visible': {
            outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2,
          },
        }}
      >
        <Box
          aria-hidden
          sx={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            display: { xs: 'none', sm: 'grid' }, placeItems: 'center',
            bgcolor: alpha(theme.palette.text.primary, 0.06), color: 'text.secondary',
          }}
        >
          {icon}
        </Box>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            display: { xs: 'none', sm: 'block' },
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {detail}
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: 'primary.main', fontWeight: 600, whiteSpace: 'nowrap' }}
        >
          {verb} &rarr;
        </Typography>
      </Box>
    </Box>
  );
};

/** "today" where that is true, and a date where it is not. */
const worked = (iso?: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  const sameDay = d.getFullYear() === today.getFullYear()
    && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  return sameDay ? 'today' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

export const PracticeHubPage: React.FC = () => {
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

  // Read from `blockers`, which is where readiness puts its own conclusion.
  // Practice must never work out for itself what counts as weak: Home reads
  // this same list, and two answers to "what is wrong" is the bug this
  // product has already paid for once.
  const weak = primary?.readiness.blockers.find((b) => b.kind === 'weak_domain') ?? null;

  const mockHref = primary ? `/exam-setup?kind=mock&subject=${primary.id}` : '/exam-setup?kind=mock';
  const drillHref = primary ? `/exam-setup?kind=drill&subject=${primary.id}` : '/exam-setup?kind=drill';

  // Exactly one of these is filled. Finishing what was started outranks
  // starting something new, so when both are true Continue takes the button
  // and the weakness stays on the page as the quieter second way in.
  const mockIsRecommendation = !!primary && !resumable && !weak;

  const alternatives = [
    // Never listed as an alternative to itself.
    ...(primary && !mockIsRecommendation
      ? [{
        key: 'mock',
        icon: <FileText size={17} />,
        label: 'Full mock',
        detail: `${primary.exam_question_count} questions, ${primary.exam_minutes} minutes, timed`,
        href: mockHref,
        verb: 'Start',
      }]
      : []),
    ...(primary
      ? [{
        key: 'drill',
        icon: <Target size={17} />,
        label: 'Targeted drill',
        detail: 'Narrow to a weak area, a domain, or what the schedule has brought round',
        href: drillHref,
        verb: 'Start',
      }]
      : []),
    {
      key: 'design-review',
      icon: <Compass size={17} />,
      label: 'Design Review',
      detail: 'Two defensible architectures; name the deciding axis',
      href: '/design-reviews',
      verb: 'Start',
    },
    {
      key: 'system-design',
      icon: <PenLine size={17} />,
      label: 'System Design',
      detail: 'Blank-page design, graded against a rubric',
      href: '/system-design',
      verb: 'Start',
    },
    {
      key: 'interview',
      icon: <MessageSquare size={17} />,
      label: 'Interview Answer',
      detail: 'Answer out loud and have the delivery analysed',
      href: '/interview-practice',
      verb: 'Start',
    },
    {
      key: 'sandbox',
      icon: <BarChart3 size={17} />,
      label: 'Chart Sandbox',
      detail: 'Change one thing and see what moves',
      href: '/chart-sandbox',
      verb: 'Explore',
    },
  ];

  return (
    <Box sx={{ maxWidth: 1060, pb: 6 }}>
      <Typography
        component="div"
        sx={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.09em',
          textTransform: 'uppercase', color: 'text.secondary',
        }}
      >
        Practice
      </Typography>
      <Typography
        variant="h3"
        component="h1"
        sx={{
          fontWeight: 700, mt: 0.75, letterSpacing: '-0.025em',
          fontSize: { xs: 30, sm: 38, md: 42 }, lineHeight: 1.12,
        }}
      >
        What should you work on today?
      </Typography>
      {/* What the page is doing, not encouragement. Home answers where you
          stand; this one only has to say where the suggestion came from. */}
      <Typography variant="body1" sx={{ color: 'text.secondary', mt: 1, fontSize: 17 }}>
        Chosen from your own evidence, not from a menu.
      </Typography>

      <Stack sx={{ mt: { xs: 3.5, md: 4.5 } }} spacing={2}>
        {loadFailed && (
          <Alert severity="warning">
            Could not reach your subjects, so this page cannot tell you what to work on.
            The other ways to practise below still work.
          </Alert>
        )}

        {resumable && (
          <Recommendation
            tone="continue"
            eyebrow="Continue"
            title={resumable.title}
            cta="Continue"
            href={`/exam/${resumable.session_id}`}
            primary
            icon={<Play size={20} />}
          >
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              {resumable.total - resumable.answered} question
              {resumable.total - resumable.answered === 1 ? '' : 's'} remaining
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              {worked(resumable.started_at) ? `Last worked ${worked(resumable.started_at)} · ` : ''}
              {resumable.answered} of {resumable.total} answered
            </Typography>
          </Recommendation>
        )}

        {weak && primary && (
          <Recommendation
            tone="attention"
            eyebrow="What needs attention"
            title={weak.domain ?? ''}
            cta={`Practise ${weak.domain}`}
            href={`/exam-setup?kind=drill&subject=${primary.id}`
              + `&domain=${encodeURIComponent(weak.domain ?? '')}`}
            // Only when nothing was left unfinished. Two filled buttons is a
            // fork, not a recommendation.
            primary={!resumable}
            icon={<AlertCircle size={20} />}
          >
            <Stack direction="row" sx={{ alignItems: 'baseline', gap: 1.5, mt: 0.5, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>
                {Math.round(weak.value ?? 0)}%
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Preparation floor {Math.round(weak.target ?? 0)}%
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
              It is the one area under the floor across your qualifying mocks.
            </Typography>
          </Recommendation>
        )}

        {/* Nothing running and nothing under the floor. Not an absence of
            something to do -- the paper is what moves the verdict. */}
        {mockIsRecommendation && primary && (
          <Recommendation
            tone="ready"
            eyebrow="Ready for a mock"
            title={primary.name}
            cta="Take a mock"
            href={mockHref}
            primary
            icon={<FileText size={20} />}
          >
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              {primary.exam_question_count} questions, {primary.exam_minutes} minutes, timed.
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No domain is under the floor, and nothing else changes your readiness.
            </Typography>
          </Recommendation>
        )}
      </Stack>

      <Box sx={{ mt: { xs: 5, md: 6 } }}>
        <Box sx={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          gap: 2, flexWrap: 'wrap', mb: 1.5,
        }}>
          <Box>
            <Typography
              component="div"
              sx={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'text.secondary',
              }}
            >
              Other practice
            </Typography>
            <Typography component="h2" sx={{ fontSize: 19, fontWeight: 700, mt: 0.25 }}>
              Explore other ways to practise
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Each one exercises a different part of the preparation.
          </Typography>
        </Box>

        <Box
          component="ul"
          aria-label="Other ways to practise"
          sx={{
            m: 0, p: 0,
            border: '1px solid', borderColor: 'divider', borderRadius: 3.5,
            bgcolor: 'background.paper', overflow: 'hidden',
            '& > li:last-of-type > a': { borderBottom: 0 },
          }}
        >
          {alternatives.map((a) => (
            <PracticeRow
              key={a.key}
              icon={a.icon}
              label={a.label}
              detail={a.detail}
              href={a.href}
              verb={a.verb}
            />
          ))}
        </Box>
      </Box>
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
