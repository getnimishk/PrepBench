// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useState } from 'react';
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import type { CompareData, EngineStatus, LabOperationResult } from '../../types/lakehouse';
import type { RunOutcome } from '../../services/lakehouse/attempts';
import { Actions, Detail, Pill, Sub } from '../ui/primitives';
import { CodeBlock } from './LoopSteps';
import { CompareResult } from './CompareResult';
import { resultSummary } from '../../services/lakehouse/present';

/** Fallback only for the install command, when neither the status nor the 503 carried one. */
const INSTALL_FALLBACK = 'uv pip install --system-certs -r backend/requirements-lab.txt';

/** The command, with a button that copies it. */
const Command: React.FC<{ command: string }> = ({ command }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
    } catch {
      setCopied(false); // The command is on screen to be selected by hand.
    }
  };
  return (
    <>
      <CodeBlock label="Install command">{command}</CodeBlock>
      <Actions sx={{ mt: '8px' }}>
        <Button size="small" variant="outlined" onClick={copy}>{copied ? 'Copied' : 'Copy command'}</Button>
      </Actions>
    </>
  );
};

/**
 * "Real engine not installed" (mockup A4).
 *
 * No numbers, no sample rows, no "expected" result: nothing stands in for a run
 * that didn't happen (CLAUDE.md hard rule 2). The e2e spec asserts it.
 */
export const NotInstalled: React.FC<{ message?: string; command?: string; reason?: string | null }> = ({
  message, command, reason,
}) => (
  <Box sx={{ mt: '10px' }}>
    <Pill tone="warning">Real engine not installed</Pill>
    <Sub sx={{ mb: 0 }}>
      {message ?? 'This step runs on a real Delta Lake engine, which is optional and isn’t installed.'}{' '}
      <b>Nothing below is simulated in its place.</b>
    </Sub>
    {reason && <Detail sx={{ mt: '6px' }}>{reason}</Detail>}
    <Command command={command || INSTALL_FALLBACK} />
    <Detail sx={{ mt: '10px' }}>Then restart PrepBench. Your prediction is saved and will be here.</Detail>
    <Detail sx={{ mt: '6px' }}>
      You can still write the acceptance criteria (step 4). The other stations don’t need the engine.
    </Detail>
  </Box>
);

const Result: React.FC<{
  result: LabOperationResult; operation: string; compareTables?: { left: string; right: string };
}> = ({ result, operation, compareTables }) => {
  const { elapsed_ms: elapsed, ...details } = result.data as Record<string, unknown>;
  const compare = result.ok && result.op === 'compare_tables' ? (result.data as unknown as CompareData) : null;
  const summary = resultSummary(result);
  return (
    <Box sx={{ mt: '10px' }}>
      <Actions>
        <Pill tone="success">Real engine run</Pill>
        <Pill tone={result.ok ? 'success' : 'danger'}>{result.ok ? 'Done' : 'Refused by the engine'}</Pill>
        <Detail>{operation}</Detail>
      </Actions>
      {summary && <Detail sx={{ mt: '8px' }}>{summary}</Detail>}
      {result.error && <CodeBlock label="The engine's message">{result.error}</CodeBlock>}
      {compare && <CompareResult data={compare} left={compareTables?.left ?? 'left'} right={compareTables?.right ?? 'right'} />}
      {!compare && Object.keys(details).length > 0 && (
        <Box component="details" sx={{ mt: '10px' }}>
          <Typography component="summary" variant="body2" sx={{ cursor: 'pointer', fontWeight: 700 }}>
            Everything the engine returned
          </Typography>
          <CodeBlock label="Engine result details">{JSON.stringify(details, null, 2)}</CodeBlock>
        </Box>
      )}
      {typeof elapsed === 'number' && <Detail sx={{ mt: '6px' }}>Took {elapsed} ms</Detail>}
    </Box>
  );
};

/** Step 3: what the engine did, or why nothing ran. */
export const EnginePanel: React.FC<{
  engine: EngineStatus;
  outcome: RunOutcome | null;
  running: boolean;
  /** What was run, in words, for the result's heading. */
  operation?: string;
  /** The two tables a compare_tables result is about. */
  compareTables?: { left: string; right: string };
}> = ({ engine, outcome, running, operation = '', compareTables }) => {
  if (outcome?.kind === 'no-engine') {
    return <NotInstalled message={outcome.message} command={outcome.installCommand} />;
  }
  if (!engine.available) {
    return <NotInstalled command={engine.install_command} reason={engine.detail} />;
  }
  if (running) {
    return (
      <Box role="status" sx={{ display: 'flex', alignItems: 'center', gap: '10px', mt: '10px' }}>
        <CircularProgress size={18} aria-hidden /> <Detail>Running on the engine…</Detail>
      </Box>
    );
  }
  if (!outcome) return <Sub sx={{ mb: 0 }}>Run the operation to see what the engine does.</Sub>;
  if (outcome.kind === 'error') return <Alert severity="error" sx={{ mt: '10px' }}>{outcome.message}</Alert>;
  return <Result result={outcome.result} operation={operation} compareTables={compareTables} />;
};
