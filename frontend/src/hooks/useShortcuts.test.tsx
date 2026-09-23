// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomThemeProvider } from '../context/ThemeContext';
import { useShortcuts } from './useShortcuts';
import { EXAM_SHORTCUTS } from '../services/shortcuts';

const mockGetSettings = vi.fn();

vi.mock('../services/api', () => ({
  getSettings: (...a: any[]) => mockGetSettings(...a),
  updateSettings: vi.fn(),
}));

const pressed: string[] = [];

const Probe: React.FC = () => {
  useShortcuts([{ shortcut: EXAM_SHORTCUTS.flag, run: (key) => pressed.push(key) }]);
  return (
    <div>
      <input aria-label="Plan" />
      <button type="button">A button</button>
    </div>
  );
};

const renderProbe = () => render(<CustomThemeProvider><Probe /></CustomThemeProvider>);

beforeEach(() => {
  pressed.length = 0;
  mockGetSettings.mockReset();
});

describe('useShortcuts', () => {
  it('runs a bound key pressed on the page', async () => {
    mockGetSettings.mockResolvedValue({ theme: 'light', shortcuts_enabled: true });
    const user = userEvent.setup();
    renderProbe();
    await waitFor(() => expect(mockGetSettings).toHaveBeenCalled());

    await user.keyboard('f');
    expect(pressed).toEqual(['f']);
  });

  it('leaves typing alone', async () => {
    mockGetSettings.mockResolvedValue({ theme: 'light', shortcuts_enabled: true });
    const user = userEvent.setup();
    renderProbe();

    await user.click(screen.getByLabelText('Plan'));
    await user.keyboard('f');

    expect(pressed).toEqual([]);
    expect(screen.getByLabelText('Plan')).toHaveValue('f');
  });

  it('does nothing when shortcuts are turned off in Settings', async () => {
    mockGetSettings.mockResolvedValue({ theme: 'light', shortcuts_enabled: false });
    const user = userEvent.setup();
    renderProbe();
    await waitFor(() => expect(mockGetSettings).toHaveBeenCalled());
    // Let the loaded preference apply.
    await new Promise((r) => setTimeout(r, 0));

    await user.keyboard('f');
    expect(pressed).toEqual([]);
  });
});
