// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Box, Button, TextField } from '@mui/material';
import { AC_CHECK_LABELS, acChecks } from '../../services/lakehouse/acChecks';
import { Actions, CheckRow, Detail, Pill } from '../ui/primitives';

export type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

/**
 * Step 4, Explain: the learner's acceptance criteria and the structure checks on
 * them (PRD P0-9). Shared by the stations. The checks are labelled as structure
 * checks, never a quality grade, and there is no AI in v1.
 */
export const AcExplain: React.FC<{
  /** Criteria are written after the prediction is on record, never before. */
  enabled: boolean;
  intro?: string;
  placeholder: string;
  criteria: string;
  onCriteria: (text: string) => void;
  checked: string | null;
  onCheck: (text: string) => void;
  saveState: SaveState;
  onSave: () => void;
}> = ({ enabled, intro = 'Write the acceptance criteria for this decision.', placeholder, criteria, onCriteria, checked, onCheck, saveState, onSave }) => {
  const checks = checked != null ? acChecks(checked) : [];
  return (
    <>
      <Detail sx={{ mt: '8px' }}>{intro}</Detail>
      <TextField
        label="Acceptance criteria" multiline minRows={4} fullWidth sx={{ mt: '8px' }}
        value={criteria} disabled={!enabled}
        onChange={(e) => onCriteria(e.target.value)}
        placeholder={placeholder}
        slotProps={{ htmlInput: { maxLength: 4000 } }}
        helperText={enabled ? undefined : 'Commit a prediction first.'}
      />
      <Actions sx={{ mt: '10px' }}>
        <Button variant="outlined" disabled={!enabled || !criteria.trim()} onClick={() => onCheck(criteria)}>Check structure</Button>
        <Button variant="outlined" disabled={!enabled || !criteria.trim() || saveState === 'saving'} onClick={onSave}>
          {saveState === 'saving' ? 'Saving…' : 'Save'}
        </Button>
        {saveState === 'saved' && <Box role="status"><Detail>Saved</Detail></Box>}
        {saveState === 'failed' && <Box role="alert"><Detail sx={{ color: 'error.main' }}>Not saved. Try again.</Detail></Box>}
      </Actions>
      {checked != null && (
        <Box sx={{ mt: '12px' }}>
          <Detail>Structure checks, not a quality grade</Detail>
          {checks.map((c) => (
            <CheckRow
              key={c.check}
              mark={<span aria-hidden>{c.passed ? '✓' : '○'}</span>}
              aside={<Pill tone={c.passed ? 'success' : 'neutral'}>{c.passed ? 'Present' : 'Missing'}</Pill>}
            >
              {AC_CHECK_LABELS[c.check]}
              {!c.passed && <Detail>{c.hint}</Detail>}
            </CheckRow>
          ))}
        </Box>
      )}
    </>
  );
};
