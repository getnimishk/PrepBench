---
id: keys
title: Partition keys, sizing and hot partitions
summary: The key decides what stays in order and how load spreads; the partition count caps parallelism and can't be undone; a hot key can't be fixed by adding partitions.
sources: §1, §7, §12, §13, §20
---
## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 18 — Partition Key Design** (Full)
  - *Relevant sections:* Choosing the key; Choosing the partition count; What the docs don't say: you can grow partitions, but your keys move
  - *Learning evidence:* For an e-commerce platform, choose keys for order lifecycle, clickstream and inventory topics, and explain the ordering each one gives and the hot-partition risk each one carries.
- **Topic 21 — Hot Partitions & Skew** (Full)
  - *Relevant sections:* Hot partitions; Why more partitions don't fix a hot key; Remedies, and what each one costs; Try it on your cluster
  - *Learning evidence:* Design a bucketing (salting) scheme for a tenant that sends 90% of the traffic, and state exactly which ordering guarantee it gives up.

## Choosing the key
The key does two jobs at once. It decides **what stays in order** (records with the same key share a partition) and **how load spreads** (the hash scatters different keys across partitions). A good key does both well.

Start from the ordering requirement, then check the distribution.

1. **What must be ordered?** Name the smallest entity whose events must be applied in sequence: one order's lifecycle, one account's ledger, one device's commands. That entity's id is your key.
2. **How many distinct keys, and how even?** Many keys with similar volume spread well. Few keys, or one giant key, don't.
3. **Is any key much busier than the rest?** A large tenant, a celebrity account, a viral video. That key's partition will be hot.

No key at all is a valid choice when order doesn't matter. The producer then uses its sticky partitioner, which spreads load well (chapter 6).

| Topic | Key | Ordering it gives | Risk |
|---|---|---|---|
| Order lifecycle | OrderId | Each order's CREATED, PAID, SHIPPED in sequence | Low: many orders, each small |
| Order lifecycle | CustomerId | All of one customer's orders in sequence | A very active customer becomes a hot key |
| Clickstream | SessionId, or no key | Per session, or none | Low; most consumers don't need order |
| Inventory level | ProductId | Each product's updates in sequence, so the latest value wins | A best-seller can run hot on launch day |
| Account ledger | AccountId | Every posting to an account in sequence | A treasury account with huge volume |

## Choosing the partition count
The documentation offers no formula, and neither should you trust anyone else's. It does give the facts the decision rests on:

- **Parallelism:** a group's useful consumers are capped by the partition count, and so are a Kafka Streams app's tasks.
- **Placement:** each partition lives entirely on one broker (with its replicas on others), so the partition count caps how many brokers share a topic's load.
- **Cost:** each partition is a directory of segment files on each replica, a leader that must be elected when a broker fails, replicas to keep in sync, and entries in the cluster metadata. More partitions mean more of all of these, and longer recovery after a broker failure.
- **Permanence:** you can **add** partitions but **never remove** them, and adding them moves keys (below).

A method, from your own guide, with illustrative numbers:

1. **Throughput:** peak MB/s you must handle, divided by the MB/s one partition sustains in **your benchmark** (producer and consumer, with your record size, batching and replication). 100 MB/s at a measured 10 MB/s per partition means at least 10.
2. **Consumer parallelism:** if processing needs 20 consumers working at once, you need at least 20 partitions.
3. **Take the larger**, add headroom for growth you can foresee (2× is common), so you don't have to add partitions and move keys later: here, about 40.
4. **Check the cluster can carry it**: partitions per broker, replicas, and recovery time when a broker fails.

![Choosing a partition count: too few caps consumer parallelism and broker spread and is costly to grow later; too many adds files, leader elections, replication and metadata; size it from throughput and consumer parallelism, take the larger, add headroom, then check the cluster can carry it](/assets/content/packs/kafka/kafka-partition-count.svg)

Ranges such as "3 to 12 partitions for small systems", from your infographics, are not in the documentation. At most they are a starting point for a benchmark.

## Hot partitions
A **hot partition** receives far more records or bytes than the others. It becomes the bottleneck while its siblings sit idle.

```
P0: 90% of traffic   <- lag grows here, its consumer is saturated
P1:  5%
P2:  5%
```

Symptoms: lag on one partition only; one consumer maxed out while others idle; uneven bytes-in across brokers; adding consumers doesn't help.

The usual cause is a **skewed key**: one key (a big customer, a default value such as `"unknown"`, an environment name) produces most of the traffic, and its hash always lands on the same partition.

## Why more partitions don't fix a hot key
![A hot key: with key CUST_A, 90% of traffic lands on one partition; bucketing the key as CUST_A_0 to CUST_A_3 spreads it over four partitions, keeping order only within each bucket](/assets/content/packs/kafka/kafka-hot-key-bucketing.svg)

The same key always hashes to one partition. With 3 partitions or 300, every record for `CUST_A` goes to one partition, so one consumer must process all of them, in order. More partitions add capacity for **other** keys; they do nothing for this one.

That is the trade-off at the heart of this chapter: **strict per-key order means one lane per key.** If one key needs more than one lane, you must give up some of its ordering, or change what you order by.

## Remedies, and what each one costs

The production answer is usually a combination, decided per stream: strict ordering for the few streams that need it (payments, ledgers, state transitions), and bucketing or relaxed ordering for the high-volume rest (telemetry, clicks, metrics). As your guide puts it, hot partitioning is a business-domain problem as much as a Kafka one.

| Remedy | What it does | What it costs |
|---|---|---|
| Key bucketing (salting): CUST_A_0 to CUST_A_3 | Spreads one key's records over several partitions | Order only within each bucket; consumers that need the whole key must merge buckets |
| Relax ordering: a random or round-robin key where order doesn't matter | Spreads load evenly | No order at all; never for state transitions such as a balance |
| A finer domain key: OrderId instead of CustomerId | Natural spread with the order that is really needed | You must prove that coarser order wasn't needed |
| Isolate the heavy tenant: its own topic, or its own cluster | Protects everyone else from one tenant | More topics to run; that tenant's key is still one lane |
| Aggregate or batch before producing | Fewer, larger records (counts per second, not every click) | Latency and lost detail |
| More capacity for the hot consumer | Faster processing of the one lane | Containment, not a fix; one lane is still one lane |
| Sequence numbers and re-ordering in the consumer | Spread freely, rebuild order downstream | Buffers, timeouts, missing and duplicate handling: real complexity |

## What the docs don't say: you can grow partitions, but your keys move
**Practical implication:** adding partitions to a keyed topic breaks per-key ordering for a while, and silently.

**Why it matters:** the documentation spells out the side effects. The hash-based mapping changes, so a key can move to a different partition, while its older records stay where they were. Existing data is not redistributed. Consumers with `auto.offset.reset=latest` can miss records written to the new partitions before they notice them. For a while one key's events sit in two partitions, and a consumer can read the newer ones first.

**What to do:** size for growth up front. If you must expand a keyed topic, either pause producers and let consumers drain before expanding, or create a new topic with the larger count, move producers, drain the old topic, and move consumers.

**Verify further:** [Basic Kafka operations: modifying topics](https://kafka.apache.org/43/operations/basic-kafka-operations/).

## Try it on your cluster
1. Make a skewed stream. Create a topic, then type mostly one key into a keyed console producer:

```
kafka-topics.bat --bootstrap-server localhost:9092 --create --topic skew-ch10 --partitions 4 --replication-factor 1
kafka-console-producer.bat --bootstrap-server localhost:9092 --topic skew-ch10 --reader-property parse.key=true --reader-property key.separator=:
```

Paste ten lines of `CUST_A:click`, then one each of `CUST_B:click`, `CUST_C:click` and `CUST_D:click`.

2. See where they landed. `kafka-get-offsets` prints each partition's end offset, which is its record count for a new topic:

```
kafka-get-offsets.bat --bootstrap-server localhost:9092 --topic skew-ch10
```

**What you should see:** one partition with at least 10 records, the others with few or none. That is your hot partition.

3. Bucket it. Produce `CUST_A_0:click`, `CUST_A_1:click`, `CUST_A_2:click`, `CUST_A_3:click` a few times each and check the offsets again: `CUST_A`'s traffic now spreads across partitions, and any one bucket's records are still in order.

## Interview takeaway
"I pick the key from the ordering requirement: the smallest entity whose events must stay in sequence, usually an order or account id, not something coarse like customer or region. Then I check skew, because one key is one partition and one consumer, and adding partitions never splits it. For a dominant key I'd bucket it if per-bucket order is enough, isolate the tenant, or aggregate, and keep strict ordering only where the business needs it. I size partitions from measured per-partition throughput and needed consumer parallelism, plus headroom, because partitions can't be reduced and adding them moves keys."
