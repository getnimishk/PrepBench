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
}));

function makeSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    theme: 'dark',
    timer_sound_enabled: true,
    default_exam_mode: 'timed',
    default_questions_count: 80,
    default_passing_percentage: 70,
    shuffle_questions: true,
    shuffle_options: true,
    daily_practice_goal: 20,
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

    await user.click(screen.getByLabelText(/theme mode/i));
    await user.click(await screen.findByRole('option', { name: 'Light Mode' }));
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
    await waitFor(() => expect(screen.getByText(/settings saved successfully/i)).toBeInTheDocument());
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

    await waitFor(() => expect(screen.getByRole('button', { name: /reset entire application/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /reset entire application/i }));

    const confirmButton = screen.getByRole('button', { name: /confirm reset/i });
    expect(confirmButton).toBeDisabled();

    await user.type(screen.getByPlaceholderText(/type reset/i), 'RESET');
    expect(confirmButton).not.toBeDisabled();

    mockGetSettings.mockResolvedValue(makeSettings({ default_questions_count: 80 }));
    await user.click(confirmButton);

    await waitFor(() => expect(mockResetApplication).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/completely reset to fresh empty state/i)).toBeInTheDocument());
    // The reset modal itself closes after a successful confirm.
    expect(screen.queryByRole('button', { name: /confirm reset/i })).not.toBeInTheDocument();
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
