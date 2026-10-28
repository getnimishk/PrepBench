---
id: rebalancing
title: Rebalancing and consumer lag
summary: A rebalance moves partitions between consumers; done badly it stalls a group, and lag is how you see it, along with every other reason a group falls behind.
sources: §2, §5, §10, §11, §12, §22
---
## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 16 — Rebalancing Protocols** (Full)
  - *Relevant sections:* What triggers a rebalance; Eager and cooperative; The consumer protocol (Kafka 4.0); Static membership; Failure scenario: the rebalance storm
  - *Learning evidence:* Diagnose a rebalance storm from its symptoms, and list the configuration and code changes that stop it.
- **Topic 17 — Consumer Lag** (Full)
  - *Relevant sections:* What lag is; Reading lag; Why lag grows, and what to do; Try it on your cluster
  - *Learning evidence:* Measure a group's lag with kafka-consumer-groups, grow it on purpose, and write a plan to bring it down that names the bottleneck first.

## What triggers a rebalance
A **rebalance** reassigns a group's partitions among its members. It happens when:

- a consumer **joins** (a new instance, a restart, a deploy);
- a consumer **leaves** cleanly (`close()`), or is **declared dead** (no heartbeat within the session timeout);
- a consumer stops calling `poll` for longer than `max.poll.interval.ms` and **leaves on its own** (chapter 7);
- the **subscription changes**: a new topic matches a pattern subscription, or partitions are added to a subscribed topic.

Rebalances are normal and necessary: they are how a group recovers from a dead member. The problem is when they are frequent, slow, or stop the whole group.

## Eager and cooperative
The classic protocol has two styles, set by the assignor you choose.

- **Eager** (Range, RoundRobin, Sticky): every consumer **revokes all its partitions** before the rebalance, and nobody consumes until the new assignment is handed out. Simple, and a full stop for the whole group, every time.
- **Cooperative** (CooperativeSticky): consumers **keep** the partitions they own. The assignor only takes away the partitions that must move, and those are reassigned in a follow-up rebalance. Partitions that don't move keep being consumed throughout. The Javadoc recommends CooperativeSticky for newer clusters.

The client default `[RangeAssignor, CooperativeStickyAssignor]` uses Range (eager) but lets you move to CooperativeSticky with **one rolling restart that removes RangeAssignor** from the list.

## The consumer protocol (Kafka 4.0)
Kafka 4.0 made the **next-generation consumer rebalance protocol** (KIP-848) generally available. The documentation describes it as fully incremental, with **no global synchronization barrier**: members don't all stop and wait for each other.

What changes for you:

- The **broker** runs assignment, with server-side assignors: `uniform` (the default) or `range`. The client config `partition.assignment.strategy` no longer applies; `group.remote.assignor` can pick one.
- The **broker** owns the timers: `group.consumer.session.timeout.ms` (45 s) and `group.consumer.heartbeat.interval.ms` (5 s). The client settings `session.timeout.ms` and `heartbeat.interval.ms` can't be used.
- The broker has it enabled since 4.0. **The client does not**: you opt in with `group.protocol=consumer`.
- Moving from classic: RangeAssignor maps to `range`; CooperativeSticky, Sticky and RoundRobin map to `uniform`.

For a new application on a 4.x cluster, the consumer protocol is the modern choice. The classic protocol remains the client default for compatibility.

## Static membership
Every restart of an ordinary (**dynamic**) member looks like a leave plus a join, so a rolling deploy of ten consumers can trigger twenty rebalances.

**Static membership** gives each instance a fixed identity with `group.instance.id`. A restart under the same ID within the session timeout is recognised as the same member coming back, so **no rebalance** happens. Pair it with a session timeout longer than a restart takes. Two instances with the same ID are fenced: the duplicate is told to shut down (`FencedInstanceIdException`). It matters most for consumers with large local state, such as Kafka Streams apps, which take a long time to rebuild state after their tasks move.

## Failure scenario: the rebalance storm
**Symptoms:** the group's lag climbs; logs show members repeatedly joining and leaving; `CommitFailedException` errors; throughput collapses although no consumer crashed.

**The usual cause:** processing a batch takes longer than `max.poll.interval.ms`. A consumer stuck in a slow downstream call stops polling, leaves the group, and its partitions move. The next owner gets the same slow batch, and the cycle repeats. Long garbage-collection pauses and very short session timeouts cause the same pattern.

**How to stop it:**

1. **Find the slow step**: a downstream database, an API, a lock. Lag that grows while broker metrics look healthy usually points here.
2. **Shrink the batch**: lower `max.poll.records`, so each loop finishes well inside the interval.
3. **Give the work room**: raise `max.poll.interval.ms` if the work is legitimately slow.
4. **Commit in onPartitionsRevoked**, so each move doesn't redo work.
5. **Stop rebalances you don't need**: static membership for restarts, and the cooperative or consumer protocol so a move doesn't stop the whole group.

## What lag is
**Consumer lag** for a partition is the gap between the **log-end offset** (the offset the next produced record will get) and the group's **committed offset**. A lag of 4,000 means 4,000 records have been written that this group hasn't committed as consumed.

Lag is the single best health signal for a consumer. Steady and small: keeping up. Growing: falling behind. Growing on one partition only: a hot partition (chapter 10) or a poison record (chapter 14).

## Reading lag
Two places show it, and they measure slightly different things.

- **kafka-consumer-groups --describe** shows `CURRENT-OFFSET` (committed), `LOG-END-OFFSET` and `LAG` per partition, from the broker's point of view. It works even when the consumers are down.
- **The consumer's own metrics**: `records-lag-max` (the largest lag across its partitions) and per-partition `records-lag`. The documentation notes these are based on the consumer's **current position, not its committed offset**, so they can look better than the committed view.

The documentation's guidance for keeping up: max lag under a threshold, and the **minimum fetch rate above 0**. A fetch rate of zero means the consumer is not fetching at all, perhaps stuck or out of the group. Lag can't tell you that, because it can sit still while nothing moves.

## Why lag grows, and what to do
Find the bottleneck before adding anything.

| Where the bottleneck is | Sign | Remedy |
|---|---|---|
| Processing is slow (downstream DB or API) | Consumers busy, brokers idle, lag on every partition | Speed up or batch the downstream work; add consumers if there are idle partitions |
| Not enough parallelism | Every partition owned, every consumer saturated | More consumers, up to the partition count; beyond that, more partitions |
| One hot partition | Lag on one partition, others near zero | Fix the key distribution (chapter 10); more consumers won't help |
| Rebalance storm | Lag rises in waves; members join and leave | The rebalance-storm steps above |
| A poison record | One partition stuck at the same offset | Skip it to a dead-letter topic (chapter 14) |
| A burst of traffic | Lag rises, then falls steadily | Maybe nothing: Kafka buffers it, if retention is longer than the catch-up time |

## Try it on your cluster
1. Make lag on purpose. Create a topic, start a consumer in group `lag-demo`, stop it, then produce:

```
kafka-topics.bat --bootstrap-server localhost:9092 --create --topic lag-ch9 --partitions 3 --replication-factor 1
kafka-console-consumer.bat --bootstrap-server localhost:9092 --topic lag-ch9 --group lag-demo
kafka-producer-perf-test.bat --bootstrap-server localhost:9092 --topic lag-ch9 --num-records 30000 --record-size 100 --throughput 3000 --command-property acks=all
```

2. Describe the group while the consumer is stopped. LAG is about 10,000 per partition:

```
kafka-consumer-groups.bat --bootstrap-server localhost:9092 --describe --group lag-demo
```

3. Start the consumer again and describe repeatedly: lag falls to 0.

4. Try the consumer protocol. Start two consumers in a new group with the opt-in setting, then describe the group with `--state` and `--members`:

```
kafka-console-consumer.bat --bootstrap-server localhost:9092 --topic lag-ch9 --group modern-demo --command-property group.protocol=consumer
kafka-consumer-groups.bat --bootstrap-server localhost:9092 --describe --group modern-demo --state
kafka-consumer-groups.bat --bootstrap-server localhost:9092 --describe --group modern-demo --members
```

Stop one consumer and describe again: its partitions move to the other within a few seconds.

## What the docs don't say: more consumers is not a lag fix by default
**Practical implication:** adding consumers cuts lag only when there are partitions without a busy owner, and only when the consumers, not something downstream, are the bottleneck.

**Why it matters:** past the partition count, new consumers sit idle. Below it, they add load to the same slow database that caused the lag, which can make things worse. Every new member also triggers a rebalance.

**What to do:** look at which partitions lag, and at what the consumers are waiting on, before scaling. Scale consumers for processing capacity, partitions for parallelism, and the downstream for the downstream.

**Verify further:** [Consumer rebalance protocol](https://kafka.apache.org/43/operations/consumer-rebalance-protocol/).

## Interview takeaway
"Rebalances happen when members join, leave, die or stop polling. Eager assignors stop the whole group; cooperative-sticky only moves what must move; and Kafka 4.0's consumer protocol makes it incremental and broker-driven, with no global barrier. To avoid storms I keep each poll's work inside max.poll.interval.ms, use static membership for restarts, and commit on revocation. Lag is log-end offset minus committed offset per partition. I read which partitions lag and why before scaling, because more consumers don't fix a hot partition or a slow database."
