---
id: delivery
title: Delivery semantics and transactions
summary: At-most-once, at-least-once and exactly-once are choices you make in the producer and the consumer together; transactions give exactly-once from Kafka to Kafka, and nowhere else by themselves.
sources: §1, §2, §5, §11, §14, §15, §20, §21
---
## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 12 — Delivery Semantics** (Full)
  - *Relevant sections:* Three guarantees, two halves; Choosing a semantic; What the docs don't say: exactly-once stops at Kafka's edge
  - *Learning evidence:* For a payment, a click and a stock-level update, choose a delivery semantic, say what configuration delivers it, and defend it.
- **Topic 15 — Transactions & EOS** (Full)
  - *Relevant sections:* Transactions: what they make atomic; Read-process-write, exactly once; Try it on your cluster
  - *Learning evidence:* Describe a transactional consume-process-produce pipeline: which settings, which calls, and what happens on abort.

## Three guarantees, two halves
The documentation defines the three in one line each:

- **At most once**: messages may be lost, but are never redelivered.
- **At least once**: messages are never lost, but may be redelivered.
- **Exactly once**: each message is processed once and only once.

Every guarantee has **two halves**, and you need both:

1. **Publishing:** did the event get into the log exactly once? (Producer: `acks`, retries, idempotence, transactions.)
2. **Consuming:** was each event's effect applied exactly once? (Consumer: when you commit, and whether processing is idempotent.)

**Kafka's default is at-least-once.** The producer retries; the consumer commits after processing.

## The producer half
- A network error leaves the producer unsure whether a write committed, like inserting into a database table with an auto-generated key and losing the reply.
- Retrying is at-least-once: the retry may duplicate a write that had succeeded.
- **Idempotence** (on by default) removes those retry duplicates: the broker deduplicates by producer ID and sequence number (chapter 6). It lasts one producer session.
- **Transactions** extend this across restarts and across partitions (below).
- **At-most-once publishing** means not retrying, so an uncertain write is dropped rather than repeated.

## The consumer half
The order of "process" and "commit" decides it (chapter 7):

- **Commit, then process** is at-most-once: a crash between them skips records.
- **Process, then commit** is at-least-once: a crash between them repeats records.
- **Exactly-once** needs the processing result and the offset to be saved **together**, so that both happen or neither does.

The documentation's recipe for at-most-once overall is precise: **no retries on the producer, and commit before processing** on the consumer. `acks=0` alone is not "at-most-once"; it is a durability choice about how much the producer waits for.

## Transactions: what they make atomic
A **transactional producer** can write to several partitions, and commit a consumer's offsets, as **one atomic unit**: all of it becomes visible, or none of it does.

How it works, in the order you'd use it:

1. The producer sets `transactional.id`, a stable name for this logical producer (it implies idempotence). On `initTransactions()`, the broker's **transaction coordinator** fences off any older producer with the same ID and aborts its unfinished transaction. That is how a restarted instance cleans up after a crashed one.
2. `beginTransaction()`, then ordinary `send()` calls to any partitions.
3. `sendOffsetsToTransaction(...)` adds the consumer's offsets to the same transaction.
4. `commitTransaction()` writes **commit markers** into every partition involved; or `abortTransaction()` writes abort markers.
5. Readers with `isolation.level=read_committed` see only committed transactional records, and only up to the **last stable offset**, the point before the first still-open transaction. Readers with the default `read_uncommitted` see everything, including aborted records.

A transaction left open longer than `transaction.timeout.ms` (default **1 minute**, capped by the broker's `transaction.max.timeout.ms`, default **15 minutes**) is aborted by the coordinator. Long transactions hold back `read_committed` readers, because the last stable offset can't move past them.

Two facts for a small cluster: the internal `__transaction_state` topic defaults to **replication factor 3** with **min ISR 2**, so by default transactions need **three brokers**; and since Kafka 4.0 (KIP-890) the broker defends against late or duplicate transactional writes more strictly, bumping the producer epoch on every transaction.

## Read-process-write, exactly once
The pattern the documentation describes, and that Kafka Streams uses internally:

```
consumer: isolation.level=read_committed, enable.auto.commit=false
producer: transactional.id=<stable id per instance>

producer.initTransactions()
loop:
    records = consumer.poll(...)
    producer.beginTransaction()
    for each record: producer.send(output record)
    producer.sendOffsetsToTransaction(offsets of what was processed, consumer.groupMetadata())
    producer.commitTransaction()
on an abortable error:
    producer.abortTransaction()
    reset the consumer to its last committed offsets, then continue
```

Three rules from the documentation:

- Partition assignment makes one consumer the only reader of each partition in the group.
- The output records and the offsets are committed atomically by the producer.
- Use **one producer per consumer** instance; it keeps transactions and rebalances simple.

**After an abort, the consumer does not rewind by itself.** Your code must reset its position, for example by seeking each partition back to its committed offset. The simplest policy is to close and recreate the producer and consumer, which rejoins the group and starts again from the committed offsets. The documentation classifies the errors: retriable ones are handled inside the client; an **AbortableException** means abort and reprocess; an **ApplicationRecoverableException** means restart the producer.

The easiest way to get all of this is Kafka Streams with `processing.guarantee=exactly_once_v2` (chapter 18), which the documentation calls the simplest route to exactly-once.

## Choosing a semantic
| Event | Sensible choice | Why |
|---|---|---|
| A payment instruction | At-least-once delivery plus an idempotent payment write keyed by payment id, or exactly-once inside Kafka with transactions | Losing it is unacceptable; doing it twice is too, so duplicates must be harmless |
| A page click for analytics | At-least-once, or at-most-once if the volume is huge and approximate counts are fine | An occasional duplicate or loss barely moves an aggregate |
| A stock-level update keyed by product | At-least-once with the latest value per key winning | Reapplying the same absolute value is harmless; a delta would not be |
| A Kafka to Kafka enrichment job | Exactly-once with transactions or Kafka Streams | Both ends are Kafka, so the offsets and output can commit together |

## What the docs don't say: exactly-once stops at Kafka's edge
**Practical implication:** Kafka transactions make **Kafka writes and Kafka offsets** atomic. They do not make an email, a payment API call or a database insert happen exactly once.

**Why it matters:** if your processing step calls an external system and then the transaction aborts, the external call has already happened. The documentation says exactly-once to other systems generally needs their cooperation, typically by storing the consumer's offset in the same place as the output, as the HDFS connector example does.

**What to do:** for external effects, use at-least-once delivery and make the effect idempotent: an idempotency key the external system checks, an upsert by primary key, or the offset stored with the output in one database transaction.

**Verify further:** [Design: message delivery semantics](https://kafka.apache.org/43/design/design/).

## Try it on your cluster
Your one-node config sets the transaction log to replication factor 1, so transactions work locally.

1. Produce transactionally with the perf tool. Each transaction stays open for `--transaction-duration-ms`, then commits:

```
kafka-topics.bat --bootstrap-server localhost:9092 --create --topic tx-ch8 --partitions 3 --replication-factor 1
kafka-producer-perf-test.bat --bootstrap-server localhost:9092 --topic tx-ch8 --num-records 20000 --record-size 100 --throughput 200 --transactional-id perf-tx --transaction-duration-ms 5000
```

2. While it runs, read with each isolation level in two terminals:

```
kafka-console-consumer.bat --bootstrap-server localhost:9092 --topic tx-ch8 --command-property isolation.level=read_uncommitted
kafka-console-consumer.bat --bootstrap-server localhost:9092 --topic tx-ch8 --command-property isolation.level=read_committed
```

**What you should see:** the `read_uncommitted` reader prints records steadily; the `read_committed` reader prints nothing, then a burst about every five seconds, as each transaction commits. That pause is the last stable offset holding committed readers back.

3. Look at the transactions from the broker's side:

```
kafka-transactions.bat --bootstrap-server localhost:9092 list
kafka-transactions.bat --bootstrap-server localhost:9092 describe --transactional-id perf-tx
```

The tool also has `find-hanging` and `abort`, for transactions left open by a producer that died; reach for them only after understanding why it hung.

## Interview takeaway
"Delivery semantics have a producer half and a consumer half. Kafka defaults to at-least-once. The idempotent producer removes retry duplicates within a session; transactions make writes to several partitions plus the consumer's offsets atomic, and read_committed consumers only see committed data. That gives exactly-once for Kafka-to-Kafka processing, which Kafka Streams packages as exactly_once_v2. It stops at Kafka's edge, though: for a database or an API I use at-least-once with idempotent writes, or store the offset with the output in one local transaction."
