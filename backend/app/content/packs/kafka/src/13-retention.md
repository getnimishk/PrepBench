---
id: retention
title: Retention, compaction and tiered storage
summary: Delete retention keeps a time or size window of history; compaction keeps the latest value per key; tiered storage moves old segments to cheaper storage.
sources: §3, §4, §8, §12, §13, §21
---
## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 23 — Log Retention & Compaction** (Full)
  - *Relevant sections:* Delete retention: a window of history; Compaction: the latest value per key; Choosing between them; Try it on your cluster
  - *Learning evidence:* For an audit trail, a customer-profile changelog and a clickstream, choose delete, compact or both, with retention values, and justify each.
- **Topic 35 — Tiered Storage** (Full)
  - *Relevant sections:* Tiered storage; What the docs don't say: tiered storage is a plug-in you must supply
  - *Learning evidence:* Explain the cost and latency trade-off of tiered storage, and why it can't be used for a compacted topic.

## Delete retention: a window of history
With `cleanup.policy=delete` (the default), Kafka keeps a **window** of each partition's history and deletes what falls out of it. The window has two limits, and whichever is hit first applies:

- `retention.ms`: age, default **7 days**. The documentation calls it an SLA on how soon consumers must read their data. `-1` means no time limit.
- `retention.bytes`: size **per partition**, default **-1** (no limit). For a topic's total, multiply by the partition count.

Deletion works on **whole segments**. For time-based retention the broker looks at the **largest timestamp in each segment**: the segment goes when its newest record is past `retention.ms`. So an old record can outlive its retention while it shares a segment with newer ones. When the records in the active segment have all passed retention, Kafka rolls a new segment so the old one can be deleted.

A consumer that falls further behind than the retention window doesn't get an error about missing data. Its offset is now out of range, so `auto.offset.reset` decides where it lands: `latest` silently skips everything in between.

## Compaction: the latest value per key
With `cleanup.policy=compact`, Kafka keeps **at least the last value for every key**, and may remove older values. It is for **changelogs of keyed, changing data**: a customer's current profile, a product's current price, a Kafka Streams state store's changelog. A new consumer can read the topic from the beginning and rebuild the current state of every key.

How it works, and what it guarantees:

- The **head** of the log (recent records) is left alone; the log cleaner compacts the **tail** in the background, recopying segments without the superseded records. The active segment, the one being written to, is never compacted. Reads are never blocked.
- **Order is never changed**, only some records removed. **Offsets never change**: a removed record's offset is simply skipped.
- A record with a key and a **null value** is a **tombstone**: it deletes the key. Tombstones are themselves removed after `delete.retention.ms` (default **1 day**).
- A consumer that keeps up within the head sees every record. A consumer reading from the start sees at least the final value of every key, and sees the tombstones only if it reaches the head within `delete.retention.ms`.
- `min.compaction.lag.ms` keeps records uncompacted for at least that long; `max.compaction.lag.ms` bounds how long a record can wait to become eligible; `min.cleanable.dirty.ratio` (default **0.5**) sets how much of the log must be superseded before the cleaner bothers.

**Both** (`cleanup.policy=delete,compact`) compacts the log **and** deletes segments past retention: the latest value per key, but only for keys updated within the window.

## Choosing between them
| Topic | Policy | Why |
|---|---|---|
| Clickstream, logs, metrics | delete, days | Each event stands alone; old ones lose value |
| Order events for downstream services | delete, long enough to replay after an outage | Consumers must be able to recover from their last offset |
| Audit trail | delete with long retention, or an archive outside Kafka | Every event must be kept; compaction would remove history |
| Customer profile, product catalogue | compact | Consumers need the current value of every key, forever |
| Session state that expires | delete,compact | Latest value per key, but forget keys not seen for a while |

## Tiered storage
Most reads in Kafka are **tail reads** of recent data, served from the page cache. Old data is read rarely: a backfill, a new consumer, recovery. **Tiered storage** (KIP-405) uses that pattern: completed log segments go to a **remote tier** (object storage such as S3, or HDFS), and brokers keep only recent segments locally.

- Turn it on in the broker (`remote.log.storage.system.enable=true`) and per topic (`remote.storage.enable=true`).
- `local.retention.ms` and `local.retention.bytes` set how much stays on broker disks (default `-2`: the same as total retention); `retention.ms` and `retention.bytes` still set the total.
- **The trade-off:** much cheaper long retention, and brokers that are smaller and faster to replace, because there is less local data to re-copy. The cost: reads of old data come from remote storage, with its higher latency.
- **Documented limitations:** **no compacted topics**, and you must disable tiered storage on every topic before turning it off on the broker.

## What the docs don't say: tiered storage is a plug-in you must supply
**Practical implication:** turning tiered storage on in Apache Kafka isn't enough; there is nothing to store to until you add an implementation.

**Why it matters:** the documentation states that Kafka **does not ship** a `RemoteStorageManager` implementation. You must configure one (`remote.log.storage.manager.class.name` and its class path) for your object store. Managed services and vendor distributions ship their own.

**What to do:** treat tiered storage as an integration project: choose and test a plug-in for your storage, measure remote-read latency for your backfill patterns, and keep compacted topics on local storage.

**Verify further:** [Tiered storage](https://kafka.apache.org/43/operations/tiered-storage/).

## Try it on your cluster
1. Make a compacted topic that compacts quickly. Small segments and a low dirty ratio make the cleaner act within minutes rather than days:

```
kafka-topics.bat --bootstrap-server localhost:9092 --create --topic profiles-ch13 --partitions 1 --replication-factor 1 --config cleanup.policy=compact --config segment.ms=10000 --config min.cleanable.dirty.ratio=0.01 --config delete.retention.ms=10000
```

2. Produce several values per key, and a tombstone. `null.marker=NULL` turns the value `NULL` into a real null:

```
kafka-console-producer.bat --bootstrap-server localhost:9092 --topic profiles-ch13 --reader-property parse.key=true --reader-property key.separator=: --reader-property null.marker=NULL
```

```
cust1:email=a@example.com
cust2:email=b@example.com
cust1:email=a2@example.com
cust1:email=a3@example.com
cust2:NULL
```

3. Wait a minute or two, produce one more line (`cust3:email=c@example.com`, so a new segment rolls), wait again, then read from the start:

```
kafka-console-consumer.bat --bootstrap-server localhost:9092 --topic profiles-ch13 --from-beginning --formatter-property print.key=true --formatter-property print.offset=true
```

**What you should see:** fewer records than you wrote. `cust1` appears only with its latest value, at its original offset; the gaps in the offsets are the removed records. `cust2`'s tombstone may still appear with a `null` value until `delete.retention.ms` passes. The cleaner runs on its own schedule, so if nothing has changed yet, wait and produce one more record.

4. Look at a delete-policy topic's settings to see the window you've been relying on:

```
kafka-configs.bat --bootstrap-server localhost:9092 --entity-type topics --entity-name orders --describe --all
```

## Interview takeaway
"Delete retention keeps a time or size window per partition, working a whole segment at a time; it's the SLA for how far behind a consumer can fall. Compaction keeps the latest value per key, with tombstones for deletes, and never reorders or renumbers anything, so it suits changelogs and state; delete,compact does both. Tiered storage moves completed segments to object storage for cheap long retention and lighter brokers, at the cost of slower reads of old data. It doesn't support compacted topics, and in Apache Kafka you bring your own storage plug-in."
