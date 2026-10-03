// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

// Station A's model: an ADF + Lakeflow Jobs pipeline loading one batch (PRD P0-6, design §4.7).
//
// Pure functions, no randomness, no clock. It works on the pack's REAL source index
// (every source row's id, when it changed, whether it is deleted, and which batch it
// arrives in), so the rows it says were lost or duplicated are real ids. Its output,
// the batch manifest, is what Station C writes into a real Delta table, and what the
// real engine then measures: an upstream mistake becomes real rows in a real table.
//
// What it models, in one paragraph. A batch's rows arrive as ten equal files. A trigger
// decides when the pipeline runs and over which rows; an incremental load copies the rows
// newer than a stored watermark. One injected failure interrupts the copy part-way. When
// the watermark moves (before the copy, when it succeeds, or when it completes, which
// includes failing) and whether the copy is retried decide whether the interrupted rows
// are lost or written twice; the sink decides whether a repeat is harmless. Late and
// out-of-order files, and rows deleted at the source, are the cases a watermark cannot see.
//
// Everything it assumes is a typed entry in pipelineCouplings.ts, and shown on screen.

export type LoadKind = 'incremental' | 'full';
export type WatermarkTiming = 'before' | 'success' | 'completion';
export type Sink = 'append' | 'upsert';
export type TriggerKind = 'schedule' | 'tumbling' | 'event';
export type DeleteHandling = 'watermark-only' | 'soft-delete-flag';
export type Owner = 'adf' | 'lakeflow';

export interface AdfLevers {
  load: LoadKind;
  watermark: WatermarkTiming;
  sink: Sink;
  trigger: TriggerKind;
  /** How many times the copy is retried after the injected failure. */
  retries: 0 | 1 | 2 | 3;
  /** Where in the copy the one injected failure happens, as a percentage; null for none. */
  failureAtPercent: number | null;
  /** One file arrives after the run. */
  lateFile: boolean;
  /** Two files arrive in the wrong order. */
  outOfOrder: boolean;
  deletes: DeleteHandling;
  owners: { externalFeed: Owner; jobDependency: Owner };
}

/** The upstream a station that runs on its own assumes: nothing goes wrong. */
export const DEFAULT_LEVERS: AdfLevers = {
  load: 'incremental', watermark: 'success', sink: 'append', trigger: 'schedule', retries: 0,
  failureAtPercent: null, lateFile: false, outOfOrder: false, deletes: 'soft-delete-flag',
  owners: { externalFeed: 'adf', jobDependency: 'lakeflow' },
};

export interface SourceRow {
  id: number;
  modifiedAt: string;
  deleted: boolean;
  batch: number | null;
}

export interface AdfConfig {
  table: string;
  windowBatch: number;
  filesPerWindow: number;
  lateFileIndex: number;
  outOfOrderPair: [number, number];
  defaultFailurePercent: number;
  orchestration: Record<'externalFeed' | 'jobDependency', { label: string; correctOwner: Owner; why: string }>;
}

export type ParsedAdf = { ok: true; config: AdfConfig } | { ok: false; reason: string };

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const OWNERS: Owner[] = ['adf', 'lakeflow'];

/** The pack's ADF content, checked. A pack without it gets a reason, not a guessed model. */
export function parseAdf(pipeline: unknown): ParsedAdf {
  const fail = (reason: string): ParsedAdf => ({ ok: false, reason });
  if (!isObj(pipeline) || !isObj(pipeline.adf)) return fail('The pack has no pipeline content for Station A.');
  const a = pipeline.adf;
  const windowBatch = num(a.window_batch);
  const files = num(a.files_per_window);
  const late = num(a.late_file_index);
  const failure = num(a.default_failure_percent);
  const pair = a.out_of_order_pair;
  if (typeof a.table !== 'string' || windowBatch === null || windowBatch < 2 || files === null || files < 2
    || late === null || late < 0 || late >= files || failure === null || failure <= 0 || failure >= 100
    || !Array.isArray(pair) || pair.length !== 2 || pair.some((p) => num(p) === null || (p as number) < 0 || (p as number) >= files)
    || pair[0] === pair[1]) {
    return fail('The pack’s Station A settings are incomplete.');
  }
  const orch = a.orchestration;
  if (!isObj(orch)) return fail('The pack says nothing about who owns which trigger.');
  const entry = (key: string) => {
    const e = orch[key];
    return isObj(e) && typeof e.label === 'string' && typeof e.why === 'string' && OWNERS.includes(e.correct_owner as Owner)
      ? { label: e.label, correctOwner: e.correct_owner as Owner, why: e.why } : null;
  };
  const externalFeed = entry('external_feed');
  const jobDependency = entry('job_dependency');
  if (!externalFeed || !jobDependency) return fail('The pack’s orchestration entries are incomplete.');
  return {
    ok: true,
    config: {
      table: a.table, windowBatch, filesPerWindow: files, lateFileIndex: late,
      outOfOrderPair: [pair[0] as number, pair[1] as number], defaultFailurePercent: failure,
      orchestration: { externalFeed, jobDependency },
    },
  };
}

// ---- the manifest ---------------------------------------------------------------------

export type FindingId =
  | 'incremental-scope' | 'append-repeats' | 'watermark-timing' | 'transient-failure' | 'late-file' | 'out-of-order'
  | 'tumbling-reruns' | 'event-per-file' | 'delete-invisible' | 'owner-effects' | 'recovery-run';

export interface Finding {
  /** The coupling-ledger entry this finding rests on. */
  ledgerId: FindingId;
  text: string;
  tone: 'problem' | 'ok' | 'info';
}

export interface PipelineStep {
  id: 'lookup' | 'copy' | 'job' | 'update';
  label: string;
  detail: string;
  owner: Owner;
}

/** What the window holds once the load, and its retry or next run, has happened. */
export interface BatchManifest {
  batch: number;
  /** The ids the window should add. */
  expected: number[];
  /** The ids the load writes into bronze, in order. A repeated id is written twice. */
  landing: number[];
  /** How Station C writes them: an upsert collapses a repeat, an append keeps it. */
  write: 'append' | 'merge';
  missed: number[];
  /** Ids stored more than once in the destination, after this load. */
  duplicated: number[];
  /** Rows stored beyond one per id. */
  duplicateWrites: number;
  /** Rows deleted at the source that the destination still holds. */
  staleDeletes: number[];
  /** Ids that arrive after the run, and are not lost yet (a full load picks them up next time). */
  pendingLate: number[];
  watermark: { before: number; after: number };
  steps: PipelineStep[];
  findings: Finding[];
  /** Orchestration choices that don't match who owns what. */
  orchestrationIssues: string[];
  /** The levers this was run with. */
  levers: AdfLevers;
}

export const FILES = (config: AdfConfig, window: number[]) => {
  const size = Math.ceil(window.length / config.filesPerWindow);
  return Array.from({ length: config.filesPerWindow }, (_, i) => window.slice(i * size, (i + 1) * size));
};

/** "1601–2000", or "1, 5–9, 12": ids as the compact ranges a person reads. */
export function ranges(ids: number[]): string {
  const sorted = [...new Set(ids)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length;) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j += 1;
    parts.push(j === i ? String(sorted[i]) : j === i + 1 ? `${sorted[i]}, ${sorted[j]}` : `${sorted[i]}–${sorted[j]}`);
    i = j + 1;
  }
  return parts.length > 6 ? `${parts.slice(0, 6).join(', ')} and ${parts.length - 6} more ranges` : parts.join(', ');
}

interface Unit {
  rows: number[];
  /** Whether the stored watermark decides which of these rows are copied. */
  watermarked: boolean;
}

const maxOf = (ids: number[]) => ids.reduce((m, id) => Math.max(m, id), 0);

/** Run one load. Deterministic: the same index and levers always give the same manifest. */
export function runPipeline(config: AdfConfig, index: SourceRow[], levers: AdfLevers): BatchManifest {
  const B = config.windowBatch;
  const byId = (a: SourceRow, b: SourceRow) => a.id - b.id;
  const window = index.filter((r) => r.batch === B).sort(byId).map((r) => r.id);
  const prior = index.filter((r) => r.batch !== null && r.batch < B).sort(byId).map((r) => r.id);
  if (window.length === 0) throw new Error(`The source index has no rows in batch ${B}.`);
  const deleted = new Set(index.filter((r) => r.deleted).map((r) => r.id));
  const wm0 = prior.length ? maxOf(prior) : 0;

  // The window arrives as files. One may be late; two may swap places.
  const files = FILES(config, window);
  const lateIdx = levers.lateFile ? config.lateFileIndex : -1;
  const order = files.map((_, i) => i);
  if (levers.outOfOrder) {
    const [x, y] = config.outOfOrderPair;
    [order[x], order[y]] = [order[y], order[x]];
  }
  const presentFiles = order.filter((i) => i !== lateIdx);
  const lateIds = lateIdx >= 0 ? files[lateIdx] : [];
  const presentRows = [...presentFiles].sort((a, b) => a - b).flatMap((i) => files[i]);

  // ---- who runs, over what ---------------------------------------------------------------
  const full = levers.trigger === 'schedule' && levers.load === 'full';
  const units: Unit[] = [];
  if (levers.trigger === 'schedule') {
    units.push({ rows: full ? [...prior, ...presentRows] : presentRows, watermarked: !full });
  } else if (levers.trigger === 'tumbling') {
    units.push({ rows: presentRows, watermarked: false });
    if (lateIdx >= 0) units.push({ rows: window, watermarked: false });
  } else {
    // Each run queries the source for everything newer than the watermark among the rows that
    // have arrived by then: its own file, and anything an earlier failed run left behind.
    const arrived: number[] = [];
    for (const i of lateIdx >= 0 ? [...presentFiles, lateIdx] : presentFiles) {
      arrived.push(...files[i]);
      units.push({ rows: [...arrived].sort((a, b) => a - b), watermarked: true });
    }
  }
  // A failed tumbling window is re-run as a whole window by the trigger itself.
  const retries = levers.trigger === 'tumbling' ? Math.max(levers.retries, 1) : levers.retries;

  const scopeOf = (unit: Unit, wm: number) => (unit.watermarked ? unit.rows.filter((id) => id > wm) : unit.rows);

  // First pass, with no failure: how many rows each unit copies, to place the failure.
  let dryWm = wm0;
  const dryTotals = units.map((unit) => {
    const scope = scopeOf(unit, dryWm);
    if (unit.watermarked && scope.length) dryWm = Math.max(dryWm, maxOf(scope));
    return scope.length;
  });
  const total = dryTotals.reduce((a, b) => a + b, 0);
  const failureAt = levers.failureAtPercent === null ? -1 : Math.floor((total * levers.failureAtPercent) / 100);
  let failUnit = -1;
  let failOffset = 0;
  if (failureAt >= 0) {
    let acc = 0;
    for (let u = 0; u < dryTotals.length; u += 1) {
      if (failureAt < acc + dryTotals[u] || u === dryTotals.length - 1) {
        failUnit = u;
        failOffset = Math.min(Math.max(failureAt - acc, 0), dryTotals[u]);
        break;
      }
      acc += dryTotals[u];
    }
  }

  // ---- the run -------------------------------------------------------------------------
  const landing: number[] = [];
  const findings: Finding[] = [];
  let wm = wm0;
  let unrecovered = false;
  let failedRows = 0;

  units.forEach((unit, u) => {
    const scope = scopeOf(unit, wm);
    const advance = () => { if (unit.watermarked && scope.length) wm = Math.max(wm, maxOf(scope)); };
    if (levers.watermark === 'before' && unit.watermarked && scope.length) wm = Math.max(wm, maxOf(scope));

    if (u === failUnit && levers.failureAtPercent !== null) {
      const partial = scope.slice(0, failOffset);
      landing.push(...partial);
      failedRows = partial.length;
      if (retries > 0) {
        landing.push(...scope);
        advance();
      } else {
        unrecovered = true;
        if (levers.watermark === 'completion') advance();
      }
    } else {
      landing.push(...scope);
      if (levers.watermark !== 'before') advance();
    }
  });

  // The next run, picking up whatever a failed one left behind: rows past the stored
  // watermark, up to the end of this window, that are present by then.
  const watermarkedRun = levers.trigger !== 'tumbling' && !full;
  if (unrecovered) {
    const next = watermarkedRun
      ? window.filter((id) => id > wm)
      : full ? [...prior, ...window] : window;
    landing.push(...next);
    if (watermarkedRun && next.length) wm = Math.max(wm, maxOf(next));
  }

  // ---- what the destination holds ---------------------------------------------------------
  const expected = window;
  const landed = new Set(landing);
  const pendingLate = full ? lateIds.filter((id) => !landed.has(id)) : [];
  const missed = expected.filter((id) => !landed.has(id) && !pendingLate.includes(id));
  const counts = new Map<number, number>();
  for (const id of prior) counts.set(id, (counts.get(id) ?? 0) + 1);
  const stored = levers.sink === 'upsert' ? [...new Set(landing)] : landing;
  for (const id of stored) counts.set(id, levers.sink === 'upsert' ? 1 : (counts.get(id) ?? 0) + 1);
  const duplicated = [...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id).sort((a, b) => a - b);
  const duplicateWrites = [...counts.values()].reduce((s, n) => s + Math.max(n - 1, 0), 0);
  const staleDeletes = levers.deletes === 'watermark-only'
    ? [...counts.keys()].filter((id) => deleted.has(id)).sort((a, b) => a - b) : [];

  // ---- the steps, in the order they run -----------------------------------------------------
  const jobOwner = levers.owners.jobDependency;
  const lookup: PipelineStep = {
    id: 'lookup', label: 'Lookup watermark', owner: 'adf',
    detail: levers.trigger === 'tumbling' ? 'A tumbling window needs none: the window is the scope.' : `last = id ${wm0}`,
  };
  const copy: PipelineStep = {
    id: 'copy', label: 'Copy', owner: levers.owners.externalFeed === 'adf' ? 'adf' : 'lakeflow',
    detail: `through a self-hosted integration runtime from on-prem MES, ${levers.sink === 'upsert' ? 'upserted on the key' : 'appended'}`,
  };
  const job: PipelineStep = { id: 'job', label: 'Run job', owner: jobOwner, detail: 'bronze to silver' };
  const update: PipelineStep = {
    id: 'update', label: 'Update watermark', owner: 'adf',
    detail: levers.watermark === 'before' ? 'before any row is copied'
      : levers.watermark === 'success' ? 'on the copy’s success exit only'
        : 'on the copy’s completion exit, which also runs when it fails',
  };
  const steps = levers.watermark === 'before' ? [lookup, update, copy, job] : [lookup, copy, job, update];

  // ---- what happened, and why --------------------------------------------------------------
  const add = (ledgerId: FindingId, text: string, tone: Finding['tone'] = 'info') => findings.push({ ledgerId, text, tone });
  const incremental = levers.trigger === 'schedule' && levers.load === 'incremental';

  if (levers.failureAtPercent !== null) {
    add('transient-failure', `The copy fails ${levers.failureAtPercent}% of the way through, after ${failedRows} row${failedRows === 1 ? '' : 's'} had been written.`);
    if (retries > 0) {
      add('transient-failure', `It is retried and succeeds, so it copies its rows again: ${levers.sink === 'append'
        ? `the ${failedRows} rows written before the failure are now there twice.`
        : 'an upsert on the key leaves one row for each id.'}`, levers.sink === 'append' && failedRows > 0 ? 'problem' : 'ok');
    } else if (levers.trigger !== 'tumbling') {
      const afterwards = levers.watermark === 'success'
        ? `The watermark did not move, so the next run starts from the old one and copies this window again: ${levers.sink === 'append' ? 'the rows already written are written twice.' : 'an upsert on the key leaves one row for each id.'}`
        : `The watermark moved ${levers.watermark === 'before' ? 'before the copy' : 'on the completion exit, which runs even when the copy fails'}, so the next run starts after rows it never copied: ${missed.length} row${missed.length === 1 ? ' is' : 's are'} lost (ids ${ranges(missed)}). No destination setting can bring them back.`;
      add('watermark-timing', afterwards, levers.watermark === 'success' ? (levers.sink === 'append' && duplicateWrites > 0 ? 'problem' : 'ok') : 'problem');
      add('recovery-run', 'What is shown is the window after the next run has picked up what the failure left.');
    }
  }
  if (levers.trigger === 'tumbling') {
    add('tumbling-reruns', lateIdx >= 0
      ? 'The late file triggers a re-run of its whole window, so every row is copied again.'
      : 'A tumbling window copies its own window and re-runs the whole window if it fails, so the watermark and the load type do not apply.', lateIdx >= 0 && levers.sink === 'append' ? 'problem' : 'info');
  }
  if (levers.trigger === 'event') {
    add('event-per-file', 'An event trigger runs once for each file that lands, each run using the stored watermark.');
  }
  if (lateIds.length) {
    if (full) {
      add('late-file', `A file of ${lateIds.length} rows arrives after the run. A full load copies everything again next time, so it is picked up then.`);
    } else if (levers.trigger === 'tumbling') {
      add('late-file', `A file of ${lateIds.length} rows arrives after the window closed.`);
    } else if (missed.some((id) => lateIds.includes(id))) {
      add('late-file', `A file of ${lateIds.length} rows arrives after the run. Its rows are older than the watermark that run stored, so no later incremental run will ever copy them (ids ${ranges(lateIds)}).`, 'problem');
    }
  }
  if (levers.outOfOrder) {
    const [x, y] = config.outOfOrderPair;
    const lost = files[x].filter((id) => !landed.has(id));
    add('out-of-order', levers.trigger === 'event' && lost.length
      ? `File ${y + 1} lands before file ${x + 1}. The watermark moved past file ${x + 1}'s rows when file ${y + 1} loaded, so they are skipped (${lost.length} rows, ids ${ranges(lost)}).`
      : `Files ${x + 1} and ${y + 1} land in the wrong order. ${levers.trigger === 'schedule' ? 'A scheduled run waits for the window, so the order does not matter here.' : 'This trigger does not depend on the order.'}`,
    levers.trigger === 'event' && lost.length ? 'problem' : 'ok');
  }
  if (full) {
    add('incremental-scope', `A full load copies every row up to this batch each time: ${prior.length.toLocaleString('en-GB')} rows from earlier batches are copied again${levers.sink === 'append' ? ' and stored twice' : ', and an upsert on the key keeps one of each'}.`, levers.sink === 'append' ? 'problem' : 'ok');
  } else if (incremental) {
    add('incremental-scope', `An incremental load copies only rows newer than the watermark (id ${wm0}), so earlier batches are not touched.`);
  }
  const explained = findings.some((f) => f.tone === 'problem' && ['transient-failure', 'watermark-timing', 'tumbling-reruns', 'incremental-scope'].includes(f.ledgerId));
  if (levers.sink === 'append' && duplicateWrites > 0 && !explained) {
    add('append-repeats', `An append writes every row it is given, so ${duplicateWrites.toLocaleString('en-GB')} repeated row${duplicateWrites === 1 ? ' is' : 's are'} stored twice.`, 'problem');
  }
  if (staleDeletes.length) {
    add('delete-invisible', `${staleDeletes.length} row${staleDeletes.length === 1 ? ' that was' : 's that were'} deleted at the source ${staleDeletes.length === 1 ? 'is' : 'are'} still in the destination: a watermark only sees rows that changed, and a deleted row is gone, not changed. Handle deletes with a soft-delete flag or a MERGE (Station C).`, 'problem');
  } else if (levers.deletes === 'soft-delete-flag') {
    add('delete-invisible', 'Deleted rows carry a soft-delete flag the pipeline applies, so none is left behind.', 'ok');
  }

  const orchestrationIssues: string[] = [];
  (['externalFeed', 'jobDependency'] as const).forEach((key) => {
    const o = config.orchestration[key];
    if (levers.owners[key] !== o.correctOwner) {
      orchestrationIssues.push(`${o.label}: ${levers.owners[key] === 'adf' ? 'ADF' : 'Lakeflow Jobs'} owns it here. ${o.why}`);
    }
  });
  if (orchestrationIssues.length) add('owner-effects', orchestrationIssues.join(' '), 'problem');

  if (!findings.some((f) => f.tone === 'problem')) {
    findings.push({ ledgerId: 'incremental-scope', text: 'Every row landed once.', tone: 'ok' });
  }

  return {
    batch: B, expected, landing, write: levers.sink === 'upsert' ? 'merge' : 'append', missed, duplicated, duplicateWrites,
    staleDeletes, pendingLate, watermark: { before: wm0, after: wm }, steps, findings, orchestrationIssues, levers,
  };
}

/** The levers as a short, stable string, for comparing runs and for remembering them. */
export const leversKey = (l: AdfLevers): string => JSON.stringify([
  l.load, l.watermark, l.sink, l.trigger, l.retries, l.failureAtPercent, l.lateFile, l.outOfOrder, l.deletes,
  l.owners.externalFeed, l.owners.jobDependency,
]);

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly string[]).includes(v as string) ? (v as T) : fallback;

/** Levers read back from storage: anything unreadable falls back to the default upstream, never throws. */
export function parseLevers(raw: unknown): AdfLevers {
  const d = DEFAULT_LEVERS;
  if (!isObj(raw)) return d;
  const owners = isObj(raw.owners) ? raw.owners : {};
  const retries = [0, 1, 2, 3].includes(raw.retries as number) ? (raw.retries as 0 | 1 | 2 | 3) : d.retries;
  const failure = raw.failureAtPercent === null ? null
    : typeof raw.failureAtPercent === 'number' && raw.failureAtPercent > 0 && raw.failureAtPercent < 100 ? Math.round(raw.failureAtPercent) : d.failureAtPercent;
  return {
    load: pick(raw.load, ['incremental', 'full'], d.load),
    watermark: pick(raw.watermark, ['before', 'success', 'completion'], d.watermark),
    sink: pick(raw.sink, ['append', 'upsert'], d.sink),
    trigger: pick(raw.trigger, ['schedule', 'tumbling', 'event'], d.trigger),
    retries, failureAtPercent: failure,
    lateFile: raw.lateFile === true, outOfOrder: raw.outOfOrder === true,
    deletes: pick(raw.deletes, ['watermark-only', 'soft-delete-flag'], d.deletes),
    owners: {
      externalFeed: pick(owners.externalFeed, OWNERS, d.owners.externalFeed),
      jobDependency: pick(owners.jobDependency, OWNERS, d.owners.jobDependency),
    },
  };
}
