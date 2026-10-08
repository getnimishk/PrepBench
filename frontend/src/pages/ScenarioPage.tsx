// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Checkbox, FormControl, FormControlLabel, FormLabel, Radio, RadioGroup, TextField,
  ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { getContentPack, getInterviewQuestions, saveInterviewQuestionFromSource } from '../services/api';
import { apiErrorMessage } from '../services/apiError';
import { usePreparation } from '../context/PreparationContext';
import { useLinkedTopics } from '../hooks/useLinkedTopics';
import {
  EXPLANATION_MAX, NOTE_MAX, ROLES, SAY_IT_MAX,
  answerCheck, commitCaseNotes, fetchPreparationAttempts, lastRole, lensTasks, saveCoverage, saveLensText,
  sayItSourceRef, scenarioProgress, serializeLensText, type ScenarioKey,
} from '../services/scenarios/scenarioAttempts';
import type { ContentPackDetail, ScenarioContent, ScenarioDebriefBlock, ScenarioRole } from '../types/contentPack';
import type { InterviewQuestion } from '../types/interviewQuestion';
import type { WireLearningAttempt } from '../types/learning';
import { ErrorState, LoadingState } from '../components/common/States';
import {
  Actions, CheckRow, Detail, Good, Note, PageHead, Panel, PanelHead, Pill, Section, Sub,
} from '../components/ui/primitives';

const DebriefList: React.FC<{ blocks: ScenarioDebriefBlock[] }> = ({ blocks }) => (
  <>
    {blocks.map((d) => (
      <Box key={d.title} sx={{ mt: '16px' }}>
        <Typography variant="h6" component="h3">{d.title}</Typography>
        {d.text.length === 1
          ? <Sub sx={{ mt: '4px' }}>{d.text[0]}</Sub>
          : (
            <Box component="ul" sx={{ m: '6px 0 0', pl: '20px', display: 'grid', gap: '6px' }}>
              {d.text.map((t) => <Typography component="li" variant="body2" key={t}>{t}</Typography>)}
            </Box>
          )}
      </Box>
    ))}
  </>
);

/** Characters left, once there are few enough to matter. */
const remaining = (value: string, max: number) =>
  max - value.length <= 100 ? `${max - value.length} characters left` : undefined;

const upsert = (all: WireLearningAttempt[], one: WireLearningAttempt) => {
  const i = all.findIndex((a) => a.attempt_uid === one.attempt_uid);
  return i === -1 ? [...all, one] : all.map((a, j) => (j === i ? one : a));
};

/**
 * A scenario: learn → check → case → debrief → say it.
 *
 * The concept is read in the guide chapter; the check is the same for every
 * role; the case questions, half of the debrief and the interview question
 * follow the role the learner practises as, and each role's work is kept
 * separately. Everything is recorded as learning attempts on the Skill
 * preparation the pack is attached to (services/scenarios/scenarioAttempts.ts
 * says how), and the check's first answer locks there, not just here.
 */
export const ScenarioPage: React.FC = () => {
  const { packId = '', scenarioId = '' } = useParams<{ packId: string; scenarioId: string }>();
  const { selected, loading: loadingPreparation } = usePreparation();
  const link = selected?.content_packs?.find((cp) => cp.pack_id === packId) ?? null;
  const version = link?.pack_version ?? null;

  const [pack, setPack] = useState<ContentPackDetail | null>(null);
  const [attempts, setAttempts] = useState<WireLearningAttempt[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const [role, setRole] = useState<ScenarioRole | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<ScenarioRole, Record<number, string>>>>({});
  const [sayDrafts, setSayDrafts] = useState<Partial<Record<ScenarioRole, string>>>({});
  const [coverDrafts, setCoverDrafts] = useState<Partial<Record<ScenarioRole, number[]>>>({});
  const [busy, setBusy] = useState(false);
  const [pendingAnswer, setPendingAnswer] = useState<{ index: number; chosen: number } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  /** The Say-it text last saved per role, so "Saved." shows only while the field still holds it. */
  const [savedSay, setSavedSay] = useState<Partial<Record<ScenarioRole, string>>>({});
  const coverageQueue = useRef<Promise<void>>(Promise.resolve());
  /** Saved Say-it questions, by preparation and source: undefined = not looked up yet, null = none. */
  const [library, setLibrary] = useState<Record<string, InterviewQuestion | null>>({});
  const [libraryNote, setLibraryNote] = useState<string | null>(null);

  // The pack, at the version the preparation pinned, or the latest when it
  // isn't attached (to say what it is, not to practise it).
  useEffect(() => {
    if (!packId || loadingPreparation) return undefined;
    let cancelled = false;
    setPack(null);
    setLoadError(null);
    getContentPack(packId, version ?? undefined)
      .then((p) => { if (!cancelled) setPack(p); })
      .catch((err) => { if (!cancelled) setLoadError(apiErrorMessage(err, '')); });
    return () => { cancelled = true; };
  }, [packId, version, loadingPreparation, reload]);

  const subjectId = link ? selected?.id ?? null : null;
  const refreshAttempts = useCallback(async () => {
    if (subjectId == null) return;
    setAttempts(await fetchPreparationAttempts(subjectId));
  }, [subjectId]);

  useEffect(() => {
    if (subjectId == null) { setAttempts([]); return undefined; }
    let cancelled = false;
    setAttempts(null);
    fetchPreparationAttempts(subjectId)
      .then((a) => { if (!cancelled) setAttempts(a); })
      .catch((err) => { if (!cancelled) setLoadError(apiErrorMessage(err, '')); });
    return () => { cancelled = true; };
  }, [subjectId, reload]);

  const scenario = pack?.scenario_levels.flatMap((l) => l.scenarios).find((s) => s.id === scenarioId) ?? null;
  const content = (scenario?.content ?? null) as ScenarioContent | null;
  const progress = useMemo(
    () => (pack && scenario && attempts ? scenarioProgress(attempts, pack.pack_id, pack.version, scenario) : null),
    [pack, scenario, attempts],
  );
  const key: ScenarioKey | null = pack && subjectId != null
    ? { subjectId, packId: pack.pack_id, version: pack.version, scenarioId }
    : null;
  // The topics of this preparation's own roadmaps whose study-guide chapter this scenario practises.
  const linkedTopics = useLinkedTopics(subjectId ?? null, link ? packId : null, { chapter: scenario?.chapter ?? '' });

  // Open on the role last practised here.
  useEffect(() => {
    if (progress && role === null) setRole(lastRole(progress));
  }, [progress, role]);

  // Is this role's Say-it question already in the library?
  const activeRole = role ?? 'po';
  const sourceRef = pack ? sayItSourceRef(pack.pack_id, pack.version, scenarioId, activeRole) : null;
  const libraryKey = sourceRef && subjectId != null ? `${subjectId}|${sourceRef}` : null;
  useEffect(() => {
    if (!libraryKey || library[libraryKey] !== undefined) return undefined;
    let cancelled = false;
    getInterviewQuestions({ source_ref: sourceRef!, subject_id: subjectId!, limit: 1 })
      .then((r) => { if (!cancelled) setLibrary((prev) => ({ ...prev, [libraryKey]: r.items[0] ?? null })); })
      .catch(() => { /* the button still works; it just can't say "update" */ });
    return () => { cancelled = true; };
  }, [libraryKey, sourceRef, subjectId, library]);

  const eyebrow = pack ? `Learning Lab · ${pack.title} scenarios` : 'Learning Lab · Scenarios';
  const back = <Button variant="outlined" component={RouterLink} to="/scenarios">All scenarios</Button>;

  if (loadError !== null) {
    return (
      <Box>
        <PageHead eyebrow={eyebrow} title="Scenario" />
        <ErrorState what="Could not load this scenario." saved="nothing_to_save" detail={loadError} onRetry={() => setReload((n) => n + 1)} />
      </Box>
    );
  }
  if (loadingPreparation || !pack || (link && (!attempts || !progress) && scenario?.content)) {
    return <Box><PageHead eyebrow={eyebrow} title="Scenario" /><LoadingState label="Loading this scenario…" /></Box>;
  }
  if (!scenario || !content) {
    return (
      <Box>
        <PageHead eyebrow={eyebrow} title={scenario ? `${scenario.number} · ${scenario.title}` : 'Scenario not found'} />
        <Detail>{scenario ? 'This scenario is planned but hasn\'t been written yet.' : `${pack.title} has no scenario ${scenarioId}.`}</Detail>
        <Actions sx={{ mt: '14px' }}>{back}</Actions>
      </Box>
    );
  }

  const chapterIndex = pack.chapters.findIndex((c) => c.id === scenario.chapter);
  const chapterPath = `/learn/guides/${pack.pack_id}/${scenario.chapter}`;

  if (!key || !progress) {
    return (
      <Box>
        <PageHead eyebrow={eyebrow} title={`${scenario.number} · ${scenario.title}`} sub={scenario.outcome} actions={back} />
        <Note>
          {selected
            ? `Scenarios are practised in a Skill preparation with the ${pack.title} guide attached, so your work is kept there. ${selected.name} doesn't have it.`
            : `Scenarios are practised in a Skill preparation with the ${pack.title} guide attached, so your work is kept there. No preparation is selected.`}
        </Note>
        <Actions sx={{ mt: '14px' }}>
          {selected?.kind === 'skill' && (
            <Button variant="contained" component={RouterLink} to={`/preparations/${selected.id}/edit`}>Attach the guide to {selected.name}</Button>
          )}
          <Button variant="outlined" component={RouterLink} to={chapterPath}>Read the guide chapter</Button>
        </Actions>
      </Box>
    );
  }

  const roleInfo = ROLES.find((r) => r.id === activeRole)!;
  const aRole = `${/^[AEIOU]/.test(roleInfo.label) ? 'an' : 'a'} ${roleInfo.label}`;
  const lens = content.lenses[activeRole];
  const tasks = lensTasks(content, activeRole);
  const committed = progress.lenses[activeRole];
  const debriefShown = Boolean(committed?.debriefShown);
  const notes = debriefShown ? committed!.notes : (drafts[activeRole] ?? {});
  const sayIt = sayDrafts[activeRole] ?? committed?.sayIt ?? '';
  const covered = coverDrafts[activeRole] ?? committed?.pointsCovered ?? [];
  const answered = Object.keys(progress.answers).length;
  const right = content.check.filter((q, i) => progress.answers[i] === q.answer).length;
  const checkDone = answered === content.check.length;
  const notesDone = tasks.every((_, i) => (notes[i] ?? '').trim().length > 0);
  const inLibrary = (libraryKey && library[libraryKey]) || null;

  // Whatever the server holds is the truth after a failure -- e.g. an answer
  // given in another tab -- so the page is re-read from it.
  const failed = async (err: unknown, failure: string) => {
    setActionError(`${failure} ${apiErrorMessage(err, '')}`.trim());
    await refreshAttempts().catch(() => {});
  };

  /** A step that must not be repeated while it is in flight: answering, opening the debrief, saving to the library. */
  const run = async (action: () => Promise<void>, failure: string) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (err) {
      await failed(err, failure);
    } finally {
      setBusy(false);
    }
  };

  // The choice shows at once, and the question is off while it saves; the
  // verdict ("Right." / "Not quite") waits for the server to hold the answer.
  const onAnswer = (index: number, chosen: number) => {
    setPendingAnswer({ index, chosen });
    return run(async () => {
      const saved = await answerCheck(key, scenario.chapter, index, chosen, chosen === content.check[index].answer);
      setAttempts((prev) => upsert(prev ?? [], saved));
    }, 'Your answer wasn\'t saved.').finally(() => setPendingAnswer(null));
  };

  const onShowDebrief = () => run(async () => {
    const saved = await commitCaseNotes(key, scenario.chapter, activeRole, serializeLensText(tasks, notes));
    setAttempts((prev) => upsert(prev ?? [], saved));
  }, 'The debrief didn\'t open: your notes weren\'t saved.');

  const lensText = (answer: string) => serializeLensText(tasks, notes, { question: lens.sayIt.question, answer });
  const sayItTooLong = lensText(sayIt).length > EXPLANATION_MAX;

  const saveSayIt = async () => {
    if (!committed || subjectId == null) return;
    const text = sayIt.trim();
    if (text !== committed.sayIt.trim()) {
      const saved = await saveLensText(subjectId, committed.attemptUid, lensText(sayIt));
      setAttempts((prev) => upsert(prev ?? [], saved));
    }
    setSavedSay((prev) => ({ ...prev, [activeRole]: text }));
  };

  // Ticks and the answer's autosave never disable anything: a blur-save that
  // did would swallow the very click that caused the blur. Each tick sends the
  // whole map, so they go one after another -- two in flight could land out of
  // order and leave the server holding the older one.
  const onToggle = (i: number, on: boolean) => {
    if (!committed || subjectId == null) return;
    const next = on ? [...covered, i].sort((x, y) => x - y) : covered.filter((x) => x !== i);
    const forRole = activeRole;
    const uid = committed.attemptUid;
    const forPreparation = subjectId;
    setCoverDrafts((prev) => ({ ...prev, [forRole]: next }));
    coverageQueue.current = coverageQueue.current.then(async () => {
      try {
        const saved = await saveCoverage(forPreparation, uid, next, lens.sayIt.points.length);
        setAttempts((prev) => upsert(prev ?? [], saved));
      } catch (err) {
        setCoverDrafts((prev) => ({ ...prev, [forRole]: undefined }));
        await failed(err, 'That wasn\'t saved.');
      }
    });
  };

  const onAddToLibrary = () => run(async () => {
    await saveSayIt();
    const result = await saveInterviewQuestionFromSource({
      source_ref: sourceRef!,
      subject_id: key.subjectId,
      round_type: 'technical',
      question_text: lens.sayIt.question,
      category: pack.title,
      prepared_answer: sayIt.trim(),
      key_talking_points: lens.sayIt.points,
    });
    setLibrary((prev) => ({ ...prev, [libraryKey!]: result.question }));
    setLibraryNote(result.created
      ? 'Added to your interview question library as a Technical question, with your answer as its prepared answer and these points as talking points.'
      : 'Updated in your interview question library: the prepared answer and talking points now match this page.');
  }, 'It wasn\'t added to the library.');

  return (
    <Box>
      <PageHead
        eyebrow={eyebrow}
        title={`${scenario.number} · ${scenario.title}`}
        sub={scenario.outcome}
        actions={back}
      />
      <Detail sx={{ mb: '16px' }}>
        Everything in the case is fictional; every rule in the debrief is from the vendor&apos;s documentation. Your work is kept in {selected!.name}.
      </Detail>

      {actionError && <Alert severity="error" sx={{ mb: '16px' }}>{actionError}</Alert>}

      <Panel soft component="section" aria-labelledby="scenario-role">
        <PanelHead title="Practise as" titleId="scenario-role" />
        <ToggleButtonGroup
          exclusive
          size="small"
          value={activeRole}
          aria-labelledby="scenario-role"
          onChange={(_, v: ScenarioRole | null) => { if (v) { setRole(v); setLibraryNote(null); } }}
          sx={{ flexWrap: 'wrap' }}
        >
          {ROLES.map((r) => <ToggleButton key={r.id} value={r.id}>{r.label}</ToggleButton>)}
        </ToggleButtonGroup>
        <Detail sx={{ mt: '8px' }}>
          The concept, the check and what went wrong are the same for every role. As {aRole}, the case asks about
          {' '}{roleInfo.focus}, and you answer {aRole} interview question. Each role&apos;s work is kept separately,
          so you can practise the same scenario as more than one.
        </Detail>
      </Panel>

      <Section>
        <Panel component="section" aria-labelledby="scenario-read">
          <PanelHead
            title="1 · Learn it first"
            titleId="scenario-read"
            aside={<Button size="small" variant="outlined" component={RouterLink} to={chapterPath}>Read the guide chapter</Button>}
          />
          <Sub sx={{ mt: 0 }}>{content.bookmark}</Sub>
          <Detail>
            If that sentence isn&apos;t clear yet, read {chapterIndex >= 0 ? `chapter ${chapterIndex + 1}` : 'the chapter'} in the Study Library first.
          </Detail>
          {linkedTopics.length > 0 && (
            <Detail sx={{ mt: '6px' }}>
              Roadmap topic{linkedTopics.length === 1 ? '' : 's'} this practises:{' '}
              {linkedTopics.map((t, i) => (
                <React.Fragment key={t.topicId}>
                  {i > 0 && ' · '}
                  <RouterLink to={`/roadmaps/${t.roadmapId}/topics/${t.topicId}`}>{t.title}</RouterLink>
                </React.Fragment>
              ))}
            </Detail>
          )}
        </Panel>
      </Section>

      <Section>
        <Panel component="section" aria-labelledby="scenario-check">
          <PanelHead
            title="2 · Check"
            titleId="scenario-check"
            aside={(
              <Pill tone={checkDone ? (right === content.check.length ? 'success' : 'warning') : 'neutral'}>
                {checkDone ? `${right} of ${content.check.length} right · practice only` : `${answered} of ${content.check.length} answered`}
              </Pill>
            )}
          />
          <Detail>The same for every role. Your first answer locks, as it would in an interview. A knowledge check, not a score: it never counts towards readiness.</Detail>
          {content.check.map((q, i) => {
            const chosen = progress.answers[i];
            const locked = chosen !== undefined;
            return (
              <Box key={q.prompt} sx={{ py: '14px', borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
                <FormControl disabled={locked || busy}>
                  <FormLabel
                    id={`check-${i}`}
                    sx={{ color: 'text.primary', fontWeight: 700, '&.Mui-focused': { color: 'text.primary' }, '&.Mui-disabled': { color: 'text.primary' } }}
                  >
                    {`${i + 1}. ${q.prompt}`}
                  </FormLabel>
                  <RadioGroup
                    aria-labelledby={`check-${i}`}
                    value={locked ? String(chosen) : pendingAnswer?.index === i ? String(pendingAnswer.chosen) : ''}
                    onChange={(e) => { void onAnswer(i, Number(e.target.value)); }}
                  >
                    {q.options.map((o, j) => (
                      <FormControlLabel
                        key={o}
                        value={String(j)}
                        control={<Radio />}
                        label={o}
                        sx={{ '& .MuiFormControlLabel-label.Mui-disabled': { color: 'text.primary' } }}
                      />
                    ))}
                  </RadioGroup>
                </FormControl>
                {locked && (chosen === q.answer
                  ? <Good sx={{ mt: '6px' }}>Right. {q.why}</Good>
                  : <Note sx={{ mt: '6px' }}>Not quite: the answer is &quot;{q.options[q.answer]}&quot;. {q.why}</Note>)}
              </Box>
            );
          })}
        </Panel>
      </Section>

      <Section>
        <Panel component="section" aria-labelledby="scenario-case">
          <PanelHead title="3 · The case" titleId="scenario-case" aside={<Pill>Fictional</Pill>} />
          {!checkDone ? (
            <Detail>Answer the check first. The case assumes you know what it covers.</Detail>
          ) : (
            <>
              <Sub sx={{ mt: 0 }}>{content.caseStudy.setting}</Sub>
              <Typography variant="h6" component="h3" sx={{ mt: '14px' }}>What happened</Typography>
              {content.caseStudy.events.map((e) => <CheckRow key={e.when} mark="•"><b>{e.when}.</b> {e.what}</CheckRow>)}
              <Typography variant="h6" component="h3" sx={{ mt: '14px' }}>The pipeline, as built</Typography>
              {content.caseStudy.pipeline.map((s, i) => <CheckRow key={s} mark={String(i + 1)}>{s}</CheckRow>)}
              <Typography variant="h6" component="h3" sx={{ mt: '18px' }}>Your task, as the {roleInfo.label}</Typography>
              <Detail>
                {debriefShown
                  ? 'Your notes as you committed them when you opened the debrief. They stay as you wrote them, beside the debrief.'
                  : `You don't need to fix it yourself. The first ${content.caseStudy.tasks.length} questions are for every role; the rest are yours. Write a line or two for each; take about ten minutes. Your notes are saved when you open the debrief, and can't be changed after it.`}
              </Detail>
              <Box sx={{ display: 'grid', gap: '14px', mt: '12px' }}>
                {tasks.map((t, i) => (
                  <TextField
                    key={`${activeRole}-${t}`}
                    label={`${String.fromCharCode(97 + i)}) ${t}`}
                    multiline
                    minRows={2}
                    fullWidth
                    value={notes[i] ?? ''}
                    helperText={debriefShown ? undefined : remaining(notes[i] ?? '', NOTE_MAX)}
                    slotProps={{ htmlInput: { maxLength: NOTE_MAX, readOnly: debriefShown } }}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [activeRole]: { ...(prev[activeRole] ?? {}), [i]: e.target.value } }))}
                  />
                ))}
              </Box>
              {!debriefShown && (
                <Actions sx={{ mt: '14px' }}>
                  <Button variant="contained" disabled={!notesDone || busy} onClick={() => { void onShowDebrief(); }}>
                    Show the debrief
                  </Button>
                  {!notesDone && <Detail>Write something for each of the {tasks.length} first.</Detail>}
                </Actions>
              )}
            </>
          )}
        </Panel>
      </Section>

      {debriefShown && (
        <>
          <Section>
            <Panel component="section" aria-labelledby="scenario-debrief">
              <PanelHead title="4 · Debrief" titleId="scenario-debrief" aside={<Pill tone="accent">{roleInfo.label}</Pill>} />
              <Detail>Compare with what you wrote above; your notes stay beside it.</Detail>
              <DebriefList blocks={content.debrief.slice(0, 2)} />
              <Typography variant="h5" component="h3" sx={{ mt: '22px' }}>What {aRole} does about it</Typography>
              <DebriefList blocks={lens.debrief} />
              <DebriefList blocks={content.debrief.slice(2)} />
              <Good sx={{ mt: '18px' }}>
                {content.takeaway.map((t) => <Box component="span" key={t} sx={{ display: 'block' }}>{t}</Box>)}
              </Good>
            </Panel>
          </Section>

          <Section>
            <Panel component="section" aria-labelledby="scenario-say">
              <PanelHead title="5 · Say it" titleId="scenario-say" aside={<Pill tone="accent">{roleInfo.label} interview</Pill>} />
              <Typography variant="h6" component="h3">&quot;{lens.sayIt.question}&quot;</Typography>
              <Note sx={{ mt: '10px' }}>{content.honesty}</Note>
              <TextField
                key={activeRole}
                sx={{ mt: '14px' }}
                label="Your answer, in your own words (then say it out loud in under two minutes)"
                multiline
                minRows={5}
                fullWidth
                value={sayIt}
                error={sayItTooLong}
                helperText={sayItTooLong
                  ? 'Too long to save with your notes. Shorten it a little.'
                  : sayIt.trim() && savedSay[activeRole] === sayIt.trim()
                    ? 'Saved.'
                    : remaining(sayIt, SAY_IT_MAX)}
                slotProps={{ htmlInput: { maxLength: SAY_IT_MAX } }}
                onChange={(e) => {
                  setSayDrafts((prev) => ({ ...prev, [activeRole]: e.target.value }));
                }}
                onBlur={() => { if (!sayItTooLong) saveSayIt().catch((err) => failed(err, 'Your answer wasn\'t saved.')); }}
              />
              <Typography variant="h6" component="h3" sx={{ mt: '16px' }}>Did your answer cover these?</Typography>
              {lens.sayIt.points.map((pt, i) => (
                <FormControlLabel
                  key={pt}
                  sx={{ display: 'flex', alignItems: 'flex-start', mt: '6px' }}
                  control={(
                    <Checkbox
                      sx={{ pt: 0 }}
                      checked={covered.includes(i)}
                      onChange={(e) => onToggle(i, e.target.checked)}
                    />
                  )}
                  label={pt}
                />
              ))}
              <Detail sx={{ mt: '8px' }}>{covered.length} of {lens.sayIt.points.length} covered, by your own reading. Nothing here is graded.</Detail>
              <Actions sx={{ mt: '14px' }}>
                <Button
                  variant="outlined"
                  disabled={!sayIt.trim() || sayItTooLong || busy}
                  onClick={() => { void onAddToLibrary(); }}
                >
                  {inLibrary ? 'Update it in my interview question library' : 'Add to my interview question library'}
                </Button>
                {inLibrary && (
                  <Button variant="text" component={RouterLink} to="/interview-practice/library">Open the question library</Button>
                )}
              </Actions>
              {libraryNote
                ? <Good sx={{ mt: '10px' }} role="status">{libraryNote}</Good>
                : (
                  <Detail sx={{ mt: '8px' }}>
                    Adds this question to Interview → Question library as a Technical question, with your answer as its prepared
                    answer and these points as talking points, so a practice round is graded against them.
                  </Detail>
                )}
            </Panel>
          </Section>
        </>
      )}
    </Box>
  );
};
