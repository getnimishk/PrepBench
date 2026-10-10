// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Checkbox, FormControlLabel, MenuItem, Switch, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { addLakehouseJournalEntry } from '../../services/api';
import { apiErrorMessage } from '../../services/apiError';
import {
  accessResult, layoutResult, parseAdls, tierResult, type AdlsConfig, type AdlsLevers, type TreeNode,
} from '../../services/lakehouse/adlsModel';
import { STATION_B_COUPLINGS } from '../../services/lakehouse/pipelineCouplings';
import { ACCESS_CHALLENGE, accessPreset, classifyAccess } from '../../services/lakehouse/pipelineChallenges';
import type { LabPackDetail } from '../../types/lakehouse';
import { ErrorState, LoadingState } from '../common/States';
import { Actions, Detail, Good, Metric, MetricRow, Note, Panel, Pill, Sub } from '../ui/primitives';
import { AcExplain, type SaveState } from './AcExplain';
import { CouplingLedger } from './CouplingLedger';
import { CodeBlock } from './LoopSteps';
import { StationShell } from './StationShell';
import { SaveAsInterviewQuestion } from './SaveAsInterviewQuestion';
import { useLabAttempt } from './useLabAttempt';

const n = (v: number) => v.toLocaleString('en-GB');
const LIFECYCLE_DAYS = [null, 7, 15, 30, 60];

/** The folder tree as text, with the target marked and each folder's ACL state where one applies. */
function drawTree(tree: TreeNode, target: string[], depth = 0, path: string[] = [], lines: string[] = []): string[] {
  const here = [...path, tree.name];
  const isTarget = here.length === target.length && here.every((p, i) => p === target[i]);
  lines.push(`${'  '.repeat(depth)}${depth ? '├ ' : ''}${tree.name}/${isTarget ? '   ← target' : ''}`);
  tree.children.forEach((c) => drawTree(c, target, depth + 1, here, lines));
  return lines;
}

/**
 * Station B: ADLS (PRD P0-5, mockup A10). Where batches land, and who can touch them.
 *
 * A simulation, and it says so on every result. There are no landing files in v1: the landing
 * zone exists only here. Every figure is a teaching constant from the pack, labelled as one.
 */
export const StationB: React.FC<{
  pack: LabPackDetail;
  subjectId?: number;
  onJournalChange: () => void;
}> = ({ pack, subjectId, onJournalChange }) => {
  const parsed = useMemo(() => parseAdls(pack.pipeline), [pack.pipeline]);
  const config: AdlsConfig | null = parsed.ok ? parsed.config : null;

  const lab = useLabAttempt(pack, subjectId, ACCESS_CHALLENGE);
  const [picked, setPicked] = useState('');
  const [levers, setLevers] = useState<AdlsLevers | null>(config ? accessPreset(config) : null);
  const [tested, setTested] = useState<string | null>(null);
  const [journalNote, setJournalNote] = useState<string | null>(null);

  const [criteria, setCriteria] = useState('');
  const [checked, setChecked] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  useEffect(() => { setCriteria(lab.attempt?.explanation_text ?? ''); }, [lab.attempt?.explanation_text]);

  if (!config || !levers) {
    return (
      <Panel component="section" aria-labelledby="station-b-title" sx={{ mt: '22px' }}>
        <Typography variant="h5" component="h2" id="station-b-title">Station B · ADLS</Typography>
        <Detail sx={{ mt: '8px' }}>
          This pack has no usable pipeline content{parsed.ok ? '' : `: ${parsed.reason}`} Nothing is shown in its place.
        </Detail>
      </Panel>
    );
  }
  if (lab.loadError) return <ErrorState what="Your lab attempts did not load." saved="nothing_to_save" detail={lab.loadError} onRetry={lab.retry} />;
  if (lab.attempt === undefined) return <LoadingState label="Loading Station B…" />;

  const committed = lab.committed;
  const preset = accessPreset(config);
  const presetAccess = accessResult(config, preset);
  const presetOutcome = classifyAccess(presetAccess);
  const chosen = lab.attempt?.prediction ?? picked;
  const { principal, path } = config.request;
  const target = `${path.join('/')}/`;

  const access = accessResult(config, levers);
  const layout = layoutResult(config, levers);
  const tier = tierResult(config, levers);
  // Only what decides access makes an access result stale: the tier and the layout don't.
  const accessKey = JSON.stringify([levers.hierarchicalNamespace, levers.grant, levers.acl]);
  const hasTested = tested === accessKey;
  const stale = tested !== null && tested !== accessKey;

  const log = async (op: string, result: Record<string, unknown>) => {
    try {
      await addLakehouseJournalEntry({ pack_id: pack.id, station: 'b', source: 'simulation', op, result, attempt_uid: lab.uid });
      setJournalNote(null);
      onJournalChange();
    } catch (err) {
      setJournalNote(apiErrorMessage(err, 'The journal entry could not be saved.'));
    }
  };

  const commit = async () => {
    if (!picked) return;
    const ok = await lab.commit(picked, { correct: picked === presetOutcome, observed: { outcome: presetOutcome } });
    if (ok) void log('adls_prediction', { outcome: presetOutcome });
  };

  const test = () => {
    setTested(accessKey);
    void log('adls_access_test', {
      outcome: access.outcome, grant: levers.grant, hierarchical_namespace: levers.hierarchicalNamespace,
      writable_folders: access.writable.length,
    });
  };

  const set = (patch: Partial<AdlsLevers>) => setLevers({ ...levers, ...patch });
  const setAcl = (patch: Partial<AdlsLevers['acl']>) => setLevers({ ...levers, acl: { ...levers.acl, ...patch } });
  const saveCriteria = async () => {
    setSaveState('saving');
    try { await lab.saveCriteria(criteria); setSaveState('saved'); } catch { setSaveState('failed'); }
  };
  const step = !committed ? 0 : !hasTested ? 1 : !criteria.trim() && saveState !== 'saved' ? 2 : 3;
  const verdict = committed && lab.attempt?.prediction ? lab.attempt.prediction === presetOutcome : null;
  const tone: Record<typeof access.outcome, 'success' | 'warning' | 'danger' | 'neutral'> = {
    allowed: 'success', 'too-broad': 'warning', denied: 'danger', unavailable: 'neutral',
  };
  const label: Record<typeof access.outcome, string> = {
    allowed: 'Allowed', 'too-broad': 'Allowed, too broad', denied: 'Denied', unavailable: 'No ACL available',
  };

  return (
    <Box component="section" aria-labelledby="station-b-title" sx={{ mt: '22px' }}>
      <Typography variant="h5" component="h2" id="station-b-title">Station B · ADLS</Typography>
      <Detail sx={{ mt: '4px' }}>Pipeline level · simulation · where batches land, and who can touch them</Detail>

      <StationShell
        idPrefix="b"
        step={step}
        prediction={{
          prompt: <>{ACCESS_CHALLENGE.prompt}</>,
          options: ACCESS_CHALLENGE.options,
          value: chosen,
          committed,
          saving: lab.committing,
          error: lab.commitError,
          onChange: setPicked,
          onCommit: commit,
          body: committed && verdict !== null ? (
            <Box sx={{ mt: '8px' }}>
              <Detail component="span">You predicted: </Detail>
              <b>{ACCESS_CHALLENGE.options.find((o) => o.id === lab.attempt?.prediction)?.text}</b>
              {verdict ? <Good sx={{ mt: '10px' }}>Your prediction was right.</Good> : <Note sx={{ mt: '10px' }}>Not what the model found.</Note>}
              <Sub>{ACCESS_CHALLENGE.reveal[presetOutcome]} {presetAccess.explanation}</Sub>
            </Box>
          ) : undefined,
        }}
        manipulate={(
          <>
            <Detail sx={{ mt: '8px' }}>
              {principal} needs <b>write</b> access to <code>{target}</code> only. Change a setting, then test the access.
            </Detail>
            <Box sx={{ display: 'grid', gap: '14px', mt: '12px' }}>
              <FormControlLabel
                control={<Switch checked={levers.hierarchicalNamespace} onChange={(e) => set({ hierarchicalNamespace: e.target.checked })} />}
                label="Hierarchical namespace"
              />
              <Box>
                <Typography variant="body2" component="p" id="b-layout" sx={{ mb: '6px', fontWeight: 700 }}>Landing layout</Typography>
                <ToggleButtonGroup exclusive size="small" aria-labelledby="b-layout" value={levers.layout} onChange={(_, v) => v && set({ layout: v })}>
                  <ToggleButton value="hdfs-copy">Copied from HDFS</ToggleButton>
                  <ToggleButton value="redesigned">Redesigned for object storage</ToggleButton>
                </ToggleButtonGroup>
              </Box>
              <Box>
                <Typography variant="body2" component="p" id="b-grant" sx={{ mb: '6px', fontWeight: 700 }}>Grant {principal} access with</Typography>
                <ToggleButtonGroup exclusive size="small" aria-labelledby="b-grant" value={levers.grant} onChange={(_, v) => v && set({ grant: v })}>
                  <ToggleButton value="directory-acl">Directory ACL</ToggleButton>
                  <ToggleButton value="rbac-container">RBAC at container scope</ToggleButton>
                </ToggleButtonGroup>
              </Box>
              {levers.grant === 'directory-acl' && (
                <Box component="fieldset" sx={{ border: 0, p: 0, m: 0 }}>
                  <Typography component="legend" variant="body2" sx={{ fontWeight: 700, mb: '4px' }}>Permissions on {target}</Typography>
                  <FormControlLabel control={<Checkbox checked={levers.acl.targetRead} onChange={(e) => setAcl({ targetRead: e.target.checked })} />} label="Read (r)" />
                  <FormControlLabel control={<Checkbox checked={levers.acl.targetWrite} onChange={(e) => setAcl({ targetWrite: e.target.checked })} />} label="Write (w)" />
                  <FormControlLabel control={<Checkbox checked={levers.acl.targetExecute} onChange={(e) => setAcl({ targetExecute: e.target.checked })} />} label="Execute (x)" />
                </Box>
              )}
              {levers.grant === 'directory-acl' && (
                <Box component="fieldset" sx={{ border: 0, p: 0, m: 0 }}>
                  <Typography component="legend" variant="body2" sx={{ fontWeight: 700, mb: '4px' }}>Execute (x) on the folders above it</Typography>
                  {path.slice(0, -1).map((folder, i) => (
                    <FormControlLabel
                      key={folder}
                      control={<Checkbox checked={levers.acl.parentsExecute[i]} onChange={(e) => setAcl({ parentsExecute: levers.acl.parentsExecute.map((v, j) => (j === i ? e.target.checked : v)) })} />}
                      label={`${path.slice(0, i + 1).join('/')}/`}
                    />
                  ))}
                </Box>
              )}
              <Box>
                <Typography variant="body2" component="p" id="b-tier" sx={{ mb: '6px', fontWeight: 700 }}>Bronze access tier</Typography>
                <ToggleButtonGroup exclusive size="small" aria-labelledby="b-tier" value={levers.tier} onChange={(_, v) => v && set({ tier: v })}>
                  <ToggleButton value="hot">Hot</ToggleButton>
                  <ToggleButton value="cool">Cool</ToggleButton>
                </ToggleButtonGroup>
              </Box>
              <TextField
                select label="Lifecycle rule: move to cool after" value={levers.lifecycleDays ?? 'off'} disabled={levers.tier === 'cool'}
                onChange={(e) => set({ lifecycleDays: e.target.value === 'off' ? null : Number(e.target.value) })}
              >
                {LIFECYCLE_DAYS.map((d) => <MenuItem key={d ?? 'off'} value={d ?? 'off'}>{d === null ? 'No rule' : `${d} days`}</MenuItem>)}
              </TextField>
            </Box>
            <Actions sx={{ mt: '14px' }}>
              <Button variant="contained" onClick={test}>Test access</Button>
              <Button variant="text" size="small" onClick={() => setLevers(preset)}>Use this challenge’s scenario</Button>
            </Actions>
          </>
        )}
        observe={(
          <Box sx={{ mt: '8px' }} aria-label="ADLS results">
            <Actions>
              <Pill tone="neutral">Simulation</Pill>
              <Detail>Worked out by the model from the pack’s teaching constants.</Detail>
            </Actions>

            <Typography variant="subtitle1" component="h4" sx={{ mt: '12px', fontWeight: 700 }}>Folders</Typography>
            <Actions sx={{ mt: '4px' }}>
              <Pill tone={levers.hierarchicalNamespace ? 'success' : 'warning'}>
                {levers.hierarchicalNamespace ? 'Hierarchical namespace on' : 'Flat namespace'}
              </Pill>
            </Actions>
            <CodeBlock label="Folder tree">{drawTree(config.tree, path).join('\n')}</CodeBlock>

            <Typography variant="subtitle1" component="h4" sx={{ mt: '14px', fontWeight: 700 }}>Access</Typography>
            {!hasTested ? (
              <Detail sx={{ mt: '6px' }}>{stale ? 'The settings changed. Test the access again.' : 'Test the access to see whether the request is met.'}</Detail>
            ) : (
              <Box sx={{ mt: '6px' }} aria-live="polite">
                <Pill tone={tone[access.outcome]}>{label[access.outcome]}</Pill>
                <Sub sx={{ my: '8px' }}>{access.explanation}</Sub>
                <Detail>{principal} can write to {access.writable.length} folder{access.writable.length === 1 ? '' : 's'}: {access.writable.length ? access.writable.map((p) => `${p.join('/')}/`).join(', ') : 'none'}.</Detail>
              </Box>
            )}

            <Typography variant="subtitle1" component="h4" sx={{ mt: '14px', fontWeight: 700 }}>Landing layout</Typography>
            <Detail sx={{ mt: '4px' }}>One day of data, for example <code>{layout.examplePath}</code></Detail>
            <MetricRow sx={{ mt: '8px' }}>
              <Metric value={n(layout.objectsPerDay)} label="Objects a day" detail="Teaching constant" />
              <Metric value={n(layout.listRequests)} label="Requests to list a day" detail="Teaching constant" />
              <Metric
                value={layout.rename.atomic ? '1' : n(layout.rename.operations)}
                label="Operations to rename a day"
                detail={layout.rename.atomic ? 'Atomic, with a hierarchical namespace' : 'A copy and a delete of every object'}
              />
            </MetricRow>

            <Typography variant="subtitle1" component="h4" sx={{ mt: '14px', fontWeight: 700 }}>Cost, relative to keeping everything hot</Typography>
            <MetricRow sx={{ mt: '8px' }}>
              <Metric value={`${tier.storageIndex.toFixed(2)}×`} label="Storage" detail="Teaching constant" />
              <Metric value={`${tier.accessIndex.toFixed(2)}×`} label="Reads" detail="Teaching constant" />
              <Metric value={`${tier.totalIndex.toFixed(2)}×`} label="Combined" detail={`${Math.round(tier.coolShare * 100)}% of the data is cool · teaching constant`} />
            </MetricRow>
            {tier.totalIndex > 1 && <Note sx={{ mt: '10px' }}>Cooler data is cheaper to store and dearer to read, and here the reads cost more than the storage saves.</Note>}
            {tier.totalIndex < 1 && <Good sx={{ mt: '10px' }}>Old data is cool and the busy, recent data stays hot, so the combined cost falls.</Good>}
            {journalNote && <Box role="alert"><Detail sx={{ mt: '8px', color: 'error.main' }}>{journalNote}</Detail></Box>}
          </Box>
        )}
        explain={(
          <>
            <AcExplain
              enabled={committed}
              intro={`Write the acceptance criteria for giving ${principal} access.`}
              placeholder="Given a vendor who needs one folder, when access is granted, then they can write only there …"
              criteria={criteria}
              onCriteria={(text) => { setCriteria(text); setSaveState('idle'); }}
              checked={checked}
              onCheck={setChecked}
              saveState={saveState}
              onSave={saveCriteria}
            />
            {Boolean(lab.attempt?.completed_at) && (
              <SaveAsInterviewQuestion
                subjectId={subjectId}
                packId={pack.id}
                packVersion={pack.version}
                station="Station B"
                challengeId="access"
                challengeTitle={ACCESS_CHALLENGE.title}
                attempt={lab.attempt}
              />
            )}
          </>
        )}
      />

      <CouplingLedger
        idPrefix="b"
        couplings={STATION_B_COUPLINGS}
        constants={[config.constantLabels.objects, config.constantLabels.volume, config.constantLabels.retention, config.constantLabels.storageRate, config.constantLabels.accessRate, config.constantLabels.readShare, config.constantLabels.costWeights]}
        intro="Every figure here is a teaching constant for a fictional scenario. None is a measurement or a price."
      />
    </Box>
  );
};
