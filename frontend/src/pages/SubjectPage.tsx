// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, Typography } from '@mui/material';
import { getSubject, getSubjectCoverage } from '../services/api';
import {
  DOMAIN_LABELS, FormatCoverage, Subject,
} from '../types/subject';
import { blockerSentence, pct, plateauSentence, readySentence } from '../services/readinessText';
import { loadFailed } from '../services/apiError';
import { LoadingState } from '../components/common/States';
import {
  Detail, Eyebrow, Grid, PageHead, Panel, PanelHead, Pill, Row, Section, type Tone,
} from '../components/ui/primitives';
import {
  KIND_LABEL, ReadinessBlock, RecommendedBlock, learnSummary, useOverviewFacts,
} from '../components/preparation/PreparationOverview';

/**
 * One preparation's own page: the workspace behind its portfolio card.
 *
 * The prototype's overview first -- readiness beside the next useful action,
 * then Learn, Practice and Review -- and then the argument under the verdict:
 * the scores it rests on, why it is what it is, each area on its evidence, and
 * every practice format this preparation has, empty ones included.
 *
 * The verdict is explained from the shared vocabulary rather than from prose
 * written here, so this page and Home cannot disagree about why you are not
 * ready.
 */

/** Where each format's action goes. Unavailable formats get no route. */
const ROUTES: Record<string, string> = {
  mock: '/exam-setup',
  drill: '/exam-setup',
  design_review: '/design-reviews',
  system_design: '/system-design',
  interview: '/interview-practice',
  roadmap: '/roadmaps',
};

const DOMAIN_TONE: Record<string, Tone> = {
  needs_work: 'danger',
  developing: 'warning',
  solid: 'success',
  needs_evaluation: 'neutral',
};

export const SubjectPage: React.FC = () => {
  const { subjectId } = useParams<{ subjectId: string }>();
  const id = Number(subjectId);

  const [subject, setSubject] = useState<Subject | null>(null);
  const [coverage, setCoverage] = useState<FormatCoverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const facts = useOverviewFacts(subject?.id);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([getSubject(id), getSubjectCoverage(id)])
      .then(([s, c]) => {
        setSubject(s);
        setCoverage(c);
      })
      .catch((err) => setError(loadFailed('Could not load this preparation', err)))
      .finally(() => setLoading(false));
  }, [id, loadAttempt]);

  if (loading) {
    return <LoadingState label="Loading this preparation…" />;
  }
  if (error || !subject) {
    return (
      <Alert severity="error" action={error ? <Button color="inherit" size="small" onClick={() => setLoadAttempt((n) => n + 1)}>Retry</Button> : undefined}>
        {error ?? 'Subject not found.'}
      </Alert>
    );
  }

  const r = subject.readiness;
  const blocker = r.blockers[0] ?? null;
  const learn = learnSummary(facts);

  return (
    <Box>
      <PageHead
        eyebrow={KIND_LABEL[subject.kind]}
        title={subject.name}
        sub={subject.description || 'Everything this preparation holds: its readiness, its next step, and the ways into learning, practice and review.'}
        actions={(
          <>
            <Button component={RouterLink} to="/preparations" variant="outlined">← My Preparations</Button>
            <Button component={RouterLink} to={`/preparations/${subject.id}/edit`} variant="outlined">Settings</Button>
          </>
        )}
      />

      <Grid columns={2}>
        <Panel><ReadinessBlock subject={subject} /></Panel>
        <Panel><RecommendedBlock subject={subject} eyebrow="Next useful action" /></Panel>
      </Grid>

      <Section>
        <Grid columns={3}>
          <Panel component="section" aria-label="Learn">
            <Eyebrow>Learn</Eyebrow>
            <Typography variant="h6" component="h3" sx={{ mt: '4px' }}>{learn ?? '—'}</Typography>
            <Button component={RouterLink} to="/learn" variant="outlined" sx={{ mt: '10px' }} aria-label="Open Learn">Open</Button>
          </Panel>
          <Panel component="section" aria-label="Practice">
            <Eyebrow>Practice</Eyebrow>
            <Typography variant="h6" component="h3" sx={{ mt: '4px' }}>
              {subject.has_exam_profile
                ? `${r.mock_count} mock${r.mock_count === 1 ? '' : 's'}`
                : `${subject.question_count} question${subject.question_count === 1 ? '' : 's'}`}
            </Typography>
            <Button component={RouterLink} to="/practice" variant="outlined" sx={{ mt: '10px' }} aria-label="Open Practice">Open</Button>
          </Panel>
          <Panel component="section" aria-label="Review">
            <Eyebrow>Review</Eyebrow>
            <Typography variant="h6" component="h3" sx={{ mt: '4px' }}>
              {facts?.counts ? `${facts.counts.spaced_due} due today` : '—'}
            </Typography>
            <Button component={RouterLink} to="/review" variant="outlined" sx={{ mt: '10px' }} aria-label="Open Review">Open</Button>
          </Panel>
        </Grid>
      </Section>

      <Section>
        <Evidence subject={subject} />
      </Section>

      {/* Why the verdict is what it is, in the product's one vocabulary. */}
      {subject.has_exam_profile && r.mock_count > 0 && (
        <Section>
          <Panel soft component="section" aria-label="Interpretation">
            <Eyebrow>{r.state === 'plateau' ? 'What this means' : blocker ? 'Why not ready' : 'Why'}</Eyebrow>
            <Typography variant="h5" component="h2" sx={{ mt: '4px' }}>
              {r.state === 'plateau'
                ? plateauSentence(r.recent_scores, r.rules)
                : blocker
                  ? blockerSentence(blocker, r.rules)
                  : readySentence(r.pass_mark, r.rules)}
            </Typography>
          </Panel>
        </Section>
      )}

      <Domains subject={subject} />
      <Formats coverage={coverage} />
    </Box>
  );
};

/** The numbers the verdict rests on. Never a percentage the sample cannot carry. */
const Evidence: React.FC<{ subject: Subject }> = ({ subject }) => {
  const r = subject.readiness;

  if (r.mock_count === 0) {
    return (
      <Panel component="section" aria-label="Evidence">
        <Eyebrow>Evidence</Eyebrow>
        <Typography variant="body1" sx={{ mt: '4px' }}>
          {subject.has_exam_profile
            ? 'No full mock under exam conditions yet. Drills close gaps; they do not measure '
              + 'readiness. A mock measures.'
            : 'This subject has no exam profile, so readiness cannot be computed. It is '
              + 'practised, not certified.'}
        </Typography>
      </Panel>
    );
  }

  return (
    <Panel component="section" aria-label="Evidence">
      <Eyebrow>Evidence · full mocks</Eyebrow>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap', mt: '6px' }}>
        {r.recent_scores.map((s, i) => {
          const below = r.pass_mark != null && s < r.pass_mark;
          return (
            <React.Fragment key={i}>
              {i > 0 && <Box component="span" aria-hidden sx={{ color: 'text.disabled', fontSize: (t) => t.typography.pxToRem(18) }}>→</Box>}
              <Box
                component="span"
                title={below ? 'below the pass mark' : undefined}
                sx={{
                  fontSize: (t) => t.typography.pxToRem(26), fontWeight: 760, fontVariantNumeric: 'tabular-nums',
                  color: below ? 'text.secondary' : 'text.primary',
                  textDecoration: below ? 'underline dotted' : 'none', textUnderlineOffset: '5px',
                }}
              >
                {pct(s)}
              </Box>
            </React.Fragment>
          );
        })}
        {r.pass_mark != null && <Detail component="span">{pct(r.pass_mark)} to pass</Detail>}
      </Box>
      <Detail sx={{ mt: '8px' }}>
        From {r.mock_count} full mock{r.mock_count === 1 ? '' : 's'}. Drills excluded.
        {r.points_per_mock != null && r.points_per_mock > 0
          && ` Rising about ${r.points_per_mock} points a mock.`}
        {r.points_per_mock != null && r.points_per_mock < 0
          && ` Falling about ${Math.abs(r.points_per_mock)} points a mock.`}
        {/* A finite number of mocks, never a date the app cannot know. */}
        {r.mocks_to_pass_estimate != null
          && ` At this rate, about ${r.mocks_to_pass_estimate} more `
             + `mock${r.mocks_to_pass_estimate === 1 ? '' : 's'} to cross the line.`}
        {r.is_stale && ' The most recent is more than two weeks old.'}
      </Detail>
    </Panel>
  );
};

/** Which areas, on how much evidence. */
const Domains: React.FC<{ subject: Subject }> = ({ subject }) => {
  const navigate = useNavigate();
  const r = subject.readiness;
  if (r.domains.length === 0) return null;

  return (
    <Section>
      <Panel component="section" aria-labelledby="areas">
        <PanelHead eyebrow="Areas" title="Each area on its evidence" titleId="areas" />
        {r.domains.map((d) => (
          <Row
            key={d.domain}
            title={d.domain}
            // An em dash, never 0%. Too few questions to judge is not a bad score.
            detail={`${d.score_pct != null ? pct(d.score_pct) : '—'} · ${d.answered} answered`}
            // Named in words as well as coloured, so the reading never rests on a colour alone.
            middle={<Pill tone={DOMAIN_TONE[d.state] ?? 'neutral'}>{DOMAIN_LABELS[d.state]}</Pill>}
            action={(
              <Button
                variant="outlined"
                onClick={() => navigate(
                  `/exam-setup?kind=drill&subject=${subject.id}&domain=${encodeURIComponent(d.domain)}`
                )}
                aria-label={`Practise ${d.domain}`}
              >
                Practise
              </Button>
            )}
          />
        ))}
        <Detail sx={{ mt: '10px' }}>
          &ldquo;Needs evaluation&rdquo; means too few questions to judge. It does not mean zero,
          and it is not a bad score.
        </Detail>
      </Panel>
    </Section>
  );
};

/** What exists for this subject. Empty formats are shown, not hidden. */
const Formats: React.FC<{ coverage: FormatCoverage[] }> = ({ coverage }) => {
  const navigate = useNavigate();
  if (coverage.length === 0) return null;

  return (
    <Section>
      <Panel soft component="section" aria-labelledby="formats">
        <PanelHead eyebrow="Practice formats" title="What this preparation has" titleId="formats" />
        {coverage.map((c) => (
          <Row
            key={c.key}
            title={c.label}
            detail={`${c.detail}${c.available && c.completed > 0 ? ` · ${c.completed} done` : ''}`}
            action={c.available ? (
              <Button variant="outlined" onClick={() => navigate(ROUTES[c.key] ?? '/')} aria-label={`${c.label} — ${c.detail}`}>
                Open
              </Button>
            ) : <Detail component="span">Nothing yet</Detail>}
          />
        ))}
      </Panel>
    </Section>
  );
};
