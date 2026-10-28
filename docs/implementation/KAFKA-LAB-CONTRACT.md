# Kafka Lab contract

**Status:** built, 2026-10-28, on branch `feat/kafka-lab` (stacked on `feat/kafka-scenarios`, PR #110). All six experiments are ready, so the lab is AVAILABLE.
**Learner brief:** "Consider me a beginner. I have never seen production Kafka. Design it zero to hero." The learner
handed every design choice to the builder; the choices below are the builder's, recorded so a reviewer can check them.

## 1. What it is

A second lab beside the ADF Behaviour Lab, for a preparation with the `kafka` content pack attached: six experiments
that take a beginner from "what is a log" to "why acknowledged writes get lost", each on a small simulated Kafka
cluster drawn on screen. Every experiment runs the same eight-stage loop as the ADF lab (Understand, Predict,
Manipulate, Observe, Reason, Apply, Explain, Retrieve) through the same runner, and keeps its attempts the same way.

It is a **teaching simulation, not Kafka running**, and every screen says so. The learner's own Kafka install is
where the guide's "Try it on your cluster" steps happen; the lab is where they see what those steps would show.

### Goals
- A beginner can climb the ladder in order, each experiment using only what the earlier ones taught.
- Every rule a model applies is either a fact from `docs/research/kafka-documentation-notes.md` (cited by section) or
  a labelled teaching assumption, in a coupling ledger shown on screen, as the ADF lab does.
- Answers are graded from the model's own run, never decided by hand (the ADF definition contract).
- The ADF lab keeps working exactly as before, with the same attempt ids, so its saved runs are untouched.

### Non-goals
- Not a Kafka emulator: no real brokers, no wire protocol, no timing beyond what each lesson needs.
- No new tables or endpoints: attempts go through `learning_attempts`, as the ADF lab's do.
- No CCDAK questions: the question bank is separate work.

### Anti-goals (a failure even if it works)
- A model rule that contradicts the guide or the docs.
- A beginner meeting a term no earlier experiment or chapter explained.
- Any change to an ADF lab attempt id, title or route.

## 2. Scope: six experiments, seven tracks

| # | Slug | Title | The idea it lands | Guide chapters | Roadmap topics |
|---|---|---|---|---|---|
| 1 | `log` | The log, not a queue | Records stay after they are read; each group reads at its own position; a new group starts at the end by default | 2 `log`, 7 `consumer` | 3, 9 |
| 2 | `keys` | Keys, partitions and order | Same key, same partition; order only within a partition; a hot key stays hot; adding partitions moves keys | 2 `log`, 10 `keys` | 18, 19, 21 |
| 3 | `groups` | Consumer groups and parallelism | One consumer per partition per group; extra consumers idle; groups are independent; lag comes from capacity | 7 `consumer`, 9 `rebalancing` | 10, 17 |
| 4 | `commits` | Commits and crashes | When you commit decides lost or repeated work after a crash; idempotent effects make repeats harmless | 7 `consumer`, 8 `delivery` | 11, 12 |
| 5 | `replication` | Copies, acks and min ISR | Who must have a write before it is acknowledged; when writes are refused instead of risked | 6 `producer`, 12 `replication` | 13, 22 |
| 6 | `failures` | When things go wrong (two modes) | `poison`: a bad record blocks a partition until it is dead-lettered. `retries`: retrying in place, at every layer, turns an outage into a storm | 14 `failures` | 24, 25 |

Scope is six. Adding, removing or merging an experiment is a product decision, as it was for ADF.

## 3. The experiments

Each section names the levers, the scenario the learner predicts, the outcomes the model reports, and the questions.
"§n" is a section of the research notes.

### E1. The log, not a queue (`log`)
- **Model:** one topic, one partition; a producer writes 6 order records (offsets 0 to 5); group `billing` reads all of
  them and commits; then group `analytics` starts.
- **Levers:** analytics' `auto.offset.reset` (latest, earliest); whether analytics uses its own group id or billing's;
  retention (7 days, 1 hour with the records 2 hours old).
- **Outcomes:** `none` (analytics reads nothing of the 6), `all` (reads all 6), `gone` (retention removed them).
- **Predict:** defaults: own group, `latest`, 7-day retention: answer `none`. Reading does not delete (§13); a group with
  no committed offset starts at `latest` by default (§2).
- **Reason:** the new group had no committed offset, so the reset policy decided, and its default is latest.
- **Apply:** "Analytics must process the history." Right when the run reads all 6 (earliest, own group, 7 days).
  Billing's group id is wrong: it shares billing's committed offset and reads nothing.
- **Retrieve:** the default of `auto.offset.reset` (latest), from chapter 7.

### E2. Keys, partitions and order (`keys`)
- **Model:** 6 partitions; 24 events for 8 orders of 3 customers, one customer with most of the traffic. A teaching
  hash maps a key to a partition (labelled: Kafka's built-in partitioner hashes the key; the exact function is not
  what is taught).
- **Levers:** key (order ID, customer ID, none); partitions (6, 12); the big customer's share (50%, 80%).
- **Outcomes:** `balanced` (no partition over twice the average, every order's events in one partition), `hot`
  (one partition over twice the average), `unordered` (an order's events in more than one partition).
- **Predict:** customer ID, 6 partitions, 80%: `hot`.
- **Reason:** every record with one key goes to one partition, so one customer's traffic lands on one partition (§13, §1).
- **Apply:** "Keep each order's events in order and spread the load." Right when `balanced`: key by order ID.
  No key spreads load but breaks per-order order (`unordered`, from the sticky partitioner, §1).
- **Findings also show:** at 12 partitions, how many keys moved from where they were at 6 (§12).
- **Retrieve:** order is guaranteed within a partition (chapter 10).

### E3. Consumer groups and parallelism (`groups`)
- **Model:** a topic with P partitions receiving 700 records/s evenly; a group of C consumers, each able to process R
  records/s; partitions assigned round-robin, at most one consumer each (§5). A second group may read the same topic.
- **Levers:** consumers (4, 6, 8); partitions (6, 12); per-consumer rate (100, 150 records/s); second group (off, on).
- **Outcomes:** `keeps-up` (capacity ≥ 700), `falls-behind` (lag grows), with idle consumers reported.
- **Predict:** 6 partitions, 8 consumers, 100/s: `falls-behind` (only 6 active: 600/s; 2 idle).
- **Reason:** a partition has one consumer in a group, so parallelism stops at the partition count (§12).
- **Apply:** "Keep up with 700 records/s." Right when `keeps-up`: 12 partitions with 8 consumers, or 6 consumers at
  150/s. Ten consumers on 6 partitions does not.
- **Findings also show:** a second group reads everything again and doesn't change the first group's lag (§13).
- **Retrieve:** the maximum parallelism of a group is its topic's partition count (chapter 7).

### E4. Commits and crashes (`commits`)
- **Model:** a consumer reads 10 order records (offsets 0 to 9), each sends one confirmation email, and crashes after
  sending 6; it restarts from its committed offset.
- **Levers:** when it commits (before processing, after processing, background auto-commit with work handed to other
  threads); whether the email step checks an order ID first (idempotent: no, yes).
- **Outcomes:** `lost` (some orders never emailed), `repeated` (some emailed twice), `exact`.
- **Predict:** commit before processing: `lost` (4 orders).
- **Reason:** the committed offset ran ahead of the work, so the restart skipped what was unfinished (§5, §22).
- **Apply:** "No order may be missed and none emailed twice." Right when `exact`: commit after processing with an
  idempotent email. Commit after without the check is `repeated`; auto-commit with hand-off can be `lost` (§22).
- **Retrieve:** the committed offset is the last processed plus one (chapter 7).

### E5. Copies, acks and min ISR (`replication`)
- **Model:** a topic with replication factor 3 on three brokers; the leader writes a record; some followers may be
  out of the ISR. After the acknowledgement, the leader's broker fails.
- **Levers:** producer `acks` (0, 1, all); topic `min.insync.replicas` (1, 2); followers in sync (2, 1, 0).
- **Outcomes:** `safe` (acknowledged with at least two copies), `one-copy` (acknowledged with only the leader's copy:
  lost when it fails), `refused` (NotEnoughReplicas: the ISR is below the minimum and acks=all), `unconfirmed`
  (acks=0: the producer never learns).
- **Predict:** acks=1, min ISR 1, both followers in sync: `one-copy`. The leader acknowledged before followers copied (§1).
- **Reason:** acks=1 waits for the leader alone (§1).
- **Apply:** "A write must survive one broker failing, or the producer must be told it can't be." Right when `safe` or
  `refused`. acks=1 with min ISR 2 is still `one-copy`: min ISR applies only to acks=all (§3, §7).
- **Retrieve:** the documented durable setup: replication factor 3, min ISR 2, acks=all (chapter 12, §23).

### E6. When things go wrong (`failures`, modes `poison` and `retries`)
- **`poison` model:** a partition of 10 records; offset 4 cannot be deserialized. Levers: handling (crash and restart,
  skip it and continue, dead-letter it then move on). Outcomes: `stuck` (the partition never passes offset 4),
  `lost-silently` (passes, keeps nothing of the bad record), `flowing-kept` (passes, the record is in the dead-letter
  topic with its offset). Predict: crash and restart: `stuck`. Reason: a consumer won't move past a record by itself
  (§23). Apply: "Keep the partition moving and lose nothing": dead-letter. Retrieve: the Apache Kafka client has no
  built-in dead-letter topic (chapter 14, §23).
- **`retries` model:** a downstream service is down for 40 minutes. Levers: where retries happen (in the poll loop,
  retry topics), how many layers retry (1, 4; 3 attempts each), circuit breaker (off, on). Outcomes: `storm` (calls
  multiply: 3^layers per record), `stalled` (in-place retries keep a partition from polling past
  `max.poll.interval.ms`, the group rebalances), `recovers`. Predict: in the poll loop, 4 layers, no breaker: `storm`.
  Reason: retries multiply across layers (§20 arithmetic, a general reliability point, labelled). Apply: "Bounded calls
  and processing resumes when the service is back": retry topics, one layer, breaker on. Retrieve: the producer's own
  retry backoff has ±20% jitter (chapter 14, §1).

## 4. Shared architecture

### 4.1 One lab runner for two labs
The ADF lab's parts become lab-neutral, driven by a small `LabSpec`:

| Field | ADF (unchanged) | Kafka |
|---|---|---|
| pack | `adf` | `kafka` |
| name | ADF Behaviour Lab | Kafka Lab |
| attempt uid prefix | `ab:` | `kb:` |
| challenge prefix | `adf.lab.` | `kafka.lab.` |
| fingerprint key | `adf-lab=` | `kafka-lab=` |
| routes | `/lab/adf`, `/lab/adf/:slug` | `/lab/kafka`, `/lab/kafka/:slug` |

`ExperimentRunner`, the attempt helpers and the stage logic take the spec; ADF passes its own and every ADF id, route
and title stays byte-identical (existing ADF tests must pass unchanged, plus a test pinning the ADF ids).

### 4.2 The picture
Definitions may return a `picture` with a run: lanes of cells (a partition's offsets, a broker's replicas, a group's
assignment), each cell with a label and a tone, plus markers (a group's position, the committed offset). One renderer
draws it as SVG from theme tokens (no hex colours; text through `pxToRem`, scaling with Large text). Shown at Observe,
for the scenario and for the learner's run side by side.

### 4.3 Persistence, evidence, links
- `learning_attempts` only, keyed as in 4.1. A finished run is never edited; starting again is run n+1.
- Backend `portfolio_sources.py` recognises `kafka.lab.` attempts as a `kafka_lab` family, titled from the frontend
  registry like ADF's; Evidence levels exactly as for ADF lab runs.
- Guide chapters link to the experiments that practise them; topic links via `curriculumLinks.ts` for the Kafka pack's
  roadmap numbers; each experiment links back to its chapters and roadmap topics. The registry's chapters and topics
  are checked against the Kafka pack's alignment blocks by a test, as ADF's are.

### 4.4 Availability
A preparation with the `kafka` pack gets `learningLab` and the Kafka lab's status from its registry (AVAILABLE only
when all six are ready), exactly as a preparation with the `adf` pack gets the ADF lab. The Learning Lab hub gets a
Kafka Lab card, the nav a Kafka Lab entry, both capability-aware. Never offered to a preparation without the pack.

## 5. Tests the implementation adds
- Each model: pure, deterministic; every outcome reachable; the predict scenario gives the stated answer; every apply
  option graded from its own run; every finding's ledger id exists; every `fact` coupling cites a notes section.
- Registry: chapters and topics resolve in the Kafka pack's newest version.
- ADF unchanged: ADF attempt ids, challenge ids and routes pinned.
- Persistence: Kafka uids parse, are scoped to the preparation, and never collide with ADF's.
- Backend: a `kafka_lab` attempt is titled and levelled in Evidence; an ADF one is unchanged.
- Routes in `responsive.spec.ts`, `accessibility.spec.ts` and `navigation.spec.ts`.

## 6. Left to the builder
Copy, colours within the token set, the exact cell counts drawn, and the order of findings, within the rules above.
