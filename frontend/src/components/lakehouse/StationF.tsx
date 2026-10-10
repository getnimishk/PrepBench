// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Checkbox, FormControlLabel, IconButton, MenuItem, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { WireLearningAttempt } from '../../types/learning';
import type { LabPackDetail } from '../../types/lakehouse';
import { addLakehouseJournalEntry } from '../../services/api';
import { apiErrorMessage } from '../../services/apiError';
import {
  commitLabPrediction, completeLabSimulation, fetchLabAttempts, findLabAttempt, labAttemptUid, openLabAttempt,
  saveLabExplanation,
} from '../../services/lakehouse/attempts';
import {
  decodeGuesses, defaultPlan, encodeGuesses, fmt, monthOf, parseFactory, runFactory, scoreTiering, tierJob, TIERING_CHALLENGE,
  type Cluster, type PlanInput, type Tier,
} from '../../services/lakehouse/factoryModel';
import { ErrorState, LoadingState } from '../common/States';
import { Actions, Bar, CheckRow, Detail, Good, Metric, MetricRow, Note, Panel, Pill, Row } from '../ui/primitives';
import { AcExplain, type SaveState } from './AcExplain';
import { FactoryLedger } from './FactoryLedger';
import { FactoryTimeline } from './FactoryTimeline';
import { SaveAsInterviewQuestion } from './SaveAsInterviewQuestion';
import { StationShell } from './StationShell';

const VISUALLY_HIDDEN = {
  border: 0, clip: 'rect(0 0 0 0)', height: '1px', margin: '-1px', overflow: 'hidden',
  padding: 0, position: 'absolute', top: 0, left: 0, whiteSpace: 'nowrap', width: '1px',
} as const;

const TIER_NAMES: Record<Tier, string> = { 1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3' };
const BUFFERS = [0, 10, 20, 30];

/**
 * Station F: the Migration Factory (PRD P0-8, mockups A7 and A8).
 *
 * A simulation, and it says so on every result: the browser's model works the
 * outcome out from the pack's teaching constants (services/lakehouse/factoryModel).
 * Nothing here comes from the engine, and the journal entries it writes are marked
 * as simulations. Its tiering is a real, write-once prediction: committed to the
 * server before the true tiers are shown.
 */
export const StationF: React.FC<{
  pack: LabPackDetail;
  subjectId?: number;
  onJournalChange: () => void;
  /** Go to Station C with the yield wave's compare preset. */
  onCompare: (wave: number) => void;
}> = ({ pack, subjectId, onJournalChange, onCompare }) => {
  const parsed = useMemo(() => parseFactory(pack.factory), [pack.factory]);
  const config = parsed.ok ? parsed.config : null;

  const [attempt, setAttempt] = useState<WireLearningAttempt | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const [guesses, setGuesses] = useState<Record<string, Tier>>({});
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);

  const [plan, setPlan] = useState<PlanInput | null>(config ? defaultPlan(config) : null);
  const [ranKey, setRanKey] = useState<string | null>(null);
  const [journalNote, setJournalNote] = useState<string | null>(null);

  const [criteria, setCriteria] = useState('');
  const [checked, setChecked] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const key = { subjectId, packId: pack.id, packVersion: pack.version, challenge: TIERING_CHALLENGE };
  // The id the attempt really has: a later generation when a deleted preparation's attempt held the first.
  const uid = attempt?.attempt_uid ?? labAttemptUid(key);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    fetchLabAttempts(subjectId)
      .then((list) => { if (!cancelled) setAttempt(findLabAttempt(list, key) ?? null); })
      .catch((err) => { if (!cancelled) setLoadError(apiErrorMessage(err, 'Could not load your lab attempts.')); });
    return () => { cancelled = true; };
    // `key` is derived from subjectId and the pack, which are what the effect is keyed on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, pack.id, pack.version, reload]);

  useEffect(() => { setCriteria(attempt?.explanation_text ?? ''); }, [attempt?.explanation_text]);

  // A prediction that reached the server but whose scoring didn't (the connection dropped between
  // the two requests) is closed here on the next load: the model scores it, the same way every time.
  const pendingPrediction = attempt?.committed_at && !attempt.completed_at ? attempt.prediction : null;
  useEffect(() => {
    if (!config || !pendingPrediction) return;
    const result = scoreTiering(config, decodeGuesses(config, pendingPrediction));
    completeLabSimulation(subjectId, uid, result.right === result.total, { right: result.right, total: result.total })
      .then(setAttempt)
      .catch(() => undefined); // Still open; the next load tries again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrediction, config]);

  const planKey = plan ? `${plan.order.join(',')}|${plan.cluster}|${plan.bufferPercent}|${plan.consumerMap}` : '';
  const run = useMemo(() => (config && plan ? runFactory(config, plan) : null), [config, plan]);

  if (!config || !plan || !run) {
    return (
      <Panel component="section" aria-labelledby="station-f-title" sx={{ mt: '22px' }}>
        <Typography variant="h5" component="h2" id="station-f-title">Station F · Migration Factory</Typography>
        <Detail sx={{ mt: '8px' }}>
          This pack has no usable Factory content{parsed.ok ? '' : `: ${parsed.reason}`} Nothing is shown in its place.
        </Detail>
      </Panel>
    );
  }
  if (loadError) {
    return <ErrorState what="Your lab attempts did not load." saved="nothing_to_save" detail={loadError} onRetry={() => setReload((n) => n + 1)} />;
  }
  if (attempt === undefined) return <LoadingState label="Loading your attempts…" />;

  const committed = Boolean(attempt?.committed_at);
  // What was committed is what's shown, whatever the page holds now.
  const shown = committed && attempt?.prediction ? decodeGuesses(config, attempt.prediction) : guesses;
  const allChosen = config.sample.every((j) => shown[j.id] !== undefined);
  const score = committed ? scoreTiering(config, shown) : null;
  const hasRun = ranKey === planKey;
  const loop = config.loop;

  const log = async (op: string, result: Record<string, unknown>, attemptUid = uid) => {
    try {
      await addLakehouseJournalEntry({ pack_id: pack.id, station: 'f', source: 'simulation', op, result, attempt_uid: committed || op === 'factory_tiering' ? attemptUid : undefined });
      setJournalNote(null);
      onJournalChange();
    } catch (err) {
      setJournalNote(apiErrorMessage(err, 'The journal entry could not be saved.'));
    }
  };

  const commit = async () => {
    if (!allChosen) return;
    setCommitting(true);
    setCommitError(null);
    try {
      const opened = await openLabAttempt(key);
      await commitLabPrediction(subjectId, opened.attempt_uid, encodeGuesses(config, guesses));
      const result = scoreTiering(config, guesses);
      const done = await completeLabSimulation(subjectId, opened.attempt_uid, result.right === result.total, { right: result.right, total: result.total });
      setAttempt(done);
      await log('factory_tiering', { right: result.right, total: result.total }, done.attempt_uid);
    } catch (err) {
      setCommitError(apiErrorMessage(err, 'Your tiering could not be saved.'));
      setReload((n) => n + 1);
    } finally {
      setCommitting(false);
    }
  };

  const move = (i: number, d: -1 | 1) => {
    const order = [...plan.order];
    [order[i], order[i + d]] = [order[i + d], order[i]];
    setPlan({ ...plan, order });
  };

  const runPlan = () => {
    setRanKey(planKey);
    void log('factory_run', {
      promised_by_count: monthOf(run.count.plannedEnd), promised_weighted: monthOf(run.weighted.plannedEnd),
      ended: monthOf(run.count.actualEnd), incidents: run.incidents.length, cluster: plan.cluster, buffer_percent: plan.bufferPercent,
      consumer_map: plan.consumerMap,
    });
  };

  const saveCriteria = async () => {
    setSaveState('saving');
    try {
      setAttempt(await saveLabExplanation(subjectId, uid, criteria));
      setSaveState('saved');
    } catch {
      setSaveState('failed');
    }
  };

  const domainName = (id: string) => config.domains.find((d) => d.id === id)?.name ?? id;
  const step = !committed ? 0 : !hasRun ? 1 : !criteria.trim() && saveState !== 'saved' ? 2 : 3;
  const verdict = (p: typeof run.count) => (p.lateness > 1
    ? `${fmt(p.lateness)} months late` : p.lateness > 0.05 ? 'about on plan' : 'on plan');

  return (
    <Box component="section" aria-labelledby="station-f-title" sx={{ mt: '22px' }}>
      <Typography variant="h5" component="h2" id="station-f-title">Station F · Migration Factory</Typography>
      <Detail sx={{ mt: '4px' }}>
        Program level · simulation · every month and cost is a teaching constant for a fictional scenario, not an estimate or a price
      </Detail>

      <StationShell
        idPrefix="f"
        step={step}
        prediction={{
          prompt: <>Tier 1 converts almost automatically; Tier 3 is where the engineering hours go. <b>Tier these {config.sample.length} jobs</b> from what you can see of each.</>,
          options: [],
          wide: true,
          value: allChosen ? 'ready' : '',
          committed,
          saving: committing,
          error: commitError,
          onChange: () => undefined,
          onCommit: commit,
          body: (
            <>
              <TableContainer tabIndex={0} role="region" aria-label="Jobs to tier, scrollable">
                <Table size="small" aria-label="Jobs to tier">
                  <TableHead>
                    <TableRow>
                      <TableCell>Job</TableCell>
                      <TableCell>Signals</TableCell>
                      <TableCell>Your tier</TableCell>
                      <TableCell>{committed ? 'True tier' : <Box component="span" sx={VISUALLY_HIDDEN}>True tier</Box>}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {config.sample.map((j) => {
                      const truth = tierJob(config, j);
                      return (
                        <TableRow key={j.id}>
                          <TableCell sx={{ fontWeight: 700 }}>{j.id}</TableCell>
                          <TableCell>{j.signals.map((s) => config.signalLabels[s]).join(' · ')}</TableCell>
                          <TableCell>
                            <ToggleButtonGroup
                              exclusive size="small" value={shown[j.id] ?? null} disabled={committed || committing}
                              aria-label={`Tier for ${j.id}`}
                              onChange={(_, v: Tier | null) => v && setGuesses({ ...guesses, [j.id]: v })}
                            >
                              {([1, 2, 3] as Tier[]).map((n) => <ToggleButton key={n} value={n} sx={{ px: '11px' }}>{n}</ToggleButton>)}
                            </ToggleButtonGroup>
                          </TableCell>
                          <TableCell>
                            {committed && score ? (
                              <>
                                <Pill tone={score.perJob[j.id].correct ? 'success' : 'danger'}>{TIER_NAMES[truth.tier]}</Pill>
                                {truth.because.length > 0 && (
                                  <Detail component="span" sx={{ ml: '8px' }}>
                                    {truth.because.map((s) => config.signalLabels[s]).join(', ')}
                                  </Detail>
                                )}
                              </>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              {committed && score && (score.right === score.total
                ? <Good sx={{ mt: '12px' }}>All {score.total} right.</Good>
                : (
                  <Note sx={{ mt: '12px' }}>
                    {score.right} of {score.total} right. A job that feeds the yield report is Tier 3 however simple its code is,
                    and a job nobody listed is still a job.
                  </Note>
                ))}
            </>
          ),
        }}
        manipulate={(
          <>
            <Detail sx={{ mt: '8px' }}>Order the domains into the programme’s waves, then run the plan.</Detail>
            <Box component="ol" aria-label="Waves, in order" sx={{ listStyle: 'none', p: 0, m: '10px 0 0' }}>
              {plan.order.map((id, i) => {
                const waves = config.slots[i];
                return (
                  <Box
                    component="li" key={id}
                    sx={{ display: 'grid', gridTemplateColumns: '92px minmax(0,1fr) auto', gap: '10px', alignItems: 'center', py: '6px', borderBottom: '1px solid', borderColor: 'divider' }}
                  >
                    <Detail>{waves.length > 1 ? `Waves ${waves[0]}–${waves[waves.length - 1]}` : `Wave ${waves[0]}`}</Detail>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{domainName(id)}</Typography>
                    <Box>
                      <IconButton size="small" aria-label={`Move ${domainName(id)} earlier`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={16} aria-hidden /></IconButton>
                      <IconButton size="small" aria-label={`Move ${domainName(id)} later`} disabled={i === plan.order.length - 1} onClick={() => move(i, 1)}><ArrowDown size={16} aria-hidden /></IconButton>
                    </Box>
                  </Box>
                );
              })}
            </Box>
            <Typography variant="body2" component="p" id="f-cluster" sx={{ mt: '14px', mb: '6px', fontWeight: 700 }}>Cluster policy for scheduled jobs</Typography>
            <ToggleButtonGroup
              exclusive size="small" value={plan.cluster} aria-labelledby="f-cluster"
              onChange={(_, v: Cluster | null) => v && setPlan({ ...plan, cluster: v })}
            >
              <ToggleButton value="job">Job clusters</ToggleButton>
              <ToggleButton value="all-purpose">All-purpose</ToggleButton>
            </ToggleButtonGroup>
            <Detail sx={{ mt: '4px' }}>Teaching constants, not prices.</Detail>
            <TextField
              select label="Contingency buffer on each plan" value={plan.bufferPercent} sx={{ mt: '14px' }}
              onChange={(e) => setPlan({ ...plan, bufferPercent: Number(e.target.value) })}
            >
              {BUFFERS.map((b) => <MenuItem key={b} value={b}>{b}%</MenuItem>)}
            </TextField>
            <FormControlLabel
              sx={{ display: 'flex', mt: '8px' }}
              control={<Checkbox checked={plan.consumerMap} onChange={(e) => setPlan({ ...plan, consumerMap: e.target.checked })} />}
              label="A consumer map is built for the yield waves"
            />
            <Actions sx={{ mt: '10px' }}>
              <Button variant="contained" onClick={runPlan}>Run plan</Button>
            </Actions>
          </>
        )}
        observe={!hasRun ? (
          <Detail sx={{ mt: '8px' }}>
            {ranKey ? 'The plan changed. Run it again to see the new outcome.' : 'Run the plan to see how it holds up.'}
          </Detail>
        ) : (
          <Box sx={{ mt: '8px' }}>
            <Actions>
              <Pill tone="neutral">Simulation</Pill>
              <Detail>Worked out by the model from the pack’s teaching constants. The engine isn’t involved.</Detail>
            </Actions>
            <Box sx={{ display: 'grid', gap: '12px', mt: '12px' }}>
              <Box>
                <Detail>
                  Planned by job count · promised month {monthOf(run.count.plannedEnd)}, ended month {monthOf(run.count.actualEnd)} · {verdict(run.count)}
                </Detail>
                <Bar value={100} color={run.count.lateness > 1 ? 'error' : 'success'} label={`Plan by job count promised month ${monthOf(run.count.plannedEnd)} and ended in month ${monthOf(run.count.actualEnd)}`} sx={{ mt: '4px' }} />
              </Box>
              <Box>
                <Detail>
                  Weighted by complexity · promised month {monthOf(run.weighted.plannedEnd)}, ended month {monthOf(run.weighted.actualEnd)} · {verdict(run.weighted)}
                </Detail>
                <Bar value={100} color={run.weighted.lateness > 1 ? 'error' : 'success'} label={`Plan weighted by complexity promised month ${monthOf(run.weighted.plannedEnd)} and ended in month ${monthOf(run.weighted.actualEnd)}`} sx={{ mt: '4px' }} />
              </Box>
            </Box>
            <FactoryTimeline run={run} config={config} />

            <Box sx={{ mt: '8px' }}>
              {run.events.map((e) => (
                <CheckRow key={e.id} mark={<span aria-hidden>▲</span>} aside={<Pill tone="warning">Event</Pill>}>
                  {e.text}
                  <Detail>{e.effect}</Detail>
                </CheckRow>
              ))}
              {run.incidents.map((i) => (
                <CheckRow key={`${i.id}-${i.wave}`} mark={<span aria-hidden>▲</span>} aside={<Pill tone="danger">Incident</Pill>}>{i.text}</CheckRow>
              ))}
            </Box>

            <MetricRow sx={{ mt: '12px' }}>
              <Metric value={`${run.cost.dbuIndex.toFixed(1)}×`} label="Compute cost" detail="Teaching constant, relative to job clusters" />
              <Metric value={`${run.cost.totalIndex.toFixed(1)}×`} label="Total with infrastructure" detail="Teaching constant, relative to job clusters" />
            </MetricRow>
            <Box sx={{ mt: '12px' }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>Decommission</Typography>
              <Box sx={{ mt: '6px' }}>
                {run.decommission.allowed
                  ? <Pill tone="success">Allowed: every consumer is confirmed migrated</Pill>
                  : <Pill tone="warning">{`Blocked · ${run.decommission.unconfirmedConsumers.length} consumers unconfirmed`}</Pill>}
              </Box>
              {!run.decommission.allowed && (
                <Detail sx={{ mt: '4px' }}>Unconfirmed: {run.decommission.unconfirmedConsumers.join(', ')}.</Detail>
              )}
            </Box>

            {run.validate && (
              <Row
                sx={{ mt: '10px' }}
                title={`Wave ${run.validate.wave} · Validate`}
                detail={`${loop.length ? `${loop.join(' → ')}. ` : ''}Yield numbers carry audit weight: compare ${run.validate.compare.left} with ${run.validate.compare.right} on the real engine.`}
                action={<Button variant="outlined" onClick={() => onCompare(run.validate!.wave)}>Compare in Station C</Button>}
              />
            )}

            <TableContainer tabIndex={0} role="region" aria-label="Wave by wave, scrollable" sx={{ mt: '12px' }}>
              <Table size="small" aria-label="Wave by wave">
                <TableHead>
                  <TableRow>
                    <TableCell>Wave</TableCell><TableCell>Domain</TableCell><TableCell>Months</TableCell><TableCell>Note</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {run.waves.map((w) => (
                    <TableRow key={w.wave}>
                      <TableCell>{w.wave}</TableCell>
                      <TableCell>{domainName(w.domainId)}</TableCell>
                      <TableCell>{fmt(w.start)} to {fmt(w.end)}</TableCell>
                      <TableCell>{w.waited > 0 ? `Cutover waited ${fmt(w.waited)} for the freeze` : ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {journalNote && <Box role="alert"><Detail sx={{ mt: '8px', color: 'error.main' }}>{journalNote}</Detail></Box>}
          </Box>
        )}
        explain={(
          <>
            <AcExplain
              enabled={committed}
              placeholder="Given the yield waves, when a consumer isn’t on the map, then the cutover is blocked until …"
              criteria={criteria}
              onCriteria={(text) => { setCriteria(text); setSaveState('idle'); }}
              checked={checked}
              onCheck={setChecked}
              saveState={saveState}
              onSave={saveCriteria}
            />
            {Boolean(attempt?.completed_at) && (
              <SaveAsInterviewQuestion
                subjectId={subjectId}
                packId={pack.id}
                packVersion={pack.version}
                station="f"
                challengeId="tiering"
                challengeTitle="Migration Factory: tiering"
                attempt={attempt}
              />
            )}
          </>
        )}
      />

      <FactoryLedger config={config} />
    </Box>
  );
};
