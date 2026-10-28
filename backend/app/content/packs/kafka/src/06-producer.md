---
id: producer
title: The producer: batching, partitioning, acks and idempotence
summary: A send is not a network call: records are serialized, partitioned, batched and sent to the leader, and acks plus idempotence decide what survives a failure.
sources: §1, §5, §7, §11, §21
---
## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 8 — Producer Internals** (Full)
  - *Relevant sections:* What happens when you call send(); How the partition is chosen; Batching: linger.ms and batch.size; Try it on your cluster
  - *Learning evidence:* Build a producer with explicit batch.size, linger.ms and compression.type, measure it with kafka-producer-perf-test, and justify each value.
- **Topic 13 — Producer Acknowledgements** (Full)
  - *Relevant sections:* acks: when is a write done?; Timeouts and retries; Ch 12 (Replication, ISR and durability)
  - *Learning evidence:* Choose acks (and min.insync.replicas) for a payments topic, a metrics topic and a click stream, and defend each choice.
- **Topic 14 — Idempotent Producer** (Full)
  - *Relevant sections:* The idempotent producer; What the docs don't say: one setting can quietly turn idempotence off
  - *Learning evidence:* Explain how producer IDs and sequence numbers stop duplicates on retry, and which settings silently disable idempotence.

## What happens when you call send()
`send()` returns almost immediately. The record goes through a pipeline inside the client, and the network comes last.

1. **Serialize.** The key and value serializers turn your objects into bytes.
2. **Partition.** The partitioner picks the partition (next section). The producer already has the cluster metadata, so it knows which broker leads each partition.
3. **Accumulate.** The record joins a **batch** for its partition in the producer's memory (`buffer.memory`, default **32 MiB**).
4. **Send.** A background thread sends ready batches to each partition's leader. One request to a broker carries batches for several partitions.
5. **Acknowledge.** The leader answers according to `acks`. The producer completes the record's future or calls its callback, with the partition and offset on success, or an error.

If records arrive faster than they can be sent, `buffer.memory` fills and `send()` **blocks** for up to `max.block.ms` (default **60 s**), then throws. That blocking is the producer's back-pressure: it is the first sign a broker or the network can't keep up.

## How the partition is chosen
The built-in logic, with no `partitioner.class` set:

- **The record names a partition:** that partition.
- **It has a key:** a hash of the key, so the same key always maps to the same partition while the partition count stays the same.
- **It has no key:** a **sticky** partition. The producer fills one partition's batch until at least `batch.size` bytes have gone to it, then moves on. That gives bigger batches than strict round-robin, and an even spread over time.

Two more settings exist. `partitioner.ignore.keys=true` ignores keys entirely. `partitioner.adaptive.partitioning.enable` (default `true`) sends more keyless records to partitions on faster brokers. You can also plug in your own `Partitioner`. The old `DefaultPartitioner` and `UniformStickyPartitioner` classes were removed in Kafka 4.0; the behaviour lives on as the default logic.

## Batching: linger.ms and batch.size
Batching is the producer's main efficiency lever: fewer, larger requests mean less overhead per record, and compression works on whole batches, so bigger batches compress better.

- `batch.size` (default **16384** bytes) is the **upper bound** of one partition's batch. A full batch is sent at once.
- `linger.ms` (default **5** ms since Kafka 4.0, previously 0) is how long the producer waits for a batch to fill before sending it anyway. The documentation explains the change: larger batches usually give similar or lower latency despite the wait.
- `compression.type` (default `none`; `gzip`, `snappy`, `lz4`, `zstd`) compresses each batch. The topic's own `compression.type` defaults to `producer`, meaning the broker keeps whatever the producer chose.

Raising `linger.ms` (to 20 or 50, say) and `batch.size` usually raises throughput and adds a little latency at low load. The right values come from measuring your record sizes and traffic, not from a table.

## acks: when is a write done?
`acks` decides how many copies must exist before the leader says "done".

Two details make `acks=all` precise. First, "all" means the **current in-sync set**, not every assigned replica: if the in-sync set has shrunk to just the leader, `acks=all` is satisfied by the leader alone. That is what the topic setting `min.insync.replicas` prevents: with `acks=all`, the leader refuses the write when the in-sync set is smaller than that number (chapter 12). Second, consumers never see a record until it is on every in-sync replica, whatever `acks` the producer used. `acks` changes what the **producer** is told, not what consumers see.

| acks | The leader answers | If the leader dies right after answering | Retries |
|---|---|---|---|
| 0 | Never: the record counts as sent once it is in the socket buffer, and the offset returned is -1 | The record may never have reached the broker | Have no effect: the producer can't see failures |
| 1 | After writing to its own log, without waiting for followers | Lost if no follower had copied it yet | Work |
| all (or -1), the default | After every replica currently in the in-sync set has it | Not lost while at least one in-sync replica survives | Work |

## Timeouts and retries
A producer retries transient errors on its own. Three settings bound it.

- `retries` defaults to the maximum integer. The documentation recommends leaving it alone and controlling retries with `delivery.timeout.ms`.
- `delivery.timeout.ms` (default **120 s**) is the whole budget from `send()` to success or failure: waiting in a batch, waiting for the ack, and every retry. It should be at least `request.timeout.ms` + `linger.ms`.
- `request.timeout.ms` (default **30 s**) is the wait for one response before retrying.
- Between attempts the producer backs off exponentially from `retry.backoff.ms` (**100 ms**) up to `retry.backoff.max.ms` (**1 s**), with **±20% random jitter** so clients don't retry in lockstep. These are the backoff-and-jitter ideas from your reliability notes, built into the client.

When `delivery.timeout.ms` runs out, the send fails and your callback gets the error. **What happens next is your code's decision**: log it, send the record to a fallback, or stop. A producer that ignores callback errors loses data silently.

## The idempotent producer
A retry is the classic source of duplicates: the broker wrote the batch, but the acknowledgement was lost, so the producer sends it again.

The **idempotent producer** prevents that inside the log. The broker gives each producer a **producer ID**, and the producer numbers every batch per partition with a **sequence number**. If a batch arrives with a sequence the broker has already written, it is recognised as a duplicate and not written again. The broker remembers the last **five** batches per producer, which is why idempotence requires `max.in.flight.requests.per.connection` to be **5 or less**.

**Idempotence is on by default** (`enable.idempotence=true`), and it needs `acks=all`, `retries` above 0, and at most 5 in-flight requests. It also keeps each partition in order even with several requests in flight.

What it does **not** do: it covers retries **within one producer session**. If your application crashes and restarts, the new producer gets a new ID, and anything your code sends again is a new record. Duplicates across restarts, and atomic writes across partitions, need **transactions** (chapter 8).

## What the docs don't say: one setting can quietly turn idempotence off
**Practical implication:** setting `acks=1` "for speed" can switch off duplicate protection without any error.

**Why it matters:** the documentation's rule is that if you set a conflicting option (such as `acks=1`, or more than 5 in-flight requests) **without** explicitly setting `enable.idempotence`, idempotence is silently disabled. Only if you explicitly set `enable.idempotence=true` together with a conflicting option does the producer refuse to start with a `ConfigException`.

**What to do:** in any producer where duplicates matter, set `enable.idempotence=true` explicitly. Then a conflicting change fails loudly at startup instead of quietly changing your guarantees.

**Verify further:** [Producer configs: enable.idempotence](https://kafka.apache.org/43/configuration/producer-configs/).

## Try it on your cluster
`kafka-producer-perf-test` sends synthetic records and reports throughput and latency. Use a fresh topic with several partitions:

```
kafka-topics.bat --bootstrap-server localhost:9092 --create --topic perf-ch6 --partitions 6 --replication-factor 1
```

1. Baseline, with the defaults:

```
kafka-producer-perf-test.bat --bootstrap-server localhost:9092 --topic perf-ch6 --num-records 500000 --record-size 200 --throughput -1 --command-property acks=all
```

2. No batching wait, no compression:

```
kafka-producer-perf-test.bat --bootstrap-server localhost:9092 --topic perf-ch6 --num-records 500000 --record-size 200 --throughput -1 --command-property acks=all linger.ms=0 batch.size=16384
```

3. Bigger batches and compression:

```
kafka-producer-perf-test.bat --bootstrap-server localhost:9092 --topic perf-ch6 --num-records 500000 --record-size 200 --throughput -1 --command-property acks=all linger.ms=20 batch.size=131072 compression.type=lz4
```

**What to record:** records/sec, MB/sec, average and 99th-percentile latency for each run. On one machine with one broker the numbers flatter everything (no network, no replication), so compare the runs with each other, not with production. Run each twice; the first run after starting the broker is often slower.

4. Watch idempotence refuse a conflict. This should fail at startup with a configuration error, because idempotence is explicitly on and `acks=1` conflicts with it:

```
kafka-producer-perf-test.bat --bootstrap-server localhost:9092 --topic perf-ch6 --num-records 10 --record-size 50 --throughput -1 --command-property enable.idempotence=true acks=1
```

## Interview takeaway
"A producer send is asynchronous: serialize, partition by key hash or sticky for keyless records, batch per partition, and send to the leader. I tune throughput with linger.ms, batch.size and compression, measured, not guessed. For durability it's acks=all with min.insync.replicas of 2 on a replication-factor-3 topic. Idempotence, on by default, removes duplicates from retries within a session using producer IDs and sequence numbers. It doesn't cover an application restart; that needs transactions. And I always handle the send callback, because when the delivery timeout expires it's my code that decides what happens to the record."
