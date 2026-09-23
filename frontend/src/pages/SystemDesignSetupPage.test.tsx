// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useParams } from 'react-router-dom';
import { SystemDesignSetupPage } from './SystemDesignSetupPage';

const mockGetPrompts = vi.fn();
const mockGenerate = vi.fn();
const mockGetAttempts = vi.fn();

vi.mock('../services/api', () => ({
  getSystemDesignPrompts: (...args: any[]) => mockGetPrompts(...args),
  generateSystemDesignPrompt: (...args: any[]) => mockGenerate(...args),
  getSystemDesignAttempts: (...args: any[]) => mockGetAttempts(...args),
}));

const AnswerStub = () => <div>Answer Page {useParams().promptId}</div>;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/system-design']}>
      <Routes>
        <Route path="/system-design" element={<SystemDesignSetupPage />} />
        <Route path="/system-design/:promptId/answer" element={<AnswerStub />} />
      </Routes>
    </MemoryRouter>
  );
}

const prompt = (id: number, title: string, category = 'Distributed Systems', extra: object = {}) => ({
  id, title, prompt_text: `${title} -- the brief.`, category, difficulty: 'easy', is_ai_generated: false, created_at: '', ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetPrompts.mockResolvedValue({ items: [prompt(1, 'Design a URL Shortener')], total: 1, skip: 0, limit: 500 });
  mockGetAttempts.mockResolvedValue({ items: [], total: 0, skip: 0, limit: 500 });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SystemDesignSetupPage', () => {
  it('shows every prompt as a card with the way into an answer', async () => {
    const user = userEvent.setup();
    renderPage();

    const card = await screen.findByRole('article', { name: 'Design a URL Shortener' });
    expect(within(card).getByRole('heading', { name: 'Design a URL Shortener' })).toBeInTheDocument();
    expect(within(card).getByText('Design a URL Shortener -- the brief.')).toBeInTheDocument();
    expect(within(card).getByText('Rubric scored · 6 dimensions')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'All prompts (1)' })).toBeInTheDocument();

    await user.click(within(card).getByRole('button', { name: /start architecture answer/i }));
    expect(await screen.findByText('Answer Page 1')).toBeInTheDocument();
  });

  it('filters the grid by category', async () => {
    mockGetPrompts.mockResolvedValue({
      items: [prompt(1, 'Design a URL Shortener'), prompt(2, 'Design a CDN', 'Caching')],
      total: 2, skip: 0, limit: 500,
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('article', { name: 'Design a CDN' });

    await user.click(screen.getByRole('tab', { name: 'Caching' }));
    expect(screen.getByRole('article', { name: 'Design a CDN' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Design a URL Shortener' })).not.toBeInTheDocument();
  });

  it('says how often a prompt has been answered', async () => {
    mockGetAttempts.mockResolvedValue({ items: [{ prompt_id: 1 }, { prompt_id: 1 }], total: 2, skip: 0, limit: 500 });
    renderPage();

    const card = await screen.findByRole('article', { name: 'Design a URL Shortener' });
    await waitFor(() => expect(within(card).getByText('Rubric scored · 6 dimensions · answered 2 times')).toBeInTheDocument());
  });

  it('picks a random challenge from the prompts not answered yet', async () => {
    mockGetPrompts.mockResolvedValue({
      items: [prompt(1, 'Already done'), prompt(2, 'Not yet')],
      total: 2, skip: 0, limit: 500,
    });
    mockGetAttempts.mockResolvedValue({ items: [{ prompt_id: 1 }], total: 1, skip: 0, limit: 500 });
    // Whatever the draw, only prompt 2 is in the pool.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText(/answered once/)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Random practice challenge' }));
    expect(await screen.findByText('Answer Page 2')).toBeInTheDocument();
  });

  it('shows an inline error and does not navigate when generation fails (e.g. no API key)', async () => {
    const user = userEvent.setup();
    // Matches what the backend actually returns since the provider layer landed:
    // vendor-neutral, and pointing at the setup flow rather than one vendor's key.
    mockGenerate.mockRejectedValue({ response: { data: { detail: 'No AI provider is set up yet. Add one in Settings -> AI Providers to generate prompts.' } } });
    renderPage();
    await screen.findByRole('article', { name: 'Design a URL Shortener' });

    // Writing a prompt is content work, so it waits behind its own button.
    expect(screen.queryByRole('button', { name: /write it/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /write me a new one/i }));
    await user.click(await screen.findByRole('button', { name: /write it/i }));

    await waitFor(() => {
      expect(screen.getByText(/Settings -> AI Providers/i)).toBeInTheDocument();
    });
    expect(mockGenerate).toHaveBeenCalledWith(expect.objectContaining({ save_to_bank: true }));
    expect(screen.queryByText(/Answer Page/)).not.toBeInTheDocument();
  });

  it('says so when the bank has no prompts', async () => {
    mockGetPrompts.mockResolvedValue({ items: [], total: 0, skip: 0, limit: 500 });
    renderPage();
    expect(await screen.findByText(/There are no prompts yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Random practice challenge' })).toBeDisabled();
  });
});
