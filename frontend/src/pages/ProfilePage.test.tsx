// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ProfilePage } from './ProfilePage';
import { PROFILE_UPDATED } from '../hooks/useProfileName';
import type { Profile } from '../types/profile';

const api = { getProfile: vi.fn(), updateProfile: vi.fn() };
vi.mock('../services/api', () => ({
  getProfile: (...a: unknown[]) => api.getProfile(...a),
  updateProfile: (...a: unknown[]) => api.updateProfile(...a),
}));

const PROFILE: Profile = {
  display_name: 'Nimish Kanungo',
  email: 'nimish@example.com',
  timezone: { name: 'India Standard Time', utc_offset_minutes: 330 },
  stats: { preparations: 6, questions: 1750, mocks_taken: 17, days_active: 142, active_since: '2026-03-02' },
  storage: { database_bytes: 39_000_000, recordings_bytes: 5_000_000 },
};

const renderPage = () => render(<MemoryRouter><ProfilePage /></MemoryRouter>);

beforeEach(() => {
  api.getProfile.mockReset();
  api.updateProfile.mockReset();
  api.getProfile.mockResolvedValue(PROFILE);
});

describe('ProfilePage', () => {
  it('shows who this copy belongs to and what has been done in it, counted from the data', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Profile', level: 1 })).toBeInTheDocument();
    const identity = screen.getByRole('region', { name: 'Identity' });
    expect(within(identity).getByText('NK')).toBeInTheDocument();
    expect(within(identity).getByDisplayValue('Nimish Kanungo')).toBeInTheDocument();
    expect(within(identity).getByText('India Standard Time (GMT+5:30)')).toBeInTheDocument();

    const totals = screen.getByRole('region', { name: 'Across all preparations' });
    expect(within(totals).getByText('1,750')).toBeInTheDocument();
    expect(within(totals).getByText('mocks taken')).toBeInTheDocument();
    expect(within(totals).getByText('142')).toBeInTheDocument();
    expect(within(totals).getByText(/^since /)).toBeInTheDocument();
    expect(within(totals).getByText('37 MB')).toBeInTheDocument();
    expect(within(totals).getByRole('link', { name: 'Manage data' })).toHaveAttribute('href', '/settings/data');
  });

  it('offers no sign-out, because there is no account', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Profile', level: 1 });
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
    expect(screen.getByText(/no account to sign in to or out of/)).toBeInTheDocument();
  });

  it('names nobody until a name is written', async () => {
    api.getProfile.mockResolvedValue({ ...PROFILE, display_name: null, email: null });
    renderPage();

    expect(await screen.findByText('No name yet')).toBeInTheDocument();
    expect(screen.getByText('No email')).toBeInTheDocument();
  });

  it('saves the name and email, and tells the header', async () => {
    const user = userEvent.setup();
    const heard = vi.fn();
    window.addEventListener(PROFILE_UPDATED, heard);
    api.updateProfile.mockImplementation(async (update) => ({ ...PROFILE, ...update }));
    renderPage();

    const save = await screen.findByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    const name = screen.getByLabelText('Display name');
    await user.clear(name);
    await user.type(name, 'Ada Lovelace');
    await user.click(save);

    await waitFor(() => expect(api.updateProfile).toHaveBeenCalledWith({ display_name: 'Ada Lovelace', email: 'nimish@example.com' }));
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    expect(heard).toHaveBeenCalledTimes(1);
    window.removeEventListener(PROFILE_UPDATED, heard);
  });

  it('will not save what is not an email address', async () => {
    const user = userEvent.setup();
    renderPage();

    const email = await screen.findByLabelText('Email');
    await user.clear(email);
    await user.type(email, 'not-an-email');

    expect(screen.getByText('That does not look like an email address.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('says a save that failed saved nothing', async () => {
    const user = userEvent.setup();
    api.updateProfile.mockRejectedValue({ response: { data: { detail: 'Database is locked.' } } });
    renderPage();

    await user.type(await screen.findByLabelText('Display name'), ' Jr');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Database is locked. Nothing was saved.')).toBeInTheDocument();
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
  });

  it('says it could not load and tries again', async () => {
    const user = userEvent.setup();
    api.getProfile.mockRejectedValueOnce({ isAxiosError: true, request: {} });
    renderPage();

    expect(await screen.findByText('Could not load your profile')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByDisplayValue('Nimish Kanungo')).toBeInTheDocument();
  });
});
