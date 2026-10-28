// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ActivityNext } from './ActivityNext';

const renderNext = (props: React.ComponentProps<typeof ActivityNext>) => render(
  <MemoryRouter><ActivityNext {...props} /></MemoryRouter>,
);

describe('ActivityNext', () => {
  it('leads to each topic and its demonstration, and offers none for a topic with no criterion', () => {
    renderNext({
      idPrefix: 'x',
      topics: [
        { roadmapId: 6, roadmapTitle: 'ADF', topicId: 313, title: 'Watermark Patterns', hasCriterion: true },
        { roadmapId: 6, roadmapTitle: 'ADF', topicId: 314, title: 'Change Tracking', hasCriterion: false },
      ],
      related: [{ label: 'Re-read chapter 10', to: '/learn/guides/adf/incremental' }],
    });
    const next = screen.getByRole('region', { name: 'What next' });
    expect(within(next).getByRole('link', { name: 'Watermark Patterns' })).toHaveAttribute('href', '/roadmaps/6/topics/313');
    expect(within(next).getByRole('link', { name: 'Demonstrate Watermark Patterns' })).toHaveAttribute('href', '/roadmaps/6/topics/313/demonstrate');
    // Nothing to meet, nothing to demonstrate: the topic is still linked, its demonstration is not.
    expect(within(next).getByRole('link', { name: 'Change Tracking' })).toHaveAttribute('href', '/roadmaps/6/topics/314');
    expect(within(next).queryByRole('link', { name: 'Demonstrate Change Tracking' })).not.toBeInTheDocument();
    expect(within(next).getByRole('link', { name: 'Re-read chapter 10' })).toHaveAttribute('href', '/learn/guides/adf/incremental');
  });

  it('draws nothing when there is nowhere to lead', () => {
    const { container } = renderNext({ idPrefix: 'x', topics: [], related: [] });
    expect(container).toBeEmptyDOMElement();
  });
});
