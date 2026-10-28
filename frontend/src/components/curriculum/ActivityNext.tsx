// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Link } from '@mui/material';
import type { LinkedTopic } from '../../hooks/useLinkedTopics';
import { Actions, Detail, Panel, PanelHead } from '../ui/primitives';

/**
 * The end of a practice activity (a scenario, a lab run): where it leads, so finishing
 * one is never a dead end. Back to each roadmap topic it practises and that topic's
 * demonstration, then the other practice for the same material. Nothing here records
 * anything: practice informs the topic page, and only a demonstration completes a topic.
 */
export const ActivityNext: React.FC<{
  idPrefix: string;
  topics: LinkedTopic[];
  /** Other practice for the same material, and the chapter to re-read. */
  related: { label: string; to: string }[];
}> = ({ idPrefix, topics, related }) => {
  if (topics.length === 0 && related.length === 0) return null;
  return (
    <Panel component="section" aria-labelledby={`${idPrefix}-next`} sx={{ mt: '15px' }}>
      <PanelHead title="What next" titleId={`${idPrefix}-next`} />
      {topics.length > 0 && (
        <>
          <Detail>
            Your topic page now lists this work. When you can explain the topic&apos;s success criterion unprompted,
            demonstrate it: that is what completes the topic.
          </Detail>
          <Box component="ul" sx={{ listStyle: 'none', p: 0, m: '8px 0 0' }}>
            {topics.map((t) => (
              <Box
                component="li"
                key={`${t.roadmapId}-${t.topicId}`}
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', py: '6px', borderTop: '1px solid', borderColor: 'divider' }}
              >
                <Link component={RouterLink} to={`/roadmaps/${t.roadmapId}/topics/${t.topicId}`} sx={{ fontWeight: 600 }}>
                  {t.title}
                </Link>
                <Button
                  variant="outlined"
                  size="small"
                  component={RouterLink}
                  to={`/roadmaps/${t.roadmapId}/topics/${t.topicId}/demonstrate`}
                  aria-label={`Demonstrate ${t.title}`}
                >
                  Demonstrate
                </Button>
              </Box>
            ))}
          </Box>
        </>
      )}
      {related.length > 0 && (
        <Actions sx={{ mt: topics.length > 0 ? '12px' : 0 }}>
          {related.map((r) => (
            <Button key={r.to} variant="text" component={RouterLink} to={r.to}>{r.label}</Button>
          ))}
        </Actions>
      )}
    </Panel>
  );
};
