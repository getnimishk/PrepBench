// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RoadmapOwnerNotice } from './RoadmapOwnerNotice';

const select = vi.fn();
let selectedId: number | null = 6;
vi.mock('../../context/PreparationContext', () => ({
  usePreparation: () => ({
    selectedId,
    select,
    preparations: [{ id: 2, name: 'Databricks Data Platform' }, { id: 6, name: 'ADF' }],
  }),
}));

const renderNotice = (ownerId: number | null) => render(
  <MemoryRouter><RoadmapOwnerNotice ownerId={ownerId} /></MemoryRouter>,
);

beforeEach(() => { select.mockReset(); selectedId = 6; });

describe('RoadmapOwnerNotice', () => {
  it('says whose roadmap this is after switching away, and switches only when asked', async () => {
    renderNotice(2);
    expect(screen.getByRole('status')).toHaveTextContent('This roadmap belongs to Databricks Data Platform, not ADF.');
    expect(screen.getByRole('link', { name: "Open ADF's roadmaps" })).toHaveAttribute('href', '/roadmaps');
    expect(select).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Switch to Databricks Data Platform' }));
    expect(select).toHaveBeenCalledWith(2);
  });

  it('says nothing when the roadmap is the picked preparation\'s, belongs to none, or nothing is picked', () => {
    const { rerender } = renderNotice(6);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    rerender(<MemoryRouter><RoadmapOwnerNotice ownerId={null} /></MemoryRouter>);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    selectedId = null;
    rerender(<MemoryRouter><RoadmapOwnerNotice ownerId={2} /></MemoryRouter>);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('offers no switch to an owner that is not in the picker (archived)', () => {
    renderNotice(9);
    expect(screen.getByRole('status')).toHaveTextContent('This roadmap belongs to another preparation, not ADF.');
    expect(screen.queryByRole('button', { name: /Switch to/ })).not.toBeInTheDocument();
  });
});
