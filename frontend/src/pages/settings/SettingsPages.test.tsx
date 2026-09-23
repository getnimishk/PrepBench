// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CustomThemeProvider, useThemeMode } from '../../context/ThemeContext';
import { ImportLauncherContext } from '../../context/importLauncherContext';
import { SettingsHome } from './SettingsHome';
import { AppearanceSettingsPage } from './AppearanceSettingsPage';
import { PracticeSettingsPage } from './PracticeSettingsPage';
import { ShortcutsSettingsPage } from './ShortcutsSettingsPage';
import { NotificationSettingsPage } from './NotificationSettingsPage';
import { DataSettingsPage } from './DataSettingsPage';
import { AboutSettingsPage } from './AboutSettingsPage';
import { StatesGalleryPage } from './StatesGalleryPage';
import type { AppSettings } from '../../types/settings';

// Every settings screen shows what is stored, changes only what it says it
// changes, and says so when a change did not land.

const api = {
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  resetApplication: vi.fn(),
  getLLMProviders: vi.fn(),
  getStorageReport: vi.fn(),
  getAboutReport: vi.fn(),
  getReviewScheduleRules: vi.fn(),
  getProfile: vi.fn(),
};

vi.mock('../../services/api', () => ({
  getSettings: (...a: any[]) => api.getSettings(...a),
  updateSettings: (...a: any[]) => api.updateSettings(...a),
  resetApplication: (...a: any[]) => api.resetApplication(...a),
  getLLMProviders: (...a: any[]) => api.getLLMProviders(...a),
  getStorageReport: (...a: any[]) => api.getStorageReport(...a),
  getAboutReport: (...a: any[]) => api.getAboutReport(...a),
  getReviewScheduleRules: (...a: any[]) => api.getReviewScheduleRules(...a),
  getProfile: (...a: any[]) => api.getProfile(...a),
  backupDownloadUrl: () => '/api/v1/system/backup',
}));

const mockPreparation = vi.fn();
vi.mock('../../context/PreparationContext', () => ({
  usePreparation: () => mockPreparation(),
}));

const SETTINGS: AppSettings = {
  theme: 'light',
  timer_sound_enabled: true,
  default_target_role: null,
  review_daily_cap: 20,
  text_size: 'standard',
  reduce_motion: 'system',
  shortcuts_enabled: true,
  notification_triggers: {
    review_due: true, mock_below_pass: true, evidence_stale: true, roadmap_slipping: true, import_unreviewed: false,
  },
};

const STORAGE = {
  database: {
    engine: 'sqlite', path: 'E:\\workspace\\PrepBench\\backend\\data\\exam_simulator.db',
    size_bytes: 1843200, wal_bytes: 32768, modified_at: '2026-09-14T08:00:00', backup_supported: true,
  },
  counts: { questions: 712, exam_sessions: 12, subjects: 3 },
  unassigned_questions: 3,
  recordings: { path: 'E:\\workspace\\PrepBench\\backend\\data\\recordings', files: 4, size_bytes: 2048000 },
  preparations: [
    { subject_id: 1, name: 'Scrum / PSM I', is_archived: false, questions: 709, sessions: 10, answers: 480 },
  ],
};

const ModeProbe: React.FC = () => <div data-testid="mode">{useThemeMode().mode}</div>;

const openImport = vi.fn();

function renderScreen(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <CustomThemeProvider>
        <ImportLauncherContext.Provider value={{ openImport }}>
          <ModeProbe />
          {ui}
        </ImportLauncherContext.Provider>
      </CustomThemeProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  // The theme provider keeps a copy of the last preferences in the browser;
  // each test starts from none.
  globalThis.localStorage?.clear();
  Object.values(api).forEach((fn) => fn.mockReset());
  api.getSettings.mockResolvedValue(SETTINGS);
  api.updateSettings.mockImplementation(async (changes: Partial<AppSettings>) => ({ ...SETTINGS, ...changes }));
  api.getLLMProviders.mockResolvedValue([]);
  api.getStorageReport.mockResolvedValue(STORAGE);
  api.getAboutReport.mockResolvedValue({
    version: '0.9.4', python_version: '3.13', platform: 'Windows', database_engine: 'sqlite', database_path: null,
    recordings_path: '', telemetry: false, providers: [], data_leaving: [], key_storage: [], license: 'PolyForm',
  });
  api.getProfile.mockResolvedValue({
    display_name: 'Nimish Kanungo', email: 'nimish@example.com',
    timezone: { name: 'India Standard Time', utc_offset_minutes: 330 },
    stats: { preparations: 1, questions: 712, mocks_taken: 6, days_active: 40, active_since: '2026-06-01' },
    storage: { database_bytes: 1875968, recordings_bytes: 2048000 },
  });
  openImport.mockReset();
  api.getReviewScheduleRules.mockResolvedValue({
    algorithm: 'SM-2', starting_ease: 2.5, minimum_ease: 1.3, first_interval_days: 1,
    second_interval_days: 6, passing_quality: 3, grades: { again: 2, hard: 3, good: 4, easy: 5 },
  });
  mockPreparation.mockReturnValue({
    preparations: [{ id: 1, name: 'Scrum / PSM I' }], selected: { id: 1, name: 'Scrum / PSM I' },
    refresh: vi.fn().mockResolvedValue(undefined),
  });
});

describe('Settings home', () => {
  it('says what each setting is now, from where it is stored', async () => {
    renderScreen(<SettingsHome />);

    const practice = await screen.findByText('Daily review cap 20 · timer sound on');
    expect(practice).toBeInTheDocument();
    expect(await screen.findByText(/1\.8 MB · 712 questions · backup available/)).toBeInTheDocument();
    expect(screen.getByText('None configured')).toBeInTheDocument();
    expect(screen.getByText('4 of 5 alerts on · no streaks, ever')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open data and storage' })).toHaveAttribute('href', '/settings/data');
    expect(await screen.findByText('Nimish Kanungo · nimish@example.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open profile' })).toHaveAttribute('href', '/profile');
    expect(await screen.findByText('v0.9.4 · telemetry off')).toBeInTheDocument();
    // Backups are downloaded on demand; nothing claims a schedule that does not exist.
    expect(screen.getByText('On demand')).toBeInTheDocument();
    expect(screen.queryByText(/weekly/i)).not.toBeInTheDocument();
  });

  it('opens the import over Settings instead of sending you to the Question Bank for it', async () => {
    const user = userEvent.setup();
    renderScreen(<SettingsHome />);

    await user.click(await screen.findByRole('button', { name: 'Import questions' }));

    expect(openImport).toHaveBeenCalledTimes(1);
  });

  it('says there is no name yet rather than inventing one', async () => {
    api.getProfile.mockResolvedValue({
      display_name: null, email: null, timezone: { name: 'UTC', utc_offset_minutes: 0 },
      stats: { preparations: 0, questions: 0, mocks_taken: 0, days_active: 0, active_since: null },
      storage: { database_bytes: null, recordings_bytes: 0 },
    });
    renderScreen(<SettingsHome />);

    expect(await screen.findByText(/^No name yet/)).toBeInTheDocument();
  });

  it('does not count preparations it could not read', async () => {
    mockPreparation.mockReturnValue({
      preparations: [], selected: null, loading: false, error: 'Could not load your preparations.', refresh: vi.fn(),
    });
    renderScreen(<SettingsHome />);

    const workspace = await screen.findByRole('region', { name: 'Workspace' });
    expect(within(workspace).getByText('Could not be read')).toBeInTheDocument();
    expect(within(workspace).queryByText(/0 active/)).not.toBeInTheDocument();
  });

  it('says a value could not be read rather than showing a default as the setting', async () => {
    api.getStorageReport.mockRejectedValue(new Error('down'));
    renderScreen(<SettingsHome />);

    const data = await screen.findByRole('region', { name: 'Data' });
    await waitFor(() => expect(within(data).getByText('Could not be read')).toBeInTheDocument());
  });
});

describe('Appearance', () => {
  it('applies a theme the moment it is chosen, and saves only that', async () => {
    const user = userEvent.setup();
    renderScreen(<AppearanceSettingsPage />);
    await waitFor(() => expect(api.getSettings).toHaveBeenCalled());

    await user.click(screen.getByRole('radio', { name: 'Dark' }));

    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
    await waitFor(() => expect(api.updateSettings).toHaveBeenCalledWith({ theme: 'dark' }));
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
  });

  it('puts the choice back and says so when it is not saved', async () => {
    const user = userEvent.setup();
    api.updateSettings.mockRejectedValue({ response: { data: { detail: 'Database is locked.' } } });
    renderScreen(<AppearanceSettingsPage />);
    await waitFor(() => expect(api.getSettings).toHaveBeenCalled());

    await user.click(screen.getByRole('radio', { name: 'Large' }));

    expect(await screen.findByText('Database is locked.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Standard' })).toBeChecked();
  });

  it('does not offer a default as the saved choice before the choice has been read', async () => {
    const user = userEvent.setup();
    let fail: (reason: unknown) => void = () => {};
    api.getSettings.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }));
    renderScreen(<AppearanceSettingsPage />);

    expect(screen.getByText('Reading your saved preferences…')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeDisabled();
    // Nothing shown as chosen: the default is not the learner's setting.
    expect(screen.queryByRole('radio', { checked: true })).not.toBeInTheDocument();

    act(() => fail(new Error('down')));
    expect(await screen.findByText('Could not read your saved preferences')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Dark' })).not.toBeDisabled());
  });

  it('follows the system when asked to', async () => {
    const listeners: ((e: { matches: boolean }) => void)[] = [];
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes('dark'),
      media: query,
      addEventListener: (_: string, fn: any) => listeners.push(fn),
      removeEventListener: () => {},
    })) as any;
    try {
      api.getSettings.mockResolvedValue({ ...SETTINGS, theme: 'system' });
      renderScreen(<AppearanceSettingsPage />);

      await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('dark'));
      expect(screen.getByText('Follows your system setting, which is dark right now.')).toBeInTheDocument();
    } finally {
      window.matchMedia = original;
    }
  });
});

describe('Practice preferences', () => {
  it('saves the cap and the target role together, and nothing else', async () => {
    const user = userEvent.setup();
    renderScreen(<PracticeSettingsPage />);

    const cap = await screen.findByLabelText('Daily review cap');
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();

    await user.clear(cap);
    await user.type(cap, '35');
    await user.type(screen.getByLabelText('Default target role'), 'Staff engineer');
    await user.click(save);

    await waitFor(() => expect(api.updateSettings).toHaveBeenCalledWith({
      review_daily_cap: 35, default_target_role: 'Staff engineer',
    }));
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
  });

  it('will not save a cap the server would refuse', async () => {
    const user = userEvent.setup();
    renderScreen(<PracticeSettingsPage />);
    const cap = await screen.findByLabelText('Daily review cap');

    await user.clear(cap);
    await user.type(cap, '0');

    expect(screen.getByText('Between 1 and 200')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('explains the schedule from the engine, and switches the timer sound at once', async () => {
    const user = userEvent.setup();
    renderScreen(<PracticeSettingsPage />);

    expect(await screen.findByText(/SM-2\. A question recalled well comes back after 1 day,\s+then 6 days/)).toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Timer sound under five minutes' }));
    await waitFor(() => expect(api.updateSettings).toHaveBeenCalledWith({ timer_sound_enabled: false }));
  });

  it('offers a retry when the preferences cannot be read', async () => {
    const user = userEvent.setup();
    api.getSettings.mockRejectedValueOnce(new Error('down')).mockResolvedValue(SETTINGS);
    renderScreen(<PracticeSettingsPage />);

    await user.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByLabelText('Daily review cap')).toHaveValue(20);
  });
});

describe('Keyboard shortcuts', () => {
  it('lists the shortcuts the screens bind, and turns them off', async () => {
    const user = userEvent.setup();
    renderScreen(<ShortcutsSettingsPage />);
    await waitFor(() => expect(api.getSettings).toHaveBeenCalled());

    const exams = screen.getByRole('region', { name: 'Exams and practice' });
    expect(within(exams).getByText('Flag or unflag the question')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Spaced repetition' })).toHaveTextContent('Grade: easy');

    await user.click(await screen.findByRole('switch', { name: 'Enable keyboard shortcuts' }));
    await waitFor(() => expect(api.updateSettings).toHaveBeenCalledWith({ shortcuts_enabled: false }));
  });
});

describe('Keyboard shortcuts before the setting is read', () => {
  it('shows neither on nor off until it knows, and says so when it cannot find out', async () => {
    let fail: (reason: unknown) => void = () => {};
    api.getSettings.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }));
    renderScreen(<ShortcutsSettingsPage />);

    expect(screen.getByRole('progressbar', { name: 'Reading whether shortcuts are on' })).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();

    act(() => fail(new Error('down')));
    expect(await screen.findByText('Could not read whether shortcuts are on')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });
});

describe('Notification settings', () => {
  it('shows each trigger as stored and changes only the one switched', async () => {
    const user = userEvent.setup();
    renderScreen(<NotificationSettingsPage />);

    const imports = await screen.findByRole('switch', { name: 'Imported questions not reviewed' });
    expect(imports).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Reviews waiting' })).toBeChecked();

    await user.click(imports);
    await waitFor(() => expect(api.updateSettings).toHaveBeenCalledWith({ notification_triggers: { import_unreviewed: true } }));
    expect(screen.getByText(/No streaks, no nudges/)).toBeInTheDocument();
  });

  it('switches at once, and switches back when the change is not saved', async () => {
    const user = userEvent.setup();
    let refuse: (reason: unknown) => void = () => {};
    api.updateSettings.mockImplementation(() => new Promise((_, reject) => { refuse = reject; }));
    renderScreen(<NotificationSettingsPage />);

    const reviews = await screen.findByRole('switch', { name: 'Reviews waiting' });
    await user.click(reviews);
    expect(reviews).not.toBeChecked();

    refuse({ response: { data: { detail: 'Database is locked.' } } });
    expect(await screen.findByText('Database is locked.')).toBeInTheDocument();
    expect(reviews).toBeChecked();
  });
});

describe('Data and storage', () => {
  it('reports the real database file and what is in it, with a backup to download', async () => {
    renderScreen(<DataSettingsPage />);

    expect(await screen.findByText(STORAGE.database.path)).toBeInTheDocument();
    expect(screen.getByText(/1\.8 MB plus 32 KB of recent writes/)).toBeInTheDocument();
    expect(screen.getByText('709 questions · 10 sessions · 480 answers')).toBeInTheDocument();
    expect(screen.getByText(/3 questions\. They appear in the Question Bank under All questions/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download backup' })).toHaveAttribute('href', '/api/v1/system/backup');
  });

  it('resets only after RESET is typed, then reads the storage again', async () => {
    const user = userEvent.setup();
    api.resetApplication.mockResolvedValue({ status: 'success' });
    renderScreen(<DataSettingsPage />);
    await screen.findByText(STORAGE.database.path);

    await user.click(screen.getByRole('button', { name: 'Reset the application' }));
    const confirm = screen.getByRole('button', { name: 'Reset everything' });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText('Type RESET to confirm'), 'RESET');
    await user.click(confirm);

    await waitFor(() => expect(api.resetApplication).toHaveBeenCalled());
    expect(await screen.findByText(/Everything was reset to a fresh install/)).toBeInTheDocument();
    expect(api.getStorageReport).toHaveBeenCalledTimes(2);
  });

  it('says a failed reset changed nothing', async () => {
    const user = userEvent.setup();
    api.resetApplication.mockRejectedValue(new Error('down'));
    renderScreen(<DataSettingsPage />);
    await screen.findByText(STORAGE.database.path);

    await user.click(screen.getByRole('button', { name: 'Reset the application' }));
    await user.type(screen.getByLabelText('Type RESET to confirm'), 'reset');
    await user.click(screen.getByRole('button', { name: 'Reset everything' }));

    expect(await screen.findByText(/The reset did not happen. Your data is unchanged./)).toBeInTheDocument();
  });
});

describe('About and privacy', () => {
  const ABOUT = {
    version: '1.0.0', python_version: '3.14.0', platform: 'Windows 11', database_engine: 'sqlite',
    database_path: 'E:\\data\\exam_simulator.db', recordings_path: 'E:\\data\\recordings', telemetry: false,
    providers: [], data_leaving: [], key_storage: [], license: 'PolyForm Noncommercial License 1.0.0',
  };

  it('says nothing leaves the machine when no cloud provider answers a task', async () => {
    api.getAboutReport.mockResolvedValue(ABOUT);
    renderScreen(<AboutSettingsPage />);

    expect(await screen.findByText('Nothing, as configured now')).toBeInTheDocument();
    expect(screen.getByText('None. No analytics and no crash reporting are built in.')).toBeInTheDocument();
  });

  it('names each task that sends text to a cloud provider, and where keys are held', async () => {
    api.getAboutReport.mockResolvedValue({
      ...ABOUT,
      data_leaving: [{ task: 'System Design grading', provider: 'Gemini' }, { task: 'Interview recording analysis', provider: 'Gemini' }],
      key_storage: ['keyring'],
    });
    renderScreen(<AboutSettingsPage />);

    expect(await screen.findByText('System Design grading, sent to Gemini')).toBeInTheDocument();
    expect(screen.getByText(/Held in your operating system's credential store/)).toBeInTheDocument();
    expect(screen.getByText('Kept on this machine. Analysis sends the audio to the provider named above.')).toBeInTheDocument();
  });
});

describe('Interface states', () => {
  it('shows every state with its reason and its way on', () => {
    renderScreen(<StatesGalleryPage />);

    for (const label of ['Empty · no preparations', 'Empty · nothing due', 'Loading', 'Error · grading unavailable', 'Saving']) {
      expect(screen.getByRole('figure', { name: label })).toBeInTheDocument();
    }
    expect(within(screen.getByRole('figure', { name: 'Error · grading unavailable' })).getByText(/Your work is saved/)).toBeInTheDocument();
    expect(within(screen.getByRole('figure', { name: 'Saving' })).getByText('Not saved')).toBeInTheDocument();
  });
});
