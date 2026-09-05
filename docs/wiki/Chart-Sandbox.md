# Chart Sandbox

At `/chart-sandbox`. A delivery simulator for people who have to **explain** agile metrics, not just read them.

Most chart tutorials show you a picture and tell you what it means. The problem is that the picture was drawn to illustrate the lesson, so you learn to recognise a shape rather than to reason about a system. The sandbox inverts this: there is one executable model, all 27 views read from it, and you can only produce a shape by producing the conditions that cause it.

## The model

Five models compose into a per-sprint result. Each is a pure function in `frontend/src/services/metrics/`.

| Module | Produces |
|---|---|
| `flowModel.ts` | Delivery, cycle time, lead time, flow efficiency, WIP, batch size, per-state occupancy |
| `qualityModel.ts` | Defect injection, in-sprint catch, escaped defects, rework load |
| `deploymentModel.ts` | Deployment frequency, change fail rate, recovery time, rework rate |
| `reliabilityModel.ts` | Incidents, downtime, error budget consumption |
| `teamModel.ts` | Happiness, sustainability signals |
| `compose.ts` | Runs all of the above across the sprint range and wires cross-model transfers |

Nothing here touches React or the network. The model is a library; the page is a view over it. That is why the sandbox works offline and why its behaviour is testable without rendering anything.

### Two structural properties

Both are asserted in the test suite rather than trusted:

**No sprint reads its own outputs.** Every cross-sprint transfer lags exactly one sprint, so sprint 1 is always the undisturbed case. Without this, an incident could feed back into the capacity that produced it and the model would be solving an implicit equation rather than simulating a sequence.

**`deploymentReworkRate` is bounded 0..1 by composition**, not by a clamp — its numerator is a term of its own denominator. There is a mutation test that removes the composition and *requires* the bound test to then fail, so the bound cannot silently become vacuous.

### Determinism over realism

Capacity varies from a **fixed zero-mean profile**, not a random draw.

Without variation, the incident loop converges to a fixed point and Velocity, Say/do and Sprint goal all draw flat lines — which cannot teach variability. But a random draw would mean the same parameters give different charts, and then a learner cannot attribute what moved to the control they touched. A fixed profile gives you both: variation that teaches, and reproducibility that lets you attribute. Set the control to 0% and the steady state is still reachable.

> [!NOTE]
> The realised mean drifts down about 1% as variation rises. That is emergent, not a defect: delivery is capped at the commitment, so a good sprint cannot bank its surplus while a bad one still loses its shortfall. Variability against a ceiling costs throughput.

## The coupling ledger

The part that matters most. `couplings.ts` declares **21 edges**, each typed:

| Type | Count | Meaning |
|---|---|---|
| `arithmetic` | 9 | An identity. Little's Law cannot be wrong |
| `assumption` | 11 | A behavioural claim the sandbox is making |
| `convention` | 1 | A naming or presentation choice, not a claim about the world |

Assumptions and conventions render as on-chart callouts, labelled as such. This is enforced, not aspirational — a completeness test fails the build if a declared coupling never reaches a chart.

**Why that test exists:** an assumption the learner never sees is one they read as a fact. *"High WIP raises defect injection"* presented as fact is a claim you cannot back up when an interviewer asks for the evidence. It caught a real orphan during the workflow-state work — `wip-across-states` was declared but wired to no chart.

Each coupling also carries `lagSprints: 0 | 1` and, where relevant, a `calibrationParameter` naming the constant it depends on.

### Calibration constants are not sliders

Deliberately. They are teaching constants, chosen so an effect is visible across a slider's range — exposing them invites reading them as measured findings. The UI says this out loud rather than hiding it.

Parameter ranges are chosen so no reachable combination can drive a calibration formula outside the domain where its output means anything. A 256-corner sweep proves it, which is why the model needs no clamps.

> [!IMPORTANT]
> No coefficient in this model may be presented as an empirically estimated industry constant. If you add one, label it as calibration and give it a `calibrationParameter` entry.

## The 27 views

Six families, two tiers. Never more than one family on screen.

| Tier | Families |
|---|---|
| **Core** | `flow` · `predictability` · `quality` · `teamHealth` |
| **Engineering extension** | `dora` · `reliability` |

Core is what the sandbox is primarily for. The extension is the deployment and operations picture.

### Four primitives, not 27 components

```
model → chartData → four primitives → page
```

Renderers are named after **primitives**, not charts:

| Primitive | Views |
|---|---|
| `line` | 20 |
| `bar` | 4 |
| `scatter` | 2 |
| `stackedArea` | 1 |

A burndown and a burnup are one line renderer given different series. Four components cover all 27 views instead of 27 components slowly growing their own quirks.

`buildChartPayload` switches **exhaustively** over the view union, so TypeScript refuses to compile a new chart that has no payload. You cannot add a view and forget to feed it.

### One deliberate deviation from the design

The design sketched a mirrored `affectedCharts` array on `Coupling`. It is not implemented as a field — two hand-maintained directions of one relationship drift silently. `chartsConsuming()` derives the reverse from `consumes`, so there is one source of truth. Documented at both ends.

## Workflow states and the CFD

The Cumulative Flow Diagram originally plotted the WIP *limit* as its middle band — drawing a constant where a CFD is supposed to show accumulation. Fixing it required extending the model, which was done additively.

`workflow.ts` defines an ordered `WORKFLOW` constant. `flowModel` partitions work in progress across those states via `partitionAcrossStates`, producing `FlowResult.stateOccupancy: number[][]`.

**The invariant that makes it additive:**

```
Σ stateOccupancy[d] === started[d] − burnup[d]
```

The partition decides only *where* work in progress sits. The total is the one the frozen model already fixed, so no existing output changes. A test sweeps the new parameter across its full range and asserts all 13 pre-existing `FlowResult` fields plus every downstream model come back byte-identical.

**The chart renders from configuration.** Band count, labels, and order all come from `WORKFLOW` — add a fourth state and the CFD grows a fourth band with no change to `chartData.ts`. A regex guard asserts no workflow state name is hard-coded anywhere in the chart layer.

`constrainedStateCapacity` is declared a **pedagogical calibration parameter**, and its coupling is typed `assumption`, never arithmetic. Where work sits is a behavioural claim, not an identity.

## The learning layer

`frontend/src/services/learning/`. Read-only with respect to the model — it observes and teaches, never alters the simulation.

**The loop:** Recognize → Commit → Act → Compare → Explain → Generalise.

You predict before you observe. The explanation is earned, not handed over.

Orientation used to be a step of its own — a full-width card between the learner and the question, explaining what a sprint is and that the charts are plotted per sprint. It was the first thing a first-time visitor was made to read, and it is framing for reading the charts rather than for answering the question. It is now a disclosure *under* the prediction (*"New to this? What the sandbox is showing"*), offered until the learner has an attempt against that concept and then dropped: by then they have met it by doing.

`ACT` is no longer tied to dismissing that card. The scenario is applied when the challenge arrives, so the sandbox is already running the thing the question is about.

`COMPARE` and `EXPLAIN` are held on screen until the learner presses **Next**. The page used to swap the challenge out in the same tick the prediction was committed — the recommender moved, the panel's React key changed, and the result step was unmounted before anyone could read it. `ChartSandboxPage` now pins the challenge on screen from the moment an attempt is recorded.

| Module | Holds |
|---|---|
| `concepts.ts` | 10 concepts in dependency order |
| `challenges.ts` | 17 challenges, including counterfactual pairs |
| `scenarios.ts` | 7 named parameter sets |
| `placement.ts` | Two-axis diagnostic — KnowledgeDepth × Capability |
| `mastery.ts` | Derived from attempts; never stored as a grade |
| `vocabulary.ts` | Leak detection (see below) |
| `recommendations.ts` | What to do next, with an explainable rationale |
| `attempts.ts` | Pure state transitions plus storage |

### Four design rules

**Placement is inferred from real attempts**, never self-report, and never collapses to a single score. A learner strong on vocabulary but weak at diagnosis is a different person from the reverse, and one number hides that.

**Nothing is gated.** A concept whose prerequisites are unmet shows an open padlock and a note about what it builds on — and stays clickable. Greying it out reads as *"you have not earned this yet"*, which is the fastest way to lose an experienced practitioner. If you already know Little's Law, start at the bottleneck work.

**Vocabulary cannot leak.** A challenge may only use terms licensed by its own concept or a transitive prerequisite. Enforced by test — it has caught real leaks, including the word *"stacked"* appearing in a card that precedes the concept teaching stacked bands.

**Counterfactual pairs share a symptom and differ in mechanism.** Same visible shape, different cause. This is what separates reading a chart from reasoning about a system.

### Progress is named evidence, not a percentage

`73% complete` is not something a learner can act on. *"Still needs a transfer case"* is. `mastery.ts` returns the specific evidence still missing.

`interviewReadiness()` exists and is **permanently closed** in this phase. The rule it encodes — that readiness requires demonstrated articulation — outlives the phase that cannot yet measure it, so it is built and blocked rather than omitted.

## Testing

Model behaviour lives in `services/metrics/*.test.ts`, learning integrity in `services/learning/*.test.ts`.

The integrity suite is the unusual one. It does not test that code runs — it tests that the *teaching* is honest: no vocabulary leaks, no relationship revealed in the card that asks about it, no unbalanced answer options, every coupling reaching a chart, arithmetic never introduced after the assumption that depends on it.

> [!WARNING]
> Two bugs once made these checks pass vacuously — `\b` inside a template literal is the JavaScript escape for backspace, so `` new RegExp(`\b${label}\b`) `` was built from control characters and matched nothing. There is now a test asserting those checks *can* fail. If you write a regex guard here, prove it fails before trusting that it passes.

## See also

- [Architecture](Architecture) — where this sits in the wider app
- [Development Guide](Development-Guide) — adding a chart or a concept
