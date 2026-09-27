// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { getContentPack } from '../services/api';
import { apiErrorMessage } from '../services/apiError';
import { usePreparation } from '../context/PreparationContext';
import type { ContentPackDetail } from '../types/contentPack';
import { ErrorState, LoadingState } from '../components/common/States';
import { Actions, Detail, Note, PageHead, Panel, PanelHead, Row } from '../components/ui/primitives';

/**
 * A built-in guide in the Study Library: what the pack covers, and its chapters.
 *
 * The version shown is the one the active preparation has pinned
 * (skills-and-content-packs-plan.md D4). With no preparation selected, or one
 * that hasn't attached this pack, the latest version is shown instead, said
 * plainly rather than silently -- attaching later keeps the exact text a
 * learner already read.
 */
export const GuidePage: React.FC = () => {
  const { packId } = useParams<{ packId: string }>();
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
    // linkedVersion is derived from `selected` on every render; re-fetching
    // when it changes is the point (attaching the pack should show its pinned
    // text without a manual reload).
  }, [packId, linkedVersion, attempt]);

  if (error !== null) {
    return (
      <Box>
        <PageHead eyebrow="Study Library" title="Guide" />
        <ErrorState what="Could not load this guide." saved="nothing_to_save" detail={error} onRetry={() => setAttempt((n) => n + 1)} />
      </Box>
    );
  }

  if (!pack) {
    return (
      <Box>
        <PageHead eyebrow="Study Library" title="Guide" />
        <LoadingState label="Loading this guide…" />
      </Box>
    );
  }

  return (
    <Box>
      <PageHead eyebrow="Study Library · Guide" title={pack.title} sub={pack.summary} />

      {linkedVersion === null && (
        <Note sx={{ mb: '16px' }}>
          {selected
            ? `Not attached to ${selected.name} — attach it to keep your place. Showing version ${pack.version} (the latest).`
            : `No preparation selected. Showing version ${pack.version} (the latest).`}
        </Note>
      )}

      {pack.chapters.length === 0 ? (
        <Panel><Detail>This guide has no chapters yet.</Detail></Panel>
      ) : (
        <Panel component="section" aria-labelledby="guide-chapters">
          <PanelHead title={`${pack.chapters.length} chapters`} titleId="guide-chapters">
            <Detail>Read in order the first time; each chapter stands on its own after that.</Detail>
          </PanelHead>
          {pack.chapters.map((c, i) => (
            <Row
              key={c.id}
              title={`${i + 1} · ${c.title}`}
              detail={c.summary}
              action={(
                <Button
                  size="small"
                  variant="outlined"
                  component={RouterLink}
                  to={`/learn/guides/${pack.pack_id}/${c.id}`}
                  aria-label={`Read chapter ${i + 1}: ${c.title}`}
                >
                  Read
                </Button>
              )}
            />
          ))}
        </Panel>
      )}

      <Actions sx={{ mt: '16px' }}>
        <Button variant="outlined" component={RouterLink} to="/learn">Back to the Study Library</Button>
      </Actions>
      <Detail sx={{ mt: '8px' }}>Source: {pack.docs_url}</Detail>
    </Box>
  );
};
