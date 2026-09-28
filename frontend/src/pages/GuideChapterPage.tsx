// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Box, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import { getContentPack } from '../services/api';
import { apiErrorMessage } from '../services/apiError';
import { usePreparation } from '../context/PreparationContext';
import type { ContentPackDetail } from '../types/contentPack';
import { Explanation } from '../components/common/Explanation';
import { ErrorState, LoadingState } from '../components/common/States';
import { Actions, Detail, Good, Note, PageHead, Panel, PanelHead, Section } from '../components/ui/primitives';

/**
 * One chapter of a built-in guide, read in the Study Library.
 *
 * A chapter links to the Learning Lab scenarios that practise it: the ones
 * written for this chapter, and any the pack names in its practice links.
 * Only written scenarios are linked -- a planned one can't be opened.
 */
export const GuideChapterPage: React.FC = () => {
  const { packId, chapterId } = useParams<{ packId: string; chapterId: string }>();
  const { selected } = usePreparation();
  const linkedVersion = selected?.content_packs?.find((cp) => cp.pack_id === packId)?.pack_version ?? null;

  const [pack, setPack] = useState<ContentPackDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!packId) return undefined;
    let cancelled = false;
    setPack(null);
    setError(null);
    getContentPack(packId, linkedVersion ?? undefined)
      .then((result) => { if (!cancelled) setPack(result); })
      .catch((err) => { if (!cancelled) setError(apiErrorMessage(err, '')); });
    return () => { cancelled = true; };
  }, [packId, linkedVersion, attempt]);

  if (error !== null) {
    return (
      <Box>
        <PageHead eyebrow="Study Library" title="Chapter" />
        <ErrorState what="Could not load this chapter." saved="nothing_to_save" detail={error} onRetry={() => setAttempt((n) => n + 1)} />
      </Box>
    );
  }

  if (!pack) {
    return (
      <Box>
        <PageHead eyebrow="Study Library" title="Chapter" />
        <LoadingState label="Loading this chapter…" />
      </Box>
    );
  }

  const index = pack.chapters.findIndex((c) => c.id === chapterId);
  const chapter = index >= 0 ? pack.chapters[index] : null;

  if (!chapter) {
    return (
      <Box>
        <PageHead eyebrow="Study Library" title="Chapter not found" />
        <Actions><Button variant="outlined" component={RouterLink} to={`/learn/guides/${pack.pack_id}`}>Back to {pack.title}</Button></Actions>
      </Box>
    );
  }

  const prev = pack.chapters[index - 1];
  const next = pack.chapters[index + 1];

  const written = pack.scenario_levels.flatMap((l) => l.scenarios).filter((s) => s.content);
  const own = written.filter((s) => s.chapter === chapter.id);
  const linked = chapter.practice_links
    .map((l) => written.find((s) => s.id === l.scenario_id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s) && !own.includes(s!));
  const practice = [...new Set([...own, ...linked])];
  const scenarioPath = (id: string) => `/scenarios/${pack.pack_id}/${id}`;

  return (
    <Box>
      <PageHead
        eyebrow={<RouterLink to={`/learn/guides/${pack.pack_id}`} style={{ color: 'inherit' }}>{pack.title}</RouterLink>}
        title={`${index + 1} · ${chapter.title}`}
        sub={chapter.summary}
        actions={practice.length > 0 && (
          <Button variant="contained" color="ink" component={RouterLink} to={scenarioPath(practice[0].id)}>Practise this</Button>
        )}
      />

      {linkedVersion === null && (
        <Note sx={{ mb: '16px' }}>
          {selected
            ? `Not attached to ${selected.name} — attach it to keep your place. Showing version ${pack.version} (the latest).`
            : `No preparation selected. Showing version ${pack.version} (the latest).`}
        </Note>
      )}

      {chapter.blocks.map((b, i) => (
        <Section key={b.heading ?? i} sx={i === 0 ? { mt: 0 } : undefined}>
          <Panel component="section" aria-labelledby={b.heading ? `block-${i}` : undefined}>
            {b.heading && <PanelHead title={b.heading} titleId={`block-${i}`} />}
            {b.md && <Explanation text={b.md} variant="body1" />}
            {b.table && (
              <TableContainer
                tabIndex={0}
                role="region"
                aria-label={`${b.heading ?? chapter.title}: table, scrollable`}
                sx={{ mt: b.md ? '12px' : 0 }}
              >
                <Table size="small">
                  <TableHead>
                    <TableRow>{b.table.head.map((h, j) => <TableCell key={`${h}-${j}`}>{h}</TableCell>)}</TableRow>
                  </TableHead>
                  <TableBody>
                    {b.table.rows.map((r) => (
                      <TableRow key={r.join('|')}>{r.map((cell, j) => <TableCell key={`${j}-${cell}`}>{cell}</TableCell>)}</TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Panel>
        </Section>
      ))}

      <Section>
        {practice.length > 0 && (
          <Good sx={{ mb: '14px' }}>
            Practise it in the Learning Lab:{' '}
            {practice.map((s, i) => (
              <React.Fragment key={s.id}>
                {i > 0 && ', '}
                <RouterLink to={scenarioPath(s.id)}>scenario {s.number}, {s.title}</RouterLink>
              </React.Fragment>
            ))}.
          </Good>
        )}
        <Actions>
          {prev && <Button variant="outlined" component={RouterLink} to={`/learn/guides/${pack.pack_id}/${prev.id}`}>Previous: {prev.title}</Button>}
          {next && <Button variant="outlined" component={RouterLink} to={`/learn/guides/${pack.pack_id}/${next.id}`}>Next: {next.title}</Button>}
          <Button variant="text" component={RouterLink} to={`/learn/guides/${pack.pack_id}`}>All chapters</Button>
        </Actions>
        <Detail sx={{ mt: '8px' }}>Source: {pack.docs_url}</Detail>
      </Section>
    </Box>
  );
};
