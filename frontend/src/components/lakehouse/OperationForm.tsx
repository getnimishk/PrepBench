// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Box, FormControlLabel, MenuItem, Switch, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import type { LabOpName, LabPackDetail } from '../../types/lakehouse';
import { defaultTemplate, type OpTemplate } from '../../services/lakehouse/stationC';

const OP_LABELS: Record<LabOpName, string> = {
  create_table: 'Create table',
  append_batch: 'Append batch',
  merge_cdc: 'Merge the change batch (CDC)',
  history: 'Table history',
  read_version: 'Read an older version (time travel)',
  restore: 'Restore to a version',
  compact: 'Compact small files',
  vacuum: 'Vacuum',
  compare_tables: 'Compare two tables',
};

/** The dataset table a layer-qualified name belongs to (`bronze.defects` -> `defects`). */
const baseName = (qualified: string) => qualified.split('.').slice(1).join('.');

/**
 * The operation the learner is about to run. They name an operation and a table
 * from the pack; the server writes the SQL and resolves the path, so there is no
 * free-text query or file path anywhere in this form.
 */
export const OperationForm: React.FC<{
  pack: LabPackDetail;
  value: OpTemplate;
  onChange: (next: OpTemplate) => void;
  disabled?: boolean;
}> = ({ pack, value, onChange, disabled }) => {
  const set = (patch: Record<string, unknown>) => onChange({ ...value, ...patch } as OpTemplate);
  const tables = pack.tables;
  const table = 'table' in value ? value.table : tables[0];
  const batches = pack.dataset.tables[baseName(table)]?.batches ?? 1;

  const changeOp = (op: LabOpName) => {
    const first = 'table' in value ? value.table : (value as { left: string }).left;
    const other = tables.find((t) => baseName(t) === baseName(first) && t !== first) ?? first;
    onChange(defaultTemplate(op, first, other));
  };

  return (
    <Box sx={{ display: 'grid', gap: '12px', mt: '12px' }}>
      <TextField select label="Operation" value={value.op} disabled={disabled} onChange={(e) => changeOp(e.target.value as LabOpName)}>
        {(Object.keys(OP_LABELS) as LabOpName[]).map((op) => <MenuItem key={op} value={op}>{OP_LABELS[op]}</MenuItem>)}
      </TextField>

      {value.op === 'compare_tables' ? (
        <>
          <TextField select label="Left table" value={value.left} disabled={disabled} onChange={(e) => set({ left: e.target.value })}>
            {tables.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>
          <TextField select label="Right table" value={value.right} disabled={disabled} onChange={(e) => set({ right: e.target.value })}>
            {tables.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>
          <TextField
            label="Tolerance" type="number" value={value.tolerance ?? 0} disabled={disabled}
            slotProps={{ htmlInput: { min: 0, step: 0.0001 } }}
            onChange={(e) => set({ tolerance: Math.max(0, Number(e.target.value) || 0) })}
          />
        </>
      ) : (
        <TextField select label="Table" value={table} disabled={disabled} onChange={(e) => set({ table: e.target.value })}>
          {tables.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
        </TextField>
      )}

      {value.op === 'append_batch' && (
        <>
          <TextField
            select label="Batch" value={value.batch} disabled={disabled}
            onChange={(e) => set({ batch: Number(e.target.value) })}
          >
            {Array.from({ length: batches }, (_, i) => i + 1).map((b) => <MenuItem key={b} value={b}>Batch {b}</MenuItem>)}
          </TextField>
          <Box>
            <Typography variant="body2" component="p" id="op-write" sx={{ mb: '6px', fontWeight: 700 }}>How it is written</Typography>
            <ToggleButtonGroup
              exclusive size="small" aria-labelledby="op-write" value={value.write ?? 'append'} disabled={disabled}
              onChange={(_, v: 'append' | 'merge' | null) => v && set({ write: v })}
            >
              <ToggleButton value="append">Append</ToggleButton>
              <ToggleButton value="merge">Merge on the key</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <Box>
            <Typography variant="body2" component="p" id="op-schema" sx={{ mb: '6px', fontWeight: 700 }}>Schema mode</Typography>
            <ToggleButtonGroup
              exclusive size="small" aria-labelledby="op-schema" value={value.schema_mode ?? 'enforce'} disabled={disabled}
              onChange={(_, v: 'enforce' | 'merge' | null) => v && set({ schema_mode: v })}
            >
              <ToggleButton value="enforce">Enforce</ToggleButton>
              <ToggleButton value="merge">Evolve (merge)</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <FormControlLabel
            control={<Switch checked={Boolean(value.small_files)} disabled={disabled} onChange={(e) => set({ small_files: e.target.checked })} />}
            label="Land it as many small writes"
          />
        </>
      )}

      {(value.op === 'read_version' || value.op === 'restore') && (
        <TextField
          label="Version" type="number" value={value.version} disabled={disabled}
          slotProps={{ htmlInput: { min: 0, step: 1 } }}
          onChange={(e) => set({ version: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
        />
      )}

      {value.op === 'vacuum' && (
        <>
          <TextField
            label="Retention (hours)" type="number" value={value.retention_hours} disabled={disabled}
            slotProps={{ htmlInput: { min: 0, step: 1 } }}
            onChange={(e) => set({ retention_hours: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
          />
          <FormControlLabel
            control={<Switch checked={value.dry_run ?? true} disabled={disabled} onChange={(e) => set({ dry_run: e.target.checked })} />}
            label="Dry run: list the files, delete nothing"
          />
          <FormControlLabel
            control={<Switch checked={value.enforce_retention ?? true} disabled={disabled} onChange={(e) => set({ enforce_retention: e.target.checked })} />}
            label="Keep the engine’s retention safety check on"
          />
        </>
      )}
    </Box>
  );
};
