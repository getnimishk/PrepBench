// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Box, Button, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs,
} from '@mui/material';
import { getContentPack } from '../services/api';
import { apiErrorMessage } from '../services/apiError';
import { usePreparation } from '../context/PreparationContext';
import type { ContentPackDetail } from '../types/contentPack';
import { Explanation } from '../components/common/Explanation';
import { ErrorState, LoadingState } from '../components/common/States';
import { Actions, Detail, Good, Note, PageHead, Panel, PanelHead, Section } from '../components/ui/primitives';

const ALIGNMENT_HEADING = 'Roadmap alignment';

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
  const [view, setView] = useState<'chapter' | 'alignment'>('chapter');

  // A new chapter starts on its text, whichever tab the last one was left on.
  useEffect(() => { setView('chapter'); }, [chapterId]);

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

  // The pack's "Roadmap alignment" block says which roadmap topics the chapter covers. The server
  // reads it wherever it sits in the chapter, so the page shows it in its own tab, not above the text.
  const alignment = chapter.blocks.find((b) => b.heading === ALIGNMENT_HEADING) ?? null;
  const body = chapter.blocks.filter((b) => b !== alignment);

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

      {alignment && (
        <Tabs
          value={view}
          onChange={(_, v: 'chapter' | 'alignment') => setView(v)}
          aria-label="Chapter views"
          sx={{ mb: '16px', borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab value="chapter" label="Chapter" id="chapter-tab-chapter" aria-controls="chapter-panel" />
          <Tab value="alignment" label="Roadmap alignment" id="chapter-tab-alignment" aria-controls="chapter-panel" />
        </Tabs>
      )}

      <Box id="chapter-panel" role={alignment ? 'tabpanel' : undefined} aria-labelledby={alignment ? `chapter-tab-${view}` : undefined}>
      {alignment && view === 'alignment' && (
        <Section sx={{ mt: 0 }}>
          <Panel component="section" aria-labelledby="alignment-title">
            <PanelHead title="Roadmap alignment" titleId="alignment-title" />
            {/* The pack writes the labels as *italic*, which Explanation does not draw: show them bold. */}
            <Explanation
              text={(alignment.md ?? '').replace(/(?<!\*)\*([A-Za-z][A-Za-z ]*:)\*(?!\*)/g, '**$1**')}
              variant="body1"
            />
          </Panel>
        </Section>
      )}

      {view === 'chapter' && body.map((b, i) => (
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
      </Box>

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
