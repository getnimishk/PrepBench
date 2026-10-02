// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { EngineStatus, JournalEntry, LabOperationResult } from '../../types/lakehouse';
import { EnginePanel } from './EnginePanel';
import { JournalDrawer } from './JournalDrawer';
import { StationShell } from './StationShell';

const available: EngineStatus = { available: true, version: '1.6.6', install_command: 'uv pip install x' };
const missing: EngineStatus = { available: false, install_command: 'uv pip install --system-certs lab', detail: 'No module named deltalake' };
const result = (over: Partial<LabOperationResult> = {}): LabOperationResult => ({
  ok: true, op: 'append_batch', table: 'bronze.defects', version: 2, rows: 3000, files: 3, data: {}, journal_uid: 'j', ...over,
});

describe('StationShell', () => {
  const baseProps = (over: Partial<React.ComponentProps<typeof StationShell>['prediction']> = {}) => ({
    idPrefix: 't',
    step: 0,
    prediction: {
      prompt: 'What happens?',
      options: [{ id: 'a', text: 'It works' }, { id: 'b', text: 'It is refused' }],
      value: '', committed: false, saving: false, onChange: vi.fn(), onCommit: vi.fn(), ...over,
    },
    manipulate: <p>The manipulate controls</p>,
    observe: <p>The observation</p>,
    explain: <p>The explanation</p>,
  });

  it('keeps Manipulate shut until a prediction is committed', () => {
    render(<StationShell {...baseProps()} />);
    expect(screen.queryByText('The manipulate controls')).not.toBeInTheDocument();
    expect(screen.getByText('Commit a prediction first.')).toBeInTheDocument();
  });

  it('cannot commit without choosing, and commits the chosen option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onCommit = vi.fn();
    const { rerender } = render(<StationShell {...baseProps({ onChange, onCommit })} />);
    expect(screen.getByRole('button', { name: 'Commit prediction' })).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: 'It is refused' }));
    expect(onChange).toHaveBeenCalledWith('b');
    rerender(<StationShell {...baseProps({ onChange, onCommit, value: 'b' })} />);
    await user.click(screen.getByRole('button', { name: 'Commit prediction' }));
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('locks the prediction once committed: options disabled, button says so, controls appear', () => {
    render(<StationShell {...baseProps({ value: 'b', committed: true })} />);
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'It is refused' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Prediction committed' })).toBeDisabled();
    expect(screen.getByText('The manipulate controls')).toBeInTheDocument();
    expect(screen.getByText('Your prediction can’t be changed once you commit it.')).toBeInTheDocument();
  });

  it('shows why a commit failed', () => {
    render(<StationShell {...baseProps({ value: 'a', error: 'Your prediction could not be saved.' })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Your prediction could not be saved.');
  });
});

describe('EnginePanel', () => {
  it('without the engine: says so, gives the command, and shows no number or result', () => {
    render(<EnginePanel engine={missing} outcome={null} running={false} />);
    expect(screen.getByText('Real engine not installed')).toBeInTheDocument();
    expect(screen.getByText('uv pip install --system-certs lab')).toBeInTheDocument();
    expect(screen.getByText(/Nothing below is simulated in its place/)).toBeInTheDocument();
    expect(screen.getByText(/Your prediction is saved/)).toBeInTheDocument();
    expect(screen.queryByText(/version|rows|files|Real engine run/i)).not.toBeInTheDocument();
  });

  it('turns a 503 from an operation into the same not-installed state, with the server’s command', () => {
    render(<EnginePanel engine={available} running={false} outcome={{ kind: 'no-engine', message: 'Not installed.', installCommand: 'uv pip install from-503' }} />);
    expect(screen.getByText('Real engine not installed')).toBeInTheDocument();
    expect(screen.getByText('uv pip install from-503')).toBeInTheDocument();
  });

  it('with the engine and nothing run yet: asks for a run, shows no result', () => {
    render(<EnginePanel engine={available} outcome={null} running={false} />);
    expect(screen.getByText('Run the operation to see what the engine does.')).toBeInTheDocument();
    expect(screen.queryByText('Real engine run')).not.toBeInTheDocument();
  });

  it('shows the engine’s result: the figures it reported and nothing else', () => {
    render(<EnginePanel engine={available} running={false} operation="append_batch · bronze.defects" outcome={{ kind: 'result', result: result() }} />);
    expect(screen.getByText('Real engine run')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('Table at version 2 · 3,000 rows · 3 files')).toBeInTheDocument();
  });

  it('shows a refusal in the engine’s own words, unreworded', () => {
    const error = 'Cannot cast schema, number of fields does not match: 9 vs 8';
    render(<EnginePanel engine={available} running={false} outcome={{ kind: 'result', result: result({ ok: false, error, rows: null, files: null }) }} />);
    expect(screen.getByText('Refused by the engine')).toBeInTheDocument();
    expect(screen.getByText(error)).toBeInTheDocument();
  });

  it('reports an ordinary error as an error, not as a result', () => {
    render(<EnginePanel engine={available} running={false} outcome={{ kind: 'error', message: 'No such table.' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('No such table.');
    expect(screen.queryByText('Real engine run')).not.toBeInTheDocument();
  });

  it('shows progress while running', () => {
    render(<EnginePanel engine={available} outcome={null} running />);
    expect(screen.getByRole('status')).toHaveTextContent('Running on the engine…');
  });
});

describe('JournalDrawer', () => {
  const entry = (over: Partial<JournalEntry>): JournalEntry => ({
    entry_uid: 'e1', pack_id: 'p', station: 'c', source: 'real_engine', op: 'append_batch', table_name: 'bronze.defects',
    result: { ok: false, error: 'Cannot cast schema', version: 1 }, created_at: '2026-09-25T14:02:00', ...over,
  });

  it('shows a source pill on every entry, whichever source it has', () => {
    const entries = [entry({}), entry({ entry_uid: 'e2', source: 'simulation', station: 'f', op: 'wave', table_name: null, result: {} })];
    render(<JournalDrawer open entries={entries} onClose={vi.fn()} onDelete={vi.fn()} onExport={vi.fn()} />);
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('Real engine')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Simulation')).toBeInTheDocument();
  });

  it('summarises only what was stored, and the refusal text', () => {
    render(<JournalDrawer open entries={[entry({})]} onClose={vi.fn()} onDelete={vi.fn()} onExport={vi.fn()} />);
    expect(screen.getByText('Refused: Cannot cast schema · v1')).toBeInTheDocument();
  });

  it('offers delete and export but no way to edit an entry', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const onExport = vi.fn();
    render(<JournalDrawer open entries={[entry({})]} onClose={vi.fn()} onDelete={onDelete} onExport={onExport} />);
    await user.click(screen.getByRole('button', { name: /^Delete entry: append_batch on bronze.defects/ }));
    expect(onDelete).toHaveBeenCalledWith('e1');
    await user.click(screen.getByRole('button', { name: 'Export .md' }));
    expect(onExport).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('says when it is empty, and disables export', () => {
    render(<JournalDrawer open entries={[]} onClose={vi.fn()} onDelete={vi.fn()} onExport={vi.fn()} />);
    expect(screen.getByText('Nothing yet. Run something in a station.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export .md' })).toBeDisabled();
    expect(screen.getByRole('heading', { level: 2, name: 'Lab journal' })).toBeInTheDocument();
  });
});
