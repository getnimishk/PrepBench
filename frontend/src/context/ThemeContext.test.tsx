// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomThemeProvider, useThemeMode } from './ThemeContext';

const mockGet = vi.fn();
const mockUpdate = vi.fn();

vi.mock('../services/api', () => ({
  getSettings: (...a: unknown[]) => mockGet(...a),
  updateSettings: (...a: unknown[]) => mockUpdate(...a),
}));

const Probe: React.FC = () => {
  const { mode, toggleTheme } = useThemeMode();
  return (
    <>
      <span data-testid="mode">{mode}</span>
      <button type="button" onClick={toggleTheme}>toggle</button>
    </>
  );
};

describe('ThemeContext', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockUpdate.mockReset();
    mockGet.mockResolvedValue({ theme: 'light', timer_sound_enabled: true, default_target_role: null });
    mockUpdate.mockResolvedValue({ theme: 'dark', timer_sound_enabled: true, default_target_role: null });
  });

  it('starts from the stored theme', async () => {
    mockGet.mockResolvedValue({ theme: 'dark', timer_sound_enabled: true, default_target_role: null });
    render(<CustomThemeProvider><Probe /></CustomThemeProvider>);
    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('dark'));
  });

  // The app-bar toggle used to change `mode` and nothing else, so the choice
  // survived until the next reload and was then silently replaced by whatever
  // Settings had stored. Persisting is the whole behaviour of the control.
  it('writes the switched theme back, keeping the rest of the record', async () => {
    render(<CustomThemeProvider><Probe /></CustomThemeProvider>);
    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('light'));

    await userEvent.click(screen.getByRole('button', { name: 'toggle' }));

    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
    expect(mockUpdate).toHaveBeenCalledWith({
      theme: 'dark',
      timer_sound_enabled: true,
      default_target_role: null,
    });
  });
});
