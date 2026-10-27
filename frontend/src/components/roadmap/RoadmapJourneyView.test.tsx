// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RoadmapJourneyView } from './RoadmapJourneyView';
import type { RoadmapPhase } from '../../types/roadmap';

const phase = (id: number, name: string, topics: Array<[number, string]>): RoadmapPhase => ({
  id, roadmap_id: 1, name, order_index: id,
  topics: topics.map(([tid, status]) => ({ id: tid, title: `Topic ${tid}`, status, estimated_hours: 1 })),
}) as unknown as RoadmapPhase;

const renderView = (phases: RoadmapPhase[]) => render(
  <MemoryRouter><RoadmapJourneyView roadmapId={1} phases={phases} onOpenPhase={vi.fn()} /></MemoryRouter>,
);

describe('RoadmapJourneyView actions', () => {
  it('puts the primary action on the phase holding the roadmap\'s next topic, in progress first', () => {
    renderView([phase(1, 'Phase A', [[1, 'not_started']]), phase(2, 'Phase B', [[2, 'in_progress']])]);
    const cont = screen.getByRole('link', { name: 'Continue learning: Phase B, Topic 2' });
    expect(cont).toHaveAttribute('href', '/roadmaps/1/topics/2');
    expect(cont).toHaveTextContent('Continue learning');
    const other = screen.getByRole('link', { name: 'Start phase: Phase A, Topic 1' });
    expect(other).toHaveAttribute('href', '/roadmaps/1/topics/1');
    expect(other).toHaveTextContent('Start phase');
  });

  it('offers no start action for a finished phase, only the topic list', () => {
    renderView([phase(1, 'Phase A', [[1, 'completed'], [2, 'skipped']]), phase(2, 'Phase B', [[3, 'not_started']])]);
    expect(screen.queryByRole('link', { name: /Phase A, / })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View topics in Phase A' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue learning: Phase B, Topic 3' })).toBeInTheDocument();
  });

  it('shows no action for a phase without topics', () => {
    renderView([phase(1, 'Empty', [])]);
    expect(screen.queryByRole('link', { name: /Continue|Start/ })).not.toBeInTheDocument();
  });
});
