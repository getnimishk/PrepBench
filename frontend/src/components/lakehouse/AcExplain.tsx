// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useRef, useState } from 'react';
import { Box, Button, Stack, TextField } from '@mui/material';
import { AC_CHECK_LABELS, acChecks } from '../../services/lakehouse/acChecks';
import { getLakehouseCriteriaFeedback } from '../../services/api';
import type { CriteriaFeedbackResponse } from '../../types/lakehouse';
import { Explanation } from '../common/Explanation';
import { Actions, CheckRow, Detail, Pill } from '../ui/primitives';

export type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

/**
 * Step 4, Explain: the learner's acceptance criteria, deterministic structure checks,
 * and optional AI feedback (P1-6). Shared by the stations. The checks are labelled as
 * structure checks, never a quality grade; AI feedback is advice only, never a score
 * or verdict, and never sets correctness.
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
}> = ({
  enabled,
  intro = 'Write the acceptance criteria for this decision.',
  placeholder,
  criteria,
  onCriteria,
  checked,
  onCheck,
  saveState,
  onSave,
}) => {
  const [feedback, setFeedback] = useState<CriteriaFeedbackResponse | null>(null);
  const [feedbackCriteria, setFeedbackCriteria] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const requestSeq = useRef(0);

  const checks = checked != null ? acChecks(checked) : [];

  const handleCriteriaChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const text = e.target.value;
    onCriteria(text);
    if (feedback !== null) {
      setFeedback(null);
      setFeedbackCriteria(null);
    }
    if (aiLoading) {
      requestSeq.current += 1;
      setAiLoading(false);
    }
  };

  const handleGetAiFeedback = async () => {
    const text = criteria.trim();
    if (!text || aiLoading) return;

    const currentSeq = ++requestSeq.current;
    setAiLoading(true);

    try {
      const res = await getLakehouseCriteriaFeedback(text);
      if (currentSeq === requestSeq.current && res != null) {
        setFeedback(res);
        setFeedbackCriteria(criteria);
      }
    } catch {
      if (currentSeq === requestSeq.current) {
        setFeedback({
          status: 'not_graded',
          points: [],
          reason: 'Could not contact the feedback service.',
        });
        setFeedbackCriteria(criteria);
      }
    } finally {
      if (currentSeq === requestSeq.current) {
        setAiLoading(false);
      }
    }
  };

  // Only show feedback if criteria matches the text it was generated for
  const activeFeedback = (feedback != null && feedbackCriteria === criteria) ? feedback : null;

  return (
    <>
      <Detail sx={{ mt: '8px' }}>{intro}</Detail>
      <TextField
        label="Acceptance criteria"
        multiline
        minRows={4}
        fullWidth
        sx={{ mt: '8px' }}
        value={criteria}
        disabled={!enabled}
        onChange={handleCriteriaChange}
        placeholder={placeholder}
        slotProps={{ htmlInput: { maxLength: 4000 } }}
        helperText={enabled ? undefined : 'Commit a prediction first.'}
      />
      <Actions sx={{ mt: '10px' }}>
        <Button variant="outlined" disabled={!enabled || !criteria.trim()} onClick={() => onCheck(criteria)}>
          Check structure
        </Button>
        <Button
          variant="outlined"
          disabled={!enabled || !criteria.trim() || aiLoading}
          onClick={handleGetAiFeedback}
        >
          {aiLoading ? 'Getting feedback…' : 'Get AI feedback'}
        </Button>
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
      {activeFeedback != null && (
        <Box sx={{ mt: '12px' }} role="status">
          {activeFeedback.status === 'not_graded' ? (
            <Box>
              <Stack direction="row" sx={{ gap: 1, alignItems: 'center', mb: '4px' }}>
                <Detail sx={{ fontWeight: 600 }}>AI feedback</Detail>
                <Pill tone="warning">Not Graded</Pill>
              </Stack>
              <Detail sx={{ color: 'text.secondary' }}>
                {activeFeedback.reason || 'AI feedback is currently unavailable.'}
              </Detail>
            </Box>
          ) : (
            <Box>
              <Stack direction="row" sx={{ gap: 1, alignItems: 'center', mb: '6px' }}>
                <Detail sx={{ fontWeight: 600 }}>AI feedback</Detail>
                <Pill tone="accent">Advice only</Pill>
              </Stack>
              {activeFeedback.points && activeFeedback.points.map((point, i) => (
                <Box key={i} sx={{ mt: i === 0 ? 0 : '6px' }}>
                  <Explanation text={`- ${point}`} variant="body2" />
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}
    </>
  );
};
