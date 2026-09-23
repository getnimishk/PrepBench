// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from './Sidebar';

const getReviewCounts = vi.fn();
vi.mock('../../services/api', () => ({
  getReviewCounts: (...a: unknown[]) => getReviewCounts(...a),
}));

const preparation = { selectedId: 4 as number | null, loading: false };
vi.mock('../../context/PreparationContext', () => ({
  usePreparation: () => preparation,
}));

let connectionState = 'online';
vi.mock('../../hooks/useConnection', () => ({
  useConnection: () => connectionState,
}));

vi.mock('../../App', () => ({
  useSidebar: () => ({ collapsed: false, toggleCollapsed: () => {} }),
}));

const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Sidebar />
  </MemoryRouter>,
);

beforeEach(() => {
  getReviewCounts.mockReset();
  getReviewCounts.mockResolvedValue({ unreviewed: 0, spaced_due: 0 });
  preparation.selectedId = 4;
  preparation.loading = false;
  connectionState = 'online';
});

describe('Sidebar', () => {
  it('lists every destination, Roadmaps among them, under the prototype headings', async () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Main' });

    // Written in title case and set in capitals by CSS, as the prototype's .navgroup is.
    for (const heading of ['Today', 'Certification', 'Interview', 'Evidence', 'Workspace', 'Learning Lab']) {
      expect(within(nav).getByText(heading)).toBeInTheDocument();
    }
    // 14 original destinations + 2 Learning Lab entries (All Sandboxes, Agile Metrics) = 16.
    expect(within(nav).getAllByRole('link')).toHaveLength(16);
    expect(within(nav).getByRole('link', { name: 'Roadmaps' })).toHaveAttribute('href', '/roadmaps');
    expect(within(nav).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
    expect(within(nav).getByRole('link', { name: 'All Sandboxes' })).toHaveAttribute('href', '/lab');
    expect(within(nav).getByRole('link', { name: 'Agile Metrics' })).toHaveAttribute('href', '/chart-sandbox');
    await waitFor(() => expect(getReviewCounts).toHaveBeenCalled());
  });

  it('marks the section a nested screen belongs to', async () => {
    renderAt('/roadmaps/3/edit');
    const roadmaps = screen.getByRole('link', { name: 'Roadmaps' });
    expect(roadmaps).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
    await waitFor(() => expect(getReviewCounts).toHaveBeenCalled());
  });

  it("counts the picked preparation's waiting review on the Review Queue, and says what the number is", async () => {
    getReviewCounts.mockResolvedValue({ unreviewed: 3, spaced_due: 2 });
    renderAt('/');

    const review = await screen.findByRole('link', { name: 'Review Queue, 5 waiting: 3 misses to read, 2 due from memory' });
    expect(within(review).getByText('5')).toBeInTheDocument();
    expect(getReviewCounts).toHaveBeenCalledWith(4);
  });

  it('shows no number when nothing is waiting', async () => {
    renderAt('/');
    await waitFor(() => expect(getReviewCounts).toHaveBeenCalled());
    expect(screen.getByRole('link', { name: 'Review Queue' })).toHaveAccessibleName('Review Queue');
  });

  it('shows no number rather than a zero when the count cannot be read', async () => {
    getReviewCounts.mockRejectedValue({ isAxiosError: true, request: {} });
    renderAt('/');
    await waitFor(() => expect(getReviewCounts).toHaveBeenCalled());
    expect(screen.getByRole('link', { name: 'Review Queue' })).toHaveAccessibleName('Review Queue');
  });

  it('waits for the preparations and for the server before counting', () => {
    preparation.loading = true;
    const { unmount } = renderAt('/');
    expect(getReviewCounts).not.toHaveBeenCalled();
    unmount();

    preparation.loading = false;
    connectionState = 'unreachable';
    renderAt('/');
    expect(getReviewCounts).not.toHaveBeenCalled();
  });
});
