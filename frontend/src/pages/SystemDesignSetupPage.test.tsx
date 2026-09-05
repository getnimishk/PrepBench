// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SystemDesignSetupPage } from './SystemDesignSetupPage';

const mockGetPrompts = vi.fn();
const mockGetCategories = vi.fn();
const mockGenerate = vi.fn();
const mockGetAttempts = vi.fn();

vi.mock('../services/api', () => ({
  getSystemDesignPrompts: (...args: any[]) => mockGetPrompts(...args),
  getSystemDesignPromptCategories: (...args: any[]) => mockGetCategories(...args),
  generateSystemDesignPrompt: (...args: any[]) => mockGenerate(...args),
  getSystemDesignAttempts: (...args: any[]) => mockGetAttempts(...args),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/system-design']}>
      <Routes>
        <Route path="/system-design" element={<SystemDesignSetupPage />} />
        <Route path="/system-design/:promptId/answer" element={<div>Answer Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetPrompts.mockResolvedValue({
    items: [
      { id: 1, title: 'Design a URL Shortener', prompt_text: 'Design a URL shortener.', category: 'Distributed Systems', difficulty: 'easy', is_ai_generated: false, created_at: '' },
    ],
    total: 1,
    skip: 0,
    limit: 100,
  });
  mockGetCategories.mockResolvedValue(['Distributed Systems']);
  mockGetAttempts.mockResolvedValue({ items: [], total: 0, skip: 0, limit: 200 });
});

describe('SystemDesignSetupPage', () => {
  it('shows the problem itself rather than a catalogue to filter', async () => {
    // The page used to open on a "give me a problem" button above twenty-four
    // category chips, three difficulty chips and a grid of cards. Deciding
    // "yes, this one" needs the problem on screen.
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Your problem')).toBeInTheDocument();
    expect(screen.getByText('Design a URL Shortener')).toBeInTheDocument();
    expect(screen.getByText('Design a URL shortener.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(await screen.findByText('Answer Page')).toBeInTheDocument();
  });

  it('offers a problem that has not been answered yet', async () => {
    mockGetPrompts.mockResolvedValue({
      items: [
        { id: 1, title: 'Already done', prompt_text: '.', category: 'c', difficulty: 'easy', is_ai_generated: false, created_at: '' },
        { id: 2, title: 'Not yet', prompt_text: '.', category: 'c', difficulty: 'easy', is_ai_generated: false, created_at: '' },
      ],
      total: 2, skip: 0, limit: 100,
    });
    mockGetAttempts.mockResolvedValue({
      items: [{ prompt_id: 1 }], total: 1, skip: 0, limit: 200,
    });

    renderPage();

    // Only prompt 2 is unattempted, so that is what is put in front of you.
    expect(await screen.findByRole('heading', { name: 'Not yet' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Already done' })).not.toBeInTheDocument();
  });

  it('keeps the prompt bank one disclosure away', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Your problem');

    expect(screen.queryByLabelText('Category')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /browse prompts/i }));
    expect(await screen.findByLabelText('Category')).toBeInTheDocument();
  });

  it('shows an inline error and does not navigate when generation fails (e.g. no API key)', async () => {
    const user = userEvent.setup();
    // Matches what the backend actually returns since the provider layer landed:
    // vendor-neutral, and pointing at the setup flow rather than one vendor's key.
    mockGenerate.mockRejectedValue({ response: { data: { detail: 'No AI provider is set up yet. Add one in Settings -> AI Providers to generate prompts.' } } });
    renderPage();
    await waitFor(() => expect(screen.getByText('Design a URL Shortener')).toBeInTheDocument());

    // Generation lives behind a disclosure now: writing a prompt is content
    // work, and the page leads with the problem you came to answer.
    await user.click(screen.getByRole('button', { name: /write me a new one/i }));
    await user.click(screen.getByRole('button', { name: /write it/i }));

    await waitFor(() => {
      expect(screen.getByText(/Settings -> AI Providers/i)).toBeInTheDocument();
    });
    // Still on the setup page -- the "Answer Page" stub never rendered.
    expect(screen.queryByText('Answer Page')).not.toBeInTheDocument();
  });
});
