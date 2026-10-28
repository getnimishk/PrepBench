---
id: log
title: Topics, partitions and offsets
summary: A topic is a name; a partition is the ordered log; an offset is a position in one partition only.
sources: §3, §5, §12, §13
---
## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 3 — Topics, Partitions, Offsets** (Full)
  - *Relevant sections:* Topic, partition, offset; The log on disk: segments; Try it on your cluster
  - *Learning evidence:* Describe a three-partition topic with `kafka-topics --describe`, and explain why offset 5 exists in more than one partition.
- **Topic 19 — Ordering Guarantees** (Full)
  - *Relevant sections:* What Kafka orders, and what it doesn't; What the docs don't say: retries could reorder, and idempotence prevents it; Ch 10 (Partition keys, sizing and hot partitions)
  - *Learning evidence:* Explain why "all orders in the order they were placed" needs a different design from "each order's events in order".

## Topic, partition, offset
**Topic.** A named stream of events, such as `orders` or `payments`. The documentation compares it to a folder of files. A topic is multi-producer and multi-subscriber: any number of applications can write to it and read from it. A topic is a **name**, not a single file and not a single ordered list.

**Partition.** A topic is split into partitions spread across brokers. Each partition is an **ordered, append-only log**: new records go on the end, and existing records are never edited in place. Partitions are what let Kafka scale: different brokers serve different partitions, and different consumers read them in parallel. The partition is also the unit of replication (chapter 12) and of consumer parallelism (chapter 7).

**Offset.** The position of a record within **its** partition, starting at 0. Offsets are per partition, so offset 5 exists in partition 0 and in partition 1, and they are unrelated records. **A record is identified by topic, partition and offset together.** An offset never changes, even under log compaction (chapter 13).

```
orders, partition 0:  [0] ORDER-1001 CREATED   [1] ORDER-1004 CREATED   [2] ORDER-1001 PAID
orders, partition 1:  [0] ORDER-1002 CREATED   [1] ORDER-1002 PAID
orders, partition 2:  [0] ORDER-1003 CREATED
```

Order is guaranteed inside partition 0, inside 1 and inside 2. There is no single guaranteed order across all three.

## What Kafka orders, and what it doesn't
The guarantee is precise: **records in one partition are stored, and read, in the order they were written.** Any consumer of a partition reads its events in exactly that order.

From that one rule come three consequences you must be able to state:

- **Same key, same partition, same order.** The default partitioner hashes the key, so every event for `ORDER-1001` lands in the same partition and stays in order.
- **No order across partitions.** A consumer reading several partitions sees them interleaved. "All orders in the order they were placed" across a multi-partition topic is not something Kafka gives you.
- **The key-to-partition mapping changes if the partition count changes.** Adding partitions moves some keys to new partitions, so for a while one key's events sit in two partitions and their order is not guaranteed (chapter 10).

If you truly need one total order, you need one partition, and you give up parallelism. Usually what you need is order **per entity** (per order, per account, per device), and the key gives you that.

## The log on disk: segments
Each partition is a folder on the broker named `<topic>-<partition>`, for example `orders-0`. That folder naming is why a topic name can be at most **249 characters**.

Inside the folder the log is split into **segment files**. To read from an offset, the broker finds the segment that holds it, then the position inside that file. Kafka writes to the newest (active) segment and rolls to a new one when the segment reaches `segment.bytes` (default **1 GiB**) or `segment.ms` (default **7 days**). Retention and compaction work **a whole segment at a time** (chapter 13), which is why a record can outlive its retention period while it shares a segment with newer records.

## Try it on your cluster
1. Describe the topic from chapter 1:

```
kafka-topics.bat --bootstrap-server localhost:9092 --describe --topic orders-ch1
```

**What you should see:** one line per partition, with `Leader: 1`, `Replicas: 1`, `Isr: 1`, because your cluster has one broker.

2. Look at the folders on disk. Find `log.dirs` in your `config\server.properties`, then list that folder. You should see `orders-ch1-0`, `orders-ch1-1` and `orders-ch1-2`, each holding a `.log` segment file and the index files Kafka keeps to find an offset inside it.

3. Read one partition only, from a chosen offset:

```
kafka-console-consumer.bat --bootstrap-server localhost:9092 --topic orders-ch1 --partition 0 --offset 0 --formatter-property print.offset=true --formatter-property print.key=true
```

**What you should see:** only that partition's records, in order, starting at offset 0. Try `--partition 1` and notice the offsets start at 0 again.

## What the docs don't say: retries could reorder, and idempotence prevents it
**Practical implication:** "one partition is ordered" assumes the producer wrote the records in order. A producer that retries can break that, unless idempotence is on.

**Why it matters:** the producer can have up to five requests in flight per connection. If an older batch fails and is retried while a newer one succeeds, the newer records could land first. The producer documentation says this reordering can happen when idempotence is off and more than one request is in flight. With idempotence on, which is the default, ordering is preserved.

**What to do:** keep `enable.idempotence` at its default of `true`, and don't set conflicting options (such as `acks=1`) that silently turn it off (chapter 6).

**Verify further:** [Producer configs: max.in.flight.requests.per.connection](https://kafka.apache.org/43/configuration/producer-configs/).

## Design trade-off
A topic's partition count is a commitment: Kafka **cannot reduce** it, and increasing it remaps keys. More partitions buy parallelism and throughput; fewer keep operations light and each key's order intact. Chapter 10 covers sizing; the rule here is to decide it on purpose rather than leave it to `num.partitions=1`, the broker default for automatically created topics.

## Interview takeaway
"Ordering in Kafka is per partition. Records with the same key hash to the same partition, so if I key by the entity whose events must stay in order, such as an order id, I get per-entity order and still spread load across partitions. A total order across a topic means one partition, which caps throughput at one consumer, so I'd challenge whether it's really needed. And I'd keep idempotence on, because retries with several requests in flight can otherwise reorder a partition."
