// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

// Station F's model: the Migration Factory (PRD P0-8, design §4.7).
//
// Pure functions. No React, no network, no randomness, no clock: the same pack
// and the same plan always give the same run, which is what lets a test pin the
// lesson ("a plan sized by job count fails where one weighted by complexity
// holds") instead of hoping a screen shows it.
//
// Every number here is a TEACHING CONSTANT read from the pack's factory.json
// (steady velocity, effort per tier, the cost ratio, the event schedule). None
// is an estimate of a real migration or a price, and the UI says so beside every
// month and every cost. The model reads the constants; it contains none of its
// own, so changing the story is a change to the pack's content, not to code.
//
// What the model does, in one paragraph. A team of fixed speed works through the
// five domains in the order the learner chose, one slot at a time. A job's effort
// depends on its tier. Two plans are written for the same programme: one sized by
// job count (every job costs what the pilot's jobs did) and one weighted by
// complexity (each job costs what its tier does). The programme then runs through
// a fixed schedule of events. Both plans meet the same reality, so the gap
// between what each promised and what happened is the lesson.

/** Station F's one prediction, the tiering. Its attempt is told apart by the `lakehouse.f.` id. */
export const TIERING_CHALLENGE = { id: 'lakehouse.f.tiering', conceptId: 'lakehouse.f.tiering' } as const;

export type Tier = 1 | 2 | 3;
export type Cluster = 'job' | 'all-purpose';

export interface FactoryJob {
  id: string;
  signals: string[];
}

export interface TierRule {
  tier: Tier;
  anyOf: string[];
}

export interface FactoryDomain {
  id: string;
  name: string;
  /** The wave numbers this domain has in the pack's own plan. */
  waves: number[];
  /** The first slot (0-based) this domain is safe to run in. Earlier is the mistake. */
  earliestSafeSlot: number;
  jobsByTier: Record<Tier, number>;
  consumers: string[];
  validateCompare?: { left: string; right: string };
}

export interface FactoryConfig {
  constants: {
    costRatio: number;
    infrastructureShare: number;
    effortByTier: Record<Tier, number>;
    steadyVelocity: number;
    pilotVelocityFactor: number;
    defaultBufferPercent: number;
  };
  /** What the pack says each teaching constant is, to be shown beside it. */
  constantLabels: Record<'costRatio' | 'infrastructureShare' | 'effortByTier' | 'steadyVelocity' | 'pilotVelocityFactor' | 'defaultBufferPercent', string>;
  signalLabels: Record<string, string>;
  tierRules: TierRule[];
  sample: FactoryJob[];
  domains: FactoryDomain[];
  /** One entry per slot of the programme: the waves it spans. Fixed by the pack. */
  slots: number[][];
  hiddenInventory: { month: number; extraJobPercent: number; tier: Tier; text: string };
  changeFreeze: { fromMonth: number; toMonth: number; text: string };
  earlyCriticalReworkPercent: number;
  loop: string[];
}

export type ParsedFactory = { ok: true; config: FactoryConfig } | { ok: false; reason: string };

const TIERS: Tier[] = [1, 2, 3];

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * The pack's factory content, checked. A stub or a malformed pack gives a reason
 * rather than a half-built model: Station F then says the pack has no Factory
 * content, instead of running on numbers that were guessed.
 */
export function parseFactory(raw: unknown): ParsedFactory {
  const fail = (reason: string): ParsedFactory => ({ ok: false, reason });
  if (!isObj(raw)) return fail('The pack has no Factory content.');
  if (raw.stub === true) return fail('This pack’s Factory content is a placeholder.');

  const tc = raw.teaching_constants;
  if (!isObj(tc)) return fail('The pack has no teaching constants.');
  const constant = (key: string): unknown => (isObj(tc[key]) ? (tc[key] as Raw).value : undefined);
  const costRatio = num(constant('job_cluster_vs_all_purpose_cost_ratio'));
  const infra = num(constant('infrastructure_share_of_job_cluster_cost'));
  const velocity = num(constant('steady_velocity_effort_per_month'));
  const pilot = num(constant('pilot_velocity_factor'));
  const buffer = num(constant('default_plan_buffer_percent'));
  const effortRaw = constant('effort_per_job_by_tier');
  const label = (key: string) => (isObj(tc[key]) && typeof (tc[key] as Raw).label === 'string' ? ((tc[key] as Raw).label as string) : '');
  if (costRatio === null || costRatio <= 0 || infra === null || velocity === null || velocity <= 0
    || pilot === null || pilot <= 0 || buffer === null || !isObj(effortRaw)) {
    return fail('The pack’s teaching constants are incomplete.');
  }
  const effort = {} as Record<Tier, number>;
  for (const t of TIERS) {
    const e = num(effortRaw[String(t)]);
    if (e === null || e <= 0) return fail(`The pack has no effort for tier ${t}.`);
    effort[t] = e;
  }

  const signals = raw.signals;
  if (!isObj(signals)) return fail('The pack has no signal labels.');
  const signalLabels: Record<string, string> = {};
  for (const [k, v] of Object.entries(signals)) if (typeof v === 'string') signalLabels[k] = v;

  if (!Array.isArray(raw.tier_rules) || raw.tier_rules.length === 0) return fail('The pack has no tier rules.');
  const tierRules: TierRule[] = [];
  for (const r of raw.tier_rules) {
    if (!isObj(r) || !TIERS.includes(r.tier as Tier) || !Array.isArray(r.any_of)) return fail('A tier rule is malformed.');
    tierRules.push({ tier: r.tier as Tier, anyOf: r.any_of.map(String) });
  }

  if (!Array.isArray(raw.tiering_sample) || raw.tiering_sample.length === 0) return fail('The pack has no jobs to tier.');
  const sample: FactoryJob[] = [];
  for (const j of raw.tiering_sample) {
    if (!isObj(j) || typeof j.id !== 'string' || !Array.isArray(j.signals)) return fail('A sample job is malformed.');
    const sigs = j.signals.map(String);
    const unknown = sigs.find((s) => !(s in signalLabels));
    if (unknown) return fail(`Job ${j.id} names a signal the pack doesn’t describe: ${unknown}.`);
    sample.push({ id: j.id, signals: sigs });
  }

  if (!Array.isArray(raw.domains) || raw.domains.length === 0) return fail('The pack has no domains.');
  const domains: FactoryDomain[] = [];
  for (const d of raw.domains) {
    if (!isObj(d) || typeof d.id !== 'string' || typeof d.name !== 'string' || !isObj(d.jobs_by_tier)
      || !Array.isArray(d.waves) || num(d.earliest_safe_slot) === null) return fail('A domain is malformed.');
    const jobsByTier = {} as Record<Tier, number>;
    for (const t of TIERS) {
      const n = num((d.jobs_by_tier as Raw)[String(t)]);
      if (n === null || n < 0) return fail(`Domain ${d.id} has no job count for tier ${t}.`);
      jobsByTier[t] = n;
    }
    const cmp = isObj(d.validate_compare) && typeof d.validate_compare.left === 'string' && typeof d.validate_compare.right === 'string'
      ? { left: d.validate_compare.left, right: d.validate_compare.right } : undefined;
    if (TIERS.reduce((n, t) => n + jobsByTier[t], 0) === 0) return fail(`Domain ${d.id} has no jobs.`);
    domains.push({
      id: d.id, name: d.name, waves: d.waves.map(Number), earliestSafeSlot: d.earliest_safe_slot as number, jobsByTier,
      consumers: Array.isArray(d.consumers) ? d.consumers.map(String) : [], validateCompare: cmp,
    });
  }

  if (!Array.isArray(raw.waves) || raw.waves.length !== domains.length) return fail('The pack’s wave plan doesn’t match its domains.');
  const slots = raw.waves.map((w) => (isObj(w) && Array.isArray(w.waves) ? w.waves.map(Number) : []));
  if (slots.some((s) => s.length === 0)) return fail('A slot in the wave plan has no waves.');

  const events = raw.events;
  if (!isObj(events) || !isObj(events.hidden_inventory) || !isObj(events.change_freeze)) return fail('The pack has no event schedule.');
  const hi = events.hidden_inventory;
  const cf = events.change_freeze;
  const hiMonth = num(hi.month);
  const hiPct = num(hi.extra_job_percent);
  const hiTier = hi.tier as Tier;
  const from = num(cf.from_month);
  const to = num(cf.to_month);
  const rework = num(events.early_critical_rework_percent);
  if (hiMonth === null || hiPct === null || !TIERS.includes(hiTier) || from === null || to === null || to <= from || rework === null) {
    return fail('The pack’s event schedule is incomplete.');
  }

  return {
    ok: true,
    config: {
      constants: {
        costRatio, infrastructureShare: infra, effortByTier: effort, steadyVelocity: velocity,
        pilotVelocityFactor: pilot, defaultBufferPercent: buffer,
      },
      constantLabels: {
        costRatio: label('job_cluster_vs_all_purpose_cost_ratio'),
        infrastructureShare: label('infrastructure_share_of_job_cluster_cost'),
        effortByTier: label('effort_per_job_by_tier'),
        steadyVelocity: label('steady_velocity_effort_per_month'),
        pilotVelocityFactor: label('pilot_velocity_factor'),
        defaultBufferPercent: label('default_plan_buffer_percent'),
      },
      signalLabels, tierRules, sample, domains, slots,
      hiddenInventory: { month: hiMonth, extraJobPercent: hiPct, tier: hiTier, text: String(hi.text ?? '') },
      changeFreeze: { fromMonth: from, toMonth: to, text: String(cf.text ?? '') },
      earlyCriticalReworkPercent: rework,
      loop: Array.isArray(raw.per_wave_loop) ? raw.per_wave_loop.map(String) : [],
    },
  };
}

// ---- tiering ------------------------------------------------------------------------

export interface TierResult {
  tier: Tier;
  /** The signals that made it this tier: what to look for next time. */
  because: string[];
}

/** A job's true tier, from the pack's rules. The first rule that matches wins. */
export function tierJob(config: FactoryConfig, job: FactoryJob): TierResult {
  for (const rule of config.tierRules) {
    const hit = job.signals.filter((s) => rule.anyOf.includes(s));
    if (hit.length > 0) return { tier: rule.tier, because: hit };
  }
  // The rule list ends with "tier 1, any of nothing" meaning "everything else".
  const last = config.tierRules[config.tierRules.length - 1];
  return { tier: last.tier, because: [] };
}

export interface TieringScore {
  right: number;
  total: number;
  perJob: Record<string, { guessed: Tier; actual: Tier; correct: boolean }>;
}

export function scoreTiering(config: FactoryConfig, guesses: Record<string, Tier>): TieringScore {
  const perJob: TieringScore['perJob'] = {};
  let right = 0;
  for (const job of config.sample) {
    const guessed = guesses[job.id];
    const actual = tierJob(config, job).tier;
    const correct = guessed === actual;
    if (correct) right += 1;
    perJob[job.id] = { guessed, actual, correct };
  }
  return { right, total: config.sample.length, perJob };
}

/** The guesses as one short string, in sample order, for the attempt's prediction. */
export const encodeGuesses = (config: FactoryConfig, guesses: Record<string, Tier>): string =>
  config.sample.map((j) => String(guesses[j.id] ?? 0)).join('');

export function decodeGuesses(config: FactoryConfig, encoded: string): Record<string, Tier> {
  const out: Record<string, Tier> = {};
  config.sample.forEach((j, i) => {
    const t = Number(encoded[i]);
    if (TIERS.includes(t as Tier)) out[j.id] = t as Tier;
  });
  return out;
}

// ---- the programme --------------------------------------------------------------------

export interface PlanInput {
  /** Domain ids, one per slot, in the order they run. A permutation of the pack's domains. */
  order: string[];
  cluster: Cluster;
  /** The contingency each plan adds to its own estimate. */
  bufferPercent: number;
  /** Whether a consumer map was built for the domains that have consumers. */
  consumerMap: boolean;
}

export function defaultPlan(config: FactoryConfig): PlanInput {
  const order = [...config.domains].sort((a, b) => (a.waves[0] ?? 0) - (b.waves[0] ?? 0)).map((d) => d.id);
  return { order, cluster: 'job', bufferPercent: config.constants.defaultBufferPercent, consumerMap: false };
}

export const domainJobs = (d: FactoryDomain) => TIERS.reduce((n, t) => n + d.jobsByTier[t], 0);

export const domainEffort = (config: FactoryConfig, d: FactoryDomain) =>
  TIERS.reduce((sum, t) => sum + d.jobsByTier[t] * config.constants.effortByTier[t], 0);

export interface WaveRun {
  wave: number;
  slot: number;
  domainId: string;
  start: number;
  end: number;
  effort: number;
  /** Effort units per month this wave ran at. */
  velocity: number;
  /** Months the cutover waited for a change freeze to end. */
  waited: number;
}

export interface ProgrammeEvent {
  id: 'hidden-inventory' | 'pilot-velocity' | 'change-freeze';
  /** The month it is scheduled for. Fixed by the pack, not by the plan. */
  month: number;
  text: string;
  /** What it did to this run, or that it did nothing. */
  effect: string;
}

export interface ProgrammeIncident {
  id: 'critical-early' | 'no-consumer-map';
  month: number;
  wave: number;
  text: string;
}

export interface PlanOutcome {
  /** What the plan promised, in months, including its buffer. */
  plannedEnd: number;
  /** The same programme's real end. */
  actualEnd: number;
  /** actualEnd - plannedEnd; positive is late. */
  lateness: number;
  /** Effort per job the plan assumed. */
  effortPerJob: number | null;
}

export interface FactoryRun {
  waves: WaveRun[];
  count: PlanOutcome;
  weighted: PlanOutcome;
  events: ProgrammeEvent[];
  incidents: ProgrammeIncident[];
  cost: { dbuIndex: number; totalIndex: number };
  decommission: { allowed: boolean; unconfirmedConsumers: string[] };
  /** The yield wave's Validate step, where the learner goes to compare real tables. */
  validate: { wave: number; month: number; domainId: string; compare: { left: string; right: string } } | null;
}

export function validatePlan(config: FactoryConfig, order: string[]): void {
  const ids = config.domains.map((d) => d.id).sort();
  if (order.length !== ids.length || [...order].sort().some((id, i) => id !== ids[i])) {
    throw new Error('A plan must place every domain exactly once.');
  }
}

/** Run a plan. Deterministic: the same config and plan give the same run, always. */
export function runFactory(config: FactoryConfig, plan: PlanInput): FactoryRun {
  validatePlan(config, plan.order);
  const c = config.constants;
  const byId = new Map(config.domains.map((d) => [d.id, d]));
  const buffer = 1 + plan.bufferPercent / 100;
  const hidden = config.hiddenInventory;
  const freeze = config.changeFreeze;

  // ---- reality: one team, one slot at a time ------------------------------------------
  const waves: WaveRun[] = [];
  const events: ProgrammeEvent[] = [];
  const incidents: ProgrammeIncident[] = [];
  let t = 0;
  let hiddenEffort = 0;
  let waited = 0;
  let pilotSlowedMonths = 0;
  let firstValidate: FactoryRun['validate'] = null;

  plan.order.forEach((domainId, slot) => {
    const d = byId.get(domainId)!;
    const slotWaves = config.slots[slot];
    const velocity = c.steadyVelocity * (slot === 0 ? c.pilotVelocityFactor : 1);
    let effort = domainEffort(config, d);

    // A domain placed before it is safe to run costs rework, and the pilot hits production.
    const early = slot < d.earliestSafeSlot;
    if (early) effort *= 1 + config.earlyCriticalReworkPercent / 100;

    // Jobs found at the scheduled month join any domain still being worked on then.
    const uplift = (hidden.extraJobPercent / 100) * domainJobs(d) * c.effortByTier[hidden.tier];
    const baseEnd = t + effort / velocity;
    if (t >= hidden.month || (t < hidden.month && baseEnd > hidden.month)) {
      effort += uplift;
      hiddenEffort += uplift;
    }

    const perWave = effort / slotWaves.length;
    slotWaves.forEach((wave, i) => {
      const start = t;
      const raw = start + perWave / velocity;
      const inFreeze = raw >= freeze.fromMonth && raw < freeze.toMonth;
      const end = inFreeze ? freeze.toMonth : raw;
      const wait = end - raw;
      waited += wait;
      waves.push({ wave, slot, domainId, start, end, effort: perWave, velocity, waited: wait });
      if (slot === 0) pilotSlowedMonths += perWave / velocity - perWave / c.steadyVelocity;
      t = end;

      if (i === 0) {
        if (early) {
          incidents.push({
            id: 'critical-early', month: Math.ceil(end), wave,
            text: `Month ${Math.ceil(end)} · ${d.name} went into wave ${wave}, before it was safe to: its pilot hit production and cost ${config.earlyCriticalReworkPercent}% more effort`,
          });
        }
        if (d.consumers.length > 0 && !plan.consumerMap) {
          incidents.push({
            id: 'no-consumer-map', month: Math.ceil(end), wave,
            text: `Month ${Math.ceil(end)} · wave ${wave} cut over without a consumer map: ${d.consumers[0]} went blank, and ${d.consumers.length - 1} more consumer${d.consumers.length - 1 === 1 ? ' is' : 's are'} unconfirmed`,
          });
        }
        if (d.validateCompare && !firstValidate) {
          firstValidate = {
            wave, month: Math.ceil(start + perWave / velocity * 0.4), domainId: d.id, compare: d.validateCompare,
          };
        }
      }
    });
  });
  const actualEnd = t;

  events.push({
    id: 'pilot-velocity', month: 1,
    text: `The pilot runs at ${Math.round(c.pilotVelocityFactor * 100)}% of steady speed while the team learns the platform`,
    effect: pilotSlowedMonths > 0
      ? `Cost ${fmt(pilotSlowedMonths)} extra months over the pilot waves.`
      : 'No effect: the pilot slot did no work.',
  });
  events.push({
    id: 'hidden-inventory', month: hidden.month, text: `Month ${hidden.month} · ${hidden.text}`,
    effect: hiddenEffort > 0
      ? `Added ${fmt(hiddenEffort / c.steadyVelocity)} months of effort to the work still ahead.`
      : 'No effect: everything had already been converted.',
  });
  events.push({
    id: 'change-freeze', month: freeze.fromMonth, text: freeze.text,
    effect: waited > 0 ? `Held cutovers back ${fmt(waited)} months in total.` : 'No cutover fell inside the freeze.',
  });
  events.sort((a, b) => a.month - b.month);

  // ---- the two plans, both written before any of it happened --------------------------
  const totalJobs = config.domains.reduce((n, d) => n + domainJobs(d), 0);
  const totalEffort = config.domains.reduce((n, d) => n + domainEffort(config, d), 0);
  const pilot = byId.get(plan.order[0])!;
  const pilotPerJob = domainEffort(config, pilot) / domainJobs(pilot);
  const countPlanned = ((totalJobs * pilotPerJob) / c.steadyVelocity) * buffer;
  const weightedPlanned = (totalEffort / c.steadyVelocity) * buffer;

  // ---- cost: relative to job clusters, teaching constants only -------------------------
  const dbuIndex = plan.cluster === 'job' ? 1 : 1 / c.costRatio;
  const totalIndex = (dbuIndex + c.infrastructureShare) / (1 + c.infrastructureShare);

  const unconfirmed = plan.consumerMap ? [] : config.domains.flatMap((d) => d.consumers);

  return {
    waves,
    count: { plannedEnd: countPlanned, actualEnd, lateness: actualEnd - countPlanned, effortPerJob: pilotPerJob },
    weighted: { plannedEnd: weightedPlanned, actualEnd, lateness: actualEnd - weightedPlanned, effortPerJob: totalEffort / totalJobs },
    events, incidents,
    cost: { dbuIndex, totalIndex },
    decommission: { allowed: unconfirmed.length === 0, unconfirmedConsumers: unconfirmed },
    validate: firstValidate,
  };
}

/** One decimal, no trailing zero noise. */
export function fmt(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

/** The month a thing falls in, for reading aloud: month 17, not 16.62. */
export const monthOf = (n: number) => Math.max(1, Math.ceil(n - 1e-9));
