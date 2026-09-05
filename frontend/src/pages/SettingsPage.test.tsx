// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPage } from './SettingsPage';
import { CustomThemeProvider, useThemeMode } from '../context/ThemeContext';
import { AppSettings } from '../types/settings';

// useThemeMode()'s default (no-provider) context value has a no-op
// setThemeMode, which would make SettingsPage's theme-sync calls silently do
// nothing -- rendering under the real provider and probing its mode proves
// fetchSettings/handleSave actually drive the app-wide theme, not a no-op.
function ThemeModeProbe() {
  const { mode } = useThemeMode();
  return <div data-testid="active-theme-mode">{mode}</div>;
}

const mockGetSettings = vi.fn();
const mockUpdateSettings = vi.fn();
const mockResetApplication = vi.fn();

vi.mock('../services/api', () => ({
  getSettings: (...args: any[]) => mockGetSettings(...args),
  updateSettings: (...args: any[]) => mockUpdateSettings(...args),
  resetApplication: (...args: any[]) => mockResetApplication(...args),
  // SettingsPage now also renders AIProvidersSection, which loads from these.
  // Without them the mocked module returns undefined and the whole page
  // crashes on render -- these tests would fail for a reason unrelated to
  // what they are actually asserting.
  getLLMProfiles: () => Promise.resolve([]),
  getLLMProviders: () => Promise.resolve([]),
  getLLMTasks: () => Promise.resolve([]),
  createLLMProvider: () => Promise.resolve({}),
  updateLLMProvider: () => Promise.resolve({}),
  deleteLLMProvider: () => Promise.resolve({}),
  verifyLLMProvider: () => Promise.resolve({}),
  getLLMProviderModels: () => Promise.resolve({ models: [], error: null }),
  setLLMTaskBinding: () => Promise.resolve({}),
  detectLocalRunners: () => Promise.resolve([]),
  getSystemInfo: () => Promise.resolve({ os_family: 'windows', total_ram_gb: 16, available_ram_gb: 8, usable_for_model_gb: 14 }),
  getLocalModelOptions: () => Promise.resolve([]),
  getLocalRunners: () => Promise.resolve([]),
  buildLauncherScript: () => Promise.resolve({ filename: 'x.bat', content: '', command: '', os_family: 'windows', port: 8080 }),
}));

function makeSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    theme: 'dark',
    timer_sound_enabled: true,
    initial_seed_completed: true,
    default_target_role: null,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <CustomThemeProvider>
        <ThemeModeProbe />
        <SettingsPage />
      </CustomThemeProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SettingsPage', () => {
  it('loads and displays current settings, including a blank default target role', async () => {
    mockGetSettings.mockResolvedValue(makeSettings({ theme: 'dark' }));
    renderPage();

    await waitFor(() => expect(screen.getByLabelText(/default target role/i)).toBeInTheDocument());
    expect(screen.getByLabelText(/default target role/i)).toHaveValue('');
    // Proves fetchSettings' setThemeMode(data.theme) call actually reaches
    // the real ThemeContext provider, not a no-op default context value.
    expect(screen.getByTestId('active-theme-mode')).toHaveTextContent('dark');
  });

  it('applies a newly saved theme immediately, not just to local settings state', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue(makeSettings({ theme: 'dark' }));
    mockUpdateSettings.mockImplementation(async (data) => makeSettings(data));
    renderPage();

    await waitFor(() => expect(screen.getByTestId('active-theme-mode')).toHaveTextContent('dark'));

    await user.click(screen.getByLabelText(/^theme$/i));
    await user.click(await screen.findByRole('option', { name: 'Light' }));
    await user.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith(expect.objectContaining({ theme: 'light' }));
    });
    await waitFor(() => expect(screen.getByTestId('active-theme-mode')).toHaveTextContent('light'));
  });

  it('saves edited settings, including the default target role', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue(makeSettings());
    mockUpdateSettings.mockImplementation(async (data) => makeSettings(data));
    renderPage();

    await waitFor(() => expect(screen.getByLabelText(/default target role/i)).toBeInTheDocument());
    await user.type(screen.getByLabelText(/default target role/i), 'Staff SRE');
    await user.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ default_target_role: 'Staff SRE' })
      );
    });
    await waitFor(() => expect(screen.getByText(/^saved\.$/i)).toBeInTheDocument());
  });

  it('shows an inline error when saving fails', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue(makeSettings());
    mockUpdateSettings.mockRejectedValue({ response: { data: { detail: 'Passing percentage must be between 1 and 100.' } } });
    renderPage();

    await waitFor(() => expect(screen.getByRole('button', { name: /save settings/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() => expect(screen.getByText('Passing percentage must be between 1 and 100.')).toBeInTheDocument());
  });

  it('requires typing RESET before the factory reset can be confirmed, then resets and reloads settings', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue(makeSettings());
    mockResetApplication.mockResolvedValue({});
    renderPage();

    await waitFor(() => expect(screen.getByRole('button', { name: /reset the application/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /reset the application/i }));

    const confirmButton = screen.getByRole('button', { name: /confirm reset/i });
    expect(confirmButton).toBeDisabled();

    await user.type(screen.getByPlaceholderText(/type reset/i), 'RESET');
    expect(confirmButton).not.toBeDisabled();

    mockGetSettings.mockResolvedValue(makeSettings());
    await user.click(confirmButton);

    await waitFor(() => expect(mockResetApplication).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/completely reset to fresh empty state/i)).toBeInTheDocument());
    // The reset modal itself closes after a successful confirm. Awaited rather
    // than asserted synchronously: MUI keeps a Dialog's children mounted for
    // the duration of its exit transition, so the node outlives the state
    // change that closed it. The assertion is the same -- it just has to be
    // allowed to happen.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /confirm reset/i })).not.toBeInTheDocument()
    );
  });

  it('shows a retry-able error state when the initial settings fetch fails', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockRejectedValue(new Error('network error'));
    renderPage();

    await waitFor(() => expect(screen.getByText(/Failed to load settings/i)).toBeInTheDocument());

    mockGetSettings.mockResolvedValue(makeSettings());
    await user.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(screen.getByLabelText(/default target role/i)).toBeInTheDocument());
  });
});
