---
id: throughput
title: Tuning throughput
summary: Throughput comes from bigger batches, compression and enough partitions; every lever trades some latency or memory, so measure before and after each change.
sources: §1, §2, §3, §5, §12, §21
---
## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 20 — Throughput Tuning** (Full)
  - *Relevant sections:* Where throughput comes from; Producer levers; Consumer levers; How to tune: one change at a time; Try it on your cluster
  - *Learning evidence:* Tune a producer and consumer pair with kafka-producer-perf-test and kafka-consumer-perf-test, change one setting at a time, and report the throughput and latency change for each.

## Where throughput comes from
Kafka is fast for structural reasons described in its design documentation: it writes sequentially to an append-only log, leans on the operating system's page cache, and moves data in **batches** end to end. The producer batches and compresses; the broker stores the batch as it arrived; the consumer fetches batches and decompresses them.

So most tuning is about one thing: **making batches bigger and fuller, without making latency unacceptable.** The second thing is **parallelism**: enough partitions, spread over enough brokers, read by enough consumers (chapter 10).

## Producer levers

The ordering of effects is consistent: **batch size and linger** decide how full requests are; **compression** shrinks every batch on the network and on disk, and works better the bigger the batch; **acks** decides how long each request waits.

| Setting | Default | Raise it to | Price |
|---|---|---|---|
| linger.ms | 5 | Wait longer for a batch to fill (10 to 50 ms is a common experiment) | Up to that much extra latency when traffic is light |
| batch.size | 16384 | Allow larger batches per partition | Memory: a buffer of this size is allocated per active partition batch |
| compression.type | none | gzip, snappy, lz4 or zstd; the codecs trade CPU for size differently, so measure each on your data | Producer CPU to compress, consumer CPU to decompress |
| buffer.memory | 33554432 (32 MiB) | Hold more unsent data across many partitions | Memory; when full, send() blocks for up to max.block.ms |
| acks | all | Lower only if you accept the loss window (chapter 6) | Durability; and acks other than all silently turns idempotence off |
| max.in.flight.requests.per.connection | 5 | Leave it; idempotence needs 5 or fewer | Over 5 disables idempotence |

## Consumer levers

Two notes. Fetch sizes are **not hard limits**: if the first batch is larger than the limit it is still returned, so a consumer never gets stuck behind a big record. And very often the consumer's real limit is **your processing**, not fetching. A consumer that spends 95% of its time in a database call gains nothing from fetch tuning (chapter 9).

| Setting | Default | What changing it does |
|---|---|---|
| fetch.min.bytes | 1 | Raise it so the broker waits to fill a bigger response: fewer requests, more latency |
| fetch.max.wait.ms | 500 | The longest the broker waits to reach fetch.min.bytes |
| max.partition.fetch.bytes | 1048576 (1 MiB) | Data per partition per fetch; raise it for large records or high-volume partitions |
| fetch.max.bytes | 52428800 (50 MiB) | Data per fetch across all partitions |
| max.poll.records | 500 | Records handed to your code per poll; lower it if processing a poll risks max.poll.interval.ms |

## Brokers and the cluster
Client tuning can't fix a saturated broker. The broker metrics that say "the broker is the bottleneck" (chapter 15):

- `RequestHandlerAvgIdlePercent` and `NetworkProcessorAvgIdlePercent` near 0 (the documentation suggests above 0.3 is healthy): the broker's threads are busy.
- `TotalTimeMs` for `Produce` or `FetchConsumer` rising, and in particular its **queue** time: requests wait before a thread picks them up.
- Uneven `BytesInPerSec` across brokers: partition leadership is unbalanced, or a hot partition.

The remedies there are cluster-level: more brokers with partitions reassigned onto them, leadership rebalanced, faster disks or network, fewer tiny requests (which is the client tuning above).

## How to tune: one change at a time
1. **Define the target**: messages per second and MB per second at peak, and the latency the business accepts (p99, not average).
2. **Measure a baseline** with production-like record sizes, keys, `acks` and replication. One broker on a laptop flatters everything.
3. **Change one setting**, measure again, keep it or revert it. Two changes at once teach you nothing.
4. **Watch the price**: p99 latency, producer and consumer CPU, memory, broker request-queue time.
5. **Write down the result** with its settings, so the next person doesn't repeat the experiment.

## Try it on your cluster
1. Create a topic and run the producer baseline (chapter 6 did the comparison; here record the full line, including percentiles):

```
kafka-topics.bat --bootstrap-server localhost:9092 --create --topic tune-ch11 --partitions 6 --replication-factor 1
kafka-producer-perf-test.bat --bootstrap-server localhost:9092 --topic tune-ch11 --num-records 1000000 --record-size 500 --throughput -1 --command-property acks=all linger.ms=5 batch.size=16384
```

2. Change only `linger.ms` to 25 and run again; then keep that and add `compression.type=lz4`; then raise `batch.size` to 131072. Write down records/sec, MB/sec and the 99th percentile each time.

3. Measure the consumer side. Each run uses a new group so it reads from the start:

```
kafka-consumer-perf-test.bat --bootstrap-server localhost:9092 --topic tune-ch11 --group perf-a --num-records 1000000
kafka-consumer-perf-test.bat --bootstrap-server localhost:9092 --topic tune-ch11 --group perf-b --num-records 1000000 --command-property fetch.min.bytes=1048576 --command-property max.partition.fetch.bytes=4194304
```

**What to read:** `MB.sec` and `nMsg.sec` in the output. On a laptop the consumer will be faster than the producer; in production, your processing code usually decides.

## What the docs don't say: throughput settings move latency's tail
**Practical implication:** a setting that doubles throughput can also raise p99 latency, and averages hide it.

**Why it matters:** with light traffic a batch waits the full `linger.ms` before sending; with `fetch.min.bytes` raised, a quiet partition's records wait for `fetch.max.wait.ms`. Neither shows up in an average taken at peak load.

**What to do:** report every tuning result as throughput plus p99 latency, measured at both peak and quiet traffic, and set the latency budget before you start tuning, not after.

**Verify further:** [Producer configs: linger.ms and batch.size](https://kafka.apache.org/43/configuration/producer-configs/).

## Interview takeaway
"Kafka throughput is mostly batching: producers fill bigger batches with linger.ms and batch.size, compress them with lz4 or zstd, and the broker and consumer handle whole batches. On the consumer side, fetch.min.bytes and the fetch sizes cut request overhead, but the usual limit is my own processing code. I tune against a stated target, one change at a time, with production-like records and replication, and I report p99 latency alongside throughput, because linger and fetch waits trade latency for throughput. If the brokers' request-handler idle drops toward zero, it's a cluster problem, not a client one."
