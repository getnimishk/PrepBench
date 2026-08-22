import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocalSetupWizard } from './LocalSetupWizard';

const mockSystemInfo = vi.fn();
const mockLocalRunners = vi.fn();
const mockLocalModels = vi.fn();
const mockLauncher = vi.fn();
const mockDetect = vi.fn();
const mockCreate = vi.fn();
const mockVerify = vi.fn();

vi.mock('../../services/api', () => ({
  getSystemInfo: (...a: any[]) => mockSystemInfo(...a),
  getLocalRunners: (...a: any[]) => mockLocalRunners(...a),
  getLocalModelOptions: (...a: any[]) => mockLocalModels(...a),
  buildLauncherScript: (...a: any[]) => mockLauncher(...a),
  detectLocalRunners: (...a: any[]) => mockDetect(...a),
  createLLMProvider: (...a: any[]) => mockCreate(...a),
  verifyLLMProvider: (...a: any[]) => mockVerify(...a),
}));

const RUNNERS = [
  {
    key: 'llamafile',
    label: 'Llamafile',
    description: 'A single file that runs a model.',
    default_port: 8080,
    pull_style: 'manual',
    steps: {
      windows: ['Download the .llamafile', 'Rename it to llamafile.exe'],
      macos: ['Download the file', 'chmod +x it'],
      linux: ['Download the file', 'chmod +x it'],
    },
  },
];

// A 7B marked as the sweet spot beats a 14B that also fits -- the backend
// decides this, and the UI has to show what it decided rather than re-sorting.
const MODELS = [
  {
    id: 'qwen2.5-14b',
    label: 'Qwen2.5 14B',
    parameters_b: 14,
    ram_required_gb: 10,
    licence: 'Apache-2.0',
    licence_commercial_ok: true,
    download_url: 'https://example.invalid/14b',
    file_name: 'qwen2.5-14b.gguf',
    sweet_spot: false,
    recommended: false,
    fits: true,
    fits_now: false,
    fit_note: 'Fits this machine, but only about 3.5GB is free right now.',
  },
  {
    id: 'qwen2.5-7b',
    label: 'Qwen2.5 7B',
    parameters_b: 7,
    ram_required_gb: 5,
    licence: 'Apache-2.0',
    licence_commercial_ok: true,
    download_url: 'https://example.invalid/7b',
    file_name: 'qwen2.5-7b.gguf',
    sweet_spot: true,
    recommended: true,
    fits: true,
    fits_now: true,
    fit_note: 'Fits comfortably -- needs about 5.0GB.',
  },
  {
    id: 'qwen2.5-3b-research',
    label: 'Qwen2.5 3B (research only)',
    parameters_b: 3,
    ram_required_gb: 3,
    licence: 'Research-only',
    licence_commercial_ok: false,
    download_url: 'https://example.invalid/3b',
    file_name: 'qwen2.5-3b.gguf',
    sweet_spot: false,
    recommended: false,
    fits: true,
    fits_now: true,
    fit_note: 'Fits comfortably -- needs about 3.0GB.',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockSystemInfo.mockResolvedValue({
    os_family: 'windows',
    total_ram_gb: 15.8,
    available_ram_gb: 3.5,
    usable_for_model_gb: 13.8,
  });
  mockLocalRunners.mockResolvedValue(RUNNERS);
  mockLocalModels.mockResolvedValue(MODELS);
  mockLauncher.mockResolvedValue({
    filename: 'Start-PrepBench-AI.bat',
    content: '@echo off\r\nllamafile.exe -m "your-model.gguf" --server --host 127.0.0.1 --port 8080',
    command: 'llamafile.exe -m "your-model.gguf" --server --host 127.0.0.1 --port 8080 --ctx-size 4096 --nobrowser',
    os_family: 'windows',
    port: 8080,
  });
  mockDetect.mockResolvedValue([]);
});

function renderWizard(props: Partial<React.ComponentProps<typeof LocalSetupWizard>> = {}) {
  return render(
    <LocalSetupWizard open onClose={() => {}} onConnected={() => {}} {...props} />
  );
}

describe('LocalSetupWizard', () => {
  it('fetches nothing at all while it is closed', async () => {
    // It stays mounted inside the Settings page. Without the `open` guard it
    // fired a request on every visit to Settings, building a command for a
    // dialog nobody had opened.
    render(<LocalSetupWizard open={false} onClose={() => {}} onConnected={() => {}} />);

    await new Promise((r) => setTimeout(r, 50));

    expect(mockSystemInfo).not.toHaveBeenCalled();
    expect(mockLocalRunners).not.toHaveBeenCalled();
    expect(mockLauncher).not.toHaveBeenCalled();
  });

  it('states up front that PrepBench will not download or run the model', async () => {
    // The governing rule of the whole feature. If the UI ever stops saying it,
    // the wizard starts looking like it does the download itself.
    renderWizard();
    expect(await screen.findByText(/will not download or run anything for you/i)).toBeInTheDocument();
  });

  it('reports what it actually measured about this machine', async () => {
    // Shown on the model-choice step, where it is the reason one model is
    // recommended over another -- never a guess presented as a measurement.
    renderWizard();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /next/i }));

    await waitFor(() => expect(screen.getByText('Qwen2.5 7B')).toBeInTheDocument());
    const text = document.body.textContent || '';
    expect(text).toMatch(/15\.8/);   // installed
    expect(text).toMatch(/3\.5/);    // free right now
  });

  it('preselects the recommended model rather than the largest that fits', async () => {
    renderWizard();
    await waitFor(() => expect(mockLocalModels).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /next/i }));

    expect(await screen.findByText('Qwen2.5 7B')).toBeInTheDocument();
    // The 14B is offered, but is not the one chosen for a first-time user --
    // on CPU it means minutes per grade.
    expect(screen.getByText('Qwen2.5 14B')).toBeInTheDocument();
  });

  it('shows each model licence, including the one that forbids commercial use', async () => {
    // Shown at pick time because it decides whether a model could ever ship
    // inside a paid product -- far cheaper to know now than to discover later.
    renderWizard();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /next/i }));

    await waitFor(() => expect(screen.getByText('Qwen2.5 14B')).toBeInTheDocument());
    const text = document.body.textContent || '';
    expect(text).toMatch(/Apache-2\.0/);
    expect(text).toMatch(/research/i);
  });

  it('shows the exact command, bound to loopback', async () => {
    renderWizard();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /next/i }));
    await waitFor(() => expect(screen.getByText('Qwen2.5 7B')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      const text = document.body.textContent || '';
      expect(text).toContain('--host 127.0.0.1');
    });
  });

  it('shows the steps for this OS and not another one', async () => {
    // A Windows user must never be told to chmod anything.
    renderWizard();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /next/i }));
    await waitFor(() => expect(screen.getByText('Qwen2.5 7B')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => expect(screen.getByText(/Rename it to llamafile\.exe/i)).toBeInTheDocument());
    expect(document.body.textContent).not.toMatch(/chmod/);
  });

  it('skips straight to connecting when something is already serving', async () => {
    mockDetect.mockResolvedValue([
      {
        profile_key: 'llamafile',
        label: 'Llamafile (local)',
        base_url: 'http://localhost:8080/v1',
        models: ['qwen2.5-7b'],
        already_configured: false,
      },
    ]);

    renderWizard();
    const user = userEvent.setup();
    const scan = await screen.findByRole('button', { name: /scan|check again|detect/i });
    await user.click(scan);

    // Downloading and launching are pointless when a server is already up.
    await waitFor(() => expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument());
  });

  it('surfaces a failed connection check instead of claiming success', async () => {
    mockCreate.mockResolvedValue({ id: 7, name: 'Local model' });
    mockVerify.mockResolvedValue({
      ok: false,
      readiness: 'unreachable',
      message: 'Could not reach http://localhost:8080/v1. Start your local model server, then try again.',
      latency_ms: 12,
      detected_models: [],
      resolved_model: null,
      returned_valid_json: null,
    });

    renderWizard();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /next/i }));
    await waitFor(() => expect(screen.getByText('Qwen2.5 7B')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => expect(document.body.textContent).toContain('--host 127.0.0.1'));
    await user.click(screen.getByRole('button', { name: /next/i }));

    await user.click(await screen.findByRole('button', { name: /connect/i }));

    await waitFor(() =>
      expect(screen.getByText(/Start your local model server/i)).toBeInTheDocument()
    );
  });
});
