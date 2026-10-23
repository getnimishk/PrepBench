// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { ScrollToTop } from './ScrollToTop';

const Shell = () => (
  <MemoryRouter initialEntries={['/a']}>
    <ScrollToTop />
    <Link to="/b">to b</Link>
    <Link to="/a?tab=2">same page, new query</Link>
    <Link to="/b#part">to b part</Link>
    <Routes>
      <Route path="/a" element={<p>page a</p>} />
      <Route path="/b" element={<p>page b</p>} />
    </Routes>
  </MemoryRouter>
);

let scrollTo: ReturnType<typeof vi.fn>;
beforeEach(() => { scrollTo = vi.fn(); window.scrollTo = scrollTo as unknown as typeof window.scrollTo; });
afterEach(() => vi.restoreAllMocks());

describe('ScrollToTop', () => {
  it('scrolls to the top when the path changes', async () => {
    render(<Shell />);
    scrollTo.mockClear();
    await userEvent.click(screen.getByRole('link', { name: 'to b' }));
    expect(await screen.findByText('page b')).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0, left: 0 }));
  });

  it('leaves the scroll alone for a query change on the same path', async () => {
    render(<Shell />);
    scrollTo.mockClear();
    await userEvent.click(screen.getByRole('link', { name: 'same page, new query' }));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('leaves the scroll alone when the link names a #hash', async () => {
    render(<Shell />);
    scrollTo.mockClear();
    await userEvent.click(screen.getByRole('link', { name: 'to b part' }));
    expect(await screen.findByText('page b')).toBeInTheDocument();
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
