// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Link, Route, Routes } from 'react-router-dom';
import { TaskRoutingSection } from '../components/settings/TaskRoutingSection';
import { NotificationsPage } from './NotificationsPage';
import { NotificationBell } from '../components/common/NotificationBell';
import { OnboardingPage } from './OnboardingPage';
import type { LLMTaskBinding } from '../types/llm';
import type { AppNotification } from '../types/system';

// Task routing, notifications, the header bell and getting started: each one
// reads what is true now, and none of them claims more than it read.

const api = {
  getLLMTasks: vi.fn(),
  getLLMProviders: vi.fn(),
  setLLMTaskBinding: vi.fn(),
  getNotifications: vi.fn(),
  getStorageReport: vi.fn(),
  getSettings: vi.fn(),
};

vi.mock('../services/api', () => ({
  getLLMTasks: (...a: any[]) => api.getLLMTasks(...a),
  getLLMProviders: (...a: any[]) => api.getLLMProviders(...a),
  setLLMTaskBinding: (...a: any[]) => api.setLLMTaskBinding(...a),
  getNotifications: (...a: any[]) => api.getNotifications(...a),
  getStorageReport: (...a: any[]) => api.getStorageReport(...a),
  getSettings: (...a: any[]) => api.getSettings(...a),
}));

const mockPreparation = vi.fn();
vi.mock('../context/PreparationContext', () => ({
  usePreparation: () => mockPreparation(),
}));

const LOCAL = { id: 1, name: 'Laptop Ollama', is_local: true, is_enabled: true };
const CLOUD = { id: 2, name: 'Gemini', is_local: false, is_enabled: true };

const task = (over: Partial<LLMTaskBinding> = {}): LLMTaskBinding => ({
  task: 'system_design_grading',
  label: 'System Design grading',
  fallback: 'The answer is saved as Not graded and can be graded later.',
  capability: 'text_json',
  bound_provider_id: null,
  bound_model: null,
  resolved_provider_id: null,
  resolved_provider_name: null,
  resolved_model: null,
  is_available: false,
  unavailable_reason: 'No AI provider is configured that can handle system_design_grading.',
  cloud_timeout_seconds: 25,
  local_timeout_seconds: 300,
  ...over,
});

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  mockPreparation.mockReset();
});

describe('Task routing', () => {
  it('says who answers each task, the time allowed, and what happens without a provider', async () => {
    api.getLLMProviders.mockResolvedValue([LOCAL, CLOUD]);
    api.getLLMTasks.mockResolvedValue([
      task({ is_available: true, resolved_provider_id: 1, resolved_provider_name: 'Laptop Ollama', resolved_model: 'llama3.1:8b', unavailable_reason: null }),
      task({ task: 'topic_guide_drafting', label: 'Study guide drafting', fallback: 'No draft is written; you can write the guide yourself.' }),
    ]);
    render(<TaskRoutingSection />);

    const grading = await screen.findByRole('group', { name: 'System Design grading' });
    expect(within(grading).getByText('Laptop Ollama · llama3.1:8b')).toBeInTheDocument();
    expect(within(grading).getByText('Allowed 300 seconds on this machine.')).toBeInTheDocument();

    const guide = screen.getByRole('group', { name: 'Study guide drafting' });
    expect(within(guide).getByText('No provider')).toBeInTheDocument();
    expect(within(guide).getByText('Without a provider: No draft is written; you can write the guide yourself.')).toBeInTheDocument();
  });

  it('routes a task to a chosen provider, and shows a refusal on that task', async () => {
    const user = userEvent.setup();
    api.getLLMProviders.mockResolvedValue([LOCAL, CLOUD]);
    api.getLLMTasks.mockResolvedValue([task()]);
    api.setLLMTaskBinding.mockRejectedValueOnce({ response: { data: { detail: 'Gemini cannot do audio json.' } } });
    render(<TaskRoutingSection />);

    // Named by its task's group, so a screen reader hears which task it routes.
    const grading = await screen.findByRole('group', { name: 'System Design grading' });
    await user.click(within(grading).getByRole('combobox', { name: 'Provider' }));
    await user.click(screen.getByRole('option', { name: /Gemini \(cloud\)/ }));

    await waitFor(() => expect(api.setLLMTaskBinding).toHaveBeenCalledWith('system_design_grading', { provider_id: 2 }));
    expect(await screen.findByText('Gemini cannot do audio json.')).toBeInTheDocument();
  });
});

describe('Notifications', () => {
  const ITEM: AppNotification = {
    id: 'review_misses:1', trigger: 'review_due', severity: 'attention', title: 'Misses to review',
    detail: '3 wrong answers from your PSM I mocks have not been reviewed.', subject_id: 1,
    subject_name: 'PSM I', count: 3, action_label: 'Review', action_path: '/review',
  };

  it('lists what needs doing, each with its way in', async () => {
    api.getNotifications.mockResolvedValue([
      ITEM,
      { ...ITEM, id: 'mock_below_pass:1:9', trigger: 'mock_below_pass', severity: 'warning', title: 'Latest mock below the pass mark', detail: 'Your latest PSM I mock scored 72% against a 85% pass mark.', action_label: 'Review the mock', action_path: '/exam-review/9' },
    ]);
    render(<MemoryRouter><NotificationsPage /></MemoryRouter>);

    expect(await screen.findByText('Misses to review')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review the mock' })).toHaveAttribute('href', '/exam-review/9');
    expect(screen.getByText('Evidence moved')).toBeInTheDocument();
  });

  it('says how alerts are delivered, from the stored triggers', async () => {
    api.getNotifications.mockResolvedValue([ITEM]);
    api.getSettings.mockResolvedValue({ notification_triggers: { review_due: true, mock_below_pass: true, evidence_stale: false } });
    render(<MemoryRouter><NotificationsPage /></MemoryRouter>);

    const delivery = await screen.findByRole('region', { name: 'Delivery' });
    expect(await within(delivery).findByText(/2 of 3 kinds of alert switched on/)).toBeInTheDocument();
    expect(within(delivery).getByText('Deliberately not implemented')).toBeInTheDocument();
  });

  it('calls nothing to do the system working', async () => {
    api.getNotifications.mockResolvedValue([]);
    render(<MemoryRouter><NotificationsPage /></MemoryRouter>);

    expect(await screen.findByText('Nothing needs you')).toBeInTheDocument();
  });

  it('says it could not check, and retries', async () => {
    const user = userEvent.setup();
    api.getNotifications.mockRejectedValueOnce(new Error('down')).mockResolvedValue([ITEM]);
    render(<MemoryRouter><NotificationsPage /></MemoryRouter>);

    expect(await screen.findByText('Could not work out your notifications')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Misses to review')).toBeInTheDocument();
  });
});

describe('The notification bell', () => {
  const renderBell = () => render(
    <MemoryRouter initialEntries={['/']}>
      <NotificationBell />
      <Link to="/review">Go to review</Link>
      <Routes>
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );

  it('counts what needs you, and reads again after moving on', async () => {
    const user = userEvent.setup();
    api.getNotifications.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }]).mockResolvedValue([]);
    renderBell();

    expect(await screen.findByRole('link', { name: 'Alerts: 2 need you' })).toHaveAttribute('href', '/notifications');

    await user.click(screen.getByRole('link', { name: 'Go to review' }));
    expect(await screen.findByRole('link', { name: 'Alerts: nothing needs you' })).toBeInTheDocument();
  });

  it('shows no count at all when it cannot read one', async () => {
    api.getNotifications.mockRejectedValue(new Error('down'));
    renderBell();

    await waitFor(() => expect(api.getNotifications).toHaveBeenCalled());
    expect(screen.getByRole('link', { name: 'Alerts' })).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});

describe('Getting started', () => {
  const PSM = {
    id: 1, name: 'Scrum / PSM I', has_exam_profile: true, question_count: 709,
    readiness: { mock_count: 0 },
  };

  it('ticks only what is actually done', async () => {
    mockPreparation.mockReturnValue({ preparations: [PSM], selected: PSM, loading: false });
    api.getStorageReport.mockResolvedValue({ database: { engine: 'sqlite', path: 'E:\\data\\exam_simulator.db' } });
    api.getLLMProviders.mockResolvedValue([]);
    render(<MemoryRouter><OnboardingPage /></MemoryRouter>);

    expect(await screen.findByRole('listitem', { name: 'PrepBench is installed: done' })).toHaveTextContent('E:\\data\\exam_simulator.db');
    expect(screen.getByRole('listitem', { name: 'Pick what you are preparing for: done' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Add questions: done' })).toHaveTextContent('709 questions');
    const mock = screen.getByRole('listitem', { name: 'Take a baseline mock: not done' });
    expect(within(mock).getByRole('link', { name: 'Set up a mock' })).toHaveAttribute('href', '/exam-setup?kind=mock&subject=1');
    expect(screen.getByRole('listitem', { name: 'Connect an AI model: not done' })).toHaveTextContent('Optional');
    expect(screen.getByText(/1 of 4 steps to go/)).toBeInTheDocument();
  });

  it('marks what it could not read as not checked, never as to do, and checks again on retry', async () => {
    const user = userEvent.setup();
    const refresh = vi.fn().mockResolvedValue(undefined);
    mockPreparation.mockReturnValue({
      preparations: [], selected: null, loading: false, error: 'Could not load your preparations.', refresh,
    });
    api.getStorageReport.mockResolvedValue({ database: { engine: 'sqlite', path: 'E:\\data\\x.db' } });
    api.getLLMProviders.mockRejectedValueOnce(new Error('down')).mockResolvedValue([]);
    render(<MemoryRouter><OnboardingPage /></MemoryRouter>);

    const questions = await screen.findByRole('listitem', { name: 'Add questions: not checked' });
    expect(questions).toHaveTextContent('could not be read');
    expect(within(questions).queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Pick what you are preparing for: not checked' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Connect an AI model: not checked' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'PrepBench is installed: done' })).toBeInTheDocument();
    expect(screen.queryByText(/steps to go/)).not.toBeInTheDocument();
    expect(screen.getByText(/4 steps could not be checked/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'You are set up' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refresh).toHaveBeenCalled();
    expect(await screen.findByRole('listitem', { name: 'Connect an AI model: not done' })).toBeInTheDocument();
  });

  it('does not ask a skill for a mock, and says when everything is done', async () => {
    const skill = { ...PSM, id: 3, name: 'System Design', has_exam_profile: false, question_count: 12 };
    mockPreparation.mockReturnValue({ preparations: [skill], selected: skill, loading: false });
    api.getStorageReport.mockResolvedValue({ database: { engine: 'sqlite', path: 'E:\\data\\x.db' } });
    api.getLLMProviders.mockResolvedValue([LOCAL]);
    render(<MemoryRouter><OnboardingPage /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'You are set up' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Take a baseline mock: done' })).toHaveTextContent('has no exam to sit');
    expect(screen.getByRole('link', { name: 'Go to Home' })).toBeInTheDocument();
  });
});
