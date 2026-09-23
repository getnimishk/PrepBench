// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { SearchPage } from './SearchPage';
import type { SearchResponse } from '../types/search';

const searchEverything = vi.fn();
vi.mock('../services/api', () => ({
  searchEverything: (...a: unknown[]) => searchEverything(...a),
}));

const preparation = { selectedId: 7 as number | null, selected: { id: 7, name: 'PSM I' } as { id: number; name: string } | null, loading: false };
vi.mock('../context/PreparationContext', () => ({
  usePreparation: () => preparation,
}));

const Where: React.FC = () => {
  const location = useLocation();
  return <div data-testid="where">{location.pathname}{location.search}</div>;
};

const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/search" element={<><SearchPage /><Where /></>} />
    </Routes>
  </MemoryRouter>,
);

const EMPTY = { total: 0, items: [] };

function response(over: Partial<SearchResponse> = {}): SearchResponse {
  return {
    query: 'sprint',
    subject_id: 7,
    subject_name: 'PSM I',
    questions: EMPTY,
    guides: EMPTY,
    roadmaps: EMPTY,
    topics: EMPTY,
    recordings: EMPTY,
    ...over,
  };
}

const FULL = response({
  questions: {
    total: 9,
    items: [{ id: 11, text: 'Who owns the Sprint Goal?', domain: 'Scrum Events', topic: 'Sprint Planning', difficulty: 'medium' }],
  },
  guides: {
    total: 1,
    items: [{
      section_id: 5, title: 'Why a sprint has a goal', excerpt: '…the sprint goal gives the Developers focus…',
      written_by: 'ai', read: false, topic_id: 3, topic_title: 'Sprint Planning', roadmap_id: 2, roadmap_title: 'PSM plan',
    }],
  },
  roadmaps: { total: 1, items: [{ id: 2, title: 'Sprint mastery', phase_count: 3, topic_count: 12, linked: false }] },
  topics: {
    total: 1,
    items: [{ id: 3, title: 'Sprint Planning', status: 'in_progress', phase_name: 'Events', roadmap_id: 2, roadmap_title: 'PSM plan' }],
  },
  recordings: {
    total: 1,
    items: [{
      id: 8, title: 'Behavioral take', question_text: 'Tell me about a sprint that failed.',
      created_at: '2026-09-01T10:00:00', duration_seconds: 95, analysis_status: 'analyzed',
    }],
  },
});

beforeEach(() => {
  searchEverything.mockReset();
  preparation.selectedId = 7;
  preparation.selected = { id: 7, name: 'PSM I' };
  preparation.loading = false;
});

describe('SearchPage', () => {
  it('asks for nothing until something is typed', () => {
    renderAt('/search');
    expect(screen.getByRole('heading', { name: 'Find anything in PSM I', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Type to search')).toBeInTheDocument();
    expect(searchEverything).not.toHaveBeenCalled();
  });

  it("searches the picked preparation as you type and keeps the words in the address", async () => {
    searchEverything.mockResolvedValue(FULL);
    const user = userEvent.setup();
    renderAt('/search');

    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'sprint');

    await waitFor(() => expect(searchEverything).toHaveBeenCalledWith('sprint', 7, 6));
    expect(searchEverything).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('where')).toHaveTextContent('/search?q=sprint');
    expect(await screen.findByText('13 matches for “sprint”')).toBeInTheDocument();
  });

  it('shows every kind with its count, and links each result where it lives', async () => {
    searchEverything.mockResolvedValue(FULL);
    renderAt('/search?q=sprint');

    expect(await screen.findByRole('button', { name: 'All 13' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Questions 9' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roadmaps 2' })).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Open question 11' })).toHaveAttribute('href', '/question-bank?question=11');
    expect(screen.getByRole('link', { name: 'See all 9 in the Question Bank' }))
      .toHaveAttribute('href', '/question-bank?keyword=sprint');

    const guides = screen.getByRole('region', { name: 'Guides' });
    expect(within(guides).getByText(/drafted by AI · not read yet/)).toBeInTheDocument();
    expect(within(guides).getByRole('link')).toHaveAttribute('href', '/roadmaps/2/topics/3/guide');

    const roadmaps = screen.getByRole('region', { name: 'Roadmaps' });
    expect(within(roadmaps).getByText(/not linked to a preparation/)).toBeInTheDocument();
    expect(within(roadmaps).getByRole('link', { name: 'Open topic Sprint Planning' })).toHaveAttribute('href', '/roadmaps/2/topics/3');

    const recordings = screen.getByRole('region', { name: 'Recordings' });
    expect(within(recordings).getByText(/come from all of them, not only PSM I/)).toBeInTheDocument();
    expect(within(recordings).getByText(/1m 35s · analysed/)).toBeInTheDocument();
    expect(within(recordings).getByRole('link')).toHaveAttribute('href', '/recordings/8');
  });

  it('shows one kind, more of it, when that kind is chosen', async () => {
    searchEverything.mockResolvedValue(FULL);
    const user = userEvent.setup();
    renderAt('/search?q=sprint');

    await user.click(await screen.findByRole('button', { name: 'Recordings 1' }));

    await waitFor(() => expect(searchEverything).toHaveBeenLastCalledWith('sprint', 7, 50));
    expect(screen.getByTestId('where')).toHaveTextContent('/search?q=sprint&kind=recordings');
    expect(await screen.findByRole('region', { name: 'Recordings' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Questions' })).not.toBeInTheDocument();
  });

  it('says plainly when nothing matches', async () => {
    searchEverything.mockResolvedValue(response({ query: 'zebra' }));
    renderAt('/search?q=zebra');

    expect(await screen.findByText('Nothing matches “zebra”')).toBeInTheDocument();
    expect(screen.getByText(/No question in PSM I, roadmap topic, study guide or recording contains that text/)).toBeInTheDocument();
  });

  it('says what failed and searches again on retry', async () => {
    searchEverything.mockRejectedValueOnce({ isAxiosError: true, request: {} }).mockResolvedValue(FULL);
    const user = userEvent.setup();
    renderAt('/search?q=sprint');

    expect(await screen.findByText(/Could not search for “sprint”/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing was changed/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('button', { name: 'All 13' })).toBeInTheDocument();
  });

  it('searches every preparation when none is picked, and says so', async () => {
    preparation.selectedId = null;
    preparation.selected = null;
    searchEverything.mockResolvedValue(response({ subject_id: null, subject_name: null }));
    renderAt('/search?q=sprint');

    await waitFor(() => expect(searchEverything).toHaveBeenCalledWith('sprint', null, 6));
    expect(screen.getByRole('heading', { name: 'Find anything', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/^Every preparation:/)).toBeInTheDocument();
  });

  it('waits for the preparations before searching', () => {
    preparation.loading = true;
    renderAt('/search?q=sprint');
    expect(searchEverything).not.toHaveBeenCalled();
  });
});
