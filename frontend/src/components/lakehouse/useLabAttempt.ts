// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { WireLearningAttempt } from '../../types/learning';
import { apiErrorMessage } from '../../services/apiError';
import {
  commitLabPrediction, completeLabSimulation, fetchLabAttempts, findLabAttempt, labAttemptUid, openLabAttempt,
  saveLabExplanation,
  type LabChallengeRef,
} from '../../services/lakehouse/attempts';

/**
 * One lab challenge's attempt: loaded from the server, with the three things a simulation
 * station does to it: commit a prediction (write-once, enforced by the server), close it with
 * the outcome the model worked out, and keep the learner's own acceptance criteria.
 *
 * `attempt` is `undefined` while loading, `null` when this learner has none yet.
 */
export function useLabAttempt(
  pack: { id: string; version: number },
  subjectId: number | undefined,
  challenge: LabChallengeRef,
) {
  const [attempt, setAttempt] = useState<WireLearningAttempt | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);

  const key = useMemo(
    () => ({ subjectId, packId: pack.id, packVersion: pack.version, challenge }),
    [subjectId, pack.id, pack.version, challenge],
  );
  // The id the attempt really has: a later generation when a deleted preparation's attempt held the first.
  const uid = attempt?.attempt_uid ?? labAttemptUid(key);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    fetchLabAttempts(subjectId)
      .then((list) => { if (!cancelled) setAttempt(findLabAttempt(list, key) ?? null); })
      .catch((err) => { if (!cancelled) setLoadError(apiErrorMessage(err, 'Could not load your lab attempts.')); });
    return () => { cancelled = true; };
  }, [subjectId, key, reload]);

  /**
   * Commit the prediction, then close the attempt with the outcome. The two are separate
   * requests, and the server's copy decides: if either fails, what it holds is re-read.
   * Resolves to whether it all landed.
   */
  const commit = useCallback(async (
    prediction: string, outcome: { correct: boolean; observed: Record<string, unknown> },
  ): Promise<boolean> => {
    setCommitting(true);
    setCommitError(null);
    try {
      const opened = await openLabAttempt(key);
      await commitLabPrediction(subjectId, opened.attempt_uid, prediction);
      setAttempt(await completeLabSimulation(subjectId, opened.attempt_uid, outcome.correct, outcome.observed));
      return true;
    } catch (err) {
      setCommitError(apiErrorMessage(err, 'Your prediction could not be saved.'));
      setReload((n) => n + 1);
      return false;
    } finally {
      setCommitting(false);
    }
  }, [subjectId, key]);

  /** The learner's own acceptance criteria. Their words, never graded. */
  const saveCriteria = useCallback(async (text: string) => {
    setAttempt(await saveLabExplanation(subjectId, uid, text));
  }, [subjectId, uid]);

  return {
    uid, attempt, loadError, retry: () => setReload((n) => n + 1),
    committed: Boolean(attempt?.committed_at), committing, commitError, commit, saveCriteria, setAttempt,
  };
}
