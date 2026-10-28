---
id: consumer
title: The consumer: poll loop, groups and offset commits
summary: A consumer pulls records, a group shares partitions among its members, and the committed offset decides what is re-read after a crash.
sources: §2, §5, §6, §10, §12, §22
---
## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 9 — Consumer Internals** (Full)
  - *Relevant sections:* The poll loop; Two positions per partition; Staying in the group
  - *Learning evidence:* Build a consumer that turns auto-commit off, commits after processing, and resumes correctly after you kill it mid-batch.
- **Topic 10 — Consumer Groups & Assignment** (Full)
  - *Relevant sections:* Consumer groups: sharing the partitions; Assignment strategies; Try it on your cluster
  - *Learning evidence:* For a six-partition topic, state the maximum useful group size, and show with kafka-consumer-groups which consumer owns which partition as you add members.
- **Topic 11 — Offset Commit Strategies** (Full)
  - *Relevant sections:* Committing offsets: auto or manual; The crash test; What the docs don't say: auto-commit is safe only if you finish the batch
  - *Learning evidence:* Implement commit-after-process correctly, and explain which records are lost or repeated if the process dies before and after the commit.

## The poll loop
A Kafka consumer **pulls**. It asks the leaders of its partitions for records from a given offset, and the broker returns a chunk of log from there. The documentation explains the choice: with pull, a slow consumer simply falls behind and catches up later, instead of being overwhelmed the way a push system would overwhelm it.

Every consumer is the same loop:

```
subscribe to topics (joining the group)
loop:
    records = poll(timeout)       # fetch, and keep group membership alive
    for each record: process it
    commit the offsets of what was processed
close (leave the group cleanly)
```

`poll` returns up to `max.poll.records` (default **500**) records. Fetching is done in the background in bigger chunks (`fetch.min.bytes`, `fetch.max.wait.ms`, `max.partition.fetch.bytes`), and records are handed out across polls. The consumer object is **not thread-safe**: one thread polls it. The one exception is `wakeup()`, which another thread may call to break a blocking `poll` during shutdown.

## Two positions per partition
For each partition it reads, a consumer has two offsets, and confusing them causes most consumer bugs.

- **Position:** the offset of the next record `poll` will return. It moves forward on every `poll`, whether or not you have processed anything.
- **Committed offset:** the offset stored in Kafka (in the internal `__consumer_offsets` topic) for the group and partition. After a restart or a rebalance, this is where reading resumes.

The committed offset means **"the next record to read"**, not "the last record processed". After processing offset 41, you commit **42**. Get this wrong by one and every restart re-reads one record per partition, or skips one.

When a group has **no** committed offset for a partition (a new group, or offsets expired), `auto.offset.reset` decides where to start: `latest` (the default: only new records), `earliest` (the oldest retained), `by_duration:<ISO-8601 duration>` (that far back in time), or `none` (fail). Committed offsets expire `offsets.retention.minutes` after a group becomes empty (default **7 days**), so a group idle longer than that starts over from `auto.offset.reset`.

## Consumer groups: sharing the partitions
Consumers with the same `group.id` form a **group**. Kafka assigns each partition of the subscribed topics to **exactly one** member of the group at a time. That one rule gives you:

- **Parallelism inside a group:** six partitions can be read by up to six consumers at once.
- **A ceiling:** with six partitions, a seventh consumer in the group gets **nothing** and sits idle. **Maximum useful group size = number of partitions.**
- **Independence across groups:** a different group gets every partition again, with its own offsets.
- **Failover:** when a member leaves or dies, its partitions are reassigned to the rest (a **rebalance**, chapter 9).

```
orders (6 partitions), group "billing" with 3 consumers:
  C1: P0, P1     C2: P2, P3     C3: P4, P5
orders, group "analytics" with 1 consumer:
  A1: P0 to P5   (reads everything, independently of billing)
```

If you need more consumers than partitions, the options are more partitions (chapter 10), or a **share group** (Kafka 4.2+), where consumers share partitions and acknowledge records one by one, at the cost of per-partition ordering.

## Assignment strategies
Who gets which partition is decided by an assignor. Kafka 4.x has two group protocols (chapter 9 covers them in depth):

- **Classic protocol** (the client default): the client config `partition.assignment.strategy`, default **[RangeAssignor, CooperativeStickyAssignor]**. Range assigns contiguous ranges per topic; RoundRobin deals partitions out one at a time; Sticky keeps existing assignments where it can; **CooperativeSticky** does the same without stopping the whole group (preferred for newer clusters).
- **Consumer protocol** (`group.protocol=consumer`, generally available since 4.0): the **broker** assigns, using `uniform` (the default) or `range`.

## Committing offsets: auto or manual
**Auto-commit** (`enable.auto.commit=true`, the default) commits the current position every `auto.commit.interval.ms` (default **5 s**), as part of polling. It is at-least-once **only if** you finish processing everything a `poll` returned before calling `poll` again. If you hand records to another thread and poll on, the commit can run ahead of the processing, and a crash loses those records.

**Manual commit** (`enable.auto.commit=false`) puts you in charge:

- `commitSync()` blocks until the commit succeeds or fails. Simple and safe; costs a round trip.
- `commitAsync()` doesn't block; failures arrive in a callback, and a later commit may overtake an earlier one. A common pattern: async in the loop, one final sync commit on shutdown.
- Commit specific offsets per partition (last processed + 1) for finer control.

**Before a partition is taken away** in a rebalance, the client calls `onPartitionsRevoked` on your `ConsumerRebalanceListener`. That is the place to commit what you have processed, so the next owner doesn't redo it.

## The crash test
Where you commit relative to processing **is** your delivery guarantee.

At-least-once with **idempotent processing** (writing with a primary key, so a repeat overwrites itself) is the most common production design.

| Order of operations | Crash between the two steps | Result |
|---|---|---|
| Commit, then process | The offset says done; the work was never done | Records lost: at-most-once |
| Process, then commit | The work was done; the offset was not saved | Records processed again: at-least-once |
| Process and commit atomically | Not possible to split | Exactly-once, needs transactions or an idempotent sink (chapter 8) |

## Staying in the group
Two separate timers decide whether a member is alive.

- **Heartbeats** (session timeout, default **45 s**): no heartbeat for that long and the member is declared dead. In the classic protocol the client sets `session.timeout.ms` and `heartbeat.interval.ms` (default **3 s**, at most a third of the session); in the consumer protocol the **broker** sets them (`group.consumer.session.timeout.ms`, `group.consumer.heartbeat.interval.ms` default **5 s**).
- **Progress** (`max.poll.interval.ms`, default **5 minutes**): heartbeats can keep flowing while your code is stuck. If `poll` isn't called within this interval, the consumer **leaves the group** and its partitions move. Its next `commitSync()` fails with `CommitFailedException`, because only current members may commit.

Slow processing (a slow database, an external API) is the usual cause of the second. Fix it by processing faster, fetching fewer records per poll (`max.poll.records`), or, if the work really is slow, raising `max.poll.interval.ms`.

## Try it on your cluster
1. Make a six-partition topic and fill it with keyed records:

```
kafka-topics.bat --bootstrap-server localhost:9092 --create --topic orders-ch7 --partitions 6 --replication-factor 1
kafka-producer-perf-test.bat --bootstrap-server localhost:9092 --topic orders-ch7 --num-records 60000 --record-size 100 --throughput 2000 --command-property acks=all
```

2. Start **one** consumer in group `billing`, then describe the group from another terminal:

```
kafka-console-consumer.bat --bootstrap-server localhost:9092 --topic orders-ch7 --group billing
kafka-consumer-groups.bat --bootstrap-server localhost:9092 --describe --group billing
```

**What you should see:** one consumer ID owning all six partitions.

3. Start a second and a third identical consumer, describing the group after each. The six partitions are re-shared: three each, then two each.

4. Start a seventh consumer. Describe again: still only six rows have an owner, and the seventh member owns nothing. Add `--members` to the describe command to see each member's partition count.

5. Commit-after-process in your Python consumer (kafka-python). Turn auto-commit off and commit only after the work is done:

```
consumer = KafkaConsumer("orders-ch7", bootstrap_servers="localhost:9092", group_id="billing-py", enable_auto_commit=False, auto_offset_reset="earliest")
for message in consumer:
    process(message)          # your business logic
    consumer.commit()         # blocks until the commit succeeds or fails
```

Kill it partway (Ctrl+C or close the window), then run it again: it resumes from the last commit. Move `consumer.commit()` above `process(message)`, repeat, and note which record goes missing. Committing after every record is slow but clear; committing every N records is the usual middle ground.

## What the docs don't say: auto-commit is safe only if you finish the batch
**Practical implication:** auto-commit isn't "at-least-once" by itself. It is at-least-once only when every record from a poll is fully processed before the next poll.

**Why it matters:** many consumers hand records to a worker pool and poll again straight away, for throughput. Auto-commit then commits positions for records still in the pool, and a crash loses them, silently, with no error.

**What to do:** with asynchronous processing, turn auto-commit off and commit an offset only once every record below it is done, per partition.

**Verify further:** [KafkaConsumer Javadoc: offsets and consumer position](https://kafka.apache.org/43/javadoc/org/apache/kafka/clients/consumer/KafkaConsumer.html).

## Interview takeaway
"Consumers pull. Within a group each partition has exactly one owner, so the partition count caps a group's parallelism and extra consumers idle. Each group has its own committed offsets, which is how several applications read the same topic independently. The committed offset is the next record to read, and whether you commit before or after processing decides at-most-once versus at-least-once. I default to manual commit after processing, with idempotent writes downstream, commit in onPartitionsRevoked, and keep processing inside max.poll.interval.ms so the consumer isn't kicked out of the group."
