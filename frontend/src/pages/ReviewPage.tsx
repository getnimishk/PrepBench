// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, CircularProgress, Divider, Stack, Typography,
} from '@mui/material';
import {
  getActivity, getHomeSummary, getReviewQueue, markAnswerReviewed,
  startExam, submitReviewCheck,
} from '../services/api';
import { ActivityItem, HomeSummary } from '../types/subject';
import { CheckResult, ReviewItem, ReviewQueue } from '../types/review';
import { apiErrorMessage } from '../services/apiError';
import { Explanation } from '../components/common/Explanation';

/**
 * What to understand from what you got wrong.
 *
 * This page used to be a counter and a history table. It said "90 wrong
 * answers you have not looked at yet" and offered no way to look at them --
 * Home's one action pointed here, and here the trail stopped. A number that
 * only ever goes up, with no way down, is the guilt mechanic the product
 * refuses everywhere else; it arrived by omission rather than by design,
 * which is why nothing caught it.
 *
 * Now it is a bounded session of real questions. One at a time, your answer
 * against the right one, the explanation, and then it is marked read and
 * gone. What is behind the cap is mentioned once, in passing, and never
 * counted at you.
 *
 * And then the part that was still missing. Reading was the whole of it: the
 * page marked the answer read and moved on, and reading is not learning. The
 * schedule was driven only by answering, so twenty explanations worked through
 * carefully left the product's model of the learner exactly where it started
 * -- Home counted what had been read, and nothing anywhere asked whether it
 * had landed.
 *
 * Each miss now ends in a check: one different question on the same concept.
 * Getting it right is transfer. Getting it wrong is the product finding out
 * that reading was not enough, which is the thing it could never find out
 * before, and the concept goes back to the front of the schedule. A concept
 * with only one question in the bank has no check, and the page says so rather
 * than asking about something else and calling it verification.
 */

/** Everything you have done, in one place -- but not the point of the page. */
const HISTORY_PREVIEW = 8;

export const ReviewPage: React.FC = () => {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<ReviewQueue | null>(null);
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // How far through today's set, and which of them have been marked read.
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState<ReviewItem[]>([]);
  const [checks, setChecks] = useState<boolean[]>([]);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    Promise.all([getReviewQueue(), getHomeSummary(), getActivity(HISTORY_PREVIEW)])
      .then(([q, h, a]) => { setQueue(q); setSummary(h); setActivity(a); })
      .catch(() => setError('Failed to load your review.'))
      .finally(() => setLoading(false));
  }, []);

  const items = queue?.items ?? [];
  const current = items[index] ?? null;
  const finished = !loading && items.length > 0 && index >= items.length;

  const advance = async (item: ReviewItem, checkPassed?: boolean) => {
    setDone((d) => [...d, item]);
    if (checkPassed !== undefined) setChecks((c) => [...c, checkPassed]);
    setIndex((i) => i + 1);
    // Only where there was no check to submit. Submitting one marks the miss
    // read on the server, and a second call would be a wasted round trip.
    if (checkPassed !== undefined) return;
    // Optimistic: the mark is bookkeeping, and a failed write should not
    // interrupt the reading, which is the part that matters.
    try {
      await markAnswerReviewed(item.session_id, item.question_id);
    } catch {
      /* it will still be in the queue tomorrow */
    }
  };

  const startMemoryReview = async () => {
    setStarting(true);
    setError(null);
    try {
      const session = await startExam({
        title: 'Due for review',
        exam_mode: 'spaced_repetition',
        total_questions: 20,
        passing_percentage: 70,
        randomize_questions: true,
        session_kind: 'drill',
      });
      navigate(`/exam/${session.id}`);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not start the review.'));
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ maxWidth: 720 }}>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>Review</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 5 }}>
        Reading a miss is what changes the next score. Answering another new question is not.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {current && (
        <ReviewCard
          key={current.answer_id}
          item={current}
          position={index + 1}
          total={items.length}
          onNext={(passed) => advance(current, passed)}
        />
      )}

      {finished && (
        <Finished done={done} checks={checks} remaining={queue?.remaining ?? 0} />
      )}

      {/* Only when the queue actually came back. With the backend down this
          used to print "Every wrong answer from your mocks has been read"
          under the failure notice -- a claim about the learner's evidence,
          made without any, and the most flattering one available. */}
      {!current && !finished && !error && (
        <Box sx={{ mb: 5 }}>
          <Typography variant="body1">
            Nothing to review. Every wrong answer from your mocks has been read.
          </Typography>
        </Box>
      )}

      {/* Spaced repetition is a different thing from reading a miss, and it
          starts on one click rather than through a setup form: "start today's
          review" used to open a configuration screen, which is not what the
          button said it would do. */}
      {(summary?.due_for_review ?? 0) > 0 && (
        <Box sx={{ mt: 6 }}>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>From memory</Typography>
          <Typography variant="body2" sx={{ mt: 0.5, mb: 1.5, color: 'text.secondary' }}>
            Questions the schedule has brought round again, to check they stayed learnt.
          </Typography>
          <Button
            variant="outlined"
            disabled={starting}
            onClick={startMemoryReview}
            sx={{ borderRadius: '100px', textTransform: 'none' }}
          >
            {starting ? 'Starting…' : 'Start a memory drill'}
          </Button>
        </Box>
      )}

      <Box sx={{ mt: 7 }}>
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>Everything you have done</Typography>
        <Stack sx={{ mt: 0.5 }} divider={<Divider />}>
          {activity.map((item, i) => (
            <Box
              key={`${item.kind}-${i}`}
              component="button"
              type="button"
              aria-label={`${item.title} — ${item.detail}`}
              onClick={() => navigate(item.href)}
              sx={{
                display: 'flex', alignItems: 'baseline', gap: 2, py: 1.1, width: '100%',
                textAlign: 'left', font: 'inherit', border: 0, bgcolor: 'transparent',
                color: 'text.primary', cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
                '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
              }}
            >
              <Typography variant="caption" sx={{ width: 56, flexShrink: 0, color: 'text.secondary' }}>
                {item.at
                  ? new Date(item.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
                  : ''}
              </Typography>
              <Typography variant="body2" sx={{ flexGrow: 1, minWidth: 0 }}>{item.title}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>{item.detail}</Typography>
            </Box>
          ))}
        </Stack>
        <Button
          size="small"
          onClick={() => navigate('/analytics')}
          sx={{ mt: 1.5, textTransform: 'none' }}
        >
          Insights
        </Button>
      </Box>
    </Box>
  );
};

/**
 * One miss: what was asked, what you said, what was right, and why.
 *
 * The options are shown in full rather than as "you chose B" -- the whole
 * point is to see what made the wrong one attractive.
 */
const ReviewCard: React.FC<{
  item: ReviewItem;
  position: number;
  total: number;
  onNext: (checkPassed?: boolean) => void;
}> = ({ item, position, total, onNext }) => {
  const chosen = new Set(item.selected_option_ids);
  const missed = item.options.filter((o) => o.is_correct && !chosen.has(o.id)).length;
  const wrongly = item.options.filter((o) => !o.is_correct && chosen.has(o.id)).length;

  // On a "choose all that apply" question you can pick nothing but correct
  // options and still be marked wrong. Ticks alone do not say that, and a
  // learner looking at three ticks beside their own answer cannot tell what
  // they got wrong.
  const whatWentWrong = [
    wrongly > 0 && `${wrongly} option${wrongly === 1 ? '' : 's'} you picked `
      + `${wrongly === 1 ? 'is' : 'are'} wrong`,
    missed > 0 && `you missed ${missed} correct ${missed === 1 ? 'one' : 'ones'}`,
  ].filter(Boolean).join(', ');

  return (
    <Box>
      <Typography variant="overline" sx={{ color: 'text.secondary' }}>
        Review today · {position} of {total}
      </Typography>

      <Typography variant="body1" sx={{ mt: 1.5, fontSize: 18, lineHeight: 1.6 }}>
        {item.question_text}
      </Typography>

      {whatWentWrong && (
        <Typography variant="body2" sx={{ mt: 2, color: 'error.main' }}>
          {whatWentWrong.charAt(0).toUpperCase() + whatWentWrong.slice(1)}.
        </Typography>
      )}

      <Stack sx={{ mt: 2.5 }} spacing={1.25}>
        {item.options.map((o) => {
          const picked = chosen.has(o.id);
          return (
            <Box
              key={o.id}
              sx={{
                display: 'flex', gap: 1.5, alignItems: 'baseline',
                pl: 1.75, py: 0.5,
                // A left rule rather than a filled box: it marks the row
                // without turning six options into six cards.
                borderLeft: 2,
                borderColor: o.is_correct
                  ? 'success.main'
                  : picked ? 'error.main' : 'transparent',
              }}
            >
              <Typography
                component="span"
                aria-hidden
                sx={{ width: 14, flexShrink: 0, color: o.is_correct ? 'success.main' : 'error.main' }}
              >
                {o.is_correct ? '✓' : picked ? '✕' : ''}
              </Typography>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ lineHeight: 1.55 }}>
                  {o.text}
                  {/* Stated in words as well as marked, so the distinction
                      does not rest on a colour or a glyph. */}
                  {picked && (
                    <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
                      {' '}— you chose this
                    </Typography>
                  )}
                </Typography>
                {picked && !o.is_correct && o.why_incorrect && (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {o.why_incorrect}
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Stack>

      {item.explanation && (
        <Box sx={{ mt: 3.5 }}>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>Why</Typography>
          <Box sx={{ mt: 0.5 }}>
            <Explanation text={item.explanation} />
          </Box>
        </Box>
      )}

      {item.check
        ? <Check item={item} position={position} total={total} onNext={onNext} />
        : (
          <Stack direction="row" sx={{ mt: 3.5, alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              disableElevation
              onClick={() => onNext()}
              sx={{ borderRadius: '100px', fontWeight: 600, textTransform: 'none' }}
            >
              {position === total ? 'Done' : 'Next'}
            </Button>
            {/* Said, rather than silently skipped. A concept with one question
                in the bank cannot be checked, and pretending otherwise -- by
                asking about something else -- would be the kind of claim this
                product refuses everywhere else. */}
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              No second question on this concept in your bank, so there is nothing to
              check it against.
            </Typography>
          </Stack>
        )}
    </Box>
  );
};

/**
 * The check: one different question on the same concept.
 *
 * This is the whole difference between reading and learning, and it is the
 * loop the product never closed. Reviewing a miss set `reviewed_at` and
 * nothing else; the schedule was driven only by answering, so an evening of
 * explanations changed nothing except twenty timestamps.
 *
 * Deliberately a different question rather than the same one again: re-asking
 * what was just explained tests whether the last two minutes are still in
 * short-term memory, which is both the wrong question and the one result the
 * learner is guaranteed to get right.
 */
const Check: React.FC<{
  item: ReviewItem;
  position: number;
  total: number;
  onNext: (checkPassed?: boolean) => void;
}> = ({ item, position, total, onNext }) => {
  const check = item.check!;
  const [picked, setPicked] = useState<number[]>([]);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  const toggle = (id: number) => {
    if (result) return;
    setPicked((prev) => {
      if (check.is_multiple) {
        return prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      }
      return [id];
    });
  };

  const submit = async () => {
    setSubmitting(true);
    setFailed(false);
    try {
      setResult(await submitReviewCheck({
        answer_id: item.answer_id,
        question_id: check.question_id,
        selected_option_ids: picked,
      }));
    } catch {
      // Not swallowed. The check is the evidence, so a check the server never
      // received must not look like one it accepted.
      setFailed(true);
    } finally {
      setSubmitting(false);
    }
  };

  const correct = new Set(result?.correct_option_ids ?? []);

  return (
    <Box sx={{ mt: 4, pt: 3.5, borderTop: 1, borderColor: 'divider' }}>
      <Typography variant="overline" sx={{ color: 'text.secondary' }}>
        Check
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, mb: 2 }}>
        A different question on the same idea. Reading an explanation is not the same
        as being able to use it.
      </Typography>

      <Typography variant="body1" sx={{ fontSize: 17, lineHeight: 1.6 }}>
        {check.question_text}
        {check.is_multiple && (
          <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
            {' '}(choose all that apply)
          </Typography>
        )}
      </Typography>

      <Stack sx={{ mt: 2 }} spacing={1}>
        {check.options.map((o) => {
          const isPicked = picked.includes(o.id);
          const isRight = result != null && correct.has(o.id);
          const isWrongPick = result != null && isPicked && !correct.has(o.id);
          return (
            <Box
              key={o.id}
              component="button"
              type="button"
              disabled={result != null}
              onClick={() => toggle(o.id)}
              aria-pressed={isPicked}
              // Named explicitly, for the reason already learnt on Home's
              // rows: a button assembled from Typography children reads as an
              // unnamed button to anything not looking at it.
              aria-label={o.text}
              sx={{
                display: 'flex', gap: 1.5, alignItems: 'baseline', textAlign: 'left',
                width: '100%', font: 'inherit', cursor: result ? 'default' : 'pointer',
                px: 1.75, py: 1, borderRadius: 2,
                border: 1,
                borderColor: isRight
                  ? 'success.main'
                  : isWrongPick
                    ? 'error.main'
                    : isPicked ? 'primary.main' : 'divider',
                bgcolor: isPicked && !result ? 'action.selected' : 'transparent',
                color: 'text.primary',
                '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
              }}
            >
              <Typography
                component="span"
                aria-hidden
                sx={{
                  width: 14, flexShrink: 0,
                  color: isRight ? 'success.main' : isWrongPick ? 'error.main' : 'text.disabled',
                }}
              >
                {result == null ? (isPicked ? '•' : '') : isRight ? '✓' : isWrongPick ? '✕' : ''}
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.55 }}>
                {o.text}
                {/* Stated as well as marked, so the reading never rests on a
                    colour or a glyph. */}
                {result != null && isRight && (
                  <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
                    {' '}— correct
                  </Typography>
                )}
                {isWrongPick && (
                  <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
                    {' '}— you chose this
                  </Typography>
                )}
              </Typography>
            </Box>
          );
        })}
      </Stack>

      {failed && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          That did not reach the server, so it has not been recorded. Try again — this
          answer is the evidence, and a check that was not saved must not look like one
          that was.
        </Alert>
      )}

      {result && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="body1" sx={{ fontWeight: 500 }}>
            {result.passed ? 'Checked.' : 'Not yet.'}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary', lineHeight: 1.6 }}>
            {result.verdict}
          </Typography>
          {!result.passed && result.explanation && (
            <Box sx={{ mt: 2 }}>
              <Explanation text={result.explanation} />
            </Box>
          )}
        </Box>
      )}

      <Stack direction="row" sx={{ mt: 3.5, alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        {result == null ? (
          <Button
            variant="contained"
            disableElevation
            disabled={picked.length === 0 || submitting}
            onClick={submit}
            sx={{ borderRadius: '100px', fontWeight: 600, textTransform: 'none' }}
          >
            {submitting ? 'Checking…' : 'Check'}
          </Button>
        ) : (
          <Button
            variant="contained"
            disableElevation
            onClick={() => onNext(result.passed)}
            sx={{ borderRadius: '100px', fontWeight: 600, textTransform: 'none' }}
          >
            {position === total ? 'Done' : 'Next'}
          </Button>
        )}
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {item.domain}
        </Typography>
      </Stack>
    </Box>
  );
};

/**
 * The end of the session.
 *
 * Closes on what was covered rather than on what is left. The remainder is
 * mentioned in one clause because hiding it would be dishonest, and made the
 * headline by nobody, because that is the backlog again.
 *
 * It now closes on what was *learnt* rather than on what was read. "Twelve
 * read" was the only thing this page could ever say, and it was a measure of
 * time spent. The checks are a measure of the thing the time was spent on --
 * and the ones that did not pass are reported plainly, because a session that
 * discovers two concepts have not landed is a more useful session than one
 * that discovers nothing.
 */
const Finished: React.FC<{
  done: ReviewItem[];
  checks: boolean[];
  remaining: number;
}> = ({ done, checks, remaining }) => {
  const byDomain = useMemo(() => {
    const counts = new Map<string, number>();
    done.forEach((d) => counts.set(d.domain, (counts.get(d.domain) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [done]);

  const passed = checks.filter(Boolean).length;
  const failed = checks.length - passed;

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 600 }}>
        That is today&apos;s review read.
      </Typography>

      {checks.length > 0 && (
        <Typography variant="body1" sx={{ mt: 1.5, lineHeight: 1.65 }}>
          {passed} of {checks.length} checked question{checks.length === 1 ? '' : 's'} came
          back right.
          {failed > 0 && ` The other ${failed === 1 ? 'one is' : `${failed} are`} back near `
            + 'the front of the schedule, so they will come round again soon.'}
        </Typography>
      )}

      <Stack sx={{ mt: 2 }} spacing={0.5}>
        {byDomain.map(([domain, n]) => (
          <Typography key={domain} variant="body2" sx={{ color: 'text.secondary' }}>
            {n} from {domain}
          </Typography>
        ))}
      </Stack>
      {remaining > 0 && (
        <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
          There are {remaining} older ones still unread. They will be here tomorrow.
        </Typography>
      )}
    </Box>
  );
};
