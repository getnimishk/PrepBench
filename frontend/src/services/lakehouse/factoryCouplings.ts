// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

// Station F's coupling ledger: every effect the Migration Factory applies,
// typed, in the same three kinds as the Agile Metrics sandbox's ledger
// (services/metrics/couplings.ts).
//
//   arithmetic  follows from definitions. Cannot be wrong, only misapplied.
//   assumption  a claim this sandbox makes so the lesson lands. NOT a fact about
//               any real migration, and never presented as one.
//   convention  a counting decision local to this sandbox.
//
// The composition is asserted (factoryCouplings.test.ts): adding an effect
// without deciding which kind it is fails the suite instead of sliding in as
// arithmetic by default. And every entry reaches the learner: FactoryLedger
// renders them all, and a test checks that each one's label is on screen.

export type FactoryCouplingType = 'arithmetic' | 'assumption' | 'convention';

export interface FactoryCoupling {
  id: string;
  type: FactoryCouplingType;
  /** The pack constant it uses, if any, so the screen can say WHICH figure is in play. */
  constant?: 'costRatio' | 'infrastructureShare' | 'effortByTier' | 'steadyVelocity' | 'pilotVelocityFactor' | 'defaultBufferPercent';
  formula: string;
  /** The caveat shown on screen. Carries the kind: "Model assumption: …". */
  uiLabel: string;
  /** What the effect did, as the chain it travels. */
  effect: string;
}

export const FACTORY_COUPLINGS: FactoryCoupling[] = [
  // ---- arithmetic -------------------------------------------------------------------
  {
    id: 'effort-from-tiers',
    type: 'arithmetic',
    formula: 'effort(domain) = Σ jobs in tier × effort per job of that tier',
    uiLabel: 'A domain’s effort is its jobs times what each tier costs.',
    effect: 'More Tier 3 jobs -> more effort in the domain -> a longer conversion, whatever the job count.',
  },
  {
    id: 'duration-from-velocity',
    type: 'arithmetic',
    formula: 'months(wave) = effort(wave) ÷ the speed the team runs at',
    uiLabel: 'A wave takes its effort divided by the speed the team runs at.',
    effect: 'The same effort at a slower speed -> more months -> every later wave starts later.',
  },
  {
    id: 'lateness',
    type: 'arithmetic',
    formula: 'lateness = month the programme really ends − month the plan promised',
    uiLabel: 'Lateness is when it really ended minus when the plan said.',
    effect: 'A plan that promises less than the work needs -> a real end after the promised one -> late.',
  },
  {
    id: 'all-purpose-cost',
    type: 'arithmetic',
    constant: 'costRatio',
    formula: 'compute(all-purpose) = compute(job cluster) ÷ the cost ratio',
    uiLabel: 'All-purpose compute costs the job-cluster figure divided by the ratio.',
    effect: 'All-purpose clusters for scheduled jobs -> compute cost multiplied by the inverse of the ratio.',
  },

  // ---- assumptions ------------------------------------------------------------------
  {
    id: 'tier-effort',
    type: 'assumption',
    constant: 'effortByTier',
    formula: 'effort per job: tier 1 = 1, tier 2 = 3, tier 3 = 8 units',
    uiLabel: 'Model assumption: a job’s effort depends on its tier by fixed teaching constants, not by any real measurement.',
    effect: 'A harder tier -> several times the effort of an easy job -> plans that treat all jobs alike are wrong by that factor.',
  },
  {
    id: 'steady-velocity',
    type: 'assumption',
    constant: 'steadyVelocity',
    formula: 'the team completes a fixed number of effort units per month once it is up to speed',
    uiLabel: 'Model assumption: one team of constant speed works one slot at a time.',
    effect: 'A fixed speed -> months follow directly from effort -> adding work always adds months.',
  },
  {
    id: 'pilot-velocity',
    type: 'assumption',
    constant: 'pilotVelocityFactor',
    formula: 'speed(pilot slot) = steady speed × the pilot factor',
    uiLabel: 'Model assumption: the pilot runs well below steady speed while the team learns the platform.',
    effect: 'A slow pilot -> its jobs take longer than steady speed would predict -> a plan built from the pilot’s pace misjudges the rest.',
  },
  {
    id: 'hidden-inventory',
    type: 'assumption',
    formula: 'at the scheduled month, extra Tier 2 jobs join every domain still being worked on',
    uiLabel: 'Model assumption: more jobs are discovered at a fixed month, all Tier 2, in the work still ahead.',
    effect: 'Jobs nobody listed turn up -> the remaining domains need more effort -> the programme runs longer than its inventory said.',
  },
  {
    id: 'change-freeze',
    type: 'assumption',
    formula: 'a cutover that would finish inside the freeze waits until it ends',
    uiLabel: 'Model assumption: no cutover can happen inside the change-freeze window, and the team waits.',
    effect: 'A freeze across a cutover -> that wave waits for the freeze to end -> every later wave starts later.',
  },
  {
    id: 'early-critical',
    type: 'assumption',
    formula: 'a domain placed before its first safe slot costs extra effort, and its pilot hits production',
    uiLabel: 'Model assumption: running a critical, latency-sensitive domain early costs rework and causes an incident.',
    effect: 'A critical domain first -> its pilot goes wrong in production -> rework on the domain and an incident.',
  },
  {
    id: 'no-consumer-map',
    type: 'assumption',
    formula: 'a domain with downstream consumers cut over without a consumer map blanks one of them',
    uiLabel: 'Model assumption: cutting over without a consumer map breaks a downstream report, and decommission stays blocked.',
    effect: 'No map of who reads the data -> a consumer is missed at cutover -> its report goes blank -> the old platform can’t be switched off.',
  },
  {
    id: 'cost-ratio',
    type: 'assumption',
    constant: 'costRatio',
    formula: 'job-cluster compute costs a fixed fraction of all-purpose compute',
    uiLabel: 'Model assumption: the job-cluster to all-purpose cost ratio is a teaching constant, never a quoted price ratio.',
    effect: 'A cheaper cluster type for scheduled work -> a lower compute figure -> only as true as the ratio chosen.',
  },
  {
    id: 'infrastructure-share',
    type: 'assumption',
    constant: 'infrastructureShare',
    formula: 'infrastructure cost = a fixed share of the job-cluster compute bill, whatever the cluster type',
    uiLabel: 'Model assumption: the infrastructure under the compute costs a fixed share, whichever cluster type runs the jobs.',
    effect: 'Infrastructure that doesn’t change -> total cost moves less than the compute bill does.',
  },
  {
    id: 'plan-buffer',
    type: 'assumption',
    constant: 'defaultBufferPercent',
    formula: 'planned end = base estimate × (1 + buffer)',
    uiLabel: 'Model assumption: each plan adds the same contingency buffer to its own estimate.',
    effect: 'A buffer -> a later promised end -> room for events, but not for an estimate that was wrong at the root.',
  },

  // ---- conventions ------------------------------------------------------------------
  {
    id: 'count-plan-extrapolates',
    type: 'convention',
    formula: 'plan by job count: every job costs what the pilot’s jobs cost',
    uiLabel: 'Sandbox counting convention: a plan sized by job count prices every job at the pilot’s average.',
    effect: 'An easy pilot -> a low price per job -> a programme that looks short and isn’t.',
  },
  {
    id: 'slot-shares-effort',
    type: 'convention',
    formula: 'the waves in a slot share its domain’s effort equally',
    uiLabel: 'Sandbox counting convention: the waves in one slot share that domain’s effort equally.',
    effect: 'An even split -> each wave in a slot takes the same time -> wave dates are indicative, not scheduled.',
  },
  {
    id: 'months-from-start',
    type: 'convention',
    formula: 'months are counted from the start of the pilot; a date inside month n is reported as month n',
    uiLabel: 'Sandbox counting convention: months run from the start of the pilot, and a date is reported as the month it falls in.',
    effect: 'Fractional months -> rounded up when read aloud -> “month 17” means “somewhere in month 17”.',
  },
];

export const FACTORY_COUPLING_BY_ID = new Map(FACTORY_COUPLINGS.map((c) => [c.id, c]));
