// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Box, Button, Chip, CircularProgress, InputAdornment, Link, TextField, Typography, useTheme,
} from '@mui/material';
import { Search as SearchIcon } from 'lucide-react';
import { searchEverything } from '../services/api';
import { apiErrorMessage } from '../services/apiError';
import { fromServerTime } from '../services/format';
import { usePreparation } from '../context/PreparationContext';
import { EmptyState, ErrorState } from '../components/common/States';
import type { SearchResponse } from '../types/search';
import { Detail, Eyebrow, Grid, PageHead, Panel, Row as PanelRow, Section } from '../components/ui/primitives';

/**
 * One search box over everything a preparation holds.
 *
 * Search existed only inside the Question Bank and the interview library, so
 * finding where something was written meant guessing which screen held it.
 * This one looks through the picked preparation's questions, its roadmaps'
 * topics and study guides, and every recording -- recordings belong to no
 * preparation, and the page says so rather than filing them under this one.
 *
 * What is typed and which kind is showing live in the address, so a reload or a
 * shared link opens the same results.
 */

type Kind = 'all' | 'questions' | 'guides' | 'roadmaps' | 'recordings';

const KINDS: { kind: Kind; label: string }[] = [
  { kind: 'all', label: 'All' },
  { kind: 'questions', label: 'Questions' },
  { kind: 'guides', label: 'Guides' },
  { kind: 'roadmaps', label: 'Roadmaps' },
  { kind: 'recordings', label: 'Recordings' },
];

/** Listed per kind: a sample of each under All, a page of one when it is picked. */
const LIMIT_ALL = 6;
const LIMIT_ONE = 50;
const DEBOUNCE_MS = 250;

function countOf(results: SearchResponse, kind: Kind): number {
  switch (kind) {
    case 'questions': return results.questions.total;
    case 'guides': return results.guides.total;
    case 'roadmaps': return results.roadmaps.total + results.topics.total;
    case 'recordings': return results.recordings.total;
    default:
      return results.questions.total + results.guides.total + results.roadmaps.total
        + results.topics.total + results.recordings.total;
  }
}

const STATUS_WORDS: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Complete',
  skipped: 'Skipped',
};

function duration(seconds: number | null): string | null {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
}

/** One result: what it is, where it sits, and the way into it. */
const Row: React.FC<{
  title: string;
  lines: (string | null | undefined)[];
  to: string;
  openLabel: string;
}> = ({ title, lines, to, openLabel }) => (
  <PanelRow
    component="li"
    columns="minmax(0,1fr) auto"
    sx={{ listStyle: 'none' }}
    title={(
      <Box
        component="span"
        sx={{ fontWeight: 640, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-word' }}
      >
        {title}
      </Box>
    )}
    detail={lines.filter(Boolean).length > 0 ? (
      <>
        {lines.filter(Boolean).map((line, i) => (
          <Box key={i} component="span" sx={{ display: 'block', wordBreak: 'break-word' }}>{line}</Box>
        ))}
      </>
    ) : undefined}
    action={(
      <Button component={RouterLink} to={to} variant="outlined" aria-label={openLabel}>
        Open
      </Button>
    )}
  />
);

/** A kind of result, as one of the prototype's panels. */
const Group: React.FC<{
  heading: string;
  total: number;
  note?: string;
  empty: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ heading, total, note, empty, children, footer }) => (
  <Panel component="section" aria-label={heading}>
    <Eyebrow component="h2">{heading} · {total}</Eyebrow>
    {note && <Detail sx={{ mt: '4px' }}>{note}</Detail>}
    {total === 0 ? (
      <Detail sx={{ mt: '8px' }}>{empty}</Detail>
    ) : (
      <Box component="ul" sx={{ m: 0, p: 0 }}>
        {children}
      </Box>
    )}
    {footer}
  </Panel>
);

export const SearchPage: React.FC = () => {
  const theme = useTheme();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const kindParam = params.get('kind') as Kind | null;
  const kind: Kind = KINDS.some((k) => k.kind === kindParam) ? (kindParam as Kind) : 'all';
  const { selectedId, selected, loading: preparationsLoading } = usePreparation();

  // Typed text updates the box at once and the address a moment later, so each
  // keystroke is not its own entry in history or its own request.
  const [text, setText] = useState(query);
  // What this box last wrote to the address. A change to `q` that is not that
  // -- back, forward, a link -- is someone else's, and the box follows it; one
  // that is, must not overwrite letters typed since it was sent.
  const sent = useRef(query);
  useEffect(() => {
    if (query !== sent.current) {
      sent.current = query;
      setText(query);
    }
  }, [query]);
  useEffect(() => {
    if (text === query) return undefined;
    const timer = setTimeout(() => {
      sent.current = text.trim() ? text : '';
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (text.trim()) next.set('q', text); else next.delete('q');
        return next;
      }, { replace: true });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, query, setParams]);

  const [results, setResults] = useState<SearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(0);

  const trimmed = query.trim();
  useEffect(() => {
    if (!trimmed) {
      setResults(null);
      setError(null);
      setSearching(false);
      return;
    }
    if (preparationsLoading) return;
    const request = latest.current + 1;
    latest.current = request;
    setSearching(true);
    setError(null);
    searchEverything(trimmed, selectedId, kind === 'all' ? LIMIT_ALL : LIMIT_ONE)
      .then((found) => { if (latest.current === request) setResults(found); })
      .catch((err) => {
        // The server's reason, when it gave one; the sentence around it is the ErrorState's.
        if (latest.current === request) setError(apiErrorMessage(err, ''));
      })
      .finally(() => { if (latest.current === request) setSearching(false); });
  }, [trimmed, selectedId, kind, attempt, preparationsLoading]);

  const chooseKind = (next: Kind) => {
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      if (next === 'all') p.delete('kind'); else p.set('kind', next);
      return p;
    }, { replace: true });
  };

  const scopeName = selected?.name ?? null;
  const current = results && results.query === trimmed ? results : null;
  // Under All, a kind with nothing in it is left out -- its chip already says 0.
  // Chosen on its own, it stays, to say so in words.
  const shows = (k: Kind) => kind === k || (kind === 'all' && current !== null && countOf(current, k) > 0);
  const total = current ? countOf(current, 'all') : 0;

  const questionsGroup = current && shows('questions') && (
    <Group
      heading="Questions"
      total={current.questions.total}
      empty="No questions match."
      footer={current.questions.total > current.questions.items.length && (
        <Detail sx={{ mt: '10px' }}>
          Showing {current.questions.items.length} of {current.questions.total}.{' '}
          <Link component={RouterLink} to={`/question-bank?keyword=${encodeURIComponent(current.query)}`}>
            See all {current.questions.total} in the Question Bank
          </Link>
        </Detail>
      )}
    >
      {current.questions.items.map((q) => (
        <Row
          key={q.id}
          title={q.text}
          lines={[`${q.domain} · ${q.topic} · ${q.difficulty}`]}
          to={`/question-bank?question=${q.id}`}
          openLabel={`Open question ${q.id}`}
        />
      ))}
    </Group>
  );

  const others = current ? [
    shows('guides') && (
      <Group key="guides" heading="Guides" total={current.guides.total} empty="No study guide sections match.">
        {current.guides.items.map((g) => (
          <Row
            key={g.section_id}
            title={g.title}
            lines={[
              g.excerpt,
              [
                `${g.topic_title} · ${g.roadmap_title}`,
                g.written_by === 'ai' ? 'drafted by AI' : 'written by you',
                g.read ? 'read' : 'not read yet',
              ].join(' · '),
            ]}
            to={`/roadmaps/${g.roadmap_id}/topics/${g.topic_id}/guide`}
            openLabel={`Open the study guide for ${g.topic_title}`}
          />
        ))}
      </Group>
    ),
    shows('roadmaps') && (
      <Group
        key="roadmaps"
        heading="Roadmaps"
        total={current.roadmaps.total + current.topics.total}
        empty="No roadmaps or topics match."
      >
        {current.roadmaps.items.map((r) => (
          <Row
            key={`roadmap-${r.id}`}
            title={r.title}
            lines={[
              `Roadmap · ${r.phase_count} ${r.phase_count === 1 ? 'phase' : 'phases'} · ${r.topic_count} ${r.topic_count === 1 ? 'topic' : 'topics'}${r.linked ? '' : ' · not linked to a preparation'}`,
            ]}
            to={`/roadmaps/${r.id}`}
            openLabel={`Open roadmap ${r.title}`}
          />
        ))}
        {current.topics.items.map((t) => (
          <Row
            key={`topic-${t.id}`}
            title={t.title}
            lines={[`Topic · ${t.phase_name} · ${t.roadmap_title} · ${STATUS_WORDS[t.status] ?? t.status}`]}
            to={`/roadmaps/${t.roadmap_id}/topics/${t.id}`}
            openLabel={`Open topic ${t.title}`}
          />
        ))}
      </Group>
    ),
    shows('recordings') && (
      <Group
        key="recordings"
        heading="Recordings"
        total={current.recordings.total}
        note={scopeName ? `Recordings belong to no preparation, so these come from all of them, not only ${scopeName}.` : undefined}
        empty="No recordings match."
      >
        {current.recordings.items.map((r) => (
          <Row
            key={r.id}
            title={r.title}
            lines={[
              r.question_text,
              [
                fromServerTime(r.created_at)?.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }),
                duration(r.duration_seconds),
                r.analysis_status === 'analyzed' ? 'analysed' : 'not analysed',
              ].filter(Boolean).join(' · '),
            ]}
            to={`/recordings/${r.id}`}
            openLabel={`Open recording ${r.title}`}
          />
        ))}
      </Group>
    ),
  ].filter(Boolean) : [];

  return (
    <Box>
      <PageHead
        eyebrow="Search"
        title={scopeName ? `Find anything in ${scopeName}` : 'Find anything'}
        sub={scopeName
          ? `Search runs over ${scopeName}'s questions, its roadmaps' topics and study guides, and your recordings.`
          : 'Every preparation: questions, roadmap topics, study guides and recordings.'}
        actions={<Button component={RouterLink} to="/" variant="outlined">← Back to Home</Button>}
      />

      <Panel component="section" role="search" aria-label="Search box">
        <TextField
          fullWidth
          autoFocus
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search questions, topics, guides, recordings…"
          slotProps={{
            htmlInput: { 'aria-label': 'Search', maxLength: 200, style: { fontSize: theme.typography.pxToRem(16), padding: '14px 12px 14px 0' } },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon size={20} aria-hidden />
                </InputAdornment>
              ),
              endAdornment: searching ? (
                <InputAdornment position="end">
                  <CircularProgress size={18} aria-label="Searching" />
                </InputAdornment>
              ) : undefined,
            },
          }}
        />

        <Box role="group" aria-label="Show" sx={{ display: 'flex', gap: '8px', mt: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {KINDS.map(({ kind: k, label }) => (
            <Chip
              key={k}
              clickable
              component="button"
              aria-pressed={kind === k}
              color={kind === k ? 'primary' : 'default'}
              label={current ? `${label} ${countOf(current, k)}` : label}
              onClick={() => chooseKind(k)}
            />
          ))}
          <Typography variant="body2" color="text.secondary" role="status" sx={{ ml: 'auto' }}>
            {!trimmed
              ? 'Type to search'
              : current
                ? `${total} ${total === 1 ? 'match' : 'matches'} for “${current.query}”`
                : searching ? 'Searching…' : ''}
          </Typography>
        </Box>
      </Panel>

      {error !== null && (
        <Section>
          <ErrorState
            what={`Could not search for “${trimmed}”`}
            saved="nothing_to_save"
            detail={error || undefined}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        </Section>
      )}

      {current && error === null && total === 0 && (
        <Section>
          <Panel>
            <EmptyState
              title={`Nothing matches “${current.query}”`}
              why={`No question${scopeName ? ` in ${scopeName}` : ''}, roadmap topic, study guide or recording contains that text. Search matches the characters exactly as typed, in any case.`}
            />
          </Panel>
        </Section>
      )}

      {current && error === null && total > 0 && (
        <>
          {questionsGroup && <Section>{questionsGroup}</Section>}
          {others.length > 0 && (
            <Section>
              <Grid template={others.length === 1 ? 'minmax(0,1fr)' : 'repeat(2, minmax(0,1fr))'} sx={{ alignItems: 'start' }}>
                {others}
              </Grid>
            </Section>
          )}

          {kind === 'all' && total > 0 && (
            <Detail sx={{ mt: '20px' }}>
              Up to {LIMIT_ALL} of each kind are listed here. Choose a kind above to see more of it.
            </Detail>
          )}
        </>
      )}
    </Box>
  );
};
