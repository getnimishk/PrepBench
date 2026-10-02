// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, MenuItem, TextField, Typography } from '@mui/material';
import type { WireLearningAttempt } from '../../types/learning';
import type { EngineStatus, LabPackDetail } from '../../types/lakehouse';
import { getLakehouseNotebook, resetLakehousePack } from '../../services/api';
import { apiErrorMessage } from '../../services/apiError';
import { AC_CHECK_LABELS, acChecks } from '../../services/lakehouse/acChecks';
import {
  commitLabPrediction, completeLabAttempt, fetchLabAttempts, labAttemptUid, openLabAttempt, runOperation,
  saveLabExplanation, type RunOutcome,
} from '../../services/lakehouse/attempts';
import {
  applyResult, buildOperation, isNotCreated, isSameOperation, STATION_C_CHALLENGES, type OpTemplate, type StationCChallenge,
  type TableStates,
} from '../../services/lakehouse/stationC';
import { ErrorState, LoadingState } from '../common/States';
import { Actions, CheckRow, Detail, Good, Note, Pill, Row } from '../ui/primitives';
import { EnginePanel } from './EnginePanel';
import { OperationForm } from './OperationForm';
import { StationShell } from './StationShell';

type StepState = 'pending' | 'running' | 'done' | 'failed';

/** What the learner ran, in words, for the result's heading. */
const describe = (t: OpTemplate) => ('table' in t ? `${t.op} · ${t.table}` : `${t.op} · ${t.left} vs ${t.right}`);

const download = (name: string, text: string, type: string) => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

interface LastRun {
  challengeId: string;
  template: OpTemplate;
  /** Which of the challenge's options the engine's result amounts to; set only for its designated operation. */
  reading?: string;
}

/**
 * Station C: Delta Lake, "the load that went wrong" (PRD P0-4, mockups A3 and A4).
 *
 * Every number on this panel is the engine's. Without the engine nothing runs and
 * nothing stands in for it; the prediction and the acceptance criteria still work.
 */
export const StationC: React.FC<{
  pack: LabPackDetail;
  engine: EngineStatus;
  subjectId?: number;
  onJournalChange: () => void;
}> = ({ pack, engine, subjectId, onJournalChange }) => {
  const [challenge, setChallenge] = useState<StationCChallenge>(STATION_C_CHALLENGES[0]);
  const [attempts, setAttempts] = useState<Record<string, WireLearningAttempt> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const [picked, setPicked] = useState('');
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);

  const [template, setTemplate] = useState<OpTemplate>(challenge.designated);
  const [tables, setTables] = useState<TableStates>({});
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  const [lastRun, setLastRun] = useState<LastRun | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [setup, setSetup] = useState<StepState[]>([]);
  const [setupError, setSetupError] = useState<string | null>(null);

  const [criteria, setCriteria] = useState('');
  const [checked, setChecked] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [notebookError, setNotebookError] = useState<string | null>(null);
  const [resetNote, setResetNote] = useState<string | null>(null);

  // Only the latest operation's answer is applied: a result that arrives after the
  // learner moved to another challenge belongs to a screen that is gone.
  const runSeq = useRef(0);

  const uid = labAttemptUid({ subjectId, packId: pack.id, packVersion: pack.version, challenge });
  const attempt = attempts?.[uid];
  const committed = Boolean(attempt?.committed_at);
  const completed = Boolean(attempt?.completed_at);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    fetchLabAttempts(subjectId)
      .then((list) => { if (!cancelled) setAttempts(Object.fromEntries(list.map((a) => [a.attempt_uid, a]))); })
      .catch((err) => { if (!cancelled) setLoadError(apiErrorMessage(err, 'Could not load your lab attempts.')); });
    return () => { cancelled = true; };
  }, [subjectId, reload]);

  // A different challenge is a different screen: nothing of the last one carries over.
  const choose = (next: StationCChallenge) => {
    runSeq.current += 1;
    setChallenge(next);
    setPicked('');
    setCommitError(null);
    setTemplate(next.designated);
    setRunning(false);
    setOutcome(null);
    setLastRun(null);
    setRecordError(null);
    setSetup([]);
    setSetupError(null);
    setChecked(null);
    setSaveState('idle');
  };

  // The explanation box shows what is on record for the challenge in view.
  useEffect(() => {
    setCriteria(attempt?.explanation_text ?? '');
  }, [uid, attempt?.explanation_text]);

  const commit = async () => {
    if (!picked) return;
    setCommitting(true);
    setCommitError(null);
    try {
      await openLabAttempt({ subjectId, packId: pack.id, packVersion: pack.version, challenge });
      const saved = await commitLabPrediction(uid, picked);
      setAttempts((all) => ({ ...(all ?? {}), [uid]: saved }));
    } catch (err) {
      setCommitError(apiErrorMessage(err, 'Your prediction could not be saved.'));
      setReload((n) => n + 1); // What the server holds is what counts.
    } finally {
      setCommitting(false);
    }
  };

  const execute = useCallback(async (t: OpTemplate, designated: boolean) => {
    const mine = ++runSeq.current;
    setRunning(true);
    setRecordError(null);
    const tableName = 'table' in t ? t.table : t.left;
    const before = tables[tableName];
    const out = await runOperation(buildOperation(pack.id, t, uid));
    if (mine !== runSeq.current) return null; // Superseded.
    setRunning(false);
    setOutcome(out);
    if (out.kind !== 'result') return out;

    setTables((s) => applyResult(s, out.result));
    onJournalChange();
    // A table that was never created is a missing set-up step, not an outcome.
    const reading = designated && !isNotCreated(out.result) ? challenge.classify(out.result, before) : undefined;
    setLastRun({ challengeId: challenge.id, template: t, reading });
    if (reading && attempt && !attempt.completed_at) {
      try {
        const done = await completeLabAttempt(attempt, reading, out.result);
        if (mine === runSeq.current) setAttempts((all) => ({ ...(all ?? {}), [uid]: done }));
      } catch (err) {
        if (mine === runSeq.current) setRecordError(apiErrorMessage(err, 'The result could not be recorded against your attempt.'));
      }
    }
    return out;
  }, [attempt, challenge, onJournalChange, pack.id, tables, uid]);

  const run = () => execute(template, isSameOperation(template, challenge.designated));
  const runFollowUp = (t: OpTemplate) => { setTemplate(t); return execute(t, isSameOperation(t, challenge.designated)); };

  const runSetup = async () => {
    setSetupError(null);
    setSetup(challenge.setup.map(() => 'pending'));
    for (let i = 0; i < challenge.setup.length; i += 1) {
      const mine = ++runSeq.current;
      setSetup((s) => s.map((v, k) => (k === i ? 'running' : v)));
      const out = await runOperation(buildOperation(pack.id, challenge.setup[i].op, uid));
      if (mine !== runSeq.current) return;
      if (out.kind === 'result' && out.result.ok) {
        setTables((s) => applyResult(s, out.result));
        onJournalChange();
        setSetup((s) => s.map((v, k) => (k === i ? 'done' : v)));
        continue;
      }
      setSetup((s) => s.map((v, k) => (k === i ? 'failed' : v)));
      setOutcome(out.kind === 'result' ? null : out);
      setSetupError(
        out.kind === 'result' ? `${challenge.setup[i].label}: ${out.result.error ?? 'the engine refused it.'}`
          : out.kind === 'error' ? out.message : out.message,
      );
      return;
    }
  };

  const saveCriteria = async () => {
    setSaveState('saving');
    try {
      const saved = await saveLabExplanation(uid, criteria);
      setAttempts((all) => ({ ...(all ?? {}), [uid]: saved }));
      setSaveState('saved');
    } catch {
      setSaveState('failed');
    }
  };

  const downloadNotebook = async () => {
    setNotebookError(null);
    try {
      download(`lakehouse-lab-${pack.id}-station-c.py`, await getLakehouseNotebook(pack.id), 'text/x-python');
    } catch (err) {
      setNotebookError(apiErrorMessage(err, 'The notebook could not be exported.'));
    }
  };

  const reset = async () => {
    setResetNote(null);
    try {
      const r = await resetLakehousePack(pack.id);
      setTables({});
      setSetup([]);
      setOutcome(null);
      setLastRun(null);
      setResetNote(r.removed ? 'The lab’s tables were deleted. Your journal and predictions are kept.' : 'There were no lab tables to delete.');
    } catch (err) {
      setResetNote(apiErrorMessage(err, 'The lab’s tables could not be reset.'));
    }
  };

  if (loadError) {
    return <ErrorState what="Your lab attempts did not load." saved="nothing_to_save" detail={loadError} onRetry={() => setReload((n) => n + 1)} />;
  }
  if (attempts === null) return <LoadingState label="Loading your attempts…" />;

  const busy = running || setup.includes('running');
  const shownReading = lastRun?.challengeId === challenge.id ? lastRun.reading : undefined;
  const result = outcome?.kind === 'result' ? outcome.result : null;
  const step = !committed ? 0 : !result && !completed ? 1 : !criteria.trim() && saveState !== 'saved' ? 2 : 3;
  const checks = checked != null ? acChecks(checked) : [];
  const engineReady = engine.available;
  const chosen = attempt?.prediction ?? picked;
  const compare = template.op === 'compare_tables' ? { left: template.left, right: template.right } : undefined;
  const verdict = shownReading
    ? (attempt?.prediction === shownReading
      ? <Good sx={{ mt: '12px' }}>Your prediction was right.</Good>
      : <Note sx={{ mt: '12px' }}>Not what you predicted. Look at which setting decided it.</Note>)
    : null;

  return (
    <Box component="section" aria-labelledby="station-c-title" sx={{ mt: '22px' }}>
      <Typography variant="h5" component="h2" id="station-c-title">Station C · Delta Lake: the load that went wrong</Typography>
      <Detail sx={{ mt: '4px' }}>
        Batches come straight from the pack’s generated data. The ADF and ADLS stations that would feed them arrive later.
      </Detail>
      <TextField
        select label="Challenge" value={challenge.id} sx={{ mt: '14px', maxWidth: 520 }}
        onChange={(e) => { const next = STATION_C_CHALLENGES.find((c) => c.id === e.target.value); if (next) choose(next); }}
      >
        {STATION_C_CHALLENGES.map((c, i) => {
          const a = attempts[labAttemptUid({ subjectId, packId: pack.id, packVersion: pack.version, challenge: c })];
          const status = a?.completed_at ? ' (done)' : a?.committed_at ? ' (predicted)' : '';
          return <MenuItem key={c.id} value={c.id}>{`${i + 1} · ${c.title}${status}`}</MenuItem>;
        })}
      </TextField>

      <StationShell
        idPrefix="c"
        step={step}
        prediction={{
          prompt: <>{challenge.scenario} <b>{challenge.prompt}</b></>,
          options: challenge.options,
          value: chosen,
          committed,
          saving: committing,
          error: commitError,
          onChange: setPicked,
          onCommit: commit,
        }}
        manipulate={(
          <>
            <Detail sx={{ mt: '8px' }}>Bring the tables to where the question starts, then run the operation.</Detail>
            <Box component="ol" sx={{ m: '8px 0 0', pl: '20px', display: 'grid', gap: '4px' }}>
              {challenge.setup.map((s, i) => (
                <Typography component="li" variant="body2" key={s.label}>
                  {s.label}{setup[i] && setup[i] !== 'pending' ? ` — ${setup[i] === 'running' ? 'running' : setup[i] === 'done' ? 'done' : 'failed'}` : ''}
                </Typography>
              ))}
            </Box>
            <Actions sx={{ mt: '10px' }}>
              <Button variant="outlined" disabled={!engineReady || busy} onClick={runSetup}>
                Set up the tables
              </Button>
              {engineReady && (
                <Button variant="text" size="small" onClick={reset} disabled={busy}>Reset lab tables</Button>
              )}
            </Actions>
            {setupError && <Box role="alert"><Detail sx={{ mt: '6px', color: 'error.main' }}>{setupError}</Detail></Box>}
            {resetNote && <Detail sx={{ mt: '6px' }}>{resetNote}</Detail>}
            <OperationForm pack={pack} value={template} onChange={setTemplate} disabled={busy} />
            <Actions sx={{ mt: '14px' }}>
              <Button variant="contained" disabled={!engineReady || busy} onClick={run}>Run on engine</Button>
              {!isSameOperation(template, challenge.designated) && (
                <Button variant="text" size="small" onClick={() => setTemplate(challenge.designated)}>Use this challenge’s operation</Button>
              )}
            </Actions>
            {!engineReady && <Detail sx={{ mt: '8px' }}>The real engine isn’t installed, so nothing can run.</Detail>}
          </>
        )}
        observe={(
          <>
            <EnginePanel engine={engine} outcome={outcome} running={running} operation={lastRun ? describe(lastRun.template) : describe(template)} compareTables={compare} />
            {recordError && <Box role="alert"><Detail sx={{ mt: '8px', color: 'error.main' }}>{recordError}</Detail></Box>}
            {verdict}
            {shownReading && (
              <Detail sx={{ mt: '8px' }}>{challenge.reveal[shownReading]}</Detail>
            )}
            {!result && completed && engineReady && !running && (
              <Detail sx={{ mt: '8px' }}>
                You have already run this challenge: your prediction was {attempt?.correct ? 'right' : 'not right'}. Run it again to see the result.
              </Detail>
            )}
            {result && challenge.followUps.length > 0 && (
              <Box sx={{ mt: '12px' }}>
                <Detail>Try next</Detail>
                {challenge.followUps.map((f) => (
                  <Row
                    key={f.label}
                    title={f.label}
                    detail={f.why}
                    action={<Button size="small" variant="outlined" disabled={!engineReady || busy} onClick={() => runFollowUp(f.op)}>Run</Button>}
                  />
                ))}
              </Box>
            )}
          </>
        )}
        explain={(
          <>
            <Detail sx={{ mt: '8px' }}>Write the acceptance criteria for this decision.</Detail>
            <TextField
              label="Acceptance criteria" multiline minRows={4} fullWidth sx={{ mt: '8px' }}
              value={criteria} disabled={!committed}
              onChange={(e) => { setCriteria(e.target.value); setSaveState('idle'); }}
              placeholder="Given a batch with an unexpected column, when it is appended, then …"
              slotProps={{ htmlInput: { maxLength: 4000 } }}
              helperText={committed ? undefined : 'Commit a prediction first.'}
            />
            <Actions sx={{ mt: '10px' }}>
              <Button variant="outlined" disabled={!committed || !criteria.trim()} onClick={() => setChecked(criteria)}>Check structure</Button>
              <Button variant="outlined" disabled={!committed || !criteria.trim() || saveState === 'saving'} onClick={saveCriteria}>
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
            <Row
              sx={{ mt: '10px' }}
              title="Databricks notebook"
              detail="The same steps in SQL and PySpark, for Databricks Free Edition"
              middle={pack.notebook_verified_on
                ? <Pill tone="success">{`Verified ${pack.notebook_verified_on}`}</Pill>
                : <Pill tone="warning">Unverified</Pill>}
              action={<Button size="small" variant="outlined" onClick={downloadNotebook}>Export</Button>}
            />
            {!pack.notebook_verified_on && (
              <Detail>It hasn’t been run on Databricks Free Edition yet, so it stays marked Unverified.</Detail>
            )}
            {notebookError && <Box role="alert"><Detail sx={{ color: 'error.main' }}>{notebookError}</Detail></Box>}
          </>
        )}
      />
    </Box>
  );
};
