// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AIProvidersSection } from './AIProvidersSection';
import { LLMProfile, LLMProvider, LLMTaskBinding } from '../../types/llm';

const mockGetProfiles = vi.fn();
const mockGetProviders = vi.fn();
const mockGetTasks = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockVerify = vi.fn();
const mockDetect = vi.fn();
const mockSetBinding = vi.fn();

vi.mock('../../services/api', () => ({
  getLLMProfiles: (...a: any[]) => mockGetProfiles(...a),
  getLLMProviders: (...a: any[]) => mockGetProviders(...a),
  getLLMTasks: (...a: any[]) => mockGetTasks(...a),
  createLLMProvider: (...a: any[]) => mockCreate(...a),
  updateLLMProvider: (...a: any[]) => mockUpdate(...a),
  deleteLLMProvider: (...a: any[]) => mockDelete(...a),
  verifyLLMProvider: (...a: any[]) => mockVerify(...a),
  getLLMProviderModels: () => Promise.resolve({ models: [], error: null }),
  setLLMTaskBinding: (...a: any[]) => mockSetBinding(...a),
  detectLocalRunners: (...a: any[]) => mockDetect(...a),
  // LocalSetupWizard renders inside this component (closed), and pulls from
  // the same module -- without these the mocked module returns undefined.
  getSystemInfo: () => Promise.resolve({ os_family: 'windows', total_ram_gb: 16, available_ram_gb: 8, usable_for_model_gb: 14 }),
  getLocalModelOptions: () => Promise.resolve([]),
  getLocalRunners: () => Promise.resolve([]),
  buildLauncherScript: () => Promise.resolve({ filename: 'x.bat', content: '', command: '', os_family: 'windows', port: 8080 }),
}));

function makeProfile(overrides: Partial<LLMProfile> = {}): LLMProfile {
  return {
    key: 'llamafile',
    label: 'Llamafile (local)',
    adapter: 'openai_compatible',
    capabilities: ['text_json'],
    is_local: true,
    requires_api_key: false,
    base_url: 'http://localhost:8080/v1',
    default_models: {},
    setup_guide: 'llamafile',
    ...overrides,
  };
}

function makeProvider(overrides: Partial<LLMProvider> = {}): LLMProvider {
  return {
    id: 1,
    name: 'My Llamafile',
    profile_key: 'llamafile',
    profile_label: 'Llamafile (local)',
    adapter: 'openai_compatible',
    base_url: null,
    effective_base_url: 'http://localhost:8080/v1',
    is_local: true,
    capabilities: ['text_json'],
    has_api_key: false,
    api_key_hint: null,
    api_key_is_from_env: false,
    default_text_model: 'qwen3-4b',
    default_audio_model: null,
    default_embedding_model: null,
    is_enabled: true,
    last_verified_at: null,
    last_verify_error: null,
    last_latency_ms: null,
    ...overrides,
  };
}

function makeTask(overrides: Partial<LLMTaskBinding> = {}): LLMTaskBinding {
  return {
    task: 'system_design_grading',
    label: 'System Design grading',
    capability: 'text_json',
    bound_provider_id: null,
    bound_model: null,
    resolved_provider_id: 1,
    resolved_provider_name: 'My Llamafile',
    resolved_model: 'qwen3-4b',
    is_available: true,
    unavailable_reason: null,
    cloud_timeout_seconds: 25,
    local_timeout_seconds: 300,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetProfiles.mockResolvedValue([makeProfile()]);
  mockGetProviders.mockResolvedValue([]);
  mockGetTasks.mockResolvedValue([]);
});

describe('AIProvidersSection', () => {
  it('tells the user AI features are off, and that everything else still works', async () => {
    render(<AIProvidersSection />);
    await waitFor(() => expect(screen.getByText(/no ai provider set up yet/i)).toBeInTheDocument());
    expect(screen.getByText(/everything else works normally/i)).toBeInTheDocument();
  });

  it('shows a configured provider with where it runs and which model', async () => {
    mockGetProviders.mockResolvedValue([makeProvider()]);
    render(<AIProvidersSection />);

    await waitFor(() => expect(screen.getByText('My Llamafile')).toBeInTheDocument());
    expect(screen.getByText('On this machine')).toBeInTheDocument();
    expect(screen.getByText(/qwen3-4b/)).toBeInTheDocument();
  });

  it('never renders an API key, only that one exists and its last four characters', async () => {
    mockGetProviders.mockResolvedValue([
      makeProvider({
        name: 'Gemini',
        is_local: false,
        has_api_key: true,
        api_key_hint: 'j-Gg',
        api_key_is_from_env: true,
      }),
    ]);
    render(<AIProvidersSection />);

    await waitFor(() => expect(screen.getByText('Gemini')).toBeInTheDocument());
    expect(screen.getByText(/Key from \.env \(.?j-Gg\)/)).toBeInTheDocument();
    // The full key must never reach the DOM.
    expect(document.body.textContent).not.toMatch(/AIza|sk-/);
  });

  it('reports a failed connection check in the provider it belongs to', async () => {
    mockGetProviders.mockResolvedValue([makeProvider()]);
    mockVerify.mockResolvedValue({
      ok: false,
      readiness: 'unreachable',
      message: 'Could not reach http://localhost:8080/v1. Start your local model server, then try again.',
      latency_ms: 12,
      detected_models: [],
      resolved_model: 'qwen3-4b',
      returned_valid_json: null,
    });

    const user = userEvent.setup();
    render(<AIProvidersSection />);
    await waitFor(() => expect(screen.getByText('My Llamafile')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /check connection for my llamafile/i }));

    await waitFor(() =>
      expect(screen.getByText(/Start your local model server/i)).toBeInTheDocument()
    );
    expect(mockVerify).toHaveBeenCalledWith(1);
  });

  it('surfaces a slow local model as a warning rather than a plain success', async () => {
    mockGetProviders.mockResolvedValue([makeProvider()]);
    mockVerify.mockResolvedValue({
      ok: true,
      readiness: 'slow',
      message: 'Connected. qwen3-4b replied in 41.0s. That is slow enough that System Design grading will take several minutes per answer.',
      latency_ms: 41000,
      detected_models: ['qwen3-4b'],
      resolved_model: 'qwen3-4b',
      returned_valid_json: true,
    });

    const user = userEvent.setup();
    render(<AIProvidersSection />);
    await waitFor(() => expect(screen.getByText('My Llamafile')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /check connection for my llamafile/i }));

    await waitFor(() => expect(screen.getByText(/several minutes per answer/i)).toBeInTheDocument());
  });

  it('says plainly when no local model server is running', async () => {
    mockDetect.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<AIProvidersSection />);
    await waitFor(() => expect(screen.getByText(/scan for local models/i)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /scan for local models/i }));

    await waitFor(() => expect(screen.getByText(/nothing found on this machine/i)).toBeInTheDocument());
  });

  it('reports a detected local runner and offers to add it', async () => {
    mockDetect.mockResolvedValue([
      { profile_key: 'ollama', label: 'Ollama (local)', base_url: 'http://localhost:11434/v1', models: ['qwen3'], already_configured: false },
    ]);
    const user = userEvent.setup();
    render(<AIProvidersSection />);
    await waitFor(() => expect(screen.getByText(/scan for local models/i)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /scan for local models/i }));

    await waitFor(() => expect(screen.getByText(/Ollama \(local\)/)).toBeInTheDocument());
    expect(screen.getByText(/1 model\(s\) loaded/)).toBeInTheDocument();
  });

  it('warns before removing a provider that the saved key goes with it', async () => {
    mockGetProviders.mockResolvedValue([makeProvider()]);
    const user = userEvent.setup();
    render(<AIProvidersSection />);
    await waitFor(() => expect(screen.getByText('My Llamafile')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /remove my llamafile/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/along with its saved key/i)).toBeInTheDocument();
    expect(mockDelete).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: /^remove$/i }));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(1));
  });

  it('only offers providers that can actually do a task', async () => {
    // A text-only provider must not appear as an option for audio analysis --
    // the backend refuses such a binding, so offering it would be a dead end.
    mockGetProviders.mockResolvedValue([
      makeProvider({ id: 1, name: 'Local Text', capabilities: ['text_json'] }),
      makeProvider({ id: 2, name: 'Cloud Multimodal', capabilities: ['text_json', 'audio_json'], is_local: false }),
    ]);
    mockGetTasks.mockResolvedValue([
      makeTask({ task: 'recording_analysis', label: 'Interview recording analysis', capability: 'audio_json' }),
    ]);

    const user = userEvent.setup();
    render(<AIProvidersSection />);
    await waitFor(() => expect(screen.getByText('Local Text')).toBeInTheDocument());

    await user.click(screen.getByText(/which provider handles what/i));
    const select = await screen.findByLabelText('Provider');
    await user.click(select);

    const options = await screen.findAllByRole('option');
    const labels = options.map((o) => o.textContent);
    expect(labels).toContain('Cloud Multimodal');
    expect(labels).not.toContain('Local Text');
  });

  it('offers local providers before cloud ones when adding', async () => {
    mockGetProfiles.mockResolvedValue([
      makeProfile({ key: 'llamafile', label: 'Llamafile (local)', is_local: true }),
      makeProfile({ key: 'gemini', label: 'Google Gemini', is_local: false, requires_api_key: true, base_url: 'https://x/v1' }),
    ]);

    const user = userEvent.setup();
    render(<AIProvidersSection />);
    await waitFor(() => expect(screen.getByRole('button', { name: /^add$/i })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /^add$/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByLabelText(/provider type/i));

    const options = await screen.findAllByRole('option');
    const texts = options.map((o) => o.textContent || '');
    const localIdx = texts.findIndex((t) => t.includes('Llamafile'));
    const cloudIdx = texts.findIndex((t) => t.includes('Gemini'));
    expect(localIdx).toBeGreaterThanOrEqual(0);
    expect(cloudIdx).toBeGreaterThan(localIdx);
  });

  it('states that PrepBench will not download or run the model for you', async () => {
    const user = userEvent.setup();
    render(<AIProvidersSection />);
    await waitFor(() => expect(screen.getByRole('button', { name: /^add$/i })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /^add$/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByLabelText(/provider type/i));
    await user.click(await screen.findByRole('option', { name: /llamafile/i }));

    expect(await within(dialog).findByText(/does not download or run the model for you/i)).toBeInTheDocument();
  });
});
