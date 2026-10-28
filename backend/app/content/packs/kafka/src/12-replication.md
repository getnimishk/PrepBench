---
id: replication
title: Replication, ISR and durability
summary: Each partition is copied to several brokers; the in-sync replica set decides what counts as committed, who may lead, and when a write must be refused.
sources: §1, §3, §4, §7, §11, §12, §13, §21
---
## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 22 — Replication & ISR** (Full)
  - *Relevant sections:* Leaders, followers and the ISR; Committed, and the guarantee; acks=all, min.insync.replicas and the trade-off; When a broker fails; Try it on your cluster: three brokers on one machine
  - *Learning evidence:* On a three-broker cluster, stop brokers one at a time while producing with acks=all and min.insync.replicas=2, and explain each ISR change, leader election and refused write you observe.

## Leaders, followers and the ISR
**The unit of replication is the partition.** With replication factor 3, each partition has three replicas on three brokers: one **leader** and two **followers**. All writes go to the leader. Followers fetch from the leader, the same way a consumer does, and append what they fetch to their own copy.

The leader keeps a list of the replicas that are keeping up: the **in-sync replica set (ISR)**, which includes the leader itself. A follower drops out of the ISR when:

- its broker loses its session with the controller (no heartbeat within `broker.session.timeout.ms`), or
- it hasn't caught up to the leader's log end for `replica.lag.time.max.ms` (default **30 s**).

A follower that catches up again rejoins the ISR. The ISR is stored in the cluster metadata every time it changes.

## Committed, and the guarantee
A record is **committed** when every replica in the ISR has it. Two consequences:

- **Consumers only ever see committed records.** Whatever `acks` the producer used, a record is not visible until it is on all in-sync replicas and the ISR is at least `min.insync.replicas`.
- **The guarantee:** a committed record is not lost **as long as at least one in-sync replica is alive.**

The documentation is equally clear about the limit: Kafka stays available after a short fail-over when brokers fail, but **may not remain available during network partitions**.

## Why an ISR, not a majority vote
Many replicated systems commit a write once a **majority** has it. To survive f failures that needs 2f+1 copies: three copies to survive one failure, five to survive two.

Kafka commits only when **all** ISR members have the write, and only ISR members can become leader. So any new leader already has every committed record, and **f+1** copies survive f failures. The documentation explains the trade: majority voting doesn't wait for the slowest replica; the ISR approach needs fewer copies for the same durability, which matters for a system that stores large volumes of data. A replica that crashed must fully re-sync before it rejoins the ISR, which is why Kafka doesn't need to flush every write to disk to keep its guarantee.

## acks=all, min.insync.replicas and the trade-off
![acks=all with min.insync.replicas=2 on replication factor 3: writes are accepted with three or two in-sync replicas and refused with NotEnoughReplicas when only one is left](/assets/content/packs/kafka/kafka-acks-min-isr.svg)

`acks=all` waits for the **current** ISR, however small it is. With replication factor 3, if two followers fall out, the ISR is just the leader, and an `acks=all` write succeeds with **one** copy. If that broker then dies, the write is gone.

`min.insync.replicas` closes that gap. With `acks=all`, the leader **refuses** the write if the ISR is smaller than this number, and the producer gets a `NotEnoughReplicas` (or `NotEnoughReplicasAfterAppend`) error.

The documentation's typical setup: **replication factor 3, min.insync.replicas 2, acks=all.** A majority of the replicas must have a write before it is acknowledged.

The trade is availability against durability: a higher minimum keeps more copies of every acknowledged write, and refuses writes sooner when brokers are down.

| Setup | Writes keep working with | Committed data survives |
|---|---|---|
| RF 3, min ISR 1, acks=all | 1 broker left | Only while that broker survives; a single copy may hold the only record |
| RF 3, min ISR 2, acks=all | 2 brokers left; refused at 1 | The loss of any one broker |
| RF 3, min ISR 3, acks=all | All 3; refused when any one is down | The same as min ISR 2, with less availability |
| RF 2, min ISR 2, acks=all | Both; refused when either is down | The loss of one broker, but no write availability during it |

## When a broker fails
1. The broker's heartbeats stop. The controller marks it offline and removes it from the ISR of every partition it held.
2. For each partition it **led**, the controller elects a new leader from that partition's remaining ISR, in one batch across partitions.
3. Clients refresh metadata, find the new leaders and carry on. Producers retry in-flight sends within `delivery.timeout.ms`.
4. When the broker returns, its replicas catch up from the leaders and rejoin the ISR.

**If every in-sync replica is lost**, Kafka by default **waits** for an ISR member to come back (`unclean.leader.election.enable=false`). The partition is unavailable rather than wrong. Turning unclean election on lets an out-of-sync replica lead, which restores availability and **loses** the committed records it never had. Since Kafka 4.0, **Eligible Leader Replicas** (on by default for new clusters from 4.1) give the controller a third option: replicas outside the ISR that it knows are still safe to elect without data loss.

## Try it on your cluster: three brokers on one machine
You can't see any of this with one broker. Add two **broker-only** nodes to your existing cluster. Your first server stays the only controller, so don't stop it during the exercise.

1. Find your cluster ID:

```
kafka-cluster.bat cluster-id --bootstrap-server localhost:9092
```

2. Copy Kafka's broker-only template twice. In `E:\workspace\Kafka_Learning\kafka\config`, copy `broker.properties` to `broker-2.properties` and `broker-3.properties`, and edit these lines. Every node in a cluster needs its own `node.id`, port and log folder. In `broker-2.properties`:

```
node.id=2
listeners=PLAINTEXT://localhost:9094
advertised.listeners=PLAINTEXT://localhost:9094
log.dirs=E:/workspace/Kafka_Learning/data/broker-2
controller.quorum.bootstrap.servers=localhost:9093
```

In `broker-3.properties`:

```
node.id=3
listeners=PLAINTEXT://localhost:9095
advertised.listeners=PLAINTEXT://localhost:9095
log.dirs=E:/workspace/Kafka_Learning/data/broker-3
controller.quorum.bootstrap.servers=localhost:9093
```

3. Format each new broker with the **same** cluster ID, joining the existing quorum:

```
kafka-storage.bat format --cluster-id <your-cluster-id> --config E:\workspace\Kafka_Learning\kafka\config\broker-2.properties --no-initial-controllers
kafka-storage.bat format --cluster-id <your-cluster-id> --config E:\workspace\Kafka_Learning\kafka\config\broker-3.properties --no-initial-controllers
```

4. Start each in its own terminal with `kafka-server-start.bat` and its properties file. Check that all three registered:

```
kafka-broker-api-versions.bat --bootstrap-server localhost:9092 | findstr "id:"
```

5. Create a replicated topic and describe it:

```
kafka-topics.bat --bootstrap-server localhost:9092 --create --topic durable-ch12 --partitions 3 --replication-factor 3 --config min.insync.replicas=2
kafka-topics.bat --bootstrap-server localhost:9092 --describe --topic durable-ch12
```

**What you should see:** each partition with three `Replicas`, three `Isr` entries, and leaders spread over brokers 1, 2 and 3.

6. Keep a producer running with `acks=all` (`--command-property acks=all` on the console producer). Stop broker 3 with Ctrl+C in its window (a clean shutdown, which hands its leaderships over first), wait a few seconds, and describe again: broker 3 is gone from every `Isr`, partitions it led have a new leader, and writes still succeed (ISR 2 ≥ min 2).

7. Stop broker 2 as well. Describe: each `Isr` has only broker 1. Send a record: the producer reports `NotEnoughReplicas`, because 1 is below `min.insync.replicas=2`. Your data isn't lost; the cluster is refusing to make a promise it can't keep.

8. Start brokers 2 and 3 again. Describe: they rejoin each `Isr` once caught up, and writes succeed again.

To put the leaders back on their preferred brokers afterwards:

```
kafka-leader-election.bat --bootstrap-server localhost:9092 --election-type preferred --all-topic-partitions
```

## What the docs don't say: replication factor 3 with min ISR 1 is a common trap
**Practical implication:** a topic can have three copies configured and still acknowledge writes held by a single broker.

**Why it matters:** `min.insync.replicas` defaults to **1**. With that default, `acks=all` stops protecting you the moment two followers fall behind, which is exactly when brokers are under stress. Nothing warns you; the writes keep succeeding.

**What to do:** set `min.insync.replicas=2` on every topic that matters (or as the broker default), keep `acks=all` on its producers, and alert on `UnderMinIsrPartitionCount` and `AtMinIsrPartitionCount` (chapter 15).

**Verify further:** [Design: availability and durability guarantees](https://kafka.apache.org/43/design/design/).

## Interview takeaway
"Each partition has a leader and followers; the leader tracks the in-sync replicas, and a record is committed once every ISR member has it. Committed data survives as long as one in-sync replica does, so f+1 replicas tolerate f failures. acks=all waits only for the current ISR, so I pair it with min.insync.replicas=2 on replication factor 3: writes are refused rather than acknowledged on a single copy. On broker failure the controller elects new leaders from the ISR, and unclean election stays off so we never trade committed data for availability."
