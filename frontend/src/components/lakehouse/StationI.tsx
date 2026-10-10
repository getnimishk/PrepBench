// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import {
  Box, Button, Link, MenuItem, Table, TableBody, TableCell, TableHead, TableRow, TextField, ToggleButton,
  ToggleButtonGroup, Typography,
} from '@mui/material';
import { addLakehouseJournalEntry } from '../../services/api';
import { apiErrorMessage } from '../../services/apiError';
import {
  GOVERNANCE_CHALLENGE, IDENTITY_CHALLENGE, ISSUER_LABEL, PLAN_IDS, PLAN_LABEL, RANGER_MASK_ITEMS, RANGER_ROW_ITEMS,
  REDESIGNS, TEST_USERS, WORKLOADS, claimsFor, evaluateEstate, keepsPurpose, legacyView, redesignView,
  type PlanId, type RedesignId, type UserView,
} from '../../services/lakehouse/identityModel';
import { claimLabel, sourceById, type ClaimId } from '../../services/lakehouse/identitySources';
import type { LabPackDetail } from '../../types/lakehouse';
import { ErrorState, LoadingState } from '../common/States';
import { Actions, Detail, Good, Note, Panel, Pill, Sub } from '../ui/primitives';
import { AcExplain, type SaveState } from './AcExplain';
import { CodeBlock } from './LoopSteps';
import { SaveAsInterviewQuestion } from './SaveAsInterviewQuestion';
import { StationShell } from './StationShell';
import { useLabAttempt } from './useLabAttempt';

type Puzzle = 'identity' | 'governance';

const DISCLAIMER = 'A teaching simulation over a fictional estate. Nothing here calls Microsoft Entra ID, a Kerberos realm, '
  + 'Apache Ranger or Azure Databricks. Documented facts are from the linked pages, as checked on 10 October 2026; '
  + 'everything else is labelled as a simulation assumption.';

/** The claim ids behind a result, each a link to its entry in the list below. */
const Rests: React.FC<{ ids: ClaimId[] }> = ({ ids }) => (
  <Detail component="span">
    Rests on{' '}
    {ids.map((id, i) => (
      <React.Fragment key={id}>
        {i > 0 && ', '}
        <Link href={`#i-claim-${id}`}>{id}</Link>
      </React.Fragment>
    ))}
  </Detail>
);

/** Every fact and assumption a puzzle uses: who says it, and where. Nothing technical appears elsewhere. */
const Grounds: React.FC<{ puzzle: Puzzle }> = ({ puzzle }) => (
  <Panel soft component="section" aria-labelledby="i-grounds" sx={{ mt: '18px' }}>
    <Typography variant="h6" component="h3" id="i-grounds">What this puzzle rests on</Typography>
    <Box component="ul" sx={{ m: 0, mt: '8px', pl: '20px', display: 'grid', gap: '8px' }}>
      {claimsFor(puzzle).map((c) => (
        <Box component="li" key={c.id} id={`i-claim-${c.id}`}>
          <Detail component="span" sx={{ fontWeight: 700 }}>{c.id} · {claimLabel(c)}:</Detail>{' '}
          <Detail component="span">{c.text}</Detail>
          {c.sourceIds.map((s) => {
            const src = sourceById(s);
            return (
              <React.Fragment key={s}>
                {' '}
                <Link href={src.url} target="_blank" rel="noopener noreferrer">{src.title}</Link>
              </React.Fragment>
            );
          })}
        </Box>
      ))}
    </Box>
  </Panel>
);

const ssnLabel: Record<UserView['ssn'], string> = { full: 'In full', 'last-four': 'Last four', none: '—' };
const viewText = (v: UserView) => `${v.rows} row${v.rows === 1 ? '' : 's'} · SSN ${ssnLabel[v.ssn]}`;

/**
 * Station I: identity and governance (P1-5). Two puzzles over a fictional estate, both pure simulation:
 * which workload's cutover plan can't authenticate, and which Unity Catalog redesign keeps a Ranger
 * policy's purpose. Every technical statement is a claim from the approved register
 * (services/lakehouse/identitySources.ts), shown with who says it and a link to where.
 */
export const StationI: React.FC<{
  pack: LabPackDetail;
  subjectId?: number;
  onJournalChange: () => void;
}> = ({ pack, subjectId, onJournalChange }) => {
  const [puzzle, setPuzzle] = useState<Puzzle>('identity');

  return (
    <Box component="section" aria-labelledby="station-i-title" sx={{ mt: '22px' }}>
      <Typography variant="h5" component="h2" id="station-i-title">Station I · Identity and governance</Typography>
      <Detail sx={{ mt: '4px' }}>Programme level · simulation · who can sign in after cutover, and who sees which rows</Detail>
      <Note sx={{ mt: '10px' }}>{DISCLAIMER}</Note>

      <ToggleButtonGroup
        exclusive size="small" aria-label="Puzzle" value={puzzle} sx={{ mt: '14px', flexWrap: 'wrap' }}
        onChange={(_, v: Puzzle | null) => v && setPuzzle(v)}
      >
        <ToggleButton value="identity">{IDENTITY_CHALLENGE.title}</ToggleButton>
        <ToggleButton value="governance">{GOVERNANCE_CHALLENGE.title}</ToggleButton>
      </ToggleButtonGroup>

      {puzzle === 'identity'
        ? <IdentityPuzzle key="identity" pack={pack} subjectId={subjectId} onJournalChange={onJournalChange} />
        : <GovernancePuzzle key="governance" pack={pack} subjectId={subjectId} onJournalChange={onJournalChange} />}
      <Grounds puzzle={puzzle} />
    </Box>
  );
};

type PuzzleProps = { pack: LabPackDetail; subjectId?: number; onJournalChange: () => void };

function useJournal(pack: LabPackDetail, uid: string, onJournalChange: () => void) {
  const [note, setNote] = useState<string | null>(null);
  const log = async (op: string, result: Record<string, unknown>) => {
    try {
      await addLakehouseJournalEntry({ pack_id: pack.id, station: 'i', source: 'simulation', op, result, attempt_uid: uid });
      setNote(null);
      onJournalChange();
    } catch (err) {
      setNote(apiErrorMessage(err, 'The journal entry could not be saved.'));
    }
  };
  return { note, log };
}

const LOCKED = 'Commit your prediction to see what the model finds.';

const IdentityPuzzle: React.FC<PuzzleProps> = ({ pack, subjectId, onJournalChange }) => {
  const lab = useLabAttempt(pack, subjectId, IDENTITY_CHALLENGE);
  const journal = useJournal(pack, lab.uid, onJournalChange);
  const [picked, setPicked] = useState('');
  const [toolFeedPlan, setToolFeedPlan] = useState<PlanId>('system-mi');
  const [tried, setTried] = useState(false);
  const [criteria, setCriteria] = useState('');
  const [checked, setChecked] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  useEffect(() => { setCriteria(lab.attempt?.explanation_text ?? ''); }, [lab.attempt?.explanation_text]);

  if (lab.loadError) return <ErrorState what="Your lab attempts did not load." saved="nothing_to_save" detail={lab.loadError} onRetry={lab.retry} />;
  if (lab.attempt === undefined) return <LoadingState label="Loading Station I…" />;

  const committed = lab.committed;
  const cutover = evaluateEstate();
  const answer = IDENTITY_CHALLENGE.answer;
  const failing = WORKLOADS.find((w) => w.id === answer)!;
  const estate = evaluateEstate({ [answer]: toolFeedPlan });
  const verdict = committed && lab.attempt?.prediction ? lab.attempt.prediction === answer : null;

  const commit = async () => {
    if (!picked) return;
    const working = cutover.filter((r) => r.result.works).length;
    const ok = await lab.commit(picked, {
      correct: picked === answer,
      observed: { failing_workload: failing.name, plans_that_work: working },
    });
    if (ok) void journal.log('identity_prediction', { failing_workload: failing.name, plans_that_work: working });
  };
  const saveCriteria = async () => {
    setSaveState('saving');
    try { await lab.saveCriteria(criteria); setSaveState('saved'); } catch { setSaveState('failed'); }
  };
  const step = !committed ? 0 : !tried ? 1 : !criteria.trim() && saveState !== 'saved' ? 2 : 3;

  return (
    <StationShell
      idPrefix="i"
      step={step}
      prediction={{
        prompt: <>{IDENTITY_CHALLENGE.prompt}</>,
        options: IDENTITY_CHALLENGE.options,
        value: lab.attempt?.prediction ?? picked,
        committed,
        saving: lab.committing,
        error: lab.commitError,
        onChange: setPicked,
        onCommit: commit,
        body: committed && verdict !== null ? (
          <Box sx={{ mt: '8px' }}>
            {verdict ? <Good>Your prediction was right.</Good> : <Note>Not what the model found.</Note>}
            <Sub sx={{ mt: '8px' }}>
              {failing.name} runs on an on-premises server, and its plan gives it a system-assigned managed identity.
            </Sub>
            <Rests ids={cutover.find((r) => r.workload.id === answer)!.result.claimIds} />
          </Box>
        ) : undefined,
      }}
      manipulate={committed ? (
        <>
          <Detail sx={{ mt: '8px' }}>Try another plan for {failing.name}. The other workloads keep theirs.</Detail>
          <TextField
            select label={`Plan for ${failing.name}`} value={toolFeedPlan} sx={{ mt: '12px', width: '100%' }}
            onChange={(e) => { setToolFeedPlan(e.target.value as PlanId); setTried(true); }}
          >
            {PLAN_IDS.map((p) => <MenuItem key={p} value={p}>{PLAN_LABEL[p]}</MenuItem>)}
          </TextField>
          <Actions sx={{ mt: '10px' }}>
            <Button variant="text" size="small" onClick={() => setToolFeedPlan(failing.plan)}>Back to the cutover plan</Button>
          </Actions>
        </>
      ) : <Detail sx={{ mt: '8px' }}>{LOCKED}</Detail>}
      observe={committed ? (
        <Box sx={{ mt: '8px' }}>
          <Actions><Pill tone="neutral">Simulation</Pill><Detail>Decided by the facts listed below.</Detail></Actions>
          <Box sx={{ overflowX: 'auto', mt: '10px' }}>
            <Table size="small" aria-label="Workloads after cutover">
              <TableHead>
                <TableRow>
                  <TableCell>Workload</TableCell>
                  <TableCell>Runs on</TableCell>
                  <TableCell>Plan</TableCell>
                  <TableCell>Result</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {estate.map(({ workload, plan, result }) => (
                  <TableRow key={workload.id}>
                    <TableCell><code>{workload.name}</code><Detail>{workload.today}</Detail></TableCell>
                    <TableCell>{workload.host}</TableCell>
                    <TableCell>{PLAN_LABEL[plan]}</TableCell>
                    <TableCell>
                      <Pill tone={result.works ? 'success' : 'danger'}>{result.works ? 'Can authenticate' : 'Cannot authenticate'}</Pill>
                      <Detail sx={{ mt: '4px' }}>{ISSUER_LABEL[result.issuer]}</Detail>
                      <Rests ids={result.claimIds} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
          {estate.every((r) => r.result.works)
            ? <Good sx={{ mt: '10px' }}>Every plan can authenticate.</Good>
            : <Note sx={{ mt: '10px' }}>One plan cannot authenticate.</Note>}
          {journal.note && <Box role="alert"><Detail sx={{ mt: '8px', color: 'error.main' }}>{journal.note}</Detail></Box>}
        </Box>
      ) : <Detail sx={{ mt: '8px' }}>{LOCKED}</Detail>}
      explain={(
        <>
          <AcExplain
            enabled={committed}
            intro={`Write the acceptance criteria for signing off ${failing.name}’s new identity.`}
            placeholder={`Given ${failing.name} after cutover, when it calls the workspace, then …`}
            criteria={criteria}
            onCriteria={(text) => { setCriteria(text); setSaveState('idle'); }}
            checked={checked}
            onCheck={setChecked}
            saveState={saveState}
            onSave={saveCriteria}
          />
          {Boolean(lab.attempt?.completed_at) && (
            <SaveAsInterviewQuestion
              subjectId={subjectId} packId={pack.id} packVersion={pack.version} station="i"
              challengeId="identity-cutover" challengeTitle={IDENTITY_CHALLENGE.title} attempt={lab.attempt}
            />
          )}
        </>
      )}
    />
  );
};

const GovernancePuzzle: React.FC<PuzzleProps> = ({ pack, subjectId, onJournalChange }) => {
  const lab = useLabAttempt(pack, subjectId, GOVERNANCE_CHALLENGE);
  const journal = useJournal(pack, lab.uid, onJournalChange);
  const [picked, setPicked] = useState('');
  const [applied, setApplied] = useState<RedesignId | null>(null);
  const [rationale, setRationale] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  useEffect(() => { setRationale(lab.attempt?.explanation_text ?? ''); }, [lab.attempt?.explanation_text]);

  if (lab.loadError) return <ErrorState what="Your lab attempts did not load." saved="nothing_to_save" detail={lab.loadError} onRetry={lab.retry} />;
  if (lab.attempt === undefined) return <LoadingState label="Loading Station I…" />;

  const committed = lab.committed;
  const answer = GOVERNANCE_CHALLENGE.answer;
  const verdict = committed && lab.attempt?.prediction ? lab.attempt.prediction === answer : null;
  const shown = applied ?? (lab.attempt?.prediction as RedesignId | undefined) ?? answer;
  const redesign = REDESIGNS.find((r) => r.id === shown)!;

  const commit = async () => {
    if (!picked) return;
    const ok = await lab.commit(picked, {
      correct: picked === answer,
      observed: { redesign_that_keeps_purpose: REDESIGNS.find((r) => r.id === answer)!.title, candidates_checked: REDESIGNS.length },
    });
    if (ok) void journal.log('governance_prediction', { candidates_checked: REDESIGNS.length });
  };
  const saveRationale = async () => {
    setSaveState('saving');
    try { await lab.saveCriteria(rationale); setSaveState('saved'); } catch { setSaveState('failed'); }
  };
  const step = !committed ? 0 : applied === null ? 1 : !rationale.trim() && saveState !== 'saved' ? 2 : 3;
  const ranger = [
    '-- Row filter, evaluated in this order',
    ...RANGER_ROW_ITEMS.map((i, n) => `${n + 1}. ${i.group}: ${i.filter === '' ? '(empty)' : i.filter}`),
    '-- Mask on ssn',
    ...RANGER_MASK_ITEMS.map((i, n) => `${n + 1}. ${i.group}: ${i.mask}`),
  ].join('\n');

  return (
    <StationShell
      idPrefix="i"
      step={step}
      prediction={{
        prompt: (
          <>
            {GOVERNANCE_CHALLENGE.prompt}
            <CodeBlock label="The legacy Ranger policy on retail.customer_orders">{ranger}</CodeBlock>
          </>
        ),
        options: GOVERNANCE_CHALLENGE.options,
        value: lab.attempt?.prediction ?? picked,
        committed,
        saving: lab.committing,
        error: lab.commitError,
        onChange: setPicked,
        onCommit: commit,
        body: committed && verdict !== null ? (
          <Box sx={{ mt: '8px' }}>
            {verdict ? <Good>Your prediction was right.</Good> : <Note>Not what the model found.</Note>}
            <Rests ids={REDESIGNS.find((r) => r.id === answer)!.claimIds} />
          </Box>
        ) : undefined,
      }}
      manipulate={committed ? (
        <>
          <Detail sx={{ mt: '8px' }}>Apply a candidate and compare what each user sees.</Detail>
          <ToggleButtonGroup
            exclusive orientation="vertical" size="small" aria-label="Candidate redesign" value={shown}
            sx={{ mt: '10px', width: '100%' }} onChange={(_, v: RedesignId | null) => v && setApplied(v)}
          >
            {REDESIGNS.map((r) => <ToggleButton key={r.id} value={r.id} sx={{ justifyContent: 'flex-start', textAlign: 'left' }}>{r.title}</ToggleButton>)}
          </ToggleButtonGroup>
          <CodeBlock label="The candidate">{redesign.sql}</CodeBlock>
        </>
      ) : <Detail sx={{ mt: '8px' }}>{LOCKED}</Detail>}
      observe={committed ? (
        <Box sx={{ mt: '8px' }}>
          <Actions><Pill tone="neutral">Simulation</Pill><Detail>The model’s reading of the facts listed below (A6).</Detail></Actions>
          <Box sx={{ overflowX: 'auto', mt: '10px' }}>
            <Table size="small" aria-label="What each user sees">
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Groups</TableCell>
                  <TableCell>Legacy policy</TableCell>
                  <TableCell>This redesign</TableCell>
                  <TableCell>Same?</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {TEST_USERS.map((u) => {
                  const a = legacyView(u);
                  const b = redesignView(shown, u);
                  const same = a.rows === b.rows && a.ssn === b.ssn;
                  return (
                    <TableRow key={u.id}>
                      <TableCell component="th" scope="row">{u.id}</TableCell>
                      <TableCell>{u.groups.length ? u.groups.join(', ') : 'none'}</TableCell>
                      <TableCell>{viewText(a)}</TableCell>
                      <TableCell>{viewText(b)}</TableCell>
                      <TableCell><Pill tone={same ? 'success' : 'danger'}>{same ? 'Same' : 'Differs'}</Pill></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
          {keepsPurpose(shown)
            ? <Good sx={{ mt: '10px' }}>This redesign keeps the policy’s purpose for every user.</Good>
            : <Note sx={{ mt: '10px' }}>This redesign does not keep the policy’s purpose.</Note>}
          <Box sx={{ mt: '6px' }}><Rests ids={redesign.claimIds} /></Box>
          {journal.note && <Box role="alert"><Detail sx={{ mt: '8px', color: 'error.main' }}>{journal.note}</Detail></Box>}
        </Box>
      ) : <Detail sx={{ mt: '8px' }}>{LOCKED}</Detail>}
      explain={(
        <>
          <TextField
            label="Why your redesign keeps the policy’s purpose" multiline minRows={4} fullWidth sx={{ mt: '8px' }}
            value={rationale} disabled={!committed}
            onChange={(e) => { setRationale(e.target.value); setSaveState('idle'); }}
            helperText="Your own words. Kept with your attempt, never scored."
          />
          <Actions sx={{ mt: '10px' }}>
            <Button variant="outlined" disabled={!committed || !rationale.trim() || saveState === 'saving'} onClick={saveRationale}>
              Save rationale
            </Button>
            {saveState === 'saved' && <Box role="status"><Detail>Saved.</Detail></Box>}
            {saveState === 'failed' && <Box role="alert"><Detail sx={{ color: 'error.main' }}>Not saved. Try again.</Detail></Box>}
          </Actions>
          {Boolean(lab.attempt?.completed_at) && (
            <SaveAsInterviewQuestion
              subjectId={subjectId} packId={pack.id} packVersion={pack.version} station="i"
              challengeId="governance-redesign" challengeTitle={GOVERNANCE_CHALLENGE.title} attempt={lab.attempt}
            />
          )}
        </>
      )}
    />
  );
};
