---
id: multi-cluster
title: Multi-cluster, multi-region and disaster recovery
summary: Replication inside a cluster survives broker failures; surviving the loss of a whole cluster or region takes a second cluster, a replication tool, and a rehearsed failover plan with stated RPO and RTO.
sources: §7, §9, §12, §13, §14, §19
---
## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 40 — MirrorMaker 2 / Cluster Linking** (Full)
  - *Relevant sections:* MirrorMaker 2; Cluster Linking; Choosing between them
  - *Learning evidence:* Write a MirrorMaker 2 configuration that replicates the orders topics from a primary cluster to a standby, and explain what the replicated topic is called and how consumers resume there.
- **Topic 41 — Multi-Region Architectures** (Full)
  - *Relevant sections:* Why one cluster isn't enough; Topologies; Active-active and its problems
  - *Learning evidence:* Choose and justify active-passive or active-active for a payments platform with a strict consistency requirement, and for a global clickstream.
- **Topic 42 — Backup & Disaster Recovery** (Full)
  - *Relevant sections:* RPO, RTO and what Kafka can promise; A DR plan for a production cluster; What the docs don't say: replication is not backup
  - *Learning evidence:* Draft a DR plan for a production cluster with an RPO and RTO, covering what is replicated, how consumers fail over, and how the plan is tested.

## Why one cluster isn't enough
Chapter 12's replication keeps data safe when **brokers** fail, and spreading replicas across racks or availability zones (`broker.rack`) protects against losing a zone. But all of it lives in **one cluster**: one controller quorum, one network, one region, one set of configuration and credentials. Losing the region, the quorum, or the cluster to an operator mistake takes every replica with it.

Surviving that needs a **second cluster**, kept in step by a replication tool that copies data **between** clusters. That copy happens after a record is written to the source, so it is asynchronous: in a disaster, the most recent records may not have crossed yet.

## MirrorMaker 2
**MirrorMaker 2** (MM2) is part of Apache Kafka. It replicates **topics, topic configurations, consumer groups and their offsets, and ACLs** from one cluster to another. It is built on **Kafka Connect source connectors**, so it runs as a Connect-style job, dedicated or inside a Connect cluster.

Configuration is written as **replication flows**, `source->target`:

```
clusters = primary, standby
primary.bootstrap.servers = primary-broker1:9092
standby.bootstrap.servers = standby-broker1:9092
primary->standby.enabled = true
primary->standby.topics = orders\..*
```

Key behaviours:

- **Remote topics are renamed** with the source cluster's alias as a prefix: `orders.order.lifecycle` from `primary` arrives as `primary.orders.order.lifecycle` (the separator is configurable; `DefaultReplicationPolicy`). The prefix stops records from different clusters landing in one partition, and lets active-active flows avoid copying data back and forth forever.
- **Consumer group offsets are replicated** too, so a group can resume in the standby cluster near where it was. The metric `checkpoint-latency-ms` shows how far behind that offset replication runs.
- New topics and groups matching the flow are picked up automatically.
- **Exactly-once** replication is supported for dedicated MirrorMaker clusters since Kafka 3.5 (`exactly.once.source.support=enabled`).

## Cluster Linking
**Cluster Linking** is a **Confluent** feature (Confluent Server and Confluent Cloud), not part of Apache Kafka. A cluster link creates **mirror topics** on the destination that are byte-for-byte copies of the source, with **the same offsets**, and it needs **no Connect** deployment. Confluent describes them as exact mirrors of topics, including offsets, meant for migration and failover; see its documentation for how a mirror topic is turned into a normal writable topic during failover.

Same offsets is the important difference: a consumer can move to the destination and continue from the identical offset, with no prefix-renamed topic to switch to.

## Choosing between them
| Aspect | MirrorMaker 2 | Cluster Linking |
|---|---|---|
| Available in | Apache Kafka, any distribution | Confluent Platform and Confluent Cloud only |
| Runs as | Kafka Connect source connectors | Built into the brokers |
| Topic names on the target | Prefixed with the source alias by default | The same names (mirror topics) |
| Offsets on the target | Not guaranteed to match the source; consumer group offsets are replicated so groups can resume | Identical to the source |
| Also replicates | Topic configs, consumer group offsets, ACLs | Mirror topic data and metadata (see Confluent's docs for the full list) |
| Main trade-off | Open and flexible, more moving parts to run | Simpler failover, tied to one vendor |

## Topologies
The MM2 documentation lists the common shapes:

- **Active-passive:** one cluster takes all traffic, replicating to a standby. Simple; the standby is idle until a disaster.
- **Active-active:** both clusters take writes, replicating to each other (A to B and B to A).
- **Aggregation:** many clusters into one (regional clusters into a central analytics cluster).
- **Fan-out:** one cluster to many (a central cluster feeding regional ones).
- **Forwarding:** a chain, A to B to C.

## Active-active and its problems
Active-active sounds like the best of both, and it carries real costs:

- **Two copies of every topic** on each side: the local `orders` and the replicated `other-region.orders`. Consumers that need the global view must read both.
- **No global order.** Events written in two regions to "the same" topic have no order between them.
- **Conflicting writes.** If the same entity can be updated in both regions, something must decide which update wins. Kafka won't.

**Choosing:** a **payments platform** with strict consistency usually wants **active-passive**, so every write for an account goes to one place and the order is unambiguous. It accepts some failover time, and the replication lag as possible data loss. A **global clickstream**, where each event is independent, suits **active-active** or regional clusters aggregated centrally: low local latency matters more than global order.

## RPO, RTO and what Kafka can promise
- **RPO** (recovery point objective): how much data, measured in time, you can afford to lose. With asynchronous cross-cluster replication, RPO is at least the **replication lag** at the moment of failure.
- **RTO** (recovery time objective): how long until the business works again: detect, decide, redirect producers, move consumers, verify.

Within one cluster (chapter 12), committed data survives broker failures with **no loss**, as long as one in-sync replica survives. Across clusters, the honest RPO is "the replication lag", so measure it and alert on it.

## A DR plan for a production cluster
A plan worth having states, for each important topic:

1. **Objectives:** RPO and RTO, agreed with the business, per topic or service tier.
2. **What is replicated:** which topics, plus consumer group offsets, ACLs and topic configurations, and the replication tool.
3. **What isn't:** schemas in the registry (replicate the registry too), connector configurations, client credentials, and anything in external systems.
4. **Detection and the decision:** who declares a disaster, on what signals, and who has the authority. A failover nobody may trigger is not a plan.
5. **Producer failover:** how clients find the standby (DNS, configuration, service discovery), and what happens to records sent during the switch.
6. **Consumer failover:** how each group resumes: from replicated offsets (MM2) or identical offsets (Cluster Linking), and how it handles reprocessing the overlap. Idempotent consumers make this safe.
7. **Failback:** how to return once the primary is back, without losing what was written to the standby.
8. **Rehearsal:** a scheduled failover test, measured against the RPO and RTO, with the results written down.

## What the docs don't say: replication is not backup
**Practical implication:** replicas and mirror clusters protect against losing **machines**; they don't protect against losing **data on purpose or by mistake**.

**Why it matters:** a deleted topic, a wrong retention setting, a bad producer writing garbage, or a compaction tombstone storm is replicated faithfully, within milliseconds, to every replica and every mirror. Kafka has no built-in point-in-time backup.

**What to do:** for data you can't regenerate, keep an independent copy outside Kafka: a sink connector writing the topic to object storage, retained and versioned separately, from which it can be replayed. Protect the destructive operations themselves with ACLs (who may delete topics or alter configs) and change review.

**Verify further:** [Geo-replication (cross-cluster data mirroring)](https://kafka.apache.org/43/operations/geo-replication-cross-cluster-data-mirroring/).

## Interview takeaway
"In-cluster replication across zones handles broker and zone failures; a region or cluster loss needs a second cluster. MirrorMaker 2 is the Apache option: it replicates topics with source-prefixed names, plus configs, ACLs and consumer group offsets, over Connect. Cluster Linking is Confluent's, with identical offsets and no Connect. Cross-cluster replication is asynchronous, so RPO is the replication lag, and I'd measure it. For strict consistency I'd choose active-passive; active-active suits independent events and needs conflict rules. And replication isn't backup: anything I can't regenerate also goes to object storage through a sink, and failover is rehearsed against stated RPO and RTO."
