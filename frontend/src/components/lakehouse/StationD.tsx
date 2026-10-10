// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, FormControlLabel, MenuItem, Radio, RadioGroup, TextField, Typography } from '@mui/material';
import type { WireLearningAttempt } from '../../types/learning';
import type { EngineStatus, LabOperation, LabPackDetail } from '../../types/lakehouse';
import { apiErrorMessage } from '../../services/apiError';
import {
  commitLabPrediction, completeLabClaim, fetchLabAttempts, findLabAttempt, openLabAttempt, runOperation, saveLabExplanation,
  type RunOutcome,
} from '../../services/lakehouse/attempts';
import { buildOperation, defaultTemplate, type OpTemplate } from '../../services/lakehouse/stationC';
import {
  checkClaim, defectChallenge, defectName, parseDefects, scoreDefects, type Cited, type DefectTruth, type Verdict,
} from '../../services/lakehouse/stationD';
import { resultSummary } from '../../services/lakehouse/present';
import { ErrorState, LoadingState } from '../common/States';
import { Actions, Bar, Detail, Good, Metric, MetricRow, Note, Panel, Pill } from '../ui/primitives';
import { EnginePanel } from './EnginePanel';
import { OperationForm } from './OperationForm';
import { SaveAsInterviewQuestion } from './SaveAsInterviewQuestion';

/** What was run, in words. */
function describeRun(op: LabOperation): string {
  if (op.op === 'compare_tables') return `Compare ${op.left} with ${op.right}${op.through_batch ? ` through batch ${op.through_batch}` : ''}`;
  const verb = op.op.replace(/_/g, ' ');
  const what = `${verb.charAt(0).toUpperCase()}${verb.slice(1)} ${op.table}`;
  return 'batch' in op ? `${what}, batch ${op.batch}${'small_files' in op && op.small_files ? ' as small files' : ''}` : what;
}

interface Run extends Cited {
  n: number;
  label: string;
}

/**
 * Station D: the Reconciliation Detective (Lakehouse P1-2).
 *
 * The legacy and migrated totals disagree. The learner runs real engine operations, then claims
 * a defect by naming it and citing the result that shows it. The score is defects found against
 * the defects the pack plants (its own manifest), and a claim counts only when the cited result
 * is one that defect produces (services/lakehouse/stationD). Nothing is graded by AI, and
 * nothing is invented: a claim with no supporting result is not counted and not recorded.
 */
export const StationD: React.FC<{
  pack: LabPackDetail;
  engine: EngineStatus;
  subjectId?: number;
  onJournalChange: () => void;
}> = ({ pack, engine, subjectId, onJournalChange }) => {
  const defects = useMemo(() => parseDefects(pack.defect_manifest), [pack.defect_manifest]);

  const [attempts, setAttempts] = useState<WireLearningAttempt[] | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const first = defects[0]?.table ?? Object.keys(pack.dataset.tables)[0] ?? 'defects';
  const [template, setTemplate] = useState<OpTemplate>(() => defaultTemplate('compare_tables', `legacy.${first}`, `bronze.${first}`));
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [cited, setCited] = useState<number | null>(null);
  const runSeq = useRef(0);

  const [defectId, setDefectId] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savedNote, setSavedNote] = useState<Record<string, 'saved' | 'failed'>>({});

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    fetchLabAttempts(subjectId)
      .then((list) => { if (!cancelled) setAttempts(list); })
      .catch((err) => { if (!cancelled) setLoadError(apiErrorMessage(err, 'Could not load your lab attempts.')); });
    return () => { cancelled = true; };
  }, [subjectId, pack.id, pack.version, reload]);

  const keyFor = useCallback(
    (d: DefectTruth) => ({ subjectId, packId: pack.id, packVersion: pack.version, challenge: defectChallenge(d.id) }),
    [subjectId, pack.id, pack.version],
  );
  /** The attempt behind each defect the learner has found: closed, and graded correct by the engine result. */
  const foundAttempts = useMemo(() => {
    const out = new Map<string, WireLearningAttempt>();
    for (const d of defects) {
      const a = attempts ? findLabAttempt(attempts, keyFor(d)) : undefined;
      if (a?.completed_at && a.correct === true) out.set(d.id, a);
    }
    return out;
  }, [attempts, defects, keyFor]);

  if (defects.length === 0) {
    return (
      <Box component="section" aria-labelledby="station-d-title" sx={{ mt: '22px' }}>
        <Typography variant="h5" component="h2" id="station-d-title">Station D · Reconciliation Detective</Typography>
        <Detail sx={{ mt: '8px' }}>This pack plants no defects, so there is nothing to find here. Nothing is shown in its place.</Detail>
      </Box>
    );
  }
  if (loadError) {
    return <ErrorState what="Your lab attempts did not load." saved="nothing_to_save" detail={loadError} onRetry={() => setReload((n) => n + 1)} />;
  }
  if (attempts === undefined) return <LoadingState label="Loading your attempts…" />;

  const score = scoreDefects(defects, foundAttempts.keys());
  const current = runs.find((r) => r.n === cited) ?? null;

  const execute = async () => {
    const mine = ++runSeq.current;
    setRunning(true);
    const request = buildOperation(pack.id, template);
    const out = await runOperation(request);
    if (mine !== runSeq.current) return;
    setRunning(false);
    setOutcome(out);
    if (out.kind !== 'result') return;
    onJournalChange();
    const n = runs.length === 0 ? 1 : Math.max(...runs.map((r) => r.n)) + 1;
    setRuns((all) => [{ n, label: describeRun(request), request, result: out.result }, ...all].slice(0, 12));
    setCited(n);
    setVerdict(null);
  };

  const claim = async () => {
    const truth = defects.find((d) => d.id === defectId);
    if (!truth || !current) return;
    const checked = checkClaim(truth, current);
    setVerdict(checked);
    setClaimError(null);
    if (!checked.supported || foundAttempts.has(truth.id)) return;
    setClaiming(true);
    try {
      const opened = await openLabAttempt(keyFor(truth));
      await commitLabPrediction(subjectId, opened.attempt_uid, truth.id);
      const done = await completeLabClaim(subjectId, opened.attempt_uid, {
        claim: truth.id, op: current.request.op, run: current.label, basis: checked.basis, journal_uid: current.result.journal_uid,
      });
      setAttempts((all) => [...(all ?? []).filter((a) => a.attempt_uid !== done.attempt_uid), done]);
    } catch (err) {
      setClaimError(apiErrorMessage(err, 'Your claim could not be saved.'));
      setReload((n) => n + 1); // What the server holds is what counts.
    } finally {
      setClaiming(false);
    }
  };

  const saveExplanation = async (a: WireLearningAttempt, id: string) => {
    try {
      const saved = await saveLabExplanation(subjectId, a.attempt_uid, drafts[id] ?? a.explanation_text ?? '');
      setAttempts((all) => [...(all ?? []).filter((x) => x.attempt_uid !== saved.attempt_uid), saved]);
      setSavedNote((s) => ({ ...s, [id]: 'saved' }));
    } catch {
      setSavedNote((s) => ({ ...s, [id]: 'failed' }));
    }
  };

  const compareTables = template.op === 'compare_tables' ? { left: template.left, right: template.right } : undefined;
  const already = foundAttempts.has(defectId);

  return (
    <Box component="section" aria-labelledby="station-d-title" sx={{ mt: '22px' }}>
      <Typography variant="h5" component="h2" id="station-d-title">Station D · Reconciliation Detective</Typography>
      <Detail sx={{ mt: '4px' }}>
        Pipeline level · runs on the real Delta engine · a teaching simulation over a fictional scenario, not a real Hadoop or Databricks system
      </Detail>
      <Panel sx={{ mt: '12px' }}>
        <Typography variant="body1" component="p" sx={{ m: 0 }}>
          The legacy and migrated totals disagree. Matching row counts do not mean the data is right: find each defect the pack plants,
          using what the engine returns.
        </Typography>
        <MetricRow sx={{ mt: '12px' }}>
          <Metric value={`${score.found} of ${score.planted}`} label="Defects found" detail="Found against the defects the pack plants" />
        </MetricRow>
        <Bar
          value={(score.found / score.planted) * 100} color={score.found === score.planted ? 'success' : 'primary'}
          label={`${score.found} of ${score.planted} defects found`} sx={{ mt: '8px' }}
        />
      </Panel>

      <Panel component="section" aria-labelledby="d-run" sx={{ mt: '16px' }}>
        <Typography variant="h6" component="h3" id="d-run">1 · Run an operation</Typography>
        <Detail sx={{ mt: '4px' }}>
          Create the legacy and bronze tables first, then compare them, load batches, merge the change batch or compact.
        </Detail>
        <OperationForm pack={pack} value={template} onChange={setTemplate} disabled={running} />
        <Actions sx={{ mt: '12px' }}>
          <Button variant="contained" onClick={execute} disabled={running || !engine.available}>Run on the engine</Button>
        </Actions>
        <EnginePanel
          engine={engine} outcome={outcome} running={running}
          operation={runs[0]?.label ?? ''} compareTables={compareTables}
        />
      </Panel>

      <Panel component="section" aria-labelledby="d-claim" sx={{ mt: '16px' }}>
        <Typography variant="h6" component="h3" id="d-claim">2 · Claim a defect</Typography>
        {runs.length === 0 ? (
          <Detail sx={{ mt: '8px' }}>Run an operation first. A claim needs an engine result to rest on.</Detail>
        ) : (
          <>
            <Detail sx={{ mt: '4px' }}>Name the defect and the result that shows it. A claim the result does not show is not counted.</Detail>
            <Typography variant="body2" component="p" id="d-cite" sx={{ mt: '12px', mb: '4px', fontWeight: 700 }}>Result to cite</Typography>
            <RadioGroup aria-labelledby="d-cite" value={cited === null ? '' : String(cited)} onChange={(e) => { setCited(Number(e.target.value)); setVerdict(null); }}>
              {runs.map((r) => (
                <FormControlLabel
                  key={r.n} value={String(r.n)} control={<Radio />}
                  label={<>{r.label}<Detail component="span" sx={{ ml: '8px' }}>{r.result.ok ? 'Done' : 'Refused'}{resultSummary(r.result) ? ` · ${resultSummary(r.result)}` : ''}</Detail></>}
                />
              ))}
            </RadioGroup>
          </>
        )}
        <TextField
          select label="Defect" value={defectId} sx={{ mt: '12px', maxWidth: 420 }}
          onChange={(e) => { setDefectId(e.target.value); setVerdict(null); }}
        >
          {defects.map((d) => (
            <MenuItem key={d.id} value={d.id}>{defectName(d.id)}{foundAttempts.has(d.id) ? ' (found)' : ''}</MenuItem>
          ))}
        </TextField>
        <Actions sx={{ mt: '12px' }}>
          <Button variant="contained" onClick={claim} disabled={claiming || !current || !defectId}>Claim this defect</Button>
        </Actions>
        {verdict && (verdict.supported
          ? <Good sx={{ mt: '12px' }} role="status">{already && !claiming ? 'Counted: ' : 'Counted. '}{verdict.basis}.</Good>
          : <Note sx={{ mt: '12px' }} role="status">Not counted. {verdict.reason}</Note>)}
        {claimError && <Box role="alert"><Detail sx={{ mt: '8px', color: 'error.main' }}>{claimError}</Detail></Box>}
      </Panel>

      <Panel component="section" aria-labelledby="d-found" sx={{ mt: '16px' }}>
        <Typography variant="h6" component="h3" id="d-found">Defects found</Typography>
        {foundAttempts.size === 0 ? (
          <Detail sx={{ mt: '8px' }}>None yet.</Detail>
        ) : (
          <Box component="ul" aria-label="Defects found" sx={{ listStyle: 'none', p: 0, m: '8px 0 0' }}>
            {defects.filter((d) => foundAttempts.has(d.id)).map((d) => {
              const a = foundAttempts.get(d.id)!;
              const basis = (a.observed as { basis?: unknown } | null | undefined)?.basis;
              return (
                <Box component="li" key={d.id} sx={{ py: '10px', borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Actions>
                    <Pill tone="success">Found</Pill>
                    <Typography variant="body2" component="span" sx={{ fontWeight: 700 }}>{defectName(d.id)}</Typography>
                    {typeof basis === 'string' && <Detail component="span">{basis}</Detail>}
                  </Actions>
                  <TextField
                    label={`Explain what happened (${defectName(d.id)})`} multiline minRows={2} fullWidth sx={{ mt: '8px' }}
                    value={drafts[d.id] ?? a.explanation_text ?? ''}
                    onChange={(e) => { setDrafts((s) => ({ ...s, [d.id]: e.target.value })); setSavedNote((s) => { const { [d.id]: _gone, ...rest } = s; return rest; }); }}
                    slotProps={{ htmlInput: { maxLength: 4000 } }}
                  />
                  <Actions sx={{ mt: '6px' }}>
                    <Button size="small" variant="outlined" onClick={() => saveExplanation(a, d.id)}>Save explanation</Button>
                    {savedNote[d.id] === 'saved' && <Box role="status"><Detail>Saved. Your words, not graded.</Detail></Box>}
                    {savedNote[d.id] === 'failed' && <Box role="alert"><Detail sx={{ color: 'error.main' }}>Could not save. Try again.</Detail></Box>}
                  </Actions>
                  <SaveAsInterviewQuestion
                    subjectId={subjectId}
                    packId={pack.id}
                    packVersion={pack.version}
                    station="d"
                    challengeId={d.id}
                    challengeTitle={defectName(d.id)}
                    attempt={a}
                  />
                </Box>
              );
            })}
          </Box>
        )}
      </Panel>
    </Box>
  );
};
