import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SystemDesignSetupPage } from './SystemDesignSetupPage';

const mockGetPrompts = vi.fn();
const mockGetCategories = vi.fn();
const mockGenerate = vi.fn();

vi.mock('../services/api', () => ({
  getSystemDesignPrompts: (...args: any[]) => mockGetPrompts(...args),
  getSystemDesignPromptCategories: (...args: any[]) => mockGetCategories(...args),
  generateSystemDesignPrompt: (...args: any[]) => mockGenerate(...args),
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
});

describe('SystemDesignSetupPage', () => {
  it('renders the prompt bank list', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Design a URL Shortener')).toBeInTheDocument());
  });

  it('navigates to the answer page when a prompt card is clicked', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText('Design a URL Shortener')).toBeInTheDocument());

    await user.click(screen.getByText('Design a URL Shortener'));
    await waitFor(() => expect(screen.getByText('Answer Page')).toBeInTheDocument());
  });

  it('shows an inline error and does not navigate when generation fails (e.g. no API key)', async () => {
    const user = userEvent.setup();
    // Matches what the backend actually returns since the provider layer landed:
    // vendor-neutral, and pointing at the setup flow rather than one vendor's key.
    mockGenerate.mockRejectedValue({ response: { data: { detail: 'No AI provider is set up yet. Add one in Settings -> AI Providers to generate prompts.' } } });
    renderPage();
    await waitFor(() => expect(screen.getByText('Design a URL Shortener')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /generate/i }));

    await waitFor(() => {
      expect(screen.getByText(/Settings -> AI Providers/i)).toBeInTheDocument();
    });
    // Still on the setup page -- the "Answer Page" stub never rendered.
    expect(screen.queryByText('Answer Page')).not.toBeInTheDocument();
  });
});
