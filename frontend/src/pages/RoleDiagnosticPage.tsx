// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Checkbox, FormControlLabel, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { addRoleDiagnostic, getRole, getRoleDiagnostics } from '../services/api';
import { apiErrorMessage } from '../services/apiError';
import { ROLES } from '../services/scenarios/scenarioAttempts';
import {
  CONFIDENCE, packVersionsOf, pickQuestions, questionByRef, requirementsFor,
  type ChosenQuestion, type Confidence,
} from '../services/roles/diagnostic';
import { loadCorePacks, loadLinkedPacks, loadPackVersions } from '../services/roles/rolePacks';
import type { ContentPackDetail, ScenarioRole } from '../types/contentPack';
import type { Role, RoleDiagnostic } from '../types/role';
import { ErrorState, LoadingState } from '../components/common/States';
import { Actions, CheckRow, Detail, Eyebrow, PageHead, Panel, PanelHead, Pill, Section, Sub } from '../components/ui/primitives';

interface Draft {
  answer: string;
  covered: number[];
  confidence: Confidence | null;
  compared: boolean;
}
const EMPTY: Draft = { answer: '', covered: [], confidence: null, compared: false };

/**
 * The role diagnostic: ten interview questions, those fitting the job's
 * requirements first, answered in the learner's own words and rated by the
 * learner. A retake asks the first attempt's questions in its lens -- the
 * server refuses anything else -- so the before/after view compares like with
 * like. Answers are page state until "Finish and save"; nothing is kept in the
 * browser.
 */
export const RoleDiagnosticPage: React.FC = () => {
  const roleId = Number(useParams().roleId);
  const navigate = useNavigate();

  const [role, setRole] = useState<Role | null>(null);
  const [first, setFirst] = useState<RoleDiagnostic | null>(null);
  const [linkedPacks, setLinkedPacks] = useState<ContentPackDetail[]>([]);
  const [corePacks, setCorePacks] = useState<ContentPackDetail[]>([]);
  const [retakePacks, setRetakePacks] = useState<ContentPackDetail[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [reload, setReload] = useState(0);

  const [lens, setLens] = useState<ScenarioRole>('po');
  const [step, setStep] = useState<number | 'intro'>('intro');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setLoadError(null);
    (async () => {
      try {
        const [r, attempts] = await Promise.all([getRole(roleId), getRoleDiagnostics(roleId)]);
        const earliest = attempts[0] ?? null;
        const [linked, core, retake] = await Promise.all([
          earliest ? Promise.resolve([]) : loadLinkedPacks(r),
          earliest ? Promise.resolve([]) : loadCorePacks(),
          earliest ? loadPackVersions(packVersionsOf(earliest.items.map((i) => i.question_ref))) : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setRole(r); setFirst(earliest); setLinkedPacks(linked); setCorePacks(core); setRetakePacks(retake);
        setLens(earliest?.lens ?? r.lens);
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        if ((err as { response?: { status?: number } }).response?.status === 404) setNotFound(true);
        else setLoadError(apiErrorMessage(err, ''));
      }
    })();
    return () => { cancelled = true; };
  }, [roleId, reload]);

  const questions: ChosenQuestion[] = useMemo(() => {
    if (!role || !ready) return [];
    if (first) {
      return first.items
        .map((i) => {
          const q = questionByRef(i.question_ref, retakePacks);
          return q ? { ...q, fits: i.fits_requirement } : null;
        })
        .filter((q): q is ChosenQuestion => q !== null);
    }
    return pickQuestions(lens, role.requirements, linkedPacks, corePacks);
  }, [role, ready, first, retakePacks, lens, linkedPacks, corePacks]);

  const back = <Button variant="outlined" component={RouterLink} to={`/preparations/roles/${roleId}`}>Back to the role</Button>;

  if (notFound || Number.isNaN(roleId)) {
    return (
      <Box>
        <PageHead eyebrow="A job you want · Diagnostic" title="Role not found" sub="It may have been deleted." />
        <Button variant="outlined" component={RouterLink} to="/preparations">All preparations</Button>
      </Box>
    );
  }
  if (loadError !== null) {
    return (
      <Box>
        <PageHead eyebrow="A job you want · Diagnostic" title="Diagnostic" />
        <ErrorState what="Could not load the diagnostic." saved="nothing_to_save" detail={loadError} onRetry={() => setReload((n) => n + 1)} />
      </Box>
    );
  }
  if (!role || !ready) return <Box><PageHead eyebrow="A job you want · Diagnostic" title="Diagnostic" /><LoadingState label="Choosing the questions…" /></Box>;

  const retake = first !== null;
  const lensLabel = ROLES.find((r) => r.id === lens)!.label;
  const fit = questions.filter((q) => q.fits).length;
  const hasLinks = role.requirements.some((r) => r.subject_id != null);
  const missing = retake ? first.items.length - questions.length : 0;

  if (step === 'intro') {
    const count = fit === 0
      ? `${questions.length} interview questions, all core topics for data platform roles: none fits this job's requirements closely enough.`
      : `${questions.length} interview questions: ${fit} fit this job's requirements, the rest are core topics for data platform roles.`;
    return (
      <Box>
        <PageHead
          eyebrow={`A job you want · Diagnostic${retake ? ' · retake' : ''}`}
          title={role.name}
          sub={`${count} About 30 minutes.`}
          actions={back}
        />

        <Panel component="section" aria-labelledby="diag-how">
          <PanelHead title="How it works" titleId="diag-how" />
          <CheckRow mark="1"><b>Answer in your own words</b>, as you would in the interview. Say it out loud too if you can.</CheckRow>
          <CheckRow mark="2"><b>Compare with the key points</b> and tick the ones your answer really covered.</CheckRow>
          <CheckRow mark="3"><b>Rate your confidence</b>: not yet, partly, or confident.</CheckRow>
          <Detail sx={{ mt: '8px' }}>
            {retake
              ? 'This is a retake: the same questions as your first attempt, so the role page can show before and after side by side.'
              : 'Take it now, before you study, and again before the interview. The role page then shows what moved.'}
            {' '}A self-assessment: nothing is graded, and readiness still comes only from full mocks.
          </Detail>
          {!retake && !hasLinks && (
            <Detail sx={{ mt: '6px' }}>
              None of this job&apos;s requirements is linked to a Skill yet, so every question is a core topic. Link a
              requirement to a Skill with a built-in guide, on the role page, to get questions chosen for it.
            </Detail>
          )}
        </Panel>

        <Section>
          <Panel component="section" aria-labelledby="diag-lens">
            <PanelHead title="Answer as" titleId="diag-lens" />
            <ToggleButtonGroup
              exclusive size="small" value={lens} aria-labelledby="diag-lens" disabled={retake}
              onChange={(_, v: ScenarioRole | null) => { if (v) setLens(v); }} sx={{ flexWrap: 'wrap' }}
            >
              {ROLES.map((r) => <ToggleButton key={r.id} value={r.id}>{r.label}</ToggleButton>)}
            </ToggleButtonGroup>
            <Detail sx={{ mt: '8px' }}>
              {retake
                ? `Kept as ${lensLabel}, the role you chose the first time.`
                : 'Guessed from the job title; change it if it\'s wrong. Scenario questions come in a version for each role.'}
            </Detail>
          </Panel>
        </Section>

        <Section>
          <Panel component="section" aria-labelledby="diag-topics">
            <PanelHead title="The questions cover" titleId="diag-topics" />
            {missing > 0 && (
              <Alert severity="warning" sx={{ mb: '10px' }}>
                {missing} question{missing > 1 ? 's' : ''} of your first attempt couldn&apos;t be loaded, so the retake can&apos;t be
                saved. Reload the page to try again.
              </Alert>
            )}
            {questions.map((q, i) => {
              const reqs = requirementsFor(q, role.requirements);
              return (
                <CheckRow key={q.ref} mark={String(i + 1)} aside={<Pill tone={q.fits ? 'accent' : 'neutral'}>{q.fits ? 'Fits' : 'Core topic'}</Pill>}>
                  <b>{q.topic}</b>
                  <Detail component="span" sx={{ display: 'block' }}>
                    {q.fits && reqs.length
                      ? `Fits: ${reqs.map((r) => r.text).join('; ')}`
                      : 'A core topic for data platform roles; chosen to make up the ten.'}
                  </Detail>
                </CheckRow>
              );
            })}
            <Actions sx={{ mt: '14px' }}>
              <Button
                variant="contained"
                color="ink"
                disabled={questions.length === 0 || missing > 0}
                onClick={() => { setDrafts(questions.map(() => ({ ...EMPTY }))); setStep(0); }}
              >
                {retake ? 'Start the retake' : 'Start'}
              </Button>
            </Actions>
          </Panel>
        </Section>
      </Box>
    );
  }

  const q = questions[step];
  const d = drafts[step];
  const last = step === questions.length - 1;
  const reqs = requirementsFor(q, role.requirements);
  const update = (patch: Partial<Draft>) => setDrafts((all) => all.map((x, i) => (i === step ? { ...x, ...patch } : x)));

  const finish = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await addRoleDiagnostic(role.id, {
        lens,
        items: questions.map((qq, i) => ({
          question_ref: qq.ref,
          answer: drafts[i].answer,
          covered: [...drafts[i].covered].sort((a, b) => a - b),
          confidence: drafts[i].confidence ?? 'not-yet',
          fits_requirement: qq.fits,
        })),
      });
      navigate(`/preparations/roles/${role.id}`);
    } catch (err) {
      setSaveError(`The attempt wasn't saved. ${apiErrorMessage(err, '')}`.trim());
      setSaving(false);
    }
  };

  return (
    <Box>
      <PageHead
        eyebrow={`Diagnostic · question ${step + 1} of ${questions.length}`}
        title={q.topic}
        sub={`${role.name} · answering as ${lensLabel}`}
      />
      <Panel component="section" aria-labelledby="diag-q">
        <Eyebrow>Interview question</Eyebrow>
        <Typography variant="h6" component="h2" id="diag-q" sx={{ mt: '4px' }}>&quot;{q.question}&quot;</Typography>
        <Detail sx={{ mt: '6px' }}>
          {q.fits && reqs.length ? `Asked because the job asks for: ${reqs.map((r) => r.text).join('; ')}` : 'A core topic for data platform roles.'}
        </Detail>
        <TextField
          key={q.ref}
          sx={{ mt: '14px' }}
          label="Your answer, in your own words"
          multiline minRows={5} fullWidth
          value={d.answer}
          onChange={(e) => update({ answer: e.target.value })}
          slotProps={{ htmlInput: { maxLength: 5000 } }}
        />
        {!d.compared ? (
          <Actions sx={{ mt: '12px' }}>
            <Button variant="outlined" disabled={!d.answer.trim()} onClick={() => update({ compared: true })}>Compare with the key points</Button>
            {!d.answer.trim() && <Detail>Write your answer first; the points stay hidden until you do.</Detail>}
          </Actions>
        ) : (
          <>
            <Typography variant="h6" component="h3" sx={{ mt: '18px' }}>Which of these did your answer really cover?</Typography>
            {q.points.map((pt, i) => (
              <FormControlLabel
                key={pt}
                sx={{ display: 'flex', alignItems: 'flex-start', mt: '6px' }}
                control={(
                  <Checkbox
                    sx={{ pt: 0 }}
                    checked={d.covered.includes(i)}
                    onChange={(e) => update({ covered: e.target.checked ? [...d.covered, i] : d.covered.filter((x) => x !== i) })}
                  />
                )}
                label={pt}
              />
            ))}
            <Typography variant="h6" component="h3" id="diag-conf" sx={{ mt: '16px' }}>How confident are you on this topic?</Typography>
            <ToggleButtonGroup
              exclusive size="small" aria-labelledby="diag-conf" sx={{ mt: '6px', flexWrap: 'wrap' }}
              value={d.confidence}
              onChange={(_, v: Confidence | null) => { if (v) update({ confidence: v }); }}
            >
              {CONFIDENCE.map((c) => <ToggleButton key={c.id} value={c.id}>{c.label}</ToggleButton>)}
            </ToggleButtonGroup>
            <Sub sx={{ mt: '12px' }}>
              To study it: <RouterLink to={q.learn.to}>{q.learn.label}</RouterLink>.
            </Sub>
          </>
        )}
        {saveError && <Alert severity="error" sx={{ mt: '12px' }}>{saveError}</Alert>}
        <Actions sx={{ mt: '18px' }}>
          <Button variant="outlined" onClick={() => setStep(step === 0 ? 'intro' : step - 1)}>Back</Button>
          <Button variant="contained" disabled={!d.confidence || saving} onClick={() => (last ? void finish() : setStep(step + 1))}>
            {last ? 'Finish and save' : 'Next question'}
          </Button>
          <Pill>{drafts.filter((x) => x.confidence).length} of {questions.length} done</Pill>
        </Actions>
      </Panel>
    </Box>
  );
};
