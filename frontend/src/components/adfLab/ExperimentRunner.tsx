// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Button, FormControl, FormControlLabel, FormLabel, Radio, RadioGroup, TextField, ToggleButton,
  ToggleButtonGroup, Typography,
} from '@mui/material';
import { Actions, Detail, Good, Note, PageHead, Panel, PanelHead, Pill, Sub } from '../ui/primitives';
import { ErrorState, LoadingState } from '../common/States';
import { CouplingLedger } from '../lakehouse/CouplingLedger';
import { LoopSteps } from '../lakehouse/LoopSteps';
import { IntegrationNotice, SimulationNotice } from './AdfLabGate';
import { useLinkedTopics } from '../../hooks/useLinkedTopics';
import { apiErrorMessage } from '../../services/apiError';
import {
  answerStage, commitPrediction, fetchAdfLabAttempts, latestRun, openPredict, openStage, recordObservation, runAttempts,
  saveExplanation, type RunKey,
} from '../../services/adfLab/attempts';
import { COMPLETE, STAGES, stageOf } from '../../services/adfLab/stages';
import type { AdfLabExperiment } from '../../services/adfLab/experiments';
import {
  causesOf, changesFrom, observationOf, type ExperimentDefinition, type LeverValue, type Levers, type ModelRun,
} from '../../services/adfLab/definition';
import type { WireLearningAttempt } from '../../types/learning';
import type { Subject } from '../../types/subject';

/**
 * One ADF Behaviour Lab experiment (or one fault mode of one), through the eight stages of the
 * PrepBench loop. Shared by all five: the stages, the attempts and the screen live here; the
 * model and its questions come from the definition (services/adfLab/definition.ts).
 *
 * Learner state is the server's (learning_attempts, through LearningService). The only things
 * held in the page are this visit's interaction: having read Understand, the levers being
 * moved, the last run, and unsubmitted choices.
 */

const n = (x: number) => x.toLocaleString('en-GB');

/** A choice among the model's own lever values. The toggle's value is the option's position. */
function Lever({ id, label, value, options, onChange }: {
  id: string; label: string; value: LeverValue; options: { value: LeverValue; label: string }[]; onChange: (v: LeverValue) => void;
}) {
  const at = String(options.findIndex((o) => o.value === value));
  return (
    <Box>
      <Typography variant="body2" component="p" id={id} sx={{ mb: '6px', fontWeight: 700 }}>{label}</Typography>
      <ToggleButtonGroup
        exclusive size="small" value={at} aria-labelledby={id}
        onChange={(_, v: string | null) => { if (v !== null) onChange(options[Number(v)].value); }}
        sx={{ flexWrap: 'wrap' }}
      >
        {options.map((o, i) => <ToggleButton key={i} value={String(i)}>{o.label}</ToggleButton>)}
      </ToggleButtonGroup>
    </Box>
  );
}

/** A single-choice question, with its legend as the accessible group name. */
function Choice({ id, legend, options, value, onChange, disabled }: {
  id: string; legend: string; options: { id: string; text: string }[]; value: string; onChange: (v: string) => void; disabled: boolean;
}) {
  return (
    <FormControl component="fieldset" sx={{ mt: '4px' }}>
      <FormLabel component="legend" id={id} sx={{ color: 'text.primary', fontWeight: 600, mb: '6px' }}>{legend}</FormLabel>
      <RadioGroup aria-labelledby={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <FormControlLabel key={o.id} value={o.id} control={<Radio />} label={o.text} disabled={disabled} />
        ))}
      </RadioGroup>
    </FormControl>
  );
}

/** One stage of the loop, as its own titled section. Defined out here so it keeps its identity across renders. */
const StagePanel: React.FC<{ prefix: string; index: number; children: React.ReactNode; aside?: React.ReactNode }> = ({ prefix, index, children, aside }) => (
  <Panel component="section" aria-labelledby={`${prefix}-stage-${index}`} sx={{ mt: '15px' }}>
    <PanelHead eyebrow={`Stage ${index + 1} of ${STAGES.length}`} title={STAGES[index]} titleId={`${prefix}-stage-${index}`} aside={aside} />
    {children}
  </Panel>
);

const Verdict: React.FC<{ attempt?: WireLearningAttempt; right: string; wrong: string }> = ({ attempt, right, wrong }) =>
  attempt?.correct ? <Good sx={{ mt: '10px' }}>{right}</Good> : <Note sx={{ mt: '10px' }}>{wrong}</Note>;

export const ExperimentRunner = <C,>({ prep, def, experiment, modeSwitch, titleSuffix }: {
  prep: Subject;
  def: ExperimentDefinition<C>;
  experiment: AdfLabExperiment;
  /** For an experiment with fault modes: the control that moves between them. */
  modeSwitch?: React.ReactNode;
  /** For a fault mode: its name, under the experiment's. */
  titleSuffix?: string;
}) => {
  const outcomeText = useMemo(
    () => Object.fromEntries(def.predict.options.map((o) => [o.id, o.text])) as Record<string, string>,
    [def],
  );

  // The topics of this preparation's own ADF roadmap that the experiment's topic numbers map to.
  const linkedTopics = useLinkedTopics(prep.id, 'adf', { topicNumbers: experiment.topics.map((t) => t.number) });

  // ---- what the model needs -------------------------------------------------------------------
  const [context, setContext] = useState<{ value: C } | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [reloadContext, setReloadContext] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setContext(null);
    setContextError(null);
    def.loadContext()
      .then((value) => { if (!cancelled) setContext({ value }); })
      .catch((err) => { if (!cancelled) setContextError(apiErrorMessage(err, 'The model’s data did not load.')); });
    return () => { cancelled = true; };
  }, [def, reloadContext]);

  // ---- this preparation's attempts, from the server --------------------------------------------
  const [attempts, setAttempts] = useState<WireLearningAttempt[] | null>(null);
  const [attemptsError, setAttemptsError] = useState<string | null>(null);
  const [runNo, setRunNo] = useState<number | null>(null);
  const loadAttempts = useCallback(async () => {
    setAttemptsError(null);
    try {
      const rows = await fetchAdfLabAttempts(prep.id);
      setAttempts(rows);
      setRunNo((current) => current ?? latestRun(rows, prep.id, def.track));
    } catch (err) {
      setAttemptsError(apiErrorMessage(err, 'Your attempts did not load.'));
    }
  }, [prep.id, def.track]);
  useEffect(() => { setRunNo(null); setAttempts(null); void loadAttempts(); }, [loadAttempts]);

  // ---- this visit's interaction, not learner state ---------------------------------------------
  const [understood, setUnderstood] = useState(false);
  const [picked, setPicked] = useState('');
  const [levers, setLevers] = useState<Levers>(def.preset);
  const [mine, setMine] = useState<{ levers: Levers; run: ModelRun } | null>(null);
  const [reason, setReason] = useState('');
  const [apply, setApply] = useState('');
  const [explanation, setExplanation] = useState<string | null>(null);
  const [retrieve, setRetrieve] = useState('');
  const [saving, setSaving] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);

  const preset = useMemo(() => (context ? def.run(context.value, def.preset) : null), [context, def]);
  const applyRuns = useMemo(
    () => (context ? def.apply.options.map((o) => def.run(context.value, o.levers)) : null),
    [context, def],
  );

  if (contextError) return <ErrorState what="The model's data did not load." saved="nothing_to_save" detail={contextError} onRetry={() => setReloadContext((x) => x + 1)} />;
  if (attemptsError) return <ErrorState what="Your attempts did not load." saved="nothing_to_save" detail={attemptsError} onRetry={() => void loadAttempts()} />;
  if (!context || !preset || !applyRuns || attempts === null || runNo === null) return <LoadingState label="Loading the experiment…" />;

  const c = context.value;
  const key: RunKey = { subjectId: prep.id, track: def.track, run: runNo };
  const rows = runAttempts(attempts, key);
  const stage = stageOf(rows, { understood, ran: mine !== null });
  const predictRow = rows.predict;
  const changes = mine ? changesFrom(def.preset, mine.levers) : {};
  const changed = Object.keys(changes).length > 0;
  const applyCorrect = (i: number) => def.apply.correct(applyRuns[i], applyRuns);

  /** One write at a time; whatever happens, re-read what the server now holds. */
  const write = async (action: () => Promise<unknown>) => {
    setSaving(true);
    setWriteError(null);
    try {
      await action();
    } catch (err) {
      setWriteError(apiErrorMessage(err, 'That was not saved.'));
    } finally {
      await loadAttempts();
      setSaving(false);
    }
  };

  const commit = () => write(async () => {
    // A run a deleted preparation's attempts still hold is skipped, so this run may be a later one.
    const opened = await openPredict(key, def.model);
    if (opened.run !== key.run) setRunNo(opened.run);
    await commitPrediction(prep.id, opened.attempt.attempt_uid, picked);
  });
  const runModel = () => setMine({ levers, run: def.run(c, levers) });
  const record = () => mine && predictRow && write(() => recordObservation(
    prep.id, predictRow.attempt_uid, changes, observationOf(preset, mine.run), predictRow.prediction === preset.outcome,
  ));
  const answerReason = () => write(async () => {
    const opened = await openStage(key, 'reason', def.model);
    await answerStage(prep.id, opened.attempt_uid, { prediction: reason, correct: causesOf(preset).includes(reason), mechanisms: [reason] });
  });
  const answerApply = () => write(async () => {
    const i = def.apply.options.findIndex((o) => o.id === apply);
    const option = def.apply.options[i];
    const right = applyCorrect(i);
    const opened = await openStage(key, 'apply', def.model);
    await answerStage(prep.id, opened.attempt_uid, {
      prediction: apply, correct: right, transfer: right,
      manipulation: changesFrom(def.preset, option.levers),
      observed: observationOf(preset, applyRuns[i]),
    });
  });
  // What the box shows is what is saved: the learner's edit, or else the explanation already on record.
  // Saving the untouched box after a reload must keep that explanation, never send an empty one.
  const shownExplanation = explanation ?? predictRow?.explanation_text ?? '';
  const explain = () => predictRow && write(() => saveExplanation(prep.id, predictRow.attempt_uid, shownExplanation.trim()));
  const answerRetrieve = () => write(async () => {
    const opened = await openStage(key, 'retrieve', def.model);
    await answerStage(prep.id, opened.attempt_uid, { prediction: retrieve, correct: retrieve === def.retrieve.answer });
  });
  const startAgain = () => {
    setRunNo(runNo + 1);
    setUnderstood(false); setPicked(''); setLevers(def.preset); setMine(null); setReason(''); setApply('');
    setExplanation(null); setRetrieve(''); setWriteError(null);
  };

  const applyRow = rows.apply;
  const applyChosen = applyRow ? def.apply.options.findIndex((o) => o.id === applyRow.prediction) : -1;
  const applyRight = def.apply.options.find((_, i) => applyCorrect(i));
  const recorded = (predictRow?.manipulation ?? {}) as Record<string, { from: unknown; to: unknown }>;
  const p = def.idPrefix;

  return (
    <Box>
      <PageHead
        eyebrow={`${prep.name} · ADF Behaviour Lab`}
        title={titleSuffix ? `${experiment.title}: ${titleSuffix}` : experiment.title}
        sub={experiment.purpose}
        actions={<Button component={RouterLink} to="/lab/adf" variant="outlined">All experiments</Button>}
      />
      <IntegrationNotice prep={prep} />
      <SimulationNotice packNote={def.contextNote?.(c)} />
      {modeSwitch}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', mt: '16px' }}>
        <Pill tone="neutral">Run {runNo}</Pill>
        {stage === COMPLETE && <Pill tone="success">Complete</Pill>}
      </Box>
      <LoopSteps active={stage} steps={STAGES} />
      {writeError && <Note role="alert" sx={{ mt: '8px' }}>{writeError} Nothing else changed; what you see is what is saved.</Note>}

      {/* 1. Understand ---------------------------------------------------------------------------- */}
      <StagePanel prefix={p} index={0}>
        <Sub sx={{ mt: 0 }}>{def.understand}</Sub>
        <Detail>
          Read more in the ADF guide:{' '}
          {experiment.chapters.map((ch, i) => (
            <React.Fragment key={ch.id}>
              {i > 0 && ' · '}
              <RouterLink to={`/learn/guides/adf/${ch.id}`}>{ch.title}</RouterLink>
            </React.Fragment>
          ))}
          .{' '}
          {linkedTopics.length > 0 ? (
            <>
              Your roadmap topics:{' '}
              {linkedTopics.map((t, i) => (
                <React.Fragment key={t.topicId}>
                  {i > 0 && ' · '}
                  <RouterLink to={`/roadmaps/${t.roadmapId}/topics/${t.topicId}`}>{t.title}</RouterLink>
                </React.Fragment>
              ))}
              .
            </>
          ) : (
            <>Roadmap topics: {experiment.topics.map((t) => `${t.number} ${t.title}`).join('; ')}.</>
          )}
        </Detail>
        {stage === 0 && (
          <Actions sx={{ mt: '12px' }}>
            <Button variant="contained" onClick={() => setUnderstood(true)}>Continue to Predict</Button>
          </Actions>
        )}
      </StagePanel>

      {/* 2. Predict --------------------------------------------------------------------------------- */}
      {stage >= 1 && (
        <StagePanel prefix={p} index={1} aside={predictRow?.committed_at ? <Pill tone="accent">Committed</Pill> : undefined}>
          <Sub sx={{ mt: 0 }}>{def.predict.prompt}</Sub>
          <Choice
            id={`${p}-predict`} legend="Your prediction" options={def.predict.options}
            value={predictRow?.prediction ?? picked} onChange={setPicked} disabled={Boolean(predictRow?.committed_at) || saving}
          />
          {predictRow?.committed_at ? (
            <Detail sx={{ mt: '8px' }}>Committed. A prediction cannot be changed once it is on the record.</Detail>
          ) : (
            <Actions sx={{ mt: '10px' }}>
              <Button variant="contained" onClick={commit} disabled={!picked || saving}>Commit prediction</Button>
            </Actions>
          )}
        </StagePanel>
      )}

      {/* 3. Manipulate ------------------------------------------------------------------------------ */}
      {stage >= 2 && (
        <StagePanel prefix={p} index={2}>
          {predictRow?.completed_at ? (
            <Detail>
              Recorded: {Object.keys(recorded).length
                ? Object.entries(recorded).map(([k, v]) => `${k} ${String(v.from)} → ${String(v.to)}`).join(', ')
                : 'no change'}.
            </Detail>
          ) : (
            <>
              <Detail>{def.heldNote}</Detail>
              <Box sx={{ display: 'grid', gap: '14px', mt: '12px' }}>
                {def.levers.map((l) => (
                  <Lever
                    key={l.key} id={`${p}-lever-${l.key}`} label={l.label} value={levers[l.key]} options={l.options}
                    onChange={(v) => setLevers({ ...levers, [l.key]: v })}
                  />
                ))}
              </Box>
              <Actions sx={{ mt: '14px' }}>
                <Button variant="contained" onClick={runModel}>Run the model</Button>
              </Actions>
            </>
          )}
        </StagePanel>
      )}

      {/* 4. Observe --------------------------------------------------------------------------------- */}
      {stage >= 3 && (
        <StagePanel prefix={p} index={3}>
          {predictRow?.completed_at ? (
            <>
              <Verdict attempt={predictRow} right="Your prediction matched the model." wrong="Not what the model found." />
              <Sub>In the scenario the model finds: {(outcomeText[preset.outcome] ?? preset.outcome).toLowerCase()}.</Sub>
              <ObservedTable
                observed={predictRow.observed as Record<string, { label: string; before: unknown; after: unknown; unit?: string }> | null}
                outcomeText={outcomeText}
              />
            </>
          ) : mine && (
            <>
              <ObservedTable
                observed={observationOf(preset, mine.run) as Record<string, { label: string; before: unknown; after: unknown; unit?: string }>}
                outcomeText={outcomeText}
              />
              <Box component="ul" aria-label="What the model found in your run" sx={{ pl: '20px', mt: '10px', mb: 0 }}>
                {mine.run.findings.map((f, i) => <li key={i}><Detail component="span">{f.text}</Detail></li>)}
              </Box>
              {!changed && <Detail sx={{ mt: '10px' }}>Change at least one lever from the scenario, then run the model again.</Detail>}
              <Actions sx={{ mt: '12px' }}>
                <Button variant="contained" onClick={record} disabled={!changed || saving}>Record this observation</Button>
              </Actions>
            </>
          )}
        </StagePanel>
      )}

      {/* 5. Reason ---------------------------------------------------------------------------------- */}
      {stage >= 4 && (
        <StagePanel prefix={p} index={4}>
          <Choice
            id={`${p}-reason`} legend={def.reason.prompt} options={def.reason.options}
            value={rows.reason?.prediction ?? reason} onChange={setReason} disabled={Boolean(rows.reason) || saving}
          />
          {rows.reason?.completed_at ? (
            <>
              <Verdict attempt={rows.reason} right="That is the mechanism the model found." wrong="Not the mechanism the model found." />
              <Detail sx={{ mt: '8px' }}>
                The model&rsquo;s finding: {preset.findings.filter((f) => f.tone === 'problem').map((f) => f.text).join(' ')}
              </Detail>
            </>
          ) : (
            <Actions sx={{ mt: '10px' }}>
              <Button variant="contained" onClick={answerReason} disabled={!reason || saving}>Submit your diagnosis</Button>
            </Actions>
          )}
        </StagePanel>
      )}

      {/* 6. Apply ----------------------------------------------------------------------------------- */}
      {stage >= 5 && (
        <StagePanel prefix={p} index={5}>
          <Choice
            id={`${p}-apply`} legend={def.apply.prompt} options={def.apply.options}
            value={applyRow?.prediction ?? apply} onChange={setApply} disabled={Boolean(applyRow) || saving}
          />
          {applyRow?.completed_at ? (
            <>
              <Verdict attempt={applyRow} right={def.apply.right} wrong={def.apply.wrong} />
              {applyChosen >= 0 && (
                <Detail sx={{ mt: '8px' }}>
                  Your choice: {(outcomeText[applyRuns[applyChosen].outcome] ?? applyRuns[applyChosen].outcome).toLowerCase()}.
                  {!applyRow.correct && applyRight && ` The change that does: ${applyRight.text.charAt(0).toLowerCase()}${applyRight.text.slice(1)}.`}
                </Detail>
              )}
            </>
          ) : (
            <Actions sx={{ mt: '10px' }}>
              <Button variant="contained" onClick={answerApply} disabled={!apply || saving}>Submit your change</Button>
            </Actions>
          )}
        </StagePanel>
      )}

      {/* 7. Explain --------------------------------------------------------------------------------- */}
      {stage >= 6 && (
        <StagePanel prefix={p} index={6}>
          <TextField
            label={def.explainLabel}
            multiline minRows={3} fullWidth
            value={shownExplanation}
            onChange={(e) => setExplanation(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 4000 } }}
          />
          <Detail sx={{ mt: '6px' }}>Your words, kept with this run. Not graded.</Detail>
          <Actions sx={{ mt: '10px' }}>
            <Button
              variant="contained" onClick={explain}
              disabled={saving || !shownExplanation.trim()}
            >
              Save your explanation
            </Button>
          </Actions>
        </StagePanel>
      )}

      {/* 8. Retrieve -------------------------------------------------------------------------------- */}
      {stage >= 7 && (
        <StagePanel prefix={p} index={7}>
          <Choice
            id={`${p}-retrieve`} legend={def.retrieve.prompt} options={def.retrieve.options}
            value={rows.retrieve?.prediction ?? retrieve} onChange={setRetrieve} disabled={Boolean(rows.retrieve) || saving}
          />
          {rows.retrieve?.completed_at ? (
            <>
              <Verdict attempt={rows.retrieve} right="Right." wrong="Not quite." />
              <Detail sx={{ mt: '8px' }}>
                The ADF guide: &ldquo;{def.retrieve.source.quote}&rdquo; Checked now, from memory; nothing is scheduled.
              </Detail>
            </>
          ) : (
            <Actions sx={{ mt: '10px' }}>
              <Button variant="contained" onClick={answerRetrieve} disabled={!retrieve || saving}>Check your answer</Button>
            </Actions>
          )}
        </StagePanel>
      )}

      {stage === COMPLETE && (
        <Panel component="section" aria-labelledby={`${p}-complete`} sx={{ mt: '15px' }}>
          <PanelHead title="Run complete" titleId={`${p}-complete`} />
          <Detail>
            Every stage of run {runNo} is recorded against {prep.name}. A finished run stays as it is; to try again,
            start a new run.
          </Detail>
          <Actions sx={{ mt: '12px' }}>
            <Button variant="outlined" onClick={startAgain}>Start a new run</Button>
          </Actions>
        </Panel>
      )}

      <CouplingLedger idPrefix={p} couplings={def.couplings} intro={def.ledgerIntro} />
    </Box>
  );
};

/** What the scenario held against what the learner's run held, from the observation record. */
const ObservedTable: React.FC<{
  observed: Record<string, { label: string; before: unknown; after: unknown; unit?: string }> | null;
  outcomeText: Record<string, string>;
}> = ({ observed, outcomeText }) => {
  if (!observed) return null;
  const entries = Object.entries(observed).filter(([k, v]) => k !== 'source' && v && typeof v === 'object');
  const show = (v: unknown, unit?: string) => (typeof v === 'number'
    ? `${n(v)}${unit ? ` ${unit}` : ''}`
    : typeof v === 'string' ? (outcomeText[v] ?? v) : '—');
  return (
    <Box component="table" sx={{ mt: '10px', borderCollapse: 'collapse', width: '100%', '& th, & td': { textAlign: 'left', p: '6px 8px', borderBottom: '1px solid', borderColor: 'divider' } }}>
      <caption style={{ textAlign: 'left', paddingBottom: 6 }}>
        <Typography component="span" variant="body2" sx={{ fontWeight: 700 }}>The scenario against your run</Typography>
      </caption>
      <thead>
        <tr><th scope="col">Measure</th><th scope="col">Scenario</th><th scope="col">Your run</th></tr>
      </thead>
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k}><th scope="row">{v.label}</th><td>{show(v.before, v.unit)}</td><td>{show(v.after, v.unit)}</td></tr>
        ))}
      </tbody>
    </Box>
  );
};
