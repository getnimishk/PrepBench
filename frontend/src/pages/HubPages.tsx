// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Tab, Tabs, Typography } from '@mui/material';
import { getHomeSummary, getReviewCounts, getSubjects } from '../services/api';
import { HomeSummary, Blocker, Resumable, Subject } from '../types/subject';
import { usePreparation } from '../context/PreparationContext';
import {
  CustomPractice, FullMock, SpacedRepetition, WeakTopicFocus,
} from '../components/practice/PracticeModes';
import { WhyThis } from '../components/common/WhyThis';
import {
  explainBlocker, explainResumable, explainVerdict,
} from '../services/recommendation';
import { LoadingState } from '../components/common/States';
import {
  Actions, Detail, Eyebrow, Grid, PageHead, Panel, PanelHead, Row, Section, Sub,
} from '../components/ui/primitives';

/** The prototype's practice formats, in its order. The tab lives in the URL so a
 *  format can be linked to and survives a reload. */
const PRACTICE_TABS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'weak', label: 'Weak topic focus' },
  { value: 'spaced', label: 'Spaced repetition' },
  { value: 'custom', label: 'Custom' },
  { value: 'mock', label: 'Full mock' },
] as const;
type PracticeTab = typeof PRACTICE_TABS[number]['value'];
const isPracticeTab = (v: string | null): v is PracticeTab =>
  PRACTICE_TABS.some((t) => t.value === v);

/**
 * My Practice.
 *
 * This page used to be an identical list of doors -- a card, a divider, a row
 * per destination, an "Open" button. That is a directory, and the sidebar was
 * already the directory. It leads instead with what the evidence recommends,
 * beside the other formats that are ready now, as the prototype lays it out.
 *
 * The second correction fixed the part that was still a lie: "Practise this"
 * under a named weakness went to a generic setup form with the weakness
 * dropped, so the one button on the page did not do what it said. The domain
 * now travels with the link, and the setup page starts on it.
 */

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
  const { selectedId } = usePreparation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: PracticeTab = isPracticeTab(tabParam) ? tabParam : 'recommended';
  const chooseTab = (value: PracticeTab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', value);
      return next;
    }, { replace: true });
  };
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [spacedDue, setSpacedDue] = useState<number | null>(null);
  const retry = () => setLoadAttempt((n) => n + 1);

  useEffect(() => {
    setLoading(true);
    setLoadFailed(false);
    Promise.all([getHomeSummary(), getSubjects()])
      .then(([h, s]) => { setSummary(h); setSubjects(s); })
      // The exercise list still works without any of this, but the page must
      // say so: dropping "Take a mock" without a word looks like the product
      // deciding you should not sit one.
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, [loadAttempt]);

  // The preparation picked in the header. Inferred only when nothing is picked
  // (outside a provider): a subject with no questions cannot be practised at
  // all, so it is not the one to lead with -- a fresh install has three
  // subjects and an empty bank.
  //
  // It used to be inferred always, so Practice ignored the picker: with
  // Databricks picked, the page recommended a PSM I mock.
  const inferred = [...subjects]
    .filter((s) => s.has_exam_profile && s.question_count > 0)
    .sort((a, b) => b.readiness.mock_count - a.readiness.mock_count)[0] ?? null;
  const picked = subjects.find((s) => s.id === selectedId) ?? null;
  const primary = picked ?? inferred;
  const primaryId = primary?.id ?? null;

  // What spaced repetition has due, for the "Also available" row. A count that
  // cannot be read is left unsaid rather than shown as zero.
  useEffect(() => {
    setSpacedDue(null);
    if (primaryId == null) return undefined;
    let cancelled = false;
    getReviewCounts(primaryId)
      .then((c) => { if (!cancelled) setSpacedDue(c.spaced_due); })
      .catch(() => { if (!cancelled) setSpacedDue(null); });
    return () => { cancelled = true; };
  }, [primaryId]);

  if (loading) {
    return <LoadingState label="Loading your practice…" />;
  }

  // The picked preparation's own unfinished session. The top-level one is the
  // newest across every preparation, for a page with none picked.
  const resumable = picked
    ? summary?.per_subject.find((p) => p.subject_id === picked.id)?.resumable ?? null
    : summary?.resumable ?? null;

  // Read from `blockers`, which is where readiness puts its own conclusion.
  // Practice must never work out for itself what counts as weak: Home reads
  // this same list, and two answers to "what is wrong" is the bug this
  // product has already paid for once.
  const weak = primary?.readiness.blockers.find((b) => b.kind === 'weak_domain') ?? null;

  return (
    <Box>
      <PageHead
        eyebrow={primary?.name ?? 'Practice'}
        title="My Practice"
        sub="The preparation stays fixed; the practice format changes around the goal."
      />

      <Tabs
        value={tab}
        onChange={(_, value: PracticeTab) => chooseTab(value)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        aria-label="Practice formats"
        sx={{ mt: '8px', mb: '20px', borderBottom: 1, borderColor: 'divider' }}
      >
        {PRACTICE_TABS.map((t) => (
          <Tab
            key={t.value}
            value={t.value}
            label={t.label}
            id={`practice-tab-${t.value}`}
            aria-controls={`practice-panel-${t.value}`}
          />
        ))}
      </Tabs>

      <Box
        role="tabpanel"
        id={`practice-panel-${tab}`}
        aria-labelledby={`practice-tab-${tab}`}
      >
        {tab !== 'recommended' && (
          primary
            ? (
              <>
                {tab === 'weak' && <WeakTopicFocus subject={primary} />}
                {tab === 'spaced' && <SpacedRepetition subject={primary} />}
                {tab === 'custom' && <CustomPractice subject={primary} />}
                {tab === 'mock' && <FullMock subject={primary} />}
              </>
            )
            : (
              loadFailed ? (
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={retry}>Retry</Button>}>
                  Could not load your preparations, so there is nothing to practise from. Nothing was changed.
                </Alert>
              ) : (
                <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                  Choose a preparation with questions in it to practise from.
                </Typography>
              )
            )
        )}

        {tab === 'recommended' && (
          <RecommendedPractice
            loadFailed={loadFailed}
            onRetry={retry}
            primary={primary}
            resumable={resumable}
            weak={weak}
            spacedDue={spacedDue}
            onChooseTab={chooseTab}
          />
        )}
      </Box>
    </Box>
  );
};

/**
 * The first tab, as the prototype draws it: what the evidence recommends now,
 * beside what else is ready -- then every other way to practise, quieter.
 *
 * Exactly one thing is recommended. Finishing what was started outranks
 * starting something new, then an area under the floor, then the mock that
 * moves the verdict; whichever does not lead is listed as also available.
 */
const RecommendedPractice: React.FC<{
  loadFailed: boolean;
  onRetry: () => void;
  primary: Subject | null;
  resumable: Resumable | null;
  weak: Blocker | null;
  spacedDue: number | null;
  onChooseTab: (tab: PracticeTab) => void;
}> = ({ loadFailed, onRetry, primary, resumable, weak, spacedDue, onChooseTab }) => {
  const mockHref = primary ? `/exam-setup?kind=mock&subject=${primary.id}` : '/exam-setup?kind=mock';
  const mockIsRecommendation = !!primary && !resumable && !weak;

  let recommended: React.ReactNode;
  if (resumable) {
    const remaining = resumable.total - resumable.answered;
    const when = worked(resumable.started_at);
    recommended = (
      <>
        <Typography variant="h5" component="h2" id="recommended-now">{resumable.title}</Typography>
        <Sub sx={{ mb: 0 }}>
          {remaining} question{remaining === 1 ? '' : 's'} remaining · {resumable.answered} of {resumable.total} answered
          {when ? ` · last worked ${when}` : ''}. Finishing what was started comes first.
        </Sub>
        <WhyThis explanation={explainResumable(resumable)} sx={{ mt: 1 }} />
        <Actions sx={{ mt: '15px' }}>
          <Button variant="contained" component={RouterLink} to={`/exam/${resumable.session_id}`}>Continue</Button>
        </Actions>
      </>
    );
  } else if (weak && primary) {
    recommended = (
      <>
        <Typography variant="h5" component="h2" id="recommended-now">{weak.domain}</Typography>
        <Sub sx={{ mb: 0 }}>
          {Math.round(weak.value ?? 0)}% in your qualifying mocks, under the {Math.round(weak.target ?? 0)}% floor.
          Work narrowly before another broad assessment.
        </Sub>
        {(() => {
          const why = explainBlocker(primary.readiness, weak);
          return why ? <WhyThis explanation={why} sx={{ mt: 1 }} /> : null;
        })()}
        <Actions sx={{ mt: '15px' }}>
          <Button
            variant="contained"
            component={RouterLink}
            to={`/exam-setup?kind=drill&subject=${primary.id}&domain=${encodeURIComponent(weak.domain ?? '')}`}
          >
            Start focused drill
          </Button>
        </Actions>
      </>
    );
  } else if (mockIsRecommendation && primary) {
    // Nothing running and nothing under the floor. Not an absence of something
    // to do -- the paper is what moves the verdict.
    recommended = (
      <>
        <Typography variant="h5" component="h2" id="recommended-now">Ready for a mock</Typography>
        <Sub sx={{ mb: 0 }}>
          {primary.exam_question_count} questions, {primary.exam_minutes} minutes, timed. No domain is under the
          floor, and nothing else changes your readiness.
        </Sub>
        {(() => {
          const why = explainVerdict(primary.readiness);
          return why ? <WhyThis explanation={why} sx={{ mt: 1 }} /> : null;
        })()}
        <Actions sx={{ mt: '15px' }}>
          <Button variant="contained" component={RouterLink} to={mockHref}>Take a mock</Button>
        </Actions>
      </>
    );
  } else {
    recommended = (
      <>
        <Typography variant="h5" component="h2" id="recommended-now">Nothing to recommend yet</Typography>
        <Sub sx={{ mb: 0 }}>Choose a preparation with questions in it to practise from.</Sub>
      </>
    );
  }

  const alternatives = [
    { key: 'design-review', label: 'Design Review', detail: 'Two defensible architectures; name the deciding axis', href: '/design-reviews', verb: 'Start' },
    { key: 'system-design', label: 'System Design', detail: 'Blank-page design, graded against a rubric', href: '/system-design', verb: 'Start' },
    { key: 'interview', label: 'Interview Answer', detail: 'Answer out loud and have the delivery analysed', href: '/interview-practice', verb: 'Start' },
    { key: 'sandbox', label: 'Chart Sandbox', detail: 'Change one thing and see what moves', href: '/chart-sandbox', verb: 'Explore' },
  ];

  return (
    <>
      {loadFailed && (
        <Alert severity="warning" sx={{ mb: '15px' }} action={<Button color="inherit" size="small" onClick={onRetry}>Retry</Button>}>
          Could not load your preparations, so this page cannot tell you what to work on.
          The other ways to practise below still work.
        </Alert>
      )}

      <Grid columns={2} sx={{ alignItems: 'start' }}>
        <Panel component="section" aria-label="Recommended now">
          <Eyebrow>Recommended now</Eyebrow>
          {recommended}
        </Panel>

        <Panel soft component="section" aria-labelledby="also-available">
          <Eyebrow component="h2" id="also-available">Also available</Eyebrow>
          {primary && (
            <Row
              title="Spaced repetition"
              detail={spacedDue == null ? 'Questions brought round on the schedule' : spacedDue > 0 ? `${spacedDue} questions due` : 'Nothing due today'}
              action={<Button variant="outlined" onClick={() => onChooseTab('spaced')} aria-label="Start spaced repetition">Start</Button>}
            />
          )}
          {weak && resumable && (
            <Row
              title="Weak topic focus"
              detail={`${weak.domain} is under the floor`}
              action={<Button variant="outlined" onClick={() => onChooseTab('weak')} aria-label="Start weak topic focus">Start</Button>}
            />
          )}
          {primary && !mockIsRecommendation && (
            <Row
              title="Full mock"
              detail={primary.pass_mark != null ? `${Math.round(primary.pass_mark)}% pass mark` : 'Timed assessment'}
              action={<Button variant="outlined" onClick={() => onChooseTab('mock')} aria-label="Start a full mock">Start</Button>}
            />
          )}
          <Row
            title="Custom set"
            detail="Narrow by domain and difficulty"
            action={<Button variant="outlined" onClick={() => onChooseTab('custom')} aria-label="Build a custom set">Start</Button>}
          />
        </Panel>
      </Grid>

      <Section>
        <Panel component="section" aria-labelledby="other-practice">
          <PanelHead eyebrow="Other practice" title="Explore other ways to practise" titleId="other-practice" sx={{ mb: '4px' }} />
          <Detail>Each one exercises a different part of the preparation.</Detail>
          <Box component="ul" aria-label="Other ways to practise" sx={{ m: 0, p: 0, listStyle: 'none', mt: '4px' }}>
            {alternatives.map((a) => (
              <Row
                key={a.key}
                component="li"
                title={a.label}
                detail={a.detail}
                action={(
                  <Button variant="outlined" component={RouterLink} to={a.href} aria-label={`${a.verb} ${a.label}`}>
                    {a.verb}
                  </Button>
                )}
              />
            ))}
          </Box>
        </Panel>
      </Section>
    </>
  );
};
