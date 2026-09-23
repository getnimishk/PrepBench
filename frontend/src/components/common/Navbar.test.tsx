// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { ImportLauncherContext } from '../../context/importLauncherContext';
import { PROFILE_UPDATED } from '../../hooks/useProfileName';

const api = {
  getProfile: vi.fn(),
  getNotifications: vi.fn(),
};
vi.mock('../../services/api', () => ({
  getProfile: (...a: unknown[]) => api.getProfile(...a),
  getNotifications: (...a: unknown[]) => api.getNotifications(...a),
}));

const preferences = { shortcutsEnabled: true };
vi.mock('../../context/ThemeContext', () => ({
  useThemeMode: () => ({
    mode: 'light',
    toggleTheme: vi.fn(),
    preferences,
    updatePreferences: vi.fn(),
    preferencesStatus: 'ready',
    reloadPreferences: vi.fn(),
  }),
}));

vi.mock('../../context/PreparationContext', () => ({
  usePreparation: () => ({
    preparations: [], selected: { id: 1, name: 'PSM I' }, selectedId: 1, select: vi.fn(),
    loading: false, error: null, refresh: vi.fn(),
  }),
}));

const Where: React.FC = () => <div data-testid="where">{useLocation().pathname}</div>;

function renderAt(path: string, { minimal = false, openImport = vi.fn() } = {}) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <ImportLauncherContext.Provider value={{ openImport }}>
        <Navbar minimal={minimal} />
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </ImportLauncherContext.Provider>
    </MemoryRouter>,
  );
  return { openImport };
}

const PROFILE = {
  display_name: 'Ada Lovelace', email: 'ada@example.com',
  timezone: { name: 'GMT', utc_offset_minutes: 0 },
  stats: { preparations: 1, questions: 2, mocks_taken: 0, days_active: 1, active_since: '2026-09-01' },
  storage: { database_bytes: 1024, recordings_bytes: 0 },
};

beforeEach(() => {
  api.getProfile.mockReset();
  api.getNotifications.mockReset();
  api.getProfile.mockResolvedValue(PROFILE);
  api.getNotifications.mockResolvedValue([]);
  preferences.shortcutsEnabled = true;
});

describe('Navbar', () => {
  it('says which section and preparation the screen is showing', async () => {
    renderAt('/roadmaps/3/edit');
    expect(screen.getByTestId('header-context')).toHaveTextContent('Roadmaps · PSM I');
    await waitFor(() => expect(api.getProfile).toHaveBeenCalled());
  });

  it('names no section for an address nothing answers', async () => {
    renderAt('/no-such-page');
    expect(screen.queryByTestId('header-context')).not.toBeInTheDocument();
    await waitFor(() => expect(api.getProfile).toHaveBeenCalled());
  });

  it('offers search, import and the profile from any screen', async () => {
    const user = userEvent.setup();
    const { openImport } = renderAt('/review');

    expect(screen.getByRole('link', { name: 'Search' })).toHaveAttribute('href', '/search');
    await user.click(screen.getByRole('button', { name: 'Import' }));
    expect(openImport).toHaveBeenCalledTimes(1);

    const profile = await screen.findByRole('link', { name: 'Profile: Ada Lovelace' });
    expect(profile).toHaveAttribute('href', '/profile');
    expect(profile).toHaveTextContent('AL');
  });

  it('draws no invented initials when no name has been written', async () => {
    api.getProfile.mockResolvedValue({ ...PROFILE, display_name: null });
    renderAt('/');
    const profile = await screen.findByRole('link', { name: 'Profile' });
    await waitFor(() => expect(api.getProfile).toHaveBeenCalled());
    expect(profile).not.toHaveTextContent(/[A-Z]/);
  });

  it('redraws the initials when the profile is saved', async () => {
    renderAt('/');
    await screen.findByRole('link', { name: 'Profile: Ada Lovelace' });

    api.getProfile.mockResolvedValue({ ...PROFILE, display_name: 'Grace Hopper' });
    act(() => { window.dispatchEvent(new Event(PROFILE_UPDATED)); });

    expect(await screen.findByRole('link', { name: 'Profile: Grace Hopper' })).toHaveTextContent('GH');
  });

  it('opens search on "/" unless shortcuts are switched off or a field has the keyboard', async () => {
    renderAt('/review');
    await waitFor(() => expect(api.getProfile).toHaveBeenCalled());

    fireEvent.keyDown(window, { key: '/' });
    expect(screen.getByTestId('where')).toHaveTextContent('/search');
  });

  it('leaves "/" alone when shortcuts are off', async () => {
    preferences.shortcutsEnabled = false;
    renderAt('/review');
    await waitFor(() => expect(api.getProfile).toHaveBeenCalled());

    fireEvent.keyDown(window, { key: '/' });
    expect(screen.getByTestId('where')).toHaveTextContent('/review');
  });

  it('keeps focus screens free of every way out', () => {
    renderAt('/exam/4', { minimal: true });

    expect(screen.queryByRole('link', { name: 'Search' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Profile/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId('header-context')).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: '/' });
    expect(screen.getByTestId('where')).toHaveTextContent('/exam/4');
  });
});
