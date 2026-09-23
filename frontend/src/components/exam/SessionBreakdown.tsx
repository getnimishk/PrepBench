// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import type { ExamDetail } from '../../types/exam';
import { Bar, BigFigure, Detail, Eyebrow, Grid, Panel, Section, Sub } from '../ui/primitives';

/**
 * What this one session showed, by area -- counted from its own answers.
 *
 * The result used to be a score and a list of questions, so "which part of the
 * bank did this go wrong in" meant paging through the list and keeping count.
 * The breakdown does the counting, from the same answers the score came from.
 *
 * A session is small, so these are counts first and percentages second: "1 of 2"
 * is the honest way to say 50% about two questions. None of it is a readiness
 * verdict -- readiness is read across mocks, not from one sitting.
 *
 * Laid out as the prototype's session results: four figures, then the areas and
 * what to do next.
 */

/** Topics are fine-grained; a result that lists thirty of them is an inventory. */
const TOPIC_LIMIT = 6;

interface AreaRow { name: string; correct: number; answered: number }

const byArea = (rows: { area: string; correct: boolean }[]): AreaRow[] => {
  const counts = new Map<string, AreaRow>();
  rows.forEach(({ area, correct }) => {
    const row = counts.get(area) ?? { name: area, correct: 0, answered: 0 };
    row.answered += 1;
    if (correct) row.correct += 1;
    counts.set(area, row);
  });
  // Worst first: the place to look is the top of the list.
  return [...counts.values()].sort(
    (a, b) => a.correct / a.answered - b.correct / b.answered || b.answered - a.answered,
  );
};

const AreaList: React.FC<{ title: string; rows: AreaRow[]; limit?: number }> = ({ title, rows, limit }) => {
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <Panel>
      <Eyebrow component="h3">{title}</Eyebrow>
      <Box component="ul" sx={{ m: 0, mt: '4px', p: 0, listStyle: 'none' }}>
        {shown.map((row) => {
          const pct = Math.round((row.correct / row.answered) * 100);
          return (
            <Box component="li" key={row.name} sx={{ py: '12px', borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <Box
                  component="b"
                  title={row.name}
                  sx={{ fontWeight: 650, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {row.name}
                </Box>
                <Box component="span" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {row.correct} of {row.answered} · {pct}%
                </Box>
              </Box>
              <Bar value={pct} label={`${row.name}: ${row.correct} of ${row.answered} correct`} sx={{ mt: '6px' }} />
            </Box>
          );
        })}
      </Box>
      {limit && rows.length > limit && (
        <Detail sx={{ mt: '10px' }}>
          {rows.length - limit} more topic{rows.length - limit === 1 ? '' : 's'} in the question review below.
        </Detail>
      )}
    </Panel>
  );
};

const Figure: React.FC<{ label: string; value: React.ReactNode; detail?: React.ReactNode; color?: string; children?: React.ReactNode }> = ({
  label, value, detail, color, children,
}) => (
  <Panel>
    <Eyebrow>{label}</Eyebrow>
    <BigFigure size={26} color={color} sx={{ mt: '6px' }}>{value}</BigFigure>
    {detail && <Detail>{detail}</Detail>}
    {children}
  </Panel>
);

export const SessionBreakdown: React.FC<{ exam: ExamDetail }> = ({ exam }) => {
  const summary = useMemo(() => {
    const answers = new Map(exam.answers.map((a) => [a.question_id, a]));
    const answered: { domain: string; topic: string; correct: boolean }[] = [];
    let skipped = 0;
    exam.questions.forEach((q) => {
      const a = answers.get(q.id);
      if (!a || (a.selected_option_ids?.length ?? 0) === 0) {
        skipped += 1;
        return;
      }
      answered.push({ domain: q.domain || 'No domain', topic: q.topic || 'No topic', correct: a.is_correct === true });
    });
    const correct = answered.filter((a) => a.correct).length;
    const flagged = exam.answers.filter((a) => a.is_flagged).length;
    return {
      flagged,
      total: exam.questions.length,
      answered: answered.length,
      correct,
      missed: answered.length - correct,
      skipped,
      domains: byArea(answered.map((a) => ({ area: a.domain, correct: a.correct }))),
      topics: byArea(answered.map((a) => ({ area: a.topic, correct: a.correct }))),
    };
  }, [exam]);

  const isMock = exam.session_kind === 'mock';
  const correctPct = summary.total > 0 ? Math.round((summary.correct / summary.total) * 100) : 0;
  const seconds = exam.time_spent_seconds ?? 0;

  return (
    <Box component="section" aria-label="Session breakdown">
      <Section>
        <Grid columns={4}>
          <Figure label="Correct" value={`${summary.correct} / ${summary.total}`}>
            <Bar value={correctPct} label={`${summary.correct} of ${summary.total} correct`} sx={{ mt: '9px' }} />
          </Figure>
          <Figure label="Answered" value={summary.answered} detail={`${summary.skipped} skipped`} />
          <Figure
            label="Missed"
            value={summary.missed}
            color={summary.missed > 0 ? 'pb.warning' : undefined}
            detail={isMock ? 'now in your review queue' : 'back on the schedule tomorrow'}
          />
          {isMock ? (
            // A mock is sat against a clock, so the time it took is part of the result.
            <Figure
              label="Time used"
              value={`${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`}
              detail={`${summary.flagged} flagged during the mock`}
            />
          ) : (
            <Figure label="Evidence" value={`+${summary.answered}`} detail="answers recorded" />
          )}
        </Grid>
      </Section>

      <Section>
        <Grid columns={2}>
          {summary.answered > 0 && <AreaList title="By domain" rows={summary.domains} />}
          <Panel soft>
            <Eyebrow component="h3">What to do next</Eyebrow>
            {summary.missed > 0 ? (
              <>
                <Box component="p" sx={{ m: 0, mt: '8px', fontSize: (t) => t.typography.pxToRem(22), fontWeight: 750, lineHeight: 1.25, letterSpacing: '-0.02em' }}>
                  Understand the {summary.missed} miss{summary.missed === 1 ? '' : 'es'} before practising again.
                </Box>
                <Sub>
                  {isMock
                    ? 'Each one is in your review queue, where a second question on the same idea checks it landed.'
                    : 'Each one comes back on the spaced schedule tomorrow; answering it right then is what moves it on.'}
                </Sub>
                {/* Outlined: the page's one filled action is reading the misses. */}
                <Button
                  component={RouterLink}
                  to={isMock ? '/review' : '/practice?tab=spaced'}
                  variant="outlined"
                >
                  {isMock ? 'Open review' : 'Spaced repetition'}
                </Button>
              </>
            ) : (
              <Sub>
                {summary.answered > 0
                  ? 'Nothing missed in this set. These questions move forward on their schedule; practising ahead of it does not strengthen recall.'
                  : 'Nothing was answered, so there is nothing to read from this session.'}
              </Sub>
            )}
          </Panel>
          {summary.answered > 0 && <AreaList title="By topic" rows={summary.topics} limit={TOPIC_LIMIT} />}
        </Grid>
      </Section>
    </Box>
  );
};
