// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, TextField, Button, Alert, CircularProgress,
} from '@mui/material';
import { Clock } from 'lucide-react';
import {
  getSettings, getSystemDesignDraft, getSystemDesignPrompt, saveSystemDesignDraft,
  submitSystemDesignAttempt,
} from '../services/api';
import { SystemDesignPrompt } from '../types/systemDesign';
import { apiErrorMessage, loadFailed } from '../services/apiError';
import { LoadingState, SaveStatus, type SaveState } from '../components/common/States';
import { connection } from '../services/connection';
import { clearLocalDraft, readLocalDraft, writeLocalDraft } from '../services/localDrafts';
import { fromServerTime } from '../services/format';
import {
  SECTIONS, Sections, SectionKey, emptySections, hasContent, toSections,
} from '../services/systemDesignSections';
import { MONO_STACK } from '../theme/tokens';
import { Actions, Detail, Eyebrow, PageHead, Panel, Section } from '../components/ui/primitives';

/**
 * Write the design, in the parts an interviewer listens for, and do not lose it.
 *
 * The answer has five sections -- requirements, architecture, data model, failure
 * handling, trade-offs -- each its own field, because the plan's chain walks
 * them in that order and a single box let a whole part be skipped without
 * anyone noticing. The grader still reads one answer: the server joins the
 * sections under their headings.
 *
 * Three things stand between the learner and losing the work:
 *
 *   Every section is saved to the database as it is typed, debounced, and the
 *   page says when it last landed. The claim "saved as you type" is only on the
 *   screen because it is true.
 *
 *   Reopening the prompt restores the draft -- and, once an answer has been
 *   submitted, restores that instead, because a revision that starts from blank
 *   boxes is a rewrite.
 *
 *   The browser asks before unloading while there are unsaved edits. That is a
 *   backstop for the second between a keystroke and the save, not the mechanism.
 */

/** Long enough not to write on every keystroke, short enough to be a safety net. */
const AUTOSAVE_MS = 1200;

const formatElapsed = (seconds: number): string => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const same = (a: Sections, b: Sections) => SECTIONS.every((s) => a[s.key] === b[s.key]);

/** What is kept on this device while a save cannot reach the server. */
interface KeptAnswer { sections: Sections; targetRole: string }

export const SystemDesignAnswerPage: React.FC = () => {
  const { promptId } = useParams<{ promptId: string }>();
  const navigate = useNavigate();
  const pid = promptId ? parseInt(promptId, 10) : 0;

  const [prompt, setPrompt] = useState<SystemDesignPrompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const [sections, setSections] = useState<Sections>(emptySections);
  // An answer written before answers had sections: shown for reference, not lost.
  const [legacyAnswer, setLegacyAnswer] = useState<string | null>(null);
  const [targetRole, setTargetRole] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [resumed, setResumed] = useState(false);
  const [restoredLocal, setRestoredLocal] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saveState, setSaveState] = useState<SaveState | null>(null);
  const saveStateRef = useRef<SaveState | null>(null);
  const [dirty, setDirty] = useState(false);
  const draftKey = `systemDesign:${pid}`;

  useEffect(() => { saveStateRef.current = saveState; }, [saveState]);

  const startTimeRef = useRef<number>(Date.now());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef({ sections: emptySections(), targetRole: '' });
  const submittedRef = useRef(false);
  const baselineRef = useRef<{ sections: Sections; targetRole: string } | null>(null);

  useEffect(() => {
    latestRef.current = { sections, targetRole };
  }, [sections, targetRole]);

  useEffect(() => {
    if (isNaN(pid) || pid <= 0) return;
    setLoading(true);
    setFetchError(null);

    Promise.all([
      getSystemDesignPrompt(pid),
      // A failed draft read must not stop the page: a learner who cannot
      // resume can still write. It must not silently look like an empty
      // draft either, which is why `resumed` is only set on success.
      getSystemDesignDraft(pid).catch(() => null),
      getSettings().catch(() => null),
    ])
      .then(([p, draft, settings]) => {
        setPrompt(p);
        startTimeRef.current = Date.now();
        let restored = emptySections();
        if (draft?.exists) {
          if (draft.sections) {
            restored = toSections(draft.sections);
          } else if ((draft.answer_text ?? '').trim()) {
            setLegacyAnswer(draft.answer_text);
          }
          setSections(restored);
          setResumed(hasContent(restored) || !!(draft.answer_text ?? '').trim());
        }
        // The draft's role wins where it has one; the Settings default is what
        // a *new* attempt starts from, which is exactly what that setting's
        // own helper text promises.
        const role = (draft?.exists ? draft.target_role : null)
          ?? settings?.default_target_role ?? '';
        setTargetRole(role);
        baselineRef.current = { sections: restored, targetRole: role };

        // Edits kept on this device that never reached the server. Newer than
        // what the server has, they win and are sent now; older, the server's
        // copy already includes them and the kept one is dropped.
        const kept = readLocalDraft<KeptAnswer>(draftKey);
        if (kept) {
          const serverTime = draft?.exists ? fromServerTime(draft.updated_at) : null;
          if (!serverTime || new Date(kept.savedAt) > serverTime) {
            setSections(toSections(kept.value.sections));
            setTargetRole(kept.value.targetRole);
            setRestoredLocal(true);
            setResumed(false);
            // The baseline stays the server's, so the autosave sees a change and sends it.
          } else {
            clearLocalDraft(draftKey);
          }
        }
      })
      .catch((err) => setFetchError(loadFailed('Could not load this prompt', err)))
      .finally(() => setLoading(false));
  }, [pid, draftKey, loadAttempt]);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const persist = useCallback(async () => {
    if (isNaN(pid) || pid <= 0 || submittedRef.current) return;
    const snapshot = { ...latestRef.current };
    // Kept on this device first, so a save that fails loses nothing.
    const keptLocally = writeLocalDraft<KeptAnswer>(draftKey, snapshot);
    setSaveState('pending_sync');
    try {
      await saveSystemDesignDraft(pid, {
        sections: snapshot.sections,
        target_role: snapshot.targetRole || null,
      });
      // Only drop the kept copy if nothing newer was typed while this was on
      // its way; otherwise the next save carries it.
      if (same(latestRef.current.sections, snapshot.sections) && latestRef.current.targetRole === snapshot.targetRole) {
        clearLocalDraft(draftKey);
        setDirty(false);
      }
      setSavedAt(new Date());
      setSaveState('synced');
    } catch {
      // Said, not swallowed. A draft the server never received must not look
      // like one it accepted -- that is the whole failure this page exists to
      // stop happening.
      setSaveState(keptLocally ? 'saved_locally' : 'sync_failed');
    }
  }, [pid, draftKey]);

  // When the server answers again, what was kept here goes to it.
  useEffect(() => connection.subscribe((state) => {
    if (state === 'online' && saveStateRef.current === 'saved_locally') persist();
  }), [persist]);

  /** Debounced autosave. Every edit restarts the clock. */
  useEffect(() => {
    if (loading || !prompt || baselineRef.current === null) return;
    if (same(sections, baselineRef.current.sections) && targetRole === baselineRef.current.targetRole) return;
    setDirty(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(persist, AUTOSAVE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // `persist` reads the latest text from a ref, so it is stable.
  }, [sections, targetRole, loading, prompt, persist]);

  // The backstop, covering the second between a keystroke and the debounce.
  useEffect(() => {
    if (!dirty || submitting) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, submitting]);

  const setSection = (key: SectionKey, value: string) =>
    setSections((prev) => ({ ...prev, [key]: value }));

  // Cancel & exit: whatever was typed in the last second is saved before leaving.
  const handleExit = async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (dirty) await persist();
    navigate('/system-design');
  };

  const handleSubmit = async () => {
    if (!prompt || !hasContent(sections)) return;
    setSubmitError(null);
    setSubmitting(true);
    // Flush first: submitting with a pending debounce and a failing grade
    // would lose whatever was typed in the last second.
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    await persist();
    try {
      const attempt = await submitSystemDesignAttempt({
        prompt_id: prompt.id,
        sections,
        target_role: targetRole || undefined,
        time_spent_seconds: elapsed,
      });
      submittedRef.current = true;
      setDirty(false);
      clearLocalDraft(draftKey);
      navigate(`/system-design/attempts/${attempt.id}`);
    } catch (err) {
      setSubmitError(apiErrorMessage(err, 'Failed to submit your answer. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (isNaN(pid) || pid <= 0) {
    return <Alert severity="error">Invalid prompt.</Alert>;
  }

  if (loading) return <LoadingState label="Loading this prompt…" />;

  if (fetchError || !prompt) {
    return (
      <Alert severity="error" action={fetchError ? <Button color="inherit" size="small" onClick={() => setLoadAttempt((n) => n + 1)}>Retry</Button> : undefined}>
        {fetchError || 'This prompt was not found.'}
        {readLocalDraft(draftKey) && ' Your unsaved edits are still kept on this device and will be restored when the prompt loads.'}
      </Alert>
    );
  }

  const written = SECTIONS.filter((s) => sections[s.key].trim()).length;
  const canSubmit = !submitting && hasContent(sections);
  const submitIcon = submitting ? <CircularProgress size={16} color="inherit" /> : undefined;

  return (
    <Box>
      <PageHead
        eyebrow={`Focused attempt · ${prompt.category} · ${prompt.difficulty}`}
        title={prompt.title}
        actions={(
          <>
            <Detail component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontVariantNumeric: 'tabular-nums' }}>
              <Clock size={14} aria-hidden /> <span aria-label="Time spent">{formatElapsed(elapsed)}</span>
            </Detail>
            <Button variant="outlined" onClick={() => void handleExit()}>Cancel &amp; exit</Button>
            <Button variant="contained" color="ink" onClick={handleSubmit} disabled={!canSubmit} startIcon={submitIcon}>
              {submitting ? 'Grading…' : 'Submit for rubric evaluation →'}
            </Button>
          </>
        )}
      />

      {/* The problem, and the constraints the answer is graded against. */}
      <Panel component="section" aria-label="Design prompt" sx={{ mt: '6px', borderLeft: '4px solid', borderLeftColor: 'primary.main' }}>
        <Eyebrow sx={{ color: 'primary.main' }}>Design prompt &amp; problem constraints</Eyebrow>
        <Typography sx={{ fontSize: (t) => t.typography.pxToRem(15), fontWeight: 700, lineHeight: 1.5, mt: '6px', whiteSpace: 'pre-wrap' }}>
          {prompt.prompt_text}
        </Typography>
      </Panel>

      {resumed && <Alert severity="info" sx={{ mt: '14px' }}>Picked up where you left off.</Alert>}
      {restoredLocal && (
        <Alert severity="info" sx={{ mt: '14px' }}>
          Restored edits that were kept on this device because they had not reached the server.
          They are being saved now.
        </Alert>
      )}
      {submitError && <Alert severity="error" sx={{ mt: '14px' }}>{submitError}</Alert>}
      {saveState === 'saved_locally' && (
        <Alert severity="warning" sx={{ mt: '14px' }}>
          Your last edits have not reached the database. They are kept on this device and will be sent
          when the server answers again; you can close the tab and they will be restored here.
        </Alert>
      )}
      {saveState === 'sync_failed' && (
        <Alert severity="error" sx={{ mt: '14px' }}>
          Your last edits have not reached the database, and this browser would not keep a copy.
          Keep this tab open, or copy the text somewhere safe before you leave.
        </Alert>
      )}

      <Section>
        <Panel component="section" aria-label="Your answer" sx={{ maxWidth: 1050 }}>
          <Eyebrow>Structured architecture workspace · saved as you type</Eyebrow>

          <Box sx={{ display: 'grid', gap: '16px', mt: '14px' }}>
            <Box>
              <FieldLabel htmlFor="sd-target-role">Target role (optional)</FieldLabel>
              <TextField
                id="sd-target-role"
                fullWidth
                placeholder="e.g. Senior Backend Engineer, fintech"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                helperText="If set, feedback is calibrated to what a strong candidate for this specific role would be expected to demonstrate."
              />
            </Box>

            {legacyAnswer && (
              <Alert severity="info">
                <strong>Your earlier answer</strong>, written before answers had sections. It is kept on
                that attempt; copy what you need into the sections below.
                <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>{legacyAnswer}</Typography>
              </Alert>
            )}

            {SECTIONS.map((s, i) => (
              <Box key={s.key}>
                <FieldLabel htmlFor={`sd-${s.key}`}>{`${i + 1}. ${s.label}`}</FieldLabel>
                <TextField
                  id={`sd-${s.key}`}
                  fullWidth
                  multiline
                  minRows={s.key === 'architecture' ? 5 : 4}
                  placeholder={s.placeholder}
                  value={sections[s.key]}
                  onChange={(e) => setSection(s.key, e.target.value)}
                  slotProps={{ input: { sx: { fontFamily: MONO_STACK, fontSize: (t) => t.typography.pxToRem(13), lineHeight: 1.5 } } }}
                />
              </Box>
            ))}
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', mt: '20px', flexWrap: 'wrap' }}>
            {/* Stated, because a learner who cannot see the saving cannot trust
                it, and this page's whole history is of work going missing. */}
            <Actions sx={{ gap: '10px' }}>
              {saveState ? (
                <SaveStatus
                  state={saveState}
                  detail={saveState === 'synced' && savedAt
                    ? `at ${savedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}. You can leave and come back`
                    : saveState === 'saved_locally'
                      ? 'not on the server yet'
                      : undefined}
                />
              ) : (
                <Detail component="span">Saved as you type.</Detail>
              )}
              <Detail component="span">{written} of {SECTIONS.length} sections written.</Detail>
            </Actions>

            <Button variant="contained" size="large" onClick={handleSubmit} disabled={!canSubmit} startIcon={submitIcon}>
              {submitting ? 'Grading…' : 'Submit architecture answer for evaluation →'}
            </Button>
          </Box>
        </Panel>
      </Section>
    </Box>
  );
};

/** The prototype's field label: above the box, small capitals, muted. */
const FieldLabel: React.FC<{ htmlFor: string; children: React.ReactNode }> = ({ htmlFor, children }) => (
  <Box
    component="label"
    htmlFor={htmlFor}
    sx={{
      display: 'block', mb: '4px', fontSize: (t) => t.typography.pxToRem(12), fontWeight: 700,
      textTransform: 'uppercase', color: 'text.secondary', letterSpacing: '0.02em',
    }}
  >
    {children}
  </Box>
);
