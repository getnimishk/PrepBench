// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
// The real pack content, so these tests check the shipped scenario, not a copy of it.
import packFactory from '../../../../backend/app/data/lab_packs/semiconductor-v1/factory.json';
import {
  decodeGuesses, defaultPlan, domainEffort, domainJobs, encodeGuesses, parseFactory, runFactory, scoreTiering, tierJob,
  validatePlan, type FactoryConfig, type PlanInput, type Tier,
} from './factoryModel';

const parsed = parseFactory(packFactory);
if (!parsed.ok) throw new Error(parsed.reason);
const config: FactoryConfig = parsed.config;
const base = defaultPlan(config);
const run = (over: Partial<PlanInput> = {}) => runFactory(config, { ...base, ...over });
const clone = () => JSON.parse(JSON.stringify(packFactory));

describe('parseFactory', () => {
  it('reads the shipped pack', () => {
    expect(config.domains.map((d) => d.id)).toEqual(['bi', 'supply', 'finance', 'yield', 'telemetry']);
    expect(config.slots).toEqual([[1, 2], [3, 4, 5, 6], [7, 8, 9], [10, 11], [12]]);
    expect(config.constants.costRatio).toBe(0.5);
    expect(config.sample).toHaveLength(12);
    expect(Object.values(config.constantLabels).every((l) => l.length > 0)).toBe(true);
  });

  it('refuses a stub, nothing, and malformed content, with a reason, rather than guessing', () => {
    expect(parseFactory({ stub: true })).toMatchObject({ ok: false });
    expect(parseFactory(null)).toMatchObject({ ok: false });
    expect(parseFactory({})).toMatchObject({ ok: false });
    const noRules = clone(); noRules.tier_rules = [];
    expect(parseFactory(noRules)).toMatchObject({ ok: false, reason: 'The pack has no tier rules.' });
    const badSignal = clone(); badSignal.tiering_sample[0].signals.push('made_up');
    expect(parseFactory(badSignal)).toMatchObject({ ok: false });
    const mismatch = clone(); mismatch.waves.pop();
    expect(parseFactory(mismatch)).toMatchObject({ ok: false });
    const noVelocity = clone(); delete noVelocity.teaching_constants.steady_velocity_effort_per_month;
    expect(parseFactory(noVelocity)).toMatchObject({ ok: false });
    const empty = clone(); empty.domains[0].jobs_by_tier = { '1': 0, '2': 0, '3': 0 };
    expect(parseFactory(empty)).toMatchObject({ ok: false, reason: 'Domain bi has no jobs.' });
    const backwardsFreeze = clone(); backwardsFreeze.events.change_freeze.to_month = 1;
    expect(parseFactory(backwardsFreeze)).toMatchObject({ ok: false });
  });
});

describe('tiering', () => {
  it('derives the tier from the pack’s rules, and says which signals decided it', () => {
    const job = (id: string) => config.sample.find((j) => j.id === id)!;
    expect(tierJob(config, job('yld_daily_agg'))).toEqual({ tier: 3, because: ['feeds_yield_report'] });
    expect(tierJob(config, job('eq_anomaly_rdd')).tier).toBe(3);
    expect(tierJob(config, job('inv_snapshot'))).toEqual({ tier: 2, because: ['oozie_coordinator'] });
    expect(tierJob(config, job('cron_mes_pull')).tier).toBe(2);
    expect(tierJob(config, job('bi_sales_feed'))).toEqual({ tier: 1, because: [] });
  });

  it('a job feeding the yield report is Tier 3 however simple its code is', () => {
    const simple = { id: 'x', signals: ['hiveql', 'no_udfs', 'feeds_yield_report'] };
    expect(tierJob(config, simple).tier).toBe(3);
    expect(tierJob(config, { id: 'y', signals: ['hiveql', 'no_udfs'] }).tier).toBe(1);
  });

  it('the sample has all three tiers, so a learner can’t tier by guessing one answer', () => {
    const tiers = new Set(config.sample.map((j) => tierJob(config, j).tier));
    expect([...tiers].sort()).toEqual([1, 2, 3]);
  });

  it('scores a tiering against the true tiers, job by job', () => {
    const truth = Object.fromEntries(config.sample.map((j) => [j.id, tierJob(config, j).tier])) as Record<string, Tier>;
    expect(scoreTiering(config, truth)).toMatchObject({ right: 12, total: 12 });
    const wrong = { ...truth, [config.sample[0].id]: 1 as Tier };
    const score = scoreTiering(config, wrong);
    expect(score.right).toBe(11);
    expect(score.perJob[config.sample[0].id]).toMatchObject({ guessed: 1, actual: 3, correct: false });
  });

  it('round-trips a tiering through its short string, and drops what it can’t read', () => {
    const guesses = Object.fromEntries(config.sample.map((j, i) => [j.id, ((i % 3) + 1) as Tier]));
    const encoded = encodeGuesses(config, guesses);
    expect(encoded).toHaveLength(12);
    expect(decodeGuesses(config, encoded)).toEqual(guesses);
    expect(decodeGuesses(config, '9')).toEqual({});
  });
});

describe('runFactory is deterministic', () => {
  it('gives the same run for the same plan, every time', () => {
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
    expect(JSON.stringify(run({ cluster: 'all-purpose', consumerMap: true }))).toBe(JSON.stringify(run({ cluster: 'all-purpose', consumerMap: true })));
  });

  it('refuses a plan that doesn’t place every domain exactly once', () => {
    expect(() => validatePlan(config, ['bi', 'bi', 'supply', 'finance', 'yield'])).toThrow();
    expect(() => validatePlan(config, ['bi'])).toThrow();
    expect(() => runFactory(config, { ...base, order: ['nope', 'bi', 'supply', 'finance', 'yield'] })).toThrow();
  });
});

describe('the plans', () => {
  it('a plan sized by job count is always worse than one weighted by complexity on the reference inventory', () => {
    for (const bufferPercent of [0, 10, 20, 30, 50]) {
      const r = run({ bufferPercent });
      expect(r.count.lateness, `buffer ${bufferPercent}`).toBeGreaterThan(r.weighted.lateness);
    }
  });

  it('with its default buffer the weighted plan holds (within a month) and the count plan fails badly', () => {
    const r = run();
    expect(r.weighted.lateness).toBeLessThanOrEqual(1);
    expect(r.count.lateness).toBeGreaterThan(5);
  });

  it('both plans meet the same reality', () => {
    const r = run();
    expect(r.count.actualEnd).toBe(r.weighted.actualEnd);
  });

  it('the count plan prices every job at the pilot’s average; the weighted plan at the true average', () => {
    const r = run();
    const pilot = config.domains[0];
    expect(r.count.effortPerJob).toBeCloseTo(domainEffort(config, pilot) / domainJobs(pilot), 10);
    const all = config.domains.reduce((n, d) => n + domainEffort(config, d), 0) / config.domains.reduce((n, d) => n + domainJobs(d), 0);
    expect(r.weighted.effortPerJob).toBeCloseTo(all, 10);
    expect(r.count.effortPerJob!).toBeLessThan(r.weighted.effortPerJob!);
  });

  it('without any buffer even the weighted plan is late: the events are real', () => {
    expect(run({ bufferPercent: 0 }).weighted.lateness).toBeGreaterThan(1);
  });

  it('a bigger buffer promises a later end and never moves the real one', () => {
    const a = run({ bufferPercent: 0 });
    const b = run({ bufferPercent: 30 });
    expect(b.weighted.plannedEnd).toBeGreaterThan(a.weighted.plannedEnd);
    expect(b.weighted.actualEnd).toBe(a.weighted.actualEnd);
  });
});

describe('the fixed event schedule', () => {
  it('lists every event at the month the pack schedules it, whatever the plan', () => {
    for (const plan of [base, { ...base, order: ['telemetry', 'yield', 'finance', 'supply', 'bi'] }]) {
      const r = runFactory(config, plan);
      const month = (id: string) => r.events.find((e) => e.id === id)!.month;
      expect(month('hidden-inventory')).toBe(config.hiddenInventory.month);
      expect(month('change-freeze')).toBe(config.changeFreeze.fromMonth);
      expect(r.events.map((e) => e.month)).toEqual([...r.events.map((e) => e.month)].sort((a, b) => a - b));
    }
  });

  it('the pilot runs at the pack’s fraction of steady speed, and nothing else does', () => {
    const r = run();
    const pilotWaves = r.waves.filter((w) => w.slot === 0);
    expect(pilotWaves.every((w) => w.velocity === config.constants.steadyVelocity * config.constants.pilotVelocityFactor)).toBe(true);
    expect(r.waves.filter((w) => w.slot > 0).every((w) => w.velocity === config.constants.steadyVelocity)).toBe(true);
  });

  it('the hidden jobs add effort to work still ahead, and are never applied to a domain already finished', () => {
    const r = run();
    const total = config.domains.reduce((n, d) => n + domainEffort(config, d), 0);
    const ran = r.waves.reduce((n, w) => n + w.effort, 0);
    expect(ran).toBeGreaterThan(total);
    // The pilot ends before the scheduled month, so its effort is exactly its inventory's.
    const pilotEffort = r.waves.filter((w) => w.slot === 0).reduce((n, w) => n + w.effort, 0);
    expect(pilotEffort).toBeCloseTo(domainEffort(config, config.domains[0]), 6);
    const pilotWaves = r.waves.filter((w) => w.slot === 0);
    expect(pilotWaves[pilotWaves.length - 1].end).toBeLessThan(config.hiddenInventory.month);
  });

  it('a cutover that would land inside the change freeze waits for it to end', () => {
    const r = run();
    const waited = r.waves.filter((w) => w.waited > 0);
    expect(waited.length).toBeGreaterThan(0);
    for (const w of waited) expect(w.end).toBe(config.changeFreeze.toMonth);
    // Nothing ends inside the window.
    for (const w of r.waves) {
      expect(w.end >= config.changeFreeze.fromMonth && w.end < config.changeFreeze.toMonth).toBe(false);
    }
    expect(r.events.find((e) => e.id === 'change-freeze')!.effect).toMatch(/Held cutovers back/);
  });

  it('says so when the freeze touches nothing', () => {
    const raw = clone();
    raw.events.change_freeze = { from_month: 90, to_month: 91, text: 'A freeze far in the future' };
    const later = parseFactory(raw);
    if (!later.ok) throw new Error(later.reason);
    const r = runFactory(later.config, defaultPlan(later.config));
    expect(r.waves.every((w) => w.waited === 0)).toBe(true);
    expect(r.events.find((e) => e.id === 'change-freeze')!.effect).toBe('No cutover fell inside the freeze.');
  });
});

describe('placing domains', () => {
  it('the safe order has no incident of its own and costs no rework', () => {
    const r = run({ consumerMap: true });
    expect(r.incidents).toEqual([]);
  });

  it('a critical domain placed before its safe slot is an incident, with rework', () => {
    const early = run({ order: ['yield', 'bi', 'supply', 'finance', 'telemetry'], consumerMap: true });
    expect(early.incidents.map((i) => i.id)).toEqual(['critical-early']);
    expect(early.incidents[0].wave).toBe(1);
    const safe = run({ consumerMap: true });
    expect(early.count.actualEnd).toBeGreaterThan(safe.count.actualEnd);
    const rework = early.waves.filter((w) => w.domainId === 'yield').reduce((n, w) => n + w.effort, 0);
    const yieldDomain = config.domains.find((d) => d.id === 'yield')!;
    expect(rework).toBeGreaterThan(domainEffort(config, yieldDomain) * (1 + config.earlyCriticalReworkPercent / 100) - 1e-6);
  });

  it('puts the pilot’s price on the count plan: a hard pilot makes it less wrong, a cheap one more', () => {
    const cheap = run();
    const hard = run({ order: ['yield', 'bi', 'supply', 'finance', 'telemetry'] });
    expect(hard.count.effortPerJob!).toBeGreaterThan(cheap.count.effortPerJob!);
  });
});

describe('the consumer map and decommission', () => {
  it('a cutover without a consumer map blanks a report, naming it, at the yield wave’s cutover', () => {
    const r = run();
    const incident = r.incidents.find((i) => i.id === 'no-consumer-map')!;
    expect(incident.wave).toBe(10);
    expect(incident.text).toContain('Yield dashboard');
    expect(incident.text).toContain('wave 10');
    const cutover = r.waves.find((w) => w.wave === 10)!;
    expect(incident.month).toBe(Math.ceil(cutover.end));
  });

  it('decommission is blocked until every consumer is confirmed, and says which', () => {
    const blocked = run();
    expect(blocked.decommission.allowed).toBe(false);
    expect(blocked.decommission.unconfirmedConsumers).toEqual(['Yield dashboard', 'Weekly scrap report', 'Audit extract']);
    const mapped = run({ consumerMap: true });
    expect(mapped.decommission).toEqual({ allowed: true, unconfirmedConsumers: [] });
    expect(mapped.incidents.find((i) => i.id === 'no-consumer-map')).toBeUndefined();
  });
});

describe('the link to Station C', () => {
  it('names the yield wave’s Validate step and the two real tables to compare there', () => {
    const r = run();
    expect(r.validate).toMatchObject({ wave: 10, domainId: 'yield', compare: { left: 'legacy.defects', right: 'silver.defects' } });
    const cutover = r.waves.find((w) => w.wave === 10)!;
    expect(r.validate!.month).toBeGreaterThanOrEqual(Math.floor(cutover.start));
    expect(r.validate!.month).toBeLessThanOrEqual(Math.ceil(cutover.end));
  });

  it('follows the yield domain wherever the plan puts it', () => {
    const r = run({ order: ['bi', 'yield', 'supply', 'finance', 'telemetry'] });
    expect(r.validate!.wave).toBe(3);
  });
});

describe('cost: teaching constants, relative to job clusters', () => {
  it('job clusters are the baseline', () => {
    expect(run().cost).toEqual({ dbuIndex: 1, totalIndex: 1 });
  });

  it('all-purpose compute costs the inverse of the ratio, and the total moves less because infrastructure doesn’t', () => {
    const { cost } = run({ cluster: 'all-purpose' });
    expect(cost.dbuIndex).toBeCloseTo(1 / config.constants.costRatio, 10);
    const infra = config.constants.infrastructureShare;
    expect(cost.totalIndex).toBeCloseTo((cost.dbuIndex + infra) / (1 + infra), 10);
    expect(cost.totalIndex).toBeLessThan(cost.dbuIndex);
    expect(cost.totalIndex).toBeGreaterThan(1);
  });

  it('the cluster choice never moves the schedule', () => {
    expect(run({ cluster: 'all-purpose' }).count.actualEnd).toBe(run().count.actualEnd);
  });
});
