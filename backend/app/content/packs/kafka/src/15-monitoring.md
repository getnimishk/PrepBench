---
id: monitoring
title: Monitoring a Kafka platform
summary: A handful of broker metrics say whether data is safe, a handful say whether it is fast, and consumer lag says whether anyone is keeping up.
sources: §2, §7, §12, §21
---
## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 26 — Key Metrics & Monitoring** (Full)
  - *Relevant sections:* Three questions, three groups of metrics; Is the data safe?; Is it fast?; Is anyone keeping up?; Alerts and SLOs for a production topic; Try it on your cluster
  - *Learning evidence:* Write alert thresholds and an SLO for a production orders topic, naming each metric, its normal value, and what to do when it fires.

## Three questions, three groups of metrics
Kafka exposes hundreds of metrics over **JMX**. Most of the time you need three answers:

1. **Is the data safe?** Replication health: are partitions fully replicated, and can they accept durable writes?
2. **Is it fast?** Request handling: are brokers keeping up, and where do requests wait?
3. **Is anyone keeping up?** Consumer lag and fetch rate: are the applications reading what is written?

The documentation lists a normal value for many broker metrics. Those normals are what turn a metric into an alert.

## Is the data safe?
| Metric (kafka.server or kafka.controller) | Normal | Meaning when it isn't |
|---|---|---|
| ReplicaManager UnderReplicatedPartitions | 0 | Some partitions have fewer in-sync replicas than replicas: a broker is down, slow, or a follower can't keep up |
| ReplicaManager UnderMinIsrPartitionCount | 0 | Some partitions have fewer in-sync replicas than min.insync.replicas: acks=all writes to them are being refused now |
| ReplicaManager AtMinIsrPartitionCount | 0 | Some partitions are exactly at the minimum: one more failure and their writes are refused |
| KafkaController OfflinePartitionsCount | 0 | Partitions with no leader at all: no reads or writes |
| KafkaController ActiveControllerCount | exactly one node reports 1 | 0 everywhere: no controller; more than one: split brain |
| ControllerStats UncleanLeaderElectionsPerSec | 0 | An out-of-sync replica became leader: committed data may have been lost |
| ReplicaManager IsrShrinksPerSec and IsrExpandsPerSec | 0, except while a broker restarts | Shrinks and expands repeating without restarts: a replica flapping in and out of sync |

## Is it fast?

The documentation also recommends watching the JVM (garbage-collection time) and the machine (CPU, disk I/O service time, network).

| Metric | Normal | Meaning |
|---|---|---|
| KafkaRequestHandlerPool RequestHandlerAvgIdlePercent | between 0 and 1, ideally above 0.3 | Near 0: the broker's request threads are saturated |
| SocketServer NetworkProcessorAvgIdlePercent | between 0 and 1, ideally above 0.3 | Near 0: the network threads are saturated |
| RequestMetrics TotalTimeMs for Produce, FetchConsumer, FetchFollower | stable for your workload | Split into queue, local, remote and response-send time: queue time rising means threads are busy; remote time rising on Produce means waiting for followers (acks=all) |
| BrokerTopicMetrics MessagesInPerSec and BytesInPerSec, per topic | your traffic pattern | Uneven across brokers: leadership imbalance or a hot partition |
| ControllerStats LeaderElectionRateAndTimeMs | non-zero only when brokers fail | Elections without failures: instability |

## Is anyone keeping up?
On the client side the documentation's advice is short: for each consumer, **max lag** below a threshold, and **minimum fetch rate** above zero.

- Consumer `records-lag-max`: the largest lag in records across the consumer's partitions. It is based on the consumer's **current position, not its committed offset**.
- Per-partition `records-lag`, to find which partition is behind.
- The fetch rate: zero means the consumer isn't fetching at all (stuck, crashed, or out of the group), which lag alone can hide, because a frozen lag looks stable.
- Producer `record-error-rate` (sends that failed) and `request-latency-avg`.

From outside the application, `kafka-consumer-groups --describe` gives committed lag per partition, and works when the consumers are down. Monitoring stacks usually poll this view for every group.

**Lag in records is not lag in time.** 10,000 records is seconds for a busy topic and days for a quiet one. For an SLO, convert it: how old is the oldest record not yet processed?

## Alerts and SLOs for a production topic
An example for `orders.order.lifecycle` (replication factor 3, min ISR 2), to adapt, not copy:

And an SLO to go with them: **"99.9% of order events are processed by billing within 60 seconds of being produced, measured monthly."** That is the user-facing promise; the alerts below are what protect it.

| Signal | Alert when | First response |
|---|---|---|
| UnderMinIsrPartitionCount | above 0 for 1 minute: page | Writes are being refused; find the down or lagging broker now |
| AtMinIsrPartitionCount | above 0 for 10 minutes: ticket | One failure from refused writes; check broker health before it becomes a page |
| UnderReplicatedPartitions | above 0 for 5 minutes | A broker is down or a follower is lagging; check disk, network, GC |
| OfflinePartitionsCount | above 0: page | Partitions are unavailable |
| ActiveControllerCount, summed over nodes | not exactly 1 | Controller quorum problem |
| UncleanLeaderElectionsPerSec | above 0 | Possible data loss; investigate which partitions and why |
| Billing consumer lag, as age of oldest unprocessed record | above 5 minutes for 10 minutes | Find the bottleneck (chapter 9) before scaling |
| Billing consumer fetch rate | 0 for 2 minutes while lag is above 0 | Consumer stuck or out of the group |
| RequestHandlerAvgIdlePercent | below 0.3 for 15 minutes | Broker capacity: rebalance leadership or add brokers |

## Try it on your cluster
1. Restart your broker with JMX on. In the broker's terminal, before starting it:

```
set JMX_PORT=9999
kafka-server-start.bat E:\workspace\Kafka_Learning\kafka\config\server.properties
```

2. Read a metric once from another terminal with Kafka's JMX tool:

```
kafka-jmx.bat --jmx-url service:jmx:rmi:///jndi/rmi://localhost:9999/jmxrmi --object-name kafka.server:type=ReplicaManager,name=UnderReplicatedPartitions --one-time true
```

**What you should see:** a timestamp and `Value` 0. Try `kafka.server:type=KafkaRequestHandlerPool,name=RequestHandlerAvgIdlePercent` too, and run a perf test in parallel to watch it fall.

3. For a visual view, `jconsole` (it comes with your JDK) can connect to `localhost:9999` and browse every `kafka.*` MBean.

4. With the three-broker setup from chapter 12, stop broker 3 while watching `UnderReplicatedPartitions` on broker 1: it rises while broker 3 is down and returns to 0 when it has rejoined.

## What the docs don't say: alert on promises, not on every metric
**Practical implication:** paging on every non-zero metric trains people to ignore pages.

**Why it matters:** `UnderReplicatedPartitions` rises during every rolling restart; `IsrShrinksPerSec` blips during every deploy. Pages for planned events teach the on-call engineer that pages don't matter, and the real one gets missed.

**What to do:** page only on what breaks a promise now (writes refused, partitions offline, consumers far behind their SLO); ticket the leading indicators (at min ISR, slow catch-up); suppress alerts during planned maintenance.

**Verify further:** [Monitoring](https://kafka.apache.org/43/operations/monitoring/).

## Interview takeaway
"I monitor three things. Data safety: under-replicated, under-min-ISR and offline partitions should all be zero, exactly one active controller, and no unclean elections. Broker capacity: request-handler and network idle above about 30%, and produce and fetch latency broken into queue, local and remote time. Consumers: lag per partition, ideally as the age of the oldest unprocessed record, plus a fetch rate above zero. I page on broken promises, such as writes being refused or an SLO about to be missed, and ticket the leading indicators."
