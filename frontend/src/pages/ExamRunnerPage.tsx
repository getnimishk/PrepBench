// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Link as RouterLink, useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Alert, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions
} from '@mui/material';
import { QuestionView } from '../components/exam/QuestionView';
import { ExplanationDrawer } from '../components/exam/ExplanationDrawer';
import { ExamTimer } from '../components/exam/ExamTimer';
import { QuestionPalette } from '../components/exam/QuestionPalette';
import { getExamDetails, getSettings, saveExamAnswer, finishExam } from '../services/api';
import { ExamDetail, ConfidenceLevel, SaveAnswerRequest } from '../types/exam';
import { Question } from '../types/question';
import { remainingSeconds } from '../services/examClock';
import { useShortcuts } from '../hooks/useShortcuts';
import { EXAM_SHORTCUTS } from '../services/shortcuts';
import { apiErrorMessage, isUnreachable, loadFailed } from '../services/apiError';
import { connection } from '../services/connection';
import {
  answersWord, clearKeptAnswers, describeKept, readKeptAnswers, storeKeptAnswers, withAnswer,
} from '../services/examOutbox';
import { LoadingState, SaveStatus } from '../components/common/States';
import { Detail, PageHead, Panel } from '../components/ui/primitives';

/** How long after an option is picked it is saved without navigating. Short
 *  enough that a reload a moment later keeps it, long enough that changing your
 *  mind between two options is one save rather than two. */
const AUTOSAVE_MS = 500;

interface SendResult {
  /** Still kept: the server did not answer. */
  unsent: number;
  /** Answered, and refused -- not recorded, and no longer kept. */
  refused: number;
}

export const ExamRunnerPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const sid = sessionId ? parseInt(sessionId, 10) : 0;

  const [examDetail, setExamDetail] = useState<ExamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOptionIds, setSelectedOptionIds] = useState<number[]>([]);
  const [answeredMap, setAnsweredMap] = useState<Map<number, number[]>>(new Map());
  const [flaggedSet, setFlaggedSet] = useState<Set<number>>(new Set());
  const [bookmarkedSet, setBookmarkedSet] = useState<Set<number>>(new Set());
  const [confidenceMap, setConfidenceMap] = useState<Map<number, ConfidenceLevel>>(new Map());
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [showExplanation, setShowExplanation] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [timeUpDialog, setTimeUpDialog] = useState(false);
  const [finishing, setFinishing] = useState(false);
  // The prototype keeps the palette folded away behind "Questions": the
  // question is what the screen is for.
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Settings' "Timer sound alert (under 5 min)". Fetched here because the
  // timer is its only consumer and a failed read must not stop an exam.
  const [timerSound, setTimerSound] = useState(false);

  // Answers the server has not got: picked while it could not be reached, kept
  // on this device, and sent when it answers. See services/examOutbox.
  const keptRef = useRef<SaveAnswerRequest[]>([]);
  const [kept, setKept] = useState({ count: 0, what: '', onDevice: true });
  const [sendingKept, setSendingKept] = useState(false);
  const [allSent, setAllSent] = useState(false);
  const [notRecorded, setNotRecorded] = useState<string | null>(null);
  // Sends run one after another, and a save waits for the one in flight, so an
  // older kept answer never reaches the server after a newer one for its question.
  const sendChainRef = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    getSettings()
      .then((s) => setTimerSound(!!s?.timer_sound_enabled))
      .catch(() => { /* no alert, and the clock still turns red */ });
  }, []);

  const currentQuestion: Question | undefined = examDetail?.questions[currentIdx];
  const isPracticeMode = examDetail?.exam_mode === 'practice';

  // Refs to prevent stale closures in timers and callbacks
  const currentQuestionRef = useRef<Question | undefined>(currentQuestion);
  const selectedOptionIdsRef = useRef<number[]>(selectedOptionIds);
  const confidenceMapRef = useRef<Map<number, ConfidenceLevel>>(confidenceMap);
  const flaggedSetRef = useRef<Set<number>>(flaggedSet);
  const bookmarkedSetRef = useRef<Set<number>>(bookmarkedSet);

  const questionStartTimeRef = useRef<number>(questionStartTime);
  const finishingRef = useRef<boolean>(false);
  // A picked option waiting to be saved. Navigation saves at once, so it
  // cancels this rather than saving the same answer twice.
  // ReturnType<typeof setTimeout>, not NodeJS.Timeout: this is browser code,
  // and the NodeJS namespace only resolved here because @types/node leaked in.
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentIdxRef = useRef<number>(0);
  const handleTimeUpRef = useRef<(() => void) | null>(null);

  useEffect(() => { currentQuestionRef.current = currentQuestion; }, [currentQuestion]);
  useEffect(() => { selectedOptionIdsRef.current = selectedOptionIds; }, [selectedOptionIds]);
  useEffect(() => { confidenceMapRef.current = confidenceMap; }, [confidenceMap]);
  useEffect(() => { flaggedSetRef.current = flaggedSet; }, [flaggedSet]);
  useEffect(() => { bookmarkedSetRef.current = bookmarkedSet; }, [bookmarkedSet]);
  useEffect(() => { questionStartTimeRef.current = questionStartTime; }, [questionStartTime]);
  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);

  useEffect(() => {
    return () => {
      if (autosaveRef.current) clearTimeout(autosaveRef.current);
    };
  }, []);

  const cancelAutosave = () => {
    if (autosaveRef.current) {
      clearTimeout(autosaveRef.current);
      autosaveRef.current = null;
    }
  };

  const updateKept = useCallback((next: SaveAnswerRequest[]) => {
    keptRef.current = next;
    const onDevice = storeKeptAnswers(sid, next);
    setKept({ count: next.length, what: describeKept(next), onDevice });
  }, [sid]);

  const sendKept = useCallback((): Promise<SendResult> => {
    const pass = async (): Promise<SendResult> => {
      let sent = 0;
      let refused = 0;
      const refusedAnswers: SaveAnswerRequest[] = [];
      let reason = '';
      if (keptRef.current.length === 0) return { unsent: 0, refused };
      setSendingKept(true);
      for (const answer of [...keptRef.current]) {
        // Replaced by a newer pick, or saved directly, since this pass began.
        if (!keptRef.current.includes(answer)) continue;
        try {
          await saveExamAnswer(sid, answer);
          sent += 1;
        } catch (err) {
          if (isUnreachable(err)) break;
          refused += 1;
          if (answer.selected_option_ids.length > 0) refusedAnswers.push(answer);
          reason = apiErrorMessage(err, 'The server refused it.');
        }
        updateKept(keptRef.current.filter((k) => k !== answer));
      }
      setSendingKept(false);
      if (sent > 0 && keptRef.current.length === 0) setAllSent(true);
      if (refusedAnswers.length > 0) {
        const n = refusedAnswers.length;
        setNotRecorded(
          `${n === 1 ? 'One answer' : `${n} answers`} picked while the server could not be reached `
          + `${n === 1 ? 'was' : 'were'} not recorded. ${reason}`,
        );
      }
      return { unsent: keptRef.current.length, refused };
    };
    const run = sendChainRef.current.then(pass, pass);
    sendChainRef.current = run;
    return run;
  }, [sid, updateKept]);

  const fetchExam = useCallback(() => {
    if (isNaN(sid) || sid <= 0) return;
    setLoading(true);
    setFetchError(null);
    getExamDetails(sid)
      .then((detail) => {
        setExamDetail(detail);
        const map = new Map<number, number[]>();
        const flags = new Set<number>();
        const bookmarks = new Set<number>();
        const conf = new Map<number, ConfidenceLevel>();

        detail.answers.forEach((a) => {
          if (a.selected_option_ids?.length > 0) map.set(a.question_id, a.selected_option_ids);
          if (a.is_flagged) flags.add(a.question_id);
          if (a.is_bookmarked) bookmarks.add(a.question_id);
          if (a.confidence_level) conf.set(a.question_id, a.confidence_level);
        });

        // Answers kept on this device from a visit the server could not reach
        // are newer than the server's copy, so they are shown, and sent.
        const keptAnswers = readKeptAnswers(sid);
        const pending = detail.status === 'in_progress' ? keptAnswers : [];
        if (keptAnswers.length > 0 && pending.length === 0) {
          clearKeptAnswers(sid);
          setNotRecorded(
            `${answersWord(keptAnswers.length)} kept on this device could not be added: this paper had already been submitted.`,
          );
        }
        pending.forEach((a) => {
          if (a.selected_option_ids.length > 0) map.set(a.question_id, a.selected_option_ids);
          else map.delete(a.question_id);
          if (a.is_flagged) flags.add(a.question_id);
          else flags.delete(a.question_id);
          conf.set(a.question_id, a.confidence_level);
        });
        keptRef.current = pending;
        setKept({ count: pending.length, what: describeKept(pending), onDevice: true });

        setAnsweredMap(map);
        setFlaggedSet(flags);
        setBookmarkedSet(bookmarks);
        setConfidenceMap(conf);
        // Resume where the learner was. The server keeps the position with each
        // save; a reload used to put everyone back on question one.
        const last = Math.max(0, detail.questions.length - 1);
        const position = pending[pending.length - 1]?.current_question_index ?? detail.current_question_index ?? 0;
        setCurrentIdx(Math.min(Math.max(position, 0), last));
        if (pending.length > 0) void sendKept();
      })
      .catch((err) => {
        console.error(err);
        // Answers already given are saved as they are picked, so a paper that
        // will not load has lost nothing.
        setFetchError(loadFailed('Could not load this paper', err));
      })
      .finally(() => setLoading(false));
  }, [sid, sendKept]);

  useEffect(() => {
    fetchExam();
  }, [fetchExam]);

  // Answers persist on navigation, so everything except the question currently
  // on screen is already saved. Closing the tab mid-exam would silently drop
  // that one, and there's no way to recover it -- so warn first. Suppressed
  // once the exam is being submitted, where leaving is the expected outcome.
  useEffect(() => {
    const examInProgress = examDetail?.status === 'in_progress';
    if (!examInProgress || finishing) return;

    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Browsers ignore custom text now and show their own wording; assigning
      // returnValue is still what triggers the prompt at all.
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [examDetail?.status, finishing]);

  useEffect(() => {
    if (currentQuestion) {
      setSelectedOptionIds(answeredMap.get(currentQuestion.id) || []);
      setShowExplanation(isPracticeMode && (answeredMap.get(currentQuestion.id) || []).length > 0);
      setQuestionStartTime(Date.now());
    }
  }, [currentIdx, currentQuestion?.id]);


  const persistAnswer = useCallback(async (
    questionId: number,
    optIds: number[],
    overrideFlagged?: boolean,
    overrideBookmarked?: boolean,
    overrideConfidence?: ConfidenceLevel,
    position?: number,
  ) => {
    if (!examDetail) return;
    const timeSpent = Math.round((Date.now() - questionStartTimeRef.current) / 1000);

    const isFlaggedVal = overrideFlagged !== undefined ? overrideFlagged : flaggedSetRef.current.has(questionId);
    const isBookmarkedVal = overrideBookmarked !== undefined ? overrideBookmarked : bookmarkedSetRef.current.has(questionId);
    const confVal = overrideConfidence !== undefined ? overrideConfidence : (confidenceMapRef.current.get(questionId) || 'not_set');

    // Snapshot only this question's previous entry (via functional update) so a
    // failed save can't clobber other answers that were saved concurrently.
    let previousEntry: number[] | undefined;
    setAnsweredMap((prev) => {
      previousEntry = prev.get(questionId);
      const updated = new Map(prev);
      if (optIds.length > 0) {
        updated.set(questionId, optIds);
      } else {
        updated.delete(questionId);
      }
      return updated;
    });

    const answer: SaveAnswerRequest = {
      question_id: questionId,
      selected_option_ids: optIds,
      time_spent_seconds: timeSpent,
      confidence_level: confVal,
      is_flagged: isFlaggedVal,
      is_bookmarked: isBookmarkedVal,
      current_question_index: position ?? currentIdxRef.current,
    };

    // Never alongside a send of kept answers, or the older copy could land last.
    await sendChainRef.current;

    try {
      await saveExamAnswer(sid, answer);
      if (keptRef.current.some((k) => k.question_id === questionId)) {
        // This question's answer as it now stands is on the server; its older
        // kept copy must not be sent after it.
        updateKept(keptRef.current.filter((k) => k.question_id !== questionId));
      }
      setSaveError(null);
      // The server answered, so whatever is kept can go too.
      if (keptRef.current.length > 0) void sendKept();
    } catch (err) {
      console.error('Failed to save answer', err);
      const timeUp = remainingSeconds(examDetail.start_time, examDetail.time_allowed_seconds) === 0;
      // No answer at all: kept rather than undone. The pick on screen is the
      // learner's, and it is sent the moment the server answers.
      if (isUnreachable(err)) {
        setAllSent(false);
        updateKept(withAnswer(keptRef.current, answer));
        if (timeUp) handleTimeUpRef.current?.();
        return;
      }
      // A save refused because the clock has run out is not a network error.
      // The server enforces the limit; the paper is submitted with what was
      // saved in time, exactly as when the countdown reaches zero on screen.
      if (timeUp) {
        handleTimeUpRef.current?.();
        return;
      }
      setAnsweredMap((prev) => {
        const reverted = new Map(prev);
        if (previousEntry !== undefined) {
          reverted.set(questionId, previousEntry);
        } else {
          reverted.delete(questionId);
        }
        return reverted;
      });
      // Refused, not lost in transit: kept on screen until the next save works,
      // because a notice that vanishes is one a learner mid-question misses.
      setSaveError(`That answer was not saved. ${apiErrorMessage(err, 'The server refused it.')}`);
    }
  }, [examDetail, sid, updateKept, sendKept]);

  const handleSelectOption = useCallback((optionIds: number[]) => {
    if (!currentQuestion) return;
    setSelectedOptionIds(optionIds);
    // Saved without waiting for navigation, so a reload or a closed tab a
    // moment later keeps the answer that was on screen.
    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    const questionId = currentQuestion.id;
    autosaveRef.current = setTimeout(() => {
      autosaveRef.current = null;
      persistAnswer(questionId, optionIds);
    }, AUTOSAVE_MS);
  }, [currentQuestion, persistAnswer]);

  const goToIndex = async (targetIdx: number) => {
    cancelAutosave();
    if (currentQuestion) {
      await persistAnswer(currentQuestion.id, selectedOptionIds, undefined, undefined, undefined, targetIdx);
    }
    setCurrentIdx(targetIdx);
  };

  const handleNext = async () => {
    if (!currentQuestion) return;
    cancelAutosave();
    const staysForExplanation = isPracticeMode && selectedOptionIds.length > 0;
    const lastIdx = (examDetail?.questions.length ?? 1) - 1;
    const destination = staysForExplanation ? currentIdx : Math.min(currentIdx + 1, lastIdx);
    await persistAnswer(currentQuestion.id, selectedOptionIds, undefined, undefined, undefined, destination);
    if (isPracticeMode && selectedOptionIds.length > 0) {
      setShowExplanation(true);
      return;
    }
    if (examDetail && currentIdx < examDetail.questions.length - 1) {
      setCurrentIdx((i) => i + 1);
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) goToIndex(currentIdx - 1);
  };

  const handleToggleFlag = () => {
    if (!currentQuestion) return;
    const nextState = !flaggedSet.has(currentQuestion.id);
    setFlaggedSet((prev) => {
      const next = new Set(prev);
      if (nextState) next.add(currentQuestion.id);
      else next.delete(currentQuestion.id);
      return next;
    });
    persistAnswer(currentQuestion.id, selectedOptionIds, nextState, undefined, undefined);
  };

  // There is no handleToggleBookmark any more -- the control is gone from
  // QuestionView. `bookmarkedSet` is still loaded from the saved answers and
  // still sent back on every save, so a historical bookmark survives being
  // re-saved rather than being quietly cleared by the removal of its button.

  // The keyboard, for everything the buttons do except finishing: → never
  // submits the paper, however it is pressed.
  useShortcuts([
    {
      shortcut: EXAM_SHORTCUTS.chooseAnswer,
      run: (key) => {
        if (!currentQuestion || (isPracticeMode && showExplanation)) return;
        const option = currentQuestion.options[Number(key) - 1];
        if (!option || option.id === undefined) return;
        if (currentQuestion.question_type === 'multiple_choice') {
          handleSelectOption(selectedOptionIds.includes(option.id)
            ? selectedOptionIds.filter((id) => id !== option.id)
            : [...selectedOptionIds, option.id]);
        } else {
          handleSelectOption([option.id]);
        }
      },
    },
    { shortcut: EXAM_SHORTCUTS.previous, run: () => handlePrev() },
    {
      shortcut: EXAM_SHORTCUTS.next,
      run: () => {
        const last = (examDetail?.questions.length ?? 1) - 1;
        if (isPracticeMode && showExplanation) {
          if (currentIdx < last) {
            setShowExplanation(false);
            goToIndex(currentIdx + 1);
          }
          return;
        }
        if (currentIdx >= last) return;
        if (selectedOptionIds.length === 0 && !isPracticeMode) return;
        handleNext();
      },
    },
    { shortcut: EXAM_SHORTCUTS.flag, run: () => handleToggleFlag() },
  ], !!examDetail);

  const handleChangeConfidence = (lvl: ConfidenceLevel) => {
    if (!currentQuestion) return;
    setConfidenceMap((prev) => new Map(prev).set(currentQuestion.id, lvl));
    persistAnswer(currentQuestion.id, selectedOptionIds, undefined, undefined, lvl);
  };

  const saveAndExit = async () => {
    cancelAutosave();
    if (currentQuestion) {
      await persistAnswer(currentQuestion.id, selectedOptionIds);
    }
    navigate('/practice');
  };

  const nextAfterExplanation = () => {
    setShowExplanation(false);
    if (currentIdx < (examDetail?.questions.length ?? 1) - 1) goToIndex(currentIdx + 1);
  };

  const openFinishConfirm = async () => {
    cancelAutosave();
    if (currentQuestion) {
      await persistAnswer(currentQuestion.id, selectedOptionIds);
    }
    setConfirmFinish(true);
  };

  const handleFinish = async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    cancelAutosave();
    setFinishing(true);
    try {
      if (currentQuestion) {
        await persistAnswer(currentQuestion.id, selectedOptionIds);
      }
      // Not submitted without answers the learner believes are in the paper.
      const { unsent, refused } = await sendKept();
      if (unsent > 0 || refused > 0) {
        setConfirmFinish(false);
        if (unsent > 0) {
          const what = describeKept(keptRef.current);
          setSaveError(
            `${what.charAt(0).toUpperCase()}${what.slice(1)} ${what === answersWord(1) ? 'is' : 'are'} kept on this `
            + 'device but not on the server yet, so the paper was not submitted. Submit it again once the server answers.',
          );
        }
        finishingRef.current = false;
        setFinishing(false);
        return;
      }
      await finishExam(sid);
      setConfirmFinish(false);
      navigate(`/exam-review/${sid}`);
    } catch (err) {
      console.error(err);
      setSaveError('Failed to submit exam. Please try again.');
      // Re-arm only on failure. The user is still on the exam with unsaved
      // work and has to be able to retry, which needs both the re-entrancy
      // guard and `finishing` cleared.
      //
      // This used to sit in a `finally`, which also ran on success -- and on
      // success we are navigating away. Clearing `finishing` there re-runs
      // the unsaved-work effect, and if that state commit wins the race
      // against the unmount it re-attaches the beforeunload guard for an exam
      // that was just submitted, warning the user about work they already
      // saved. It lost that race often enough to fail the suite once the
      // machine was busy.
      finishingRef.current = false;
      setFinishing(false);
    }
  };

  const handleTimeUp = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    cancelAutosave();
    setFinishing(true);
    try {
      const q = currentQuestionRef.current;
      const opts = selectedOptionIdsRef.current;
      if (q) {
        await persistAnswer(q.id, opts);
      }
      // What the server refuses for lateness is reported, not waited on.
      await sendKept();
      await finishExam(sid);
      setTimeUpDialog(true);
    } catch (err) {
      console.error('Failed to auto-finish exam on time up', err);
      // Same rule as handleFinish -- and here it was never a race. The
      // time-up dialog keeps this component mounted, so clearing `finishing`
      // on the success path re-attached the beforeunload guard every single
      // time: the exam auto-submits when the clock runs out, and then closing
      // the tab warned about losing work the app had already saved.
      finishingRef.current = false;
      setFinishing(false);
    }
  }, [persistAnswer, sendKept, sid]);

  useEffect(() => { handleTimeUpRef.current = handleTimeUp; }, [handleTimeUp]);

  // The server is back: send what was kept -- or, if the time ran out while it
  // was away, submit the paper, which sends what was kept first.
  useEffect(() => {
    if (!examDetail || examDetail.status !== 'in_progress') return undefined;
    return connection.subscribe((state) => {
      if (state !== 'online' || finishingRef.current) return;
      if (remainingSeconds(examDetail.start_time, examDetail.time_allowed_seconds) === 0) {
        handleTimeUpRef.current?.();
      } else if (keptRef.current.length > 0) {
        void sendKept();
      }
    });
  }, [examDetail, sendKept]);

  const paletteAnswers = useMemo(() => {
    if (!examDetail) return [];
    return examDetail.question_ids_order.map((qid) => ({
      question_id: qid,
      selected_option_ids: answeredMap.get(qid) || [],
      is_flagged: flaggedSet.has(qid),
    }));
  }, [examDetail, answeredMap, flaggedSet]);

  if (isNaN(sid) || sid <= 0) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
        <Alert severity="error">Invalid Exam Session ID.</Alert>
      </Box>
    );
  }

  if (loading) return <LoadingState label="Loading this paper…" />;

  if (fetchError) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={fetchExam}>Retry</Button>}>
          {fetchError}
        </Alert>
      </Box>
    );
  }

  if (!examDetail) return <Alert severity="error">Exam session not found.</Alert>;

  // A submitted paper is not sat again. Opened here -- from history, a bookmark,
  // the back button -- it used to draw the paper with a clock already at zero,
  // which "ran out" on arrival: the Time is Up dialog, and a save and a finish
  // sent for a paper the server had long since closed.
  if (examDetail.status === 'completed') {
    return (
      <Box>
        <PageHead
          eyebrow={examDetail.title}
          title="This paper has been submitted"
          sub="A submitted paper cannot be changed. Its score and every answer are in its review."
          actions={(
            <Button component={RouterLink} to={`/exam-review/${sid}`} variant="contained" color="ink">
              See the results
            </Button>
          )}
        />
        {notRecorded && <Alert severity="warning">{notRecorded}</Alert>}
      </Box>
    );
  }

  const totalQ = examDetail.questions.length;
  const answeredCount = answeredMap.size;
  const flaggedCount = flaggedSet.size;
  const isLast = currentIdx === totalQ - 1;
  const flagged = !!currentQuestion && flaggedSet.has(currentQuestion.id);
  const revealed = isPracticeMode && showExplanation;
  const timed = !isPracticeMode && examDetail.time_allowed_seconds != null;
  const paletteId = `palette-${sid}`;

  // The prototype's runner: the question number is the page's title, and every
  // control is in the head. Practice checks each answer before moving on, so
  // its main button says which of the two it will do.
  const primary = isPracticeMode
    ? revealed
      ? isLast
        ? { label: 'Finish', onClick: openFinishConfirm }
        : { label: 'Next', onClick: nextAfterExplanation }
      : selectedOptionIds.length > 0
        ? { label: 'Check answer', onClick: handleNext }
        : isLast
          ? { label: 'Finish', onClick: openFinishConfirm }
          : { label: 'Next', onClick: handleNext }
    : { label: 'Finish', onClick: openFinishConfirm };

  return (
    <Box>
      <PageHead
        eyebrow={examDetail.title}
        title={`Question ${currentIdx + 1} of ${totalQ}`}
        actions={(
          <>
            {timed && (
              <ExamTimer
                startTime={examDetail.start_time}
                timeAllowedSeconds={examDetail.time_allowed_seconds ?? undefined}
                onTimeUp={handleTimeUp}
                soundEnabled={timerSound}
              />
            )}
            {isPracticeMode && (
              <Button variant="outlined" onClick={saveAndExit}>Save &amp; exit</Button>
            )}
            <Button
              variant="outlined"
              aria-expanded={paletteOpen}
              aria-controls={paletteId}
              onClick={() => setPaletteOpen((open) => !open)}
            >
              {paletteOpen ? 'Hide questions' : 'Questions'}
            </Button>
            <Button
              variant={flagged ? 'contained' : 'outlined'}
              aria-pressed={flagged}
              onClick={handleToggleFlag}
              disabled={!currentQuestion}
            >
              {flagged ? 'Flagged' : 'Flag'}
            </Button>
            <Button variant="outlined" onClick={handlePrev} disabled={currentIdx === 0}>Back</Button>
            {!isPracticeMode && (
              <Button variant="outlined" onClick={handleNext} disabled={isLast || !currentQuestion}>Next</Button>
            )}
            <Button variant="contained" color="ink" onClick={primary.onClick} disabled={!currentQuestion}>
              {primary.label}
            </Button>
          </>
        )}
      >
        {isPracticeMode ? (
          // One segment a question, filled once it is answered.
          <Box
            role="img"
            aria-label={`${answeredCount} of ${totalQ} answered`}
            sx={{ display: 'flex', gap: '7px', flexWrap: 'wrap', mb: '6px' }}
          >
            {examDetail.question_ids_order.map((qid, i) => (
              <Box
                key={`${qid}-${i}`}
                sx={{
                  flex: '0 1 52px', minWidth: 8, height: 5, borderRadius: '8px',
                  bgcolor: answeredMap.has(qid) ? 'primary.main' : 'pb.track',
                }}
              />
            ))}
          </Box>
        ) : (
          <Detail>
            {answeredCount} answered · {flaggedCount} flagged · {totalQ - answeredCount} remaining
          </Detail>
        )}
        {/* Only once something was kept: every answer is otherwise saved as it
            is picked, and a "Saved" beside each one is noise. */}
        {(kept.count > 0 || allSent) && (
          <Box sx={{ mt: '8px' }}>
            <SaveStatus
              state={kept.count === 0 ? 'synced' : sendingKept ? 'pending_sync' : kept.onDevice ? 'saved_locally' : 'offline'}
              detail={kept.count === 0
                ? 'every answer is on the server'
                : sendingKept
                  ? `sending ${kept.what}`
                  : kept.onDevice
                    ? `${kept.what} not on the server yet`
                    : `${kept.what} held in this tab only, so closing it loses them`}
            />
          </Box>
        )}
      </PageHead>

      {saveError && <Alert severity="error" sx={{ mt: '10px' }}>{saveError}</Alert>}
      {notRecorded && <Alert severity="warning" sx={{ mt: '10px' }} onClose={() => setNotRecorded(null)}>{notRecorded}</Alert>}

      {paletteOpen && (
        <QuestionPalette
          id={paletteId}
          totalQuestions={totalQ}
          currentIndex={currentIdx}
          questionIdsOrder={examDetail.question_ids_order}
          answers={paletteAnswers}
          onSelectIndex={(idx) => goToIndex(idx)}
        />
      )}

      <Panel component="section" aria-label={`Question ${currentIdx + 1}`} sx={{ mt: '14px', maxWidth: 900 }}>
        {currentQuestion ? (
          <>
            <QuestionView
              question={currentQuestion}
              selectedOptionIds={selectedOptionIds}
              onSelectOption={handleSelectOption}
              confidenceLevel={confidenceMap.get(currentQuestion.id) || 'not_set'}
              onChangeConfidence={handleChangeConfidence}
              revealed={revealed}
            />
            {revealed && (
              <ExplanationDrawer question={currentQuestion} selectedOptionIds={selectedOptionIds} />
            )}
          </>
        ) : (
          <Alert severity="warning">No questions loaded.</Alert>
        )}
      </Panel>

      {/* Finish Confirm Dialog */}
      <Dialog open={confirmFinish} onClose={() => setConfirmFinish(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Submit this paper?</DialogTitle>
        <DialogContent>
          <Typography>
            You have answered {answeredCount} of {totalQ} questions.
            {answeredCount < totalQ && (
              <Box component="span" sx={{ color: 'pb.warning', fontWeight: 700 }}>
                {' '}({totalQ - answeredCount} unanswered)
              </Box>
            )} Are you sure you want to submit?
          </Typography>
          {flaggedSet.size > 0 && (
            <Typography variant="body2" sx={{ mt: 1.5, color: 'text.secondary' }}>
              {flaggedSet.size} flagged for another look. Flags are not answers: a flagged
              question you left blank scores zero.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setConfirmFinish(false)}>Keep going</Button>
          <Button
            variant="contained"
            color="ink"
            onClick={handleFinish}
            disabled={finishing}
            startIcon={finishing ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {finishing ? 'Submitting…' : 'Yes, submit'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Time Up Dialog */}
      <Dialog open={timeUpDialog} onClose={() => navigate(`/exam-review/${sid}`)} maxWidth="xs" fullWidth>
        <DialogTitle>Time is up</DialogTitle>
        <DialogContent>
          <Typography>
            Your time for this exam session has expired. The paper has been submitted with every answer saved in time.
          </Typography>
          {notRecorded && (
            <Typography variant="body2" sx={{ mt: 1.5, color: 'warning.main' }}>{notRecorded}</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" color="ink" onClick={() => navigate(`/exam-review/${sid}`)}>
            See the results
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
