// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert, Box, Button, Link, Typography,
} from '@mui/material';
import {
  Actions, BigFigure, Detail, Eyebrow, Good, Grid, Note, PageHead, Panel, Section, Sub,
} from '../components/ui/primitives';
import { getSpacedDeck, gradeSpacedCard } from '../services/api';
import { apiErrorMessage, loadFailed } from '../services/apiError';
import { usePreparation } from '../context/PreparationContext';
import { useShortcuts } from '../hooks/useShortcuts';
import { SPACED_SHORTCUTS } from '../services/shortcuts';
import { Explanation } from '../components/common/Explanation';
import type { SpacedCard, SpacedDeck, SpacedGrade } from '../types/spaced';
import { LoadingState } from '../components/common/States';

/**
 * Spaced repetition: recall, reveal, grade.
 *
 * Every other way the schedule moves -- answering in a session, checking a miss on
 * Review -- puts the options on screen, and choosing the right one from four is
 * recognition. A card shows the question alone and asks for the answer from memory
 * first. Only then is the answer revealed, and the learner says how well it came
 * back; that grade, not a click on an option, sets when the card returns.
 *
 * The preview beside each grade is the interval the server says that grade would
 * set, computed by the same SM-2 step that grading runs.
 */

const GRADES: { value: SpacedGrade; label: string }[] = [
  { value: 'again', label: 'Again' },
  { value: 'hard', label: 'Hard' },
  { value: 'good', label: 'Good' },
  { value: 'easy', label: 'Easy' },
];

const days = (n: number) => (n === 1 ? '1 day' : `${n} days`);


interface Graded { card: SpacedCard; grade: SpacedGrade; interval: number }

export const SpacedReviewPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedId, selected } = usePreparation();
  // One area's due cards, when opened from that area's page. Its count was
  // "Review 3 due"; a deck of every due card in the preparation would not be
  // the three it offered.
  const domain = searchParams.get('domain');
  const from = searchParams.get('from');
  const exitTo = from === 'review'
    ? '/review'
    : from === 'area' && domain && selectedId
      ? `/analytics/area?subject=${selectedId}&domain=${encodeURIComponent(domain)}`
      : '/practice?tab=spaced';

  const [deck, setDeck] = useState<SpacedDeck | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(false);
  const [graded, setGraded] = useState<Graded[]>([]);
  const [grading, setGrading] = useState(false);
  const [gradeError, setGradeError] = useState<string | null>(null);
  // Bumped by "Continue reviewing" to fetch the next deck.
  const [round, setRound] = useState(0);

  // A different preparation is a different schedule, so the deck starts over.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setIndex(0);
    setShown(false);
    setGraded([]);
    setGradeError(null);
    (domain ? getSpacedDeck(selectedId, undefined, domain) : getSpacedDeck(selectedId))
      .then((d) => { if (!cancelled) setDeck(d); })
      .catch((err) => { if (!cancelled) setLoadError(loadFailed('Could not load what is due', err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedId, round, domain]);

  const cards = deck?.cards ?? [];
  const card = cards[index] ?? null;
  const finished = !loading && cards.length > 0 && index >= cards.length;

  const next = useCallback(() => {
    setShown(false);
    setGradeError(null);
    setIndex((i) => i + 1);
  }, []);

  const grade = async (value: SpacedGrade) => {
    if (!card || !shown) return;
    setGrading(true);
    setGradeError(null);
    try {
      const result = await gradeSpacedCard(card.question_id, value);
      setGraded((g) => [...g, { card, grade: value, interval: result.interval_days }]);
      next();
    } catch (err) {
      // Not moved on. A grade the server never recorded must not look like one it did.
      setGradeError(apiErrorMessage(
        err, 'That grade did not reach the server, so this card has not moved. Try again.',
      ));
    } finally {
      setGrading(false);
    }
  };

  // Space reveals; 1-4 grade once revealed. Grading is refused while a grade is
  // still on its way, exactly as the buttons are disabled.
  useShortcuts([
    { shortcut: SPACED_SHORTCUTS.show, run: () => { if (card && !shown) setShown(true); } },
    ...(['again', 'hard', 'good', 'easy'] as const).map((value) => ({
      shortcut: SPACED_SHORTCUTS[value],
      run: () => { if (card && shown && !grading) grade(value); },
    })),
  ], !!card);

  const eyebrow = `Spaced repetition${selected ? ` · ${selected.name}` : ''}${domain ? ` · ${domain}` : ''}`;

  // Said wherever the deck is narrowed, with the way back to all of it.
  const narrowed = domain && (
    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
      Only questions in {domain}.{' '}
      <Link component={RouterLink} to="/practice/spaced">Review everything due</Link>
    </Typography>
  );

  if (loading) {
    return <LoadingState label="Loading what is due…" />;
  }

  const dueSince = card ? new Date(card.due_since).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : null;

  return (
    <Box>
      {loadError && (
        <>
          <PageHead eyebrow={eyebrow} title="Spaced repetition" />
          <Alert
            severity="error"
            action={<Button color="inherit" size="small" onClick={() => setRound((r) => r + 1)}>Retry</Button>}
          >
            {loadError}
          </Alert>
        </>
      )}

      {!loadError && !card && !finished && (
        <>
          <PageHead
            eyebrow={eyebrow}
            title="Nothing due"
            sub="Every scheduled concept has been reviewed."
            actions={<Button variant="outlined" onClick={() => navigate(exitTo)}>← Back</Button>}
          >
            {narrowed}
          </PageHead>
          <Section>
            <Good>
              {domain ? `Nothing in ${domain} is due today.` : 'Nothing is due today.'}{' '}
              Practising ahead of schedule does not strengthen recall.
            </Good>
          </Section>
        </>
      )}

      {card && (
        <>
          <PageHead
            eyebrow={eyebrow}
            title={`${cards.length - index} to review`}
            sub={`${card.topic || card.domain} · due since ${dueSince}`}
            actions={(
              <>
                <Button variant="outlined" onClick={() => navigate(exitTo)}>← Exit</Button>
                <Detail component="span">Card {index + 1} of {cards.length}</Detail>
              </>
            )}
          >
            {narrowed}
          </PageHead>

          {/* The prototype's .progress: one short track per card. */}
          <Box aria-hidden sx={{ display: 'flex', gap: '7px', mb: '16px', flexWrap: 'wrap' }}>
            {cards.map((c, i) => (
              <Box key={c.question_id} sx={{ width: 52, height: 5, borderRadius: '8px', bgcolor: i < index ? 'primary.main' : 'pb.track' }} />
            ))}
          </Box>

          <Panel component="section" aria-label="Card" sx={{ maxWidth: 900 }}>
            <Eyebrow>Retrieve before revealing</Eyebrow>
            <Typography component="p" sx={{ fontSize: (t) => t.typography.pxToRem(18), fontWeight: 640, mt: '8px', lineHeight: 1.5 }}>
              {card.question_text}
            </Typography>
            {card.is_multiple && <Detail>More than one answer.</Detail>}

            {!shown ? (
              <>
                <Note sx={{ mt: '18px' }}>
                  Answer it in your head first. Recognising an answer you are shown is not retrieval.
                </Note>
                <Actions sx={{ mt: '16px' }}>
                  <Button variant="contained" color="ink" onClick={() => setShown(true)}>Show answer</Button>
                </Actions>
              </>
            ) : (
              <>
                <Good sx={{ mt: '18px' }}>
                  {card.answer.length > 0
                    ? card.answer.map((a) => <Box key={a} component="b" sx={{ display: 'block' }}>{a}</Box>)
                    : 'No option is marked correct for this question in your bank.'}
                </Good>

                {card.explanation && (
                  <Section>
                    <Eyebrow>Why</Eyebrow>
                    <Box sx={{ mt: '8px' }}><Explanation text={card.explanation} /></Box>
                  </Section>
                )}

                <Eyebrow component="h2" sx={{ mt: '18px' }}>How well did you retrieve it?</Eyebrow>
                <Actions sx={{ mt: '10px' }}>
                  {GRADES.map((g) => (
                    <Button
                      key={g.value}
                      variant={g.value === 'good' || g.value === 'easy' ? 'contained' : 'outlined'}
                      color={g.value === 'easy' ? 'ink' : 'primary'}
                      disabled={grading}
                      onClick={() => grade(g.value)}
                      aria-label={`${g.label} — back in ${days(card.intervals[g.value])}`}
                      sx={{ gap: '6px' }}
                    >
                      {g.label}
                      <Box component="span" sx={{ fontWeight: 400, opacity: 0.8, fontSize: (t) => t.typography.pxToRem(12) }}>{days(card.intervals[g.value])}</Box>
                    </Button>
                  ))}
                </Actions>
                {gradeError && (
                  <Alert
                    severity="warning"
                    sx={{ mt: 2 }}
                    action={<Button color="inherit" size="small" onClick={next}>Skip card</Button>}
                  >
                    {gradeError}
                  </Alert>
                )}
              </>
            )}
          </Panel>
        </>
      )}

      {finished && (
        <Finished
          eyebrow={eyebrow}
          graded={graded}
          stillDue={Math.max(0, (deck?.due_total ?? 0) - graded.length)}
          onContinue={() => setRound((r) => r + 1)}
          onBack={() => navigate(exitTo)}
        />
      )}
    </Box>
  );
};

/** The end of a deck: not a score, but where each concept went. */
const Finished: React.FC<{
  eyebrow: React.ReactNode;
  graded: Graded[];
  stillDue: number;
  onContinue: () => void;
  onBack: () => void;
}> = ({ eyebrow, graded, stillDue, onContinue, onBack }) => {
  const counts = GRADES.map((g) => ({ ...g, n: graded.filter((x) => x.grade === g.value).length }));
  const soon = graded.filter((x) => x.interval <= 1).length;

  return (
    <>
      <PageHead
        eyebrow={eyebrow}
        title={`${graded.length} concept${graded.length === 1 ? '' : 's'} retrieved`}
        sub="Retrieval sessions are not scored. What matters is when each concept comes back."
        actions={(
          <>
            {stillDue > 0 && <Button variant="contained" onClick={onContinue}>Continue reviewing</Button>}
            <Button variant="outlined" onClick={onBack}>Done</Button>
          </>
        )}
      />

      <Section>
        <Grid columns={4}>
          {counts.map((c) => (
            <Panel key={c.value}>
              <Eyebrow>{c.label}</Eyebrow>
              <BigFigure size={26}>{c.n}</BigFigure>
            </Panel>
          ))}
        </Grid>
      </Section>

      <Section>
        <Panel component="section" aria-labelledby="schedule-moved">
          <Eyebrow>Schedule moved</Eyebrow>
          <Typography variant="h5" component="h2" id="schedule-moved">
            {graded.length} update{graded.length === 1 ? '' : 's'} saved
          </Typography>
          <Sub sx={{ mb: 0 }}>
            {soon > 0 && `${soon} ${soon === 1 ? 'comes' : 'come'} back tomorrow. `}
            {soon < graded.length && 'The rest have moved forward on their own intervals. '}
            {stillDue > 0 ? `${stillDue} more ${stillDue === 1 ? 'is' : 'are'} still due.` : 'Nothing else is due.'}
          </Sub>
        </Panel>
      </Section>
    </>
  );
};
