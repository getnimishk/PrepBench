---
id: cluster
title: Brokers, controllers and KRaft
summary: Brokers store and serve partitions; a small controller quorum holds the cluster's metadata, with no ZooKeeper since Kafka 4.0.
sources: §4, §7, §9, §11, §12
---
## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 4 — Broker & Cluster Architecture** (Full)
  - *Relevant sections:* Brokers; Controllers; A three-broker cluster, drawn; Try it on your cluster
  - *Learning evidence:* Draw a three-broker cluster with a three-partition, replication-factor-3 topic, and label each partition's leader, its followers and the active controller.
- **Topic 5 — ZooKeeper vs. KRaft** (Full)
  - *Relevant sections:* Why ZooKeeper went away; What the metadata is; Combined mode is for your laptop
  - *Learning evidence:* Explain why Kafka moved to KRaft and what metadata the controller quorum manages.

## Brokers
A **broker** is a Kafka server that stores partitions and serves reads and writes for them. A cluster has several brokers, and a topic's partitions are spread across them.

Every partition has one **leader** replica and, when the replication factor is above 1, **follower** replicas on other brokers. Producers write to the leader; followers copy from it (chapter 12). A broker is usually leader for some partitions and follower for others, and Kafka spreads leadership evenly so no broker does all the leading.

Any broker can answer a **metadata request**: which brokers are alive and which broker leads each partition. That is how a client that knows only one address (`--bootstrap-server localhost:9092`) finds everything else, and why producers can send straight to the right leader with no routing layer.

## Controllers
A **controller** manages the cluster's metadata: which brokers are registered, which topics and partitions exist, who leads each partition, and each partition's in-sync replicas. When a broker fails, the controller notices (its heartbeats stop) and elects new leaders for the partitions it led, choosing from the in-sync replicas and batching the changes across partitions.

In **KRaft** mode, a few servers are configured as controllers and form the **metadata quorum**. One is the **active** controller; the others are **hot standbys** that can take over. The documentation suggests **3 or 5** controllers, and a **majority must be alive** for the cluster to stay available: three controllers survive one failure, five survive two.

Each server's role is set by `process.roles`: `broker`, `controller`, or `broker,controller`.

## What the metadata is
Think of two kinds of data in a cluster:

- **Your data**: the records in your topics' partitions, stored on brokers.
- **Metadata**: the description of the cluster itself. Brokers and their addresses, topics and their configurations, partitions and their replicas, leaders, in-sync replica sets, ACLs, feature versions.

In KRaft mode the metadata is itself a replicated log (the `__cluster_metadata` topic) kept by the controller quorum using the Raft consensus protocol; brokers follow it to stay current. One detail from the 4.3 notes: in KRaft mode, sensitive values held in metadata records are **not encrypted** by Kafka.

## Why ZooKeeper went away
Before KRaft, the metadata lived in **Apache ZooKeeper**, a separate distributed system that every Kafka cluster had to run and secure alongside it. KRaft moved the metadata into Kafka itself.

The facts that matter in 2026:

- **Kafka 4.0 removed ZooKeeper mode.** Every 4.x release (including your 4.3) runs only in KRaft mode.
- A 3.x cluster still on ZooKeeper has to migrate to KRaft before it can be upgraded to 4.x.
- Since 4.0 the configuration files that used to sit in `config/kraft/` are in `config/` with everything else. That is why your first `format` command failed with `NoSuchFileException` on `config\kraft\server.properties`.

The documentation does not give one official list of reasons for the move. The reasons usually given are architectural: one system to run and secure instead of two, metadata handled as a Kafka log, and a controller that does not have to load the cluster's state from an outside store when it fails over.

## Combined mode is for your laptop
Your cluster is a single server with `process.roles=broker,controller`: a **combined** server, both broker and controller. The documentation's position is clear: combined servers are simpler for small setups like development, but the controller is less isolated, and you cannot roll or scale controllers separately from brokers. **Combined mode is not recommended in critical deployments.** Production clusters run dedicated controllers, typically three, and separate brokers.

## A three-broker cluster, drawn
A topic `orders` with three partitions and replication factor 3, on brokers 1, 2 and 3, with three dedicated controllers:

```
Controllers (metadata quorum):  C1 (active)   C2 (standby)   C3 (standby)

Broker 1:  orders-0 LEADER     orders-1 follower   orders-2 follower
Broker 2:  orders-0 follower   orders-1 LEADER     orders-2 follower
Broker 3:  orders-0 follower   orders-1 follower   orders-2 LEADER
```

Each broker leads one partition and follows the other two. If broker 2 fails, the active controller makes broker 1 or 3 the leader of `orders-1`, from that partition's in-sync replicas.

## Try it on your cluster
1. See the metadata quorum. `--bootstrap-server` talks to a broker; the tool asks it about the quorum:

```
kafka-metadata-quorum.bat --bootstrap-server localhost:9092 describe --status
```

**What you should see:** your node as `LeaderId`, a `CurrentVoters` list with one entry, and a high watermark. One voter means no controller failure can be survived; that is the cost of a one-node setup.

2. See the feature versions your cluster was formatted with:

```
kafka-features.bat --bootstrap-server localhost:9092 describe
```

**What you should see:** `metadata.version` finalized at `4.3-IV0`, the value from your format step, and `kraft.version`.

3. Find your cluster ID, the one you generated with `kafka-storage random-uuid`:

```
kafka-cluster.bat cluster-id --bootstrap-server localhost:9092
```

You will need it in chapter 12 to add brokers to this cluster.

## What the docs don't say: formatting is deliberate
**Practical implication:** Kafka refuses to start on blank storage. You must run `kafka-storage format` with a cluster ID first, every time you add a server.

**Why it matters:** the documentation explains that older versions formatted storage automatically, and that this could hide an error. In the metadata log, a majority of controllers starting empty could even elect a leader missing committed data. The extra step is a safety check, not ceremony.

**What to do:** keep your cluster ID somewhere safe; format a new broker with the same ID and `--no-initial-controllers`; format the first controller with `--standalone`, as you did.

**Verify further:** [KRaft: provisioning nodes](https://kafka.apache.org/43/operations/kraft/).

## Interview takeaway
"Brokers store partitions and serve clients; every partition has a leader and followers spread across brokers. Since Kafka 4.0, metadata lives in a KRaft controller quorum inside Kafka. It's a Raft-replicated metadata log, usually three or five controllers, and a majority must be up. ZooKeeper is gone, so there's one system to run and secure. For anything that matters I'd run dedicated controllers, not combined mode, so controllers can be rolled and scaled on their own."
