// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { FactoryCoupling } from '../lakehouse/factoryCouplings';
import type { LeverChange, Track } from './attempts';

/**
 * What one ADF Behaviour Lab experiment (or one fault mode of one) gives the shared runner
 * (components/adfLab/ExperimentRunner.tsx). The runner owns the eight stages, the attempts and
 * the screen; a definition owns only the model and the questions it asks of it.
 *
 * Every answer the runner grades comes from `run`:
 *   Predict  -- the prediction is right when it equals the scenario run's `outcome`;
 *   Reason   -- a cause is right when the scenario run has a `problem` finding with that id;
 *   Apply    -- an option is right when `apply.correct` holds for the run of its levers.
 * A definition never decides an answer by itself; it only chooses what to ask.
 *
 * `run` and `contextNote` are methods so that every definition, whatever its context, can sit
 * in one list as an ExperimentDefinition<unknown>.
 */

/** A lever's value is one of the model's own: a setting, a number, on or off, or none. */
export type LeverValue = string | number | boolean | null;
export type Levers = Record<string, LeverValue>;

export interface LeverSpec {
  key: string;
  label: string;
  options: { value: LeverValue; label: string }[];
}

/** A figure the model reports for a run; numbers carry their unit. */
export interface Measure {
  label: string;
  value: number | string;
  unit?: string;
}

export interface Finding {
  /** The coupling-ledger entry the finding rests on. */
  ledgerId: string;
  text: string;
  tone: 'problem' | 'ok' | 'info';
}

/** One run of the model, in the runner's terms. */
export interface ModelRun {
  /** One of `predict.options`' ids: the run's result as the prediction asks about it. */
  outcome: string;
  /** What the run shows, by stable key (the keys of the `observed` record). */
  measures: Record<string, Measure>;
  findings: Finding[];
}

export interface Option { id: string; text: string }

export interface ExperimentDefinition<C = unknown> {
  track: Track;
  /** Prefix for element ids on the page. */
  idPrefix: string;
  /** What the model runs on, as recorded in each attempt's fingerprint. */
  model: string;
  /** Anything the model needs that is fetched (pack data); resolves at once for a model with none. */
  loadContext: () => Promise<C>;
  /** Extra provenance to show beside the simulation notice (the pack's own note, say). */
  contextNote?(c: C): string | undefined;
  understand: string;
  preset: Levers;
  levers: LeverSpec[];
  /** What is held still, and why, said beside the levers. */
  heldNote: string;
  run(c: C, levers: Levers): ModelRun;
  predict: { prompt: string; options: Option[] };
  reason: { prompt: string; options: Option[] };
  apply: {
    prompt: string;
    options: (Option & { levers: Levers })[];
    /**
     * Right when this run meets the changed constraint. `all` is every option's run, in option
     * order, for a constraint that is relative ("the cheapest that meets the deadline").
     */
    correct: (r: ModelRun, all: ModelRun[]) => boolean;
    right: string;
    wrong: string;
  };
  explainLabel: string;
  retrieve: { prompt: string; options: Option[]; answer: string; source: { chapter: string; quote: string } };
  couplings: FactoryCoupling[];
  ledgerIntro: string;
}

/** What differs from the scenario, as the server's `manipulation` record. Empty when nothing does. */
export function changesFrom(from: Levers, to: Levers): LeverChange {
  const out: LeverChange = {};
  for (const k of Object.keys(from)) {
    if (from[k] !== to[k]) out[k] = { from: asRecorded(from[k]), to: asRecorded(to[k]) };
  }
  return out;
}
const asRecorded = (v: LeverValue): string | number | null => (typeof v === 'boolean' ? (v ? 'on' : 'off') : v);

/** The scenario against the learner's run, in the `observed` shape the platform reads. */
export function observationOf(preset: ModelRun, mine: ModelRun): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, m] of Object.entries(preset.measures)) {
    const after = mine.measures[key]?.value;
    out[key] = typeof m.value === 'number'
      ? { label: m.label, before: m.value, after, unit: m.unit ?? '', precision: 0 }
      : { label: m.label, before: m.value, after };
  }
  return out;
}

/** The scenario's causes, by the model: the ledger ids of its problem findings. */
export const causesOf = (r: ModelRun): string[] =>
  [...new Set(r.findings.filter((f) => f.tone === 'problem').map((f) => f.ledgerId))];
