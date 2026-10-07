// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { WireLearningAttempt } from '../../types/learning';
import type { StageAttempt } from './attempts';
import { LAB_STAGES } from './experiments';

/**
 * The PrepBench learning loop, the same eight stages in every ADF Behaviour Lab experiment.
 * Evidence is not a stage: it is what the recorded attempts already are.
 */
export const STAGES = LAB_STAGES;
export type Stage = typeof STAGES[number];

/** Past the last stage: the run is complete. */
export const COMPLETE = STAGES.length;

/**
 * Where a run is, read from what the server holds for it. Two things are not on the server and
 * do not need to be: having read the Understand stage, and having run the model this visit
 * (a reload after committing comes back to Manipulate, with the prediction still committed).
 */
export function stageOf(
  rows: Partial<Record<StageAttempt, WireLearningAttempt>>,
  local: { understood: boolean; ran: boolean },
): number {
  const predict = rows.predict;
  if (!predict?.committed_at) return local.understood ? 1 : 0;
  if (!predict.completed_at) return local.ran ? 3 : 2;
  if (!rows.reason?.completed_at) return 4;
  if (!rows.apply?.completed_at) return 5;
  if (!predict.explanation_text?.trim()) return 6;
  if (!rows.retrieve?.completed_at) return 7;
  return COMPLETE;
}
