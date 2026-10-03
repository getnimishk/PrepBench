// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Checkbox, FormControlLabel, MenuItem, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { addLakehouseJournalEntry } from '../../services/api';
import { apiErrorMessage } from '../../services/apiError';
import {
  leversKey, parseAdf, ranges, runPipeline, type AdfLevers, type BatchManifest, type SourceRow,
} from '../../services/lakehouse/adfModel';
import { STATION_A_COUPLINGS } from '../../services/lakehouse/pipelineCouplings';
import { classifyManifest, watermarkPreset, WATERMARK_CHALLENGE, type WatermarkOutcome } from '../../services/lakehouse/pipelineChallenges';
import { loadSourceIndex } from '../../services/lakehouse/sourceIndex';
import type { LabPackDetail } from '../../types/lakehouse';
import { ErrorState, LoadingState } from '../common/States';
import { Actions, CheckRow, Detail, Good, Metric, MetricRow, Note, Panel, Pill, Row, Sub } from '../ui/primitives';
import { AcExplain, type SaveState } from './AcExplain';
import { CouplingLedger } from './CouplingLedger';
import { StationShell } from './StationShell';
import { useLabAttempt } from './useLabAttempt';

const n = (v: number) => v.toLocaleString('en-GB');

/** One labelled choice among a few, as a toggle group. */
function Choice<T extends string>({ id, label, value, options, onChange, disabled }: {
  id: string; label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean;
}) {
  return (
    <Box>
      <Typography variant="body2" component="p" id={id} sx={{ mb: '6px', fontWeight: 700 }}>{label}</Typography>
      <ToggleButtonGroup
        exclusive size="small" value={value} aria-labelledby={id} disabled={disabled}
        onChange={(_, v: T | null) => v && onChange(v)}
        sx={{ flexWrap: 'wrap' }}
      >
        {options.map((o) => <ToggleButton key={o.value} value={o.value}>{o.label}</ToggleButton>)}
      </ToggleButtonGroup>
    </Box>
  );
}

const OWNER_OPTIONS = [{ value: 'adf', label: 'Azure Data Factory' }, { value: 'lakeflow', label: 'Lakeflow Jobs' }] as const;
const FAILURE_POINTS = [10, 20, 30, 40, 50, 60, 70, 80, 90];

/**
 * Station A: ADF + Lakeflow Jobs (PRD P0-6, mockup A9). A step list, not a canvas.
 *
 * A simulation, and it says so: the browser's model works the outcome out over the pack's real
 * source index, and the batch manifest it produces is what Station C writes into a real table and
 * the real engine measures. The prediction is a real, write-once attempt; its outcome is the
 * model's, recorded as a simulation.
 */
export const StationA: React.FC<{
  pack: LabPackDetail;
  subjectId?: number;
  /** The upstream Station C will use. Station A sets it to what the learner last ran. */
  upstream: AdfLevers;
  onUpstream: (levers: AdfLevers) => void;
  onJournalChange: () => void;
  onLoadInC: () => void;
}> = ({ pack, subjectId, upstream, onUpstream, onJournalChange, onLoadInC }) => {
  const parsed = useMemo(() => parseAdf(pack.pipeline), [pack.pipeline]);
  const config = parsed.ok ? parsed.config : null;
  const table = config?.table;

  const [index, setIndex] = useState<SourceRow[] | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);
  useEffect(() => {
    if (!table) return undefined;
    let cancelled = false;
    setIndexError(null);
    loadSourceIndex(pack.id, pack.version, table)
      .then((rows) => { if (!cancelled) setIndex(rows); })
      .catch((err) => { if (!cancelled) setIndexError(apiErrorMessage(err, 'The source index did not load.')); });
    return () => { cancelled = true; };
  }, [pack.id, pack.version, table, reloadIndex]);

  const lab = useLabAttempt(pack, subjectId, WATERMARK_CHALLENGE);
  const [picked, setPicked] = useState('');
  const [levers, setLevers] = useState<AdfLevers>(upstream);
  const [ran, setRan] = useState<{ key: string; manifest: BatchManifest } | null>(null);
  const [journalNote, setJournalNote] = useState<string | null>(null);

  const [criteria, setCriteria] = useState('');
  const [checked, setChecked] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  useEffect(() => { setCriteria(lab.attempt?.explanation_text ?? ''); }, [lab.attempt?.explanation_text]);

  if (!config) {
    return (
      <Panel component="section" aria-labelledby="station-a-title" sx={{ mt: '22px' }}>
        <Typography variant="h5" component="h2" id="station-a-title">Station A · ADF + Lakeflow Jobs</Typography>
        <Detail sx={{ mt: '8px' }}>
          This pack has no usable pipeline content{parsed.ok ? '' : `: ${parsed.reason}`} Nothing is shown in its place.
        </Detail>
      </Panel>
    );
  }
  if (lab.loadError) return <ErrorState what="Your lab attempts did not load." saved="nothing_to_save" detail={lab.loadError} onRetry={lab.retry} />;
  if (indexError) return <ErrorState what="The source index did not load." saved="nothing_to_save" detail={indexError} onRetry={() => setReloadIndex((x) => x + 1)} />;
  if (lab.attempt === undefined || index === null) return <LoadingState label="Loading Station A…" />;

  const committed = lab.committed;
  const preset = watermarkPreset(config);
  const presetManifest = runPipeline(config, index, preset);
  const presetOutcome = classifyManifest(presetManifest);
  const chosen = (lab.attempt?.prediction ?? picked) as WatermarkOutcome | '';
  const key = leversKey(levers);
  const hasRun = ran !== null && ran.key === key;
  const stale = ran !== null && ran.key !== key;
  const m = ran?.manifest ?? null;

  const log = async (op: string, result: Record<string, unknown>) => {
    try {
      await addLakehouseJournalEntry({ pack_id: pack.id, station: 'a', source: 'simulation', op, result, attempt_uid: lab.uid });
      setJournalNote(null);
      onJournalChange();
    } catch (err) {
      setJournalNote(apiErrorMessage(err, 'The journal entry could not be saved.'));
    }
  };

  const commit = async () => {
    if (!picked) return;
    const ok = await lab.commit(picked, {
      correct: picked === presetOutcome,
      observed: { outcome: presetOutcome, missed: presetManifest.missed.length, duplicated: presetManifest.duplicated.length },
    });
    if (ok) void log('adf_prediction', { outcome: presetOutcome, missed: presetManifest.missed.length });
  };

  const run = () => {
    const manifest = runPipeline(config, index, levers);
    setRan({ key, manifest });
    onUpstream(levers);
    void log('adf_run', {
      trigger: levers.trigger, load: levers.load, watermark: levers.watermark, sink: levers.sink,
      retries: levers.retries, failure_at_percent: levers.failureAtPercent,
      expected: manifest.expected.length, missed: manifest.missed.length, repeated_writes: manifest.duplicateWrites,
    });
  };

  const set = (patch: Partial<AdfLevers>) => setLevers({ ...levers, ...patch });
  const tumbling = levers.trigger === 'tumbling';
  const scheduled = levers.trigger === 'schedule';

  const saveCriteria = async () => {
    setSaveState('saving');
    try { await lab.saveCriteria(criteria); setSaveState('saved'); } catch { setSaveState('failed'); }
  };
  const step = !committed ? 0 : !hasRun ? 1 : !criteria.trim() && saveState !== 'saved' ? 2 : 3;
  const verdict = committed && lab.attempt?.prediction ? (lab.attempt.prediction === presetOutcome) : null;

  return (
    <Box component="section" aria-labelledby="station-a-title" sx={{ mt: '22px' }}>
      <Typography variant="h5" component="h2" id="station-a-title">Station A · ADF + Lakeflow Jobs</Typography>
      <Detail sx={{ mt: '4px' }}>Pipeline level · simulation · decides which rows land in each batch, and sends them to Station C</Detail>

      <StationShell
        idPrefix="a"
        step={step}
        prediction={{
          prompt: <>{WATERMARK_CHALLENGE.prompt}</>,
          options: WATERMARK_CHALLENGE.options,
          value: chosen,
          committed,
          saving: lab.committing,
          error: lab.commitError,
          onChange: setPicked,
          onCommit: commit,
          body: committed && verdict !== null ? (
            <Box sx={{ mt: '8px' }}>
              <Box component="ul" aria-label="Your prediction" sx={{ listStyle: 'none', p: 0, m: 0 }}>
                <li>
                  <Detail component="span">You predicted: </Detail>
                  <b>{WATERMARK_CHALLENGE.options.find((o) => o.id === lab.attempt?.prediction)?.text}</b>
                </li>
              </Box>
              {verdict ? <Good sx={{ mt: '10px' }}>Your prediction was right.</Good> : <Note sx={{ mt: '10px' }}>Not what the model found.</Note>}
              <Sub>
                {WATERMARK_CHALLENGE.reveal[presetOutcome]}{' '}
                {presetManifest.missed.length > 0 && `${n(presetManifest.missed.length)} rows (ids ${ranges(presetManifest.missed)}) never arrive.`}
                {presetManifest.duplicated.length > 0 && ` ${n(presetManifest.duplicateWrites)} rows are repeated.`}
              </Sub>
            </Box>
          ) : undefined,
        }}
        manipulate={(
          <>
            <Detail sx={{ mt: '8px' }}>Change one thing at a time, then run the pipeline.</Detail>
            <Box sx={{ display: 'grid', gap: '14px', mt: '12px' }}>
              <Choice id="a-trigger" label="Trigger" value={levers.trigger} onChange={(v) => set({ trigger: v })} options={[
                { value: 'schedule', label: 'Schedule' }, { value: 'tumbling', label: 'Tumbling window' }, { value: 'event', label: 'Event (a file lands)' }]}
              />
              <Choice id="a-load" label="Load" value={levers.load} disabled={!scheduled} onChange={(v) => set({ load: v })} options={[
                { value: 'incremental', label: 'Incremental' }, { value: 'full', label: 'Full' }]}
              />
              {!scheduled && <Detail>Only a scheduled run chooses between a full and an incremental load: a tumbling window copies its own window, and an event runs once per file.</Detail>}
              <Choice id="a-watermark" label="When is the watermark updated?" value={levers.watermark} disabled={tumbling} onChange={(v) => set({ watermark: v })} options={[
                { value: 'success', label: 'After the copy succeeds' }, { value: 'completion', label: 'After the copy completes' }, { value: 'before', label: 'Before the copy' }]}
              />
              {tumbling && <Detail>A tumbling window tracks its own window state, so the watermark isn’t used.</Detail>}
              <Choice id="a-sink" label="Destination" value={levers.sink} onChange={(v) => set({ sink: v })} options={[
                { value: 'append', label: 'Append' }, { value: 'upsert', label: 'Upsert on the key' }]}
              />
              <Box sx={{ display: 'grid', gap: '8px' }}>
                <FormControlLabel
                  control={<Checkbox checked={levers.failureAtPercent !== null} onChange={(e) => set({ failureAtPercent: e.target.checked ? config.defaultFailurePercent : null })} />}
                  label="Inject a failure part-way through the copy"
                />
                {levers.failureAtPercent !== null && (
                  <TextField select label="Fails after this much of the copy" value={levers.failureAtPercent} onChange={(e) => set({ failureAtPercent: Number(e.target.value) })}>
                    {FAILURE_POINTS.map((p) => <MenuItem key={p} value={p}>{p}%</MenuItem>)}
                  </TextField>
                )}
                <TextField select label="Retries after the failure" value={levers.retries} disabled={levers.failureAtPercent === null} onChange={(e) => set({ retries: Number(e.target.value) as AdfLevers['retries'] })}>
                  {[0, 1, 2, 3].map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                </TextField>
              </Box>
              <Box>
                <FormControlLabel control={<Checkbox checked={levers.lateFile} onChange={(e) => set({ lateFile: e.target.checked })} />} label="One file arrives late" />
                <FormControlLabel control={<Checkbox checked={levers.outOfOrder} onChange={(e) => set({ outOfOrder: e.target.checked })} />} label="Two files arrive out of order" />
              </Box>
              <Choice id="a-deletes" label="Rows deleted at the source" value={levers.deletes} onChange={(v) => set({ deletes: v })} options={[
                { value: 'watermark-only', label: 'Left to the watermark' }, { value: 'soft-delete-flag', label: 'Soft-delete flag applied' }]}
              />
              <TextField select label={config.orchestration.externalFeed.label} value={levers.owners.externalFeed} onChange={(e) => set({ owners: { ...levers.owners, externalFeed: e.target.value as 'adf' | 'lakeflow' } })}>
                {OWNER_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label} owns it</MenuItem>)}
              </TextField>
              <TextField select label={config.orchestration.jobDependency.label} value={levers.owners.jobDependency} onChange={(e) => set({ owners: { ...levers.owners, jobDependency: e.target.value as 'adf' | 'lakeflow' } })}>
                {OWNER_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label} owns it</MenuItem>)}
              </TextField>
            </Box>
            <Actions sx={{ mt: '14px' }}>
              <Button variant="contained" onClick={run}>Run pipeline</Button>
              <Button variant="text" size="small" onClick={() => setLevers(preset)}>Use this challenge’s scenario</Button>
            </Actions>
          </>
        )}
        observe={!m ? (
          <Detail sx={{ mt: '8px' }}>Run the pipeline to see which rows land.</Detail>
        ) : (
          <Box sx={{ mt: '8px' }} aria-label="Pipeline run">
            <Actions>
              <Pill tone="neutral">Simulation</Pill>
              <Detail>Worked out by the model over the pack’s real source rows. The engine isn’t involved until Station C.</Detail>
            </Actions>
            {stale && <Note sx={{ mt: '10px' }}>The settings changed. Run the pipeline again to see the new outcome.</Note>}

            <Box sx={{ mt: '10px' }}>
              {m.steps.map((s, i) => (
                <CheckRow key={s.id} mark={String(i + 1)} aside={<Pill tone={s.owner === 'adf' ? 'neutral' : 'accent'}>{s.owner === 'adf' ? 'ADF' : 'Lakeflow'}</Pill>}>
                  <b>{s.label}</b> · {s.detail}
                </CheckRow>
              ))}
            </Box>

            <Typography variant="subtitle1" component="h4" sx={{ mt: '14px', fontWeight: 700 }}>Batch manifest</Typography>
            <Sub sx={{ my: '6px' }}>
              Batch {m.batch}: {n(m.expected.length - m.missed.length - m.pendingLate.length)} of {n(m.expected.length)} rows landed
              {m.missed.length ? ` · ${n(m.missed.length)} missed (ids ${ranges(m.missed)})` : ''}
              {m.duplicateWrites ? ` · ${n(m.duplicateWrites)} written twice` : ''}
              {m.pendingLate.length ? ` · ${n(m.pendingLate.length)} still to arrive` : ''}.
            </Sub>
            <MetricRow>
              <Metric value={n(m.expected.length)} label="Expected" detail={`ids ${ranges(m.expected)}`} />
              <Metric value={n(m.missed.length)} label="Missed" detail={m.missed.length ? `ids ${ranges(m.missed)}` : 'none'} />
              <Metric value={n(m.duplicateWrites)} label="Repeated writes" detail={m.duplicateWrites ? `${n(m.duplicated.length)} ids` : 'none'} />
              <Metric value={n(m.staleDeletes.length)} label="Deleted rows left behind" detail="a watermark can’t see a delete" />
            </MetricRow>
            <Box sx={{ mt: '10px', display: 'grid', gap: '8px' }}>
              {m.findings.map((f, i) => (f.tone === 'problem'
                ? <Note key={i}>{f.text}</Note>
                : f.tone === 'ok' ? <Good key={i}>{f.text}</Good> : <Detail key={i}>{f.text}</Detail>))}
            </Box>
            <Row
              sx={{ mt: '10px' }}
              title="Load this batch in Station C"
              detail={`Writes exactly these ${n(m.landing.length)} rows into bronze.defects on the real engine, then compares the table with the legacy copy.`}
              action={<Button variant="outlined" disabled={stale} onClick={onLoadInC}>Load in Station C</Button>}
            />
            {journalNote && <Box role="alert"><Detail sx={{ mt: '8px', color: 'error.main' }}>{journalNote}</Detail></Box>}
          </Box>
        )}
        explain={(
          <AcExplain
            enabled={committed}
            placeholder="Given a copy that fails part-way, when the watermark has already moved, then …"
            criteria={criteria}
            onCriteria={(text) => { setCriteria(text); setSaveState('idle'); }}
            checked={checked}
            onCheck={setChecked}
            saveState={saveState}
            onSave={saveCriteria}
          />
        )}
      />

      <CouplingLedger
        idPrefix="a"
        couplings={STATION_A_COUPLINGS}
        intro="Every outcome here comes from this model, over the pack’s real source rows. None is a measurement of a real pipeline."
      />
    </Box>
  );
};
