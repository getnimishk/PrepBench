// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LearningLabPage } from './LearningLabPage';

describe('LearningLabPage', () => {
  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={['/lab']}>
        <LearningLabPage />
      </MemoryRouter>,
    );

  it('renders the page header with eyebrow and title', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Interactive Sandboxes' })).toBeInTheDocument();
    expect(screen.getByText('Learning Lab')).toBeInTheDocument();
  });

  it('renders the 4-step simulation loop with semantic h2 heading', () => {
    renderPage();
    const section = screen.getByRole('region', { name: 'The simulation loop' });
    expect(within(section).getByRole('heading', { level: 2, name: 'The simulation loop' })).toBeInTheDocument();

    expect(within(section).getByText('1 · Predict')).toBeInTheDocument();
    expect(within(section).getByText('2 · Manipulate')).toBeInTheDocument();
    expect(within(section).getByText('3 · Observe')).toBeInTheDocument();
    expect(within(section).getByText('4 · Explain')).toBeInTheDocument();
  });

  it('renders the available sandboxes section and all 3 domain cards', () => {
    renderPage();
    const section = screen.getByRole('region', { name: 'Available sandboxes' });
    expect(within(section).getByRole('heading', { level: 2, name: 'Available sandboxes' })).toBeInTheDocument();

    // Card titles as h3
    expect(screen.getByRole('heading', { level: 3, name: 'Agile Metrics' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Databricks Architecture' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Financial Learning' })).toBeInTheDocument();
  });

  it('marks Agile Metrics as live with active link to /chart-sandbox', () => {
    renderPage();
    const card = screen.getByRole('heading', { level: 3, name: 'Agile Metrics' }).closest('article')!;
    expect(within(card).getByText('Live')).toBeInTheDocument();

    const cta = within(card).getByRole('link', { name: 'Open sandbox: Agile Metrics' });
    expect(cta).toHaveAttribute('href', '/chart-sandbox');

    // Check all 6 metric families
    for (const family of ['Flow', 'Predictability', 'Quality', 'Team health', 'DORA', 'Reliability']) {
      expect(within(card).getByText(family)).toBeInTheDocument();
    }
  });

  it('renders Databricks and Financial sandboxes as coming soon with disabled buttons', () => {
    renderPage();
    const databricksCard = screen.getByRole('heading', { level: 3, name: 'Databricks Architecture' }).closest('article')!;
    expect(within(databricksCard).getByText('Coming soon')).toBeInTheDocument();
    const dbBtn = within(databricksCard).getByRole('button', { name: 'Databricks Architecture is not yet available' });
    expect(dbBtn).toBeDisabled();

    const financeCard = screen.getByRole('heading', { level: 3, name: 'Financial Learning' }).closest('article')!;
    expect(within(financeCard).getByText('Coming soon')).toBeInTheDocument();
    const finBtn = within(financeCard).getByRole('button', { name: 'Financial Learning is not yet available' });
    expect(finBtn).toBeDisabled();
  });

  it('gives every action a name that contains what it says on screen', () => {
    // WCAG 2.5.3 Label in Name. Asserted as the rule rather than as one exact
    // string, because the exact string is what let the defect in: this file
    // used to expect "Open the Agile Metrics sandbox" for a button reading
    // "Open sandbox", so the test enforced the mismatch it should have caught.
    renderPage();
    const actions = [...screen.getAllByRole('link'), ...screen.getAllByRole('button')];
    expect(actions.length).toBeGreaterThan(0);
    for (const el of actions) {
      const visible = (el.textContent ?? '').trim().toLowerCase();
      const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().toLowerCase();
      expect(name, `"${name}" should contain the visible text "${visible}"`).toContain(visible);
    }
  });
});
