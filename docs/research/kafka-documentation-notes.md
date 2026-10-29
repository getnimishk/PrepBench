# Apache Kafka — documentation notes

**Source:** the Apache Kafka 4.3 documentation, https://kafka.apache.org/43/ (read 2026-10-28), plus the Confluent pages
named in each section for what Apache Kafka itself does not ship (Schema Registry, ksqlDB, Cluster Linking).
**Purpose:** ground the Kafka study guide and its scenarios (`backend/app/content/packs/kafka/`) in the official docs. A chapter's
`sources` field cites the sections here (`§3`), the way the ADF guide cites `adf-documentation-notes.md`.
**Version:** the learner runs Kafka 4.3 in KRaft mode on Windows (their own install, formatted with `metadata.version
4.3-IV0`), so these notes use the 4.3 pages. The newest release when read was 4.4; nothing here was taken from it.

**How the learner's own material was used.** Four documents the learner wrote while learning with ChatGPT (a
fundamentals guide, a local-setup transcript, a Kafka-and-traffic-failure transcript, reliability revision notes) and six
generated infographics set the guide's order, emphasis and examples. They are not sources of fact. Every fact in the guide
comes from a section below. Where the learner's material disagrees with the docs, §20 records it and the guide follows the docs.

Defaults are quoted as the 4.3 configuration reference states them. Everything else is in my own words.

---

## 1. Producer configuration (4.3 defaults)

Source: https://kafka.apache.org/43/configuration/producer-configs/

| Setting | Default | What the docs say it does |
|---|---|---|
| `acks` | `all` | How many acknowledgements the leader must have before a request is complete. `0`: no wait, record counts as sent once in the socket buffer, retries have no effect, returned offset is always -1. `1`: leader writes to its own log and answers without waiting for followers; lost if the leader fails before followers copy it. `all` (= `-1`): leader waits for the full set of in-sync replicas; not lost while at least one in-sync replica stays alive. Idempotence requires `all`. |
| `enable.idempotence` | `true` | Exactly one copy of each message is written to the stream. Requires `max.in.flight.requests.per.connection` ≤ 5, `retries` > 0, `acks=all`. On by default if no conflicting settings; if conflicting settings are set and idempotence was not explicitly enabled, it is silently disabled; if explicitly enabled with conflicts, `ConfigException`. |
| `retries` | `2147483647` | Retries a send that failed with a transient error until success, a non-transient error, or `delivery.timeout.ms` expires. Docs: prefer leaving it unset and controlling retry with `delivery.timeout.ms`. With idempotence off and more than one in-flight request, retries can reorder records. |
| `delivery.timeout.ms` | `120000` (2 min) | Upper bound on reporting success or failure after `send()` returns: covers time waiting to send, awaiting the ack, and retries. Should be ≥ `request.timeout.ms` + `linger.ms`. |
| `request.timeout.ms` | `30000` (30 s) | Max wait for a response to one request before resending or failing. Should be larger than the broker's `replica.lag.time.max.ms` to reduce duplicates from unnecessary retries. |
| `linger.ms` | `5` | Upper bound on the artificial delay to fill a batch. **Changed from 0 to 5 in Kafka 4.0.** A batch is sent at once when it reaches `batch.size`, regardless of linger. |
| `batch.size` | `16384` (16 KiB) | Upper bound of a per-partition batch in bytes; `0` disables batching; a buffer of this size is always allocated. |
| `buffer.memory` | `33554432` (32 MiB) | Total memory for records waiting to be sent. When full, `send()` blocks for up to `max.block.ms`, then fails. |
| `max.block.ms` | `60000` (1 min) | How long `send()` (and `partitionsFor()`, the transaction methods) may block: metadata fetch plus buffer allocation. |
| `max.in.flight.requests.per.connection` | `5` | Unacknowledged requests per connection. >1 with idempotence off and retries on risks reordering. Idempotence needs ≤ 5 **because the broker retains at most 5 batches per producer.** |
| `compression.type` | `none` | `none`, `gzip`, `snappy`, `lz4`, `zstd`. Compresses whole batches, so better batching gives better compression. |
| `partitioner.class` | `null` (built-in logic) | Key present, no partition: hash of the key. No key, no partition: a "sticky" partition that changes after at least `batch.size` bytes. `RoundRobinPartitioner` exists, with a known uneven-distribution issue (KAFKA-9965). Custom: implement `Partitioner`. |
| `partitioner.ignore.keys` | `false` | `true` makes the producer ignore keys when choosing a partition. |
| `partitioner.adaptive.partitioning.enable` | `true` | Producer sends more to partitions on faster brokers. |
| `transactional.id` | `null` | Enables transactions; implies idempotence. Without it the producer is limited to idempotent delivery. By default transactions need at least **three brokers** (broker `transaction.state.log.replication.factor`). |
| `transaction.timeout.ms` | `60000` (1 min) | The coordinator aborts a transaction open longer than this. Larger than broker `transaction.max.timeout.ms` → `InvalidTxnTimeoutException`. |
| `retry.backoff.ms` / `retry.backoff.max.ms` | `100` / `1000` | Initial backoff, growing exponentially to the max, **with ±20% random jitter** so clients don't retry in sync. |
| `max.request.size` | `1048576` (1 MiB) | Max request size; effectively caps the uncompressed batch. The broker has its own cap. |

## 2. Consumer configuration (4.3 defaults)

Source: https://kafka.apache.org/43/configuration/consumer-configs/

| Setting | Default | What the docs say it does |
|---|---|---|
| `group.id` | `null` | Required to use group management (`subscribe`) or Kafka-based offset storage. |
| `group.protocol` | `classic` | `classic` or `consumer` (the newer protocol, §6). |
| `group.remote.assignor` | `null` | Server-side assignor, only with `group.protocol=consumer`; otherwise the first of broker `group.consumer.assignors`. |
| `enable.auto.commit` | `true` | Commit offsets periodically in the background. |
| `auto.commit.interval.ms` | `5000` (5 s) | How often auto-commit runs. |
| `auto.offset.reset` | `latest` | When the group has no committed offset, or it no longer exists on the server: `earliest`, `latest`, `by_duration:<ISO-8601>`, or `none` (throw). Warning: with `latest`, adding partitions can lose messages produced to the new partitions before consumers reset. |
| `isolation.level` | `read_uncommitted` | `read_committed` returns only committed transactional records, and only up to the last stable offset (LSO); non-transactional records are always returned. |
| `max.poll.records` | `500` | Max records per `poll()`. Does not change fetching; records are cached and handed out across polls. |
| `max.poll.interval.ms` | `300000` (5 min) | Max gap between `poll()` calls. Exceed it and the consumer is considered failed and the group rebalances. A static member instead stops heartbeating and is reassigned after the session timeout. |
| `session.timeout.ms` | `45000` (45 s) | Heartbeat-based failure detection (classic protocol only; the `consumer` protocol uses broker `group.consumer.session.timeout.ms`). |
| `heartbeat.interval.ms` | `3000` (3 s) | Classic only; lower than the session timeout, typically ≤ ⅓ of it. |
| `partition.assignment.strategy` | `[RangeAssignor, CooperativeStickyAssignor]` | Uses Range, but allows upgrading to CooperativeSticky with one rolling bounce that removes Range. Also `RoundRobinAssignor`, `StickyAssignor`, or a custom `ConsumerPartitionAssignor`. |
| `group.instance.id` | `null` | Static membership: one instance per id; combined with a longer session timeout it avoids rebalances on restarts. |
| `fetch.min.bytes` | `1` | Server waits for this much data (or `fetch.max.wait.ms`). Larger raises throughput a little, adds latency. |
| `fetch.max.wait.ms` | `500` | Max server wait to satisfy `fetch.min.bytes`. |
| `fetch.max.bytes` | `52428800` (50 MiB) | Max data per fetch; not absolute (a first oversized batch is still returned so the consumer can progress). |
| `max.partition.fetch.bytes` | `1048576` (1 MiB) | Max data per partition per fetch; same "not absolute" rule. |
| `client.rack` | `""` | Client's rack, matched with broker `broker.rack`. |

## 3. Topic configuration (4.3 defaults)

Source: https://kafka.apache.org/43/configuration/topic-configs/

| Setting | Default | What the docs say it does |
|---|---|---|
| `cleanup.policy` | `delete` | `delete` discards old segments by time or size; `compact` keeps the latest value per key; `delete,compact` does both. |
| `retention.ms` | `604800000` (7 days) | Max age before old segments are discarded (delete policy); "an SLA on how soon consumers must read their data". `-1` = no time limit. |
| `retention.bytes` | `-1` | Max size **per partition**; multiply by partition count for the topic. Default: no size limit. |
| `segment.bytes` | `1073741824` (1 GiB) | Segment file size. Retention and cleaning work **a file at a time**. |
| `segment.ms` | `604800000` (7 days) | Forces a roll even if the segment isn't full, so retention can act. |
| `min.insync.replicas` | `1` | Min in-sync replicas (leader included) for a write with `acks=all` to succeed. With fewer, the producer gets an exception. With `acks=all`, every current in-sync replica must acknowledge, even if that is more than this minimum. |
| `unclean.leader.election.enable` | `false` | Allow an out-of-sync replica to become leader as a last resort, risking data loss. |
| `max.message.bytes` | `1048588` | Largest record **batch** allowed (after compression). |
| `min.compaction.lag.ms` / `max.compaction.lag.ms` | `0` / `Long.MAX` | Min / max time a message stays uncompacted. |
| `delete.retention.ms` | `86400000` (1 day) | How long tombstones stay in a compacted topic; also bounds how long a full re-read from offset 0 may take. |
| `min.cleanable.dirty.ratio` | `0.5` | How dirty a log must be before the cleaner compacts it. |
| `message.timestamp.type` | `CreateTime` | `CreateTime` (producer's) or `LogAppendTime` (broker's). |
| `compression.type` | `producer` | Keep the producer's codec, or force `uncompressed`/a codec. |
| `remote.storage.enable` | `false` | Turns on tiered storage for the topic (§13). |
| `local.retention.ms` / `local.retention.bytes` | `-2` | Local (broker-disk) retention under tiered storage; `-2` = same as `retention.*`; must be ≤ it. |

## 4. Broker configuration (4.3 defaults)

Source: https://kafka.apache.org/43/configuration/broker-configs/

| Setting | Default | Note |
|---|---|---|
| `num.partitions` | `1` | Default partitions for a new topic. |
| `default.replication.factor` | `1` | Default replication for a new topic. |
| `auto.create.topics.enable` | `true` | Topics are created on first use unless turned off. |
| `offsets.topic.replication.factor` / `offsets.topic.num.partitions` | `3` / `50` | The internal offsets topic. Creation fails until the cluster has enough brokers. |
| `offsets.retention.minutes` | `10080` (7 days) | Committed offsets expire this long after a group becomes empty (or stops subscribing to the topic). |
| `transaction.state.log.replication.factor` / `transaction.state.log.min.isr` | `3` / `2` | The internal transaction-state topic. |
| `transaction.max.timeout.ms` | `900000` (15 min) | Cap on a client's `transaction.timeout.ms`. |
| `replica.lag.time.max.ms` | `30000` (30 s) | A follower that hasn't fetched, or hasn't caught up to the leader's log end, for this long is removed from the ISR. |
| `log.retention.hours` | `168` | Broker-wide default retention (7 days). |
| `process.roles` | (none) | `broker`, `controller`, or `broker,controller` (combined mode). |
| `node.id` | (none) | Required in KRaft mode. |
| `controller.quorum.bootstrap.servers` | `""` | How nodes find the controller quorum (dynamic quorums). `controller.quorum.voters` is "the old way" and must not be set with a dynamic quorum; the voter set then comes from `--standalone` or `--initial-controllers` at format time. |
| `group.consumer.session.timeout.ms` / `group.consumer.heartbeat.interval.ms` | `45000` / `5000` | Session timeout and heartbeat for the `consumer` group protocol (set on the broker). |
| `group.consumer.assignors` | `uniform,range` | Server-side assignors for the `consumer` protocol; the first is the default. |
| `message.max.bytes` | `1048588` | Largest record batch (after compression); per topic via `max.message.bytes`. |
| `broker.rack` | `null` | Rack-aware replica placement. |
| `delete.topic.enable` | `true` | Topics can be deleted through the admin client. |
| `listeners` | `PLAINTEXT://:9092` | Listener URIs and names. |
| `advertised.listeners` | `null` | Addresses published to clients when they differ from `listeners` (cloud, containers). |
| `listener.security.protocol.map` | `SASL_SSL:SASL_SSL,PLAINTEXT:PLAINTEXT,SSL:SSL,SASL_PLAINTEXT:SASL_PLAINTEXT` | Maps listener names to security protocols, so e.g. `INTERNAL:SSL,EXTERNAL:SSL`. |
| `controller.listener.names` | (none) | Listener(s) used by the controller. |
| `authorizer.class.name` | `""` | The authorizer (§16). |

## 5. Design: producer, consumer, delivery semantics, transactions

Source: https://kafka.apache.org/43/design/design/ (The Producer, The Consumer, Message Delivery Semantics, Using Transactions)

- **The producer sends straight to the partition leader**, with no routing tier; any node answers metadata requests
  saying which brokers are alive and who leads each partition. The client chooses the partition: at random, or by a key
  hashed to a partition ("semantic partitioning"), so that, e.g., all of one user's data goes to one partition.
- **Batching** trades a little latency for throughput: the producer accumulates in memory and sends larger batches.
- **Consumers pull.** A consumer sends fetch requests with its offset and receives a chunk of log from that position, so
  it can rewind. Pull lets a slow consumer "simply fall behind and catch up", lets the broker batch aggressively, and
  long polls avoid busy-waiting. Push "tends to overwhelm" a consumer slower than production.
- **Consumer position is one integer per partition**, the offset of the next message to consume, because each
  partition is consumed by exactly one consumer in each subscribing group at a time. It is checkpointed periodically,
  so acknowledgement is cheap, and a consumer can rewind to re-consume (e.g. after fixing a bug).
- **Static membership** (KIP-345): `group.instance.id` gives members persistent ids, so restarts and deploys don't
  trigger rebalances. A duplicate id is fenced (`FencedInstanceIdException`).
- **Three semantics:** at most once (may be lost, never redelivered), at least once (never lost, may be redelivered),
  exactly once (processed once and only once). It splits into two problems: durability when publishing, and guarantees
  when consuming.
- **Committed message:** applied by all in-sync replicas; not lost while one replicating broker stays alive.
- **Producer side:** a network error leaves the producer unsure whether the write committed. Resending gave
  at-least-once until 0.11.0.0. **Idempotent producer:** the broker assigns each producer an ID and deduplicates using
  a sequence number sent with every message. **Transactions:** atomic writes across partitions, all or nothing.
- **Consumer side:** save position *then* process = at-most-once on a crash. Process *then* save position =
  at-least-once on a crash; often fine when updates are idempotent (a primary key just overwrites).
- **Exactly once, Kafka to Kafka:** the consumer's position is a message in an internal topic, so the transactional
  producer writes offsets in the same transaction as the output. On abort, the stored position reverts (but the
  consumer must refetch it; it does not rewind itself), and output is hidden from `read_committed` readers.
- **Exactly once to an external system** needs cooperation from that system: store the offset with the output (the
  docs' example: a Connect connector writing HDFS data and offsets together). **Default: at-least-once.** At-most-once
  = no producer retries + commit before processing.
- **Using transactions:** only the producer is transactional, but it can update the consumer's committed offset.
  Three aspects: assignment makes one consumer own each partition; the producer writes output and offsets atomically;
  one producer per consumer is advisable. Consumer: `isolation.level=read_committed` and `enable.auto.commit=false`.
  Producer: `transactional.id`, which also aborts a crashed previous instance's open transaction. Transaction markers
  are written on commit/abort. **After an abort the application must reset its consumer position itself.** Exception
  classes: `RetriableException`, `RefreshRetriableException` (handled inside the client), `AbortableException` (abort and
  reprocess), `ApplicationRecoverableException` (restart the producer), `InvalidConfigurationException`, `KafkaException`.
  Simplest recovery: recreate producer and consumer, which rebalances and rewinds to the last committed offset.
- **Kafka Streams** is described as "the simplest way to get exactly-once semantics".

## 6. Share groups ("queues for Kafka")

Source: https://kafka.apache.org/43/design/design/ (The Share Consumer)

- A different kind of group, alongside consumer groups. Share consumers **cooperatively** consume: a partition can be
  assigned to several consumers, and **there can be more consumers than partitions.**
- Records are acknowledged **individually**, and delivery attempts are **counted**, so unprocessable records can be
  handled automatically.
- A fetched record is held under a time-limited **acquisition lock** (default 30 s, `share.record.lock.duration.ms`).
  The consumer can accept, release (another attempt), reject (no more attempts), renew, or do nothing (the lock expires).
- Broker `group.share.partition.max.record.locks` limits how many records per partition are locked at once.
- Each share group consumes a topic independently of other share groups.

## 7. Replication, ISR and leader election

Source: https://kafka.apache.org/43/design/design/ (Replication)

- **The unit of replication is the partition.** One leader, zero or more followers; replication factor = all replicas
  including the leader. All writes go to the leader; reads can go to the leader or followers. Followers fetch from the
  leader like consumers. Leaders are spread evenly across brokers.
- **The controller** manages broker registration. A broker is alive (in sync) if it keeps a session with the controller
  (KRaft: heartbeats within `broker.session.timeout.ms`) and, as a follower, doesn't fall too far behind
  (`replica.lag.time.max.ms`). The leader tracks the **ISR**; a dead or lagging follower is removed.
- **Only committed messages are given to consumers.** Whatever `acks` is, a message becomes visible only when it is on
  all in-sync replicas and the ISR is at least `min.insync.replicas`.
- **Guarantee:** a committed message is not lost as long as at least one in-sync replica is alive. Kafka stays
  available after a short fail-over, but **may not remain available during network partitions.**
- **ISR vs majority quorum:** a majority quorum needs 2f+1 replicas to survive f failures; Kafka's ISR needs **f+1**,
  because only ISR members can be elected and a write commits only when all of them have it. The ISR is stored in
  cluster metadata. A replica that crashed must fully re-sync before rejoining the ISR, so Kafka does not need fsync on
  every write.
- **Unclean leader election** (all replicas down): wait for an ISR member (consistent, maybe unavailable) or take the
  first replica back (available, may lose committed messages). Default since 0.11.0.0: wait.
  `unclean.leader.election.enable` changes it.
- **acks=all means the current ISR, not all assigned replicas.** With two replicas and one down, `acks=all` writes still
  succeed and could be lost if the last one fails. Two topic settings favour durability: no unclean election, and
  `min.insync.replicas` (writes refused when the ISR is below it, only with `acks=all`).
- On broker failure the **controller** elects new leaders from the ISR, batching the changes across partitions.

## 8. Log compaction

Source: https://kafka.apache.org/43/design/design/ (Log Compaction)

- Compaction keeps **at least the last known value for each key** in a partition. It suits changelogs of keyed, mutable
  data (restoring state after a crash, reloading caches), not standalone events.
- The **head** of the log is a normal log with dense offsets; compaction works on the **tail**. Offsets never change;
  a compacted-away offset is still a valid position (reading from it returns the next surviving record).
- A record with a key and a **null value is a tombstone**: it deletes earlier records with that key, and is itself
  removed after `delete.retention.ms`.
- Guarantees: a consumer that keeps up within the head sees every message; **ordering is never changed**, only some
  messages removed; an offset never changes; a consumer reading from the start sees at least the final state of every
  record, and sees the tombstones only if it reaches the head within `delete.retention.ms` (default 24 h).
- The log cleaner is a pool of background threads that recopy segments; cleaning does not block reads and can be
  throttled. The summary uses 24 bytes per key.

## 9. KRaft: controllers, quorum, formatting

Sources: https://kafka.apache.org/43/operations/kraft/ ; https://kafka.apache.org/43/getting-started/upgrade (4.0.0 notes) ;
https://kafka.apache.org/43/getting-started/zk2kraft

- **Kafka 4.0 removed ZooKeeper mode; 4.0 onward only supports KRaft.** Upgrading a 3.x cluster to 4.x requires KRaft
  first (software and metadata version 3.3.x or later).
- `process.roles`: `broker`, `controller`, or both ("combined" servers). Combined mode is simpler for small setups such
  as development, but controllers can't be rolled or scaled separately; **not recommended in critical deployments.**
- Controllers form the **metadata quorum**: one active, the others hot standbys. Typically **3 or 5**; a **majority must
  be alive**: 3 tolerate 1 failure, 5 tolerate 2.
- Everyone finds the active controller through `controller.quorum.bootstrap.servers` (dynamic quorum, kraft.version 1,
  from 4.1). The static `controller.quorum.voters` is deprecated with kraft.version 1.
- **Provisioning:** `kafka-storage random-uuid` makes a cluster ID; each server is formatted with it
  (`kafka-storage format`). Kafka no longer formats blank storage automatically, because auto-formatting can hide an
  error and, in the metadata log, could elect a leader with missing committed data.
- `format --standalone` bootstraps a single voter (the recommended start; add controllers later);
  `--initial-controllers` bootstraps several.
- **Since 4.0 the KRaft config files are in `config/`, not `config/kraft/`** (the learner's `NoSuchFileException` on
  `config\kraft\server.properties`).
- In KRaft mode Kafka stores sensitive data in metadata records **unencrypted** (the ZooKeeper-era password encoder
  settings were removed).
- 4.0 also: the `--bootstrap-server` option accepts only comma-separated lists; clients and Streams need **Java 11**,
  brokers, Connect and tools **Java 17**; `DefaultPartitioner` and `UniformStickyPartitioner` classes removed.

## 10. Consumer groups: the two rebalance protocols

Source: https://kafka.apache.org/43/operations/consumer-rebalance-protocol/ ; consumer configs (§2)

- **Kafka 4.0 made the next-generation consumer rebalance protocol (KIP-848) generally available.** It is "fully
  incremental" and "no longer relies on a global synchronization barrier", so rebalances are faster and groups scale
  better. Two kinds of groups now exist: `consumer` protocol and `classic` protocol.
- Server side: enabled automatically since 4.0 (`group.version` feature). Heartbeat and session timeout are set **on
  the broker** (`group.consumer.heartbeat.interval.ms` 5 s, `group.consumer.session.timeout.ms` 45 s), and so is
  assignment: `group.consumer.assignors`, default `uniform,range`, `uniform` first.
- Mapping from client assignors: `RangeAssignor` to `range`; `CooperativeStickyAssignor`, `StickyAssignor`,
  `RoundRobinAssignor` to `uniform`.
- Client side: **not on by default**; set `group.protocol=consumer`. Then `heartbeat.interval.ms` and
  `session.timeout.ms` can't be used. Regex subscriptions are evaluated on the server (RE2J).
- Classic protocol default assignor list: `[RangeAssignor, CooperativeStickyAssignor]` (§2).

## 11. Versions and what changed (4.0 to 4.3)

Source: https://kafka.apache.org/43/getting-started/upgrade

- 4.0: ZooKeeper removed (§9); KIP-848 GA (§10); new group coordinator; **Transactions server-side defense
  (KIP-890)**: with 4.0 producers the producer epoch is bumped on every transaction; **Eligible Leader Replicas
  (KIP-966 part 1)**: the controller tracks replicas outside the ISR that are still safe to elect without data loss;
  `linger.ms` default 0 to 5 (§1).
- 4.1: dynamic controller membership; **Queues for Kafka (KIP-932, share groups) in preview.**
- 4.2: **share groups production-ready** (§6).
- 4.3: Kafka Streams headers-aware state stores (opt-in `dsl.store.format`); `kafka-streams-scala` deprecated;
  `group.coordinator.rebalance.protocols` deprecated (protocols governed by feature versions in 5.0); new share-group
  configs such as `share.delivery.count.limit`.

## 12. Operations: topics, consumer groups, partitions, metrics

Sources: https://kafka.apache.org/43/operations/basic-kafka-operations/ ; https://kafka.apache.org/43/operations/monitoring/

- **Replication factor:** with 3, "up to 2 servers can fail before you will lose access to your data"; the docs
  recommend **2 or 3** so machines can be bounced without interrupting consumption.
- **Partition count:** each partition must fit on one server; it caps how many servers share a topic's load and
  **the maximum parallelism of consumers**. Each partition is a folder `<topic>-<partition>` in the log directory, so
  **topic names are limited to 249 characters**.
- **Adding partitions** (`kafka-topics --alter --partitions`) has side effects the docs list: keys hashed by
  `hash(key) % partitions` **can move to a different partition**, affecting ordering for existing keys, and existing
  data is not redistributed; consumers with `auto.offset.reset=latest` can miss messages written to new partitions
  before they notice them; new partitions appear only after a metadata refresh (`metadata.max.age.ms`); never add
  partitions to internal topics (`__consumer_offsets`, `__transaction_state`, `__share_group_state`,
  `__cluster_metadata`). **Kafka cannot reduce a topic's partition count.**
- `kafka-consumer-groups --describe` shows `TOPIC PARTITION CURRENT-OFFSET LOG-END-OFFSET LAG CONSUMER-ID HOST
  CLIENT-ID`. `--reset-offsets` works on one group at a time, needs `--topic` or `--all-topics`, the group's consumers
  must be inactive, and it only displays the plan unless `--execute` is given. Scenarios include `--to-earliest`,
  `--to-latest`, `--to-datetime`, `--shift-by`.
- Expanding a cluster: new brokers get no existing partitions until you run `kafka-reassign-partitions`; reassignment
  can be throttled (`--throttle`).
- **Broker metrics and their normal values:** `UnderReplicatedPartitions` 0; `UnderMinIsrPartitionCount` 0;
  `AtMinIsrPartitionCount` 0; `IsrShrinksPerSec` / `IsrExpandsPerSec` 0 except while a broker is down and recovering;
  `ActiveControllerCount`: exactly one broker has 1; `UncleanLeaderElectionsPerSec` 0; `LeaderElectionRateAndTimeMs`
  non-zero when brokers fail; `RequestHandlerAvgIdlePercent` and `NetworkProcessorAvgIdlePercent` between 0 and 1,
  ideally > 0.3; `TotalTimeMs` per request type, split into queue, local, remote and response-send time;
  `MessagesInPerSec`, `BytesInPerSec` per topic.
- **Client metrics:** consumer `records-lag-max` (max lag in records over partitions; **based on the current position,
  not the committed offset**), per-partition `records-lag`; producer `record-error-rate`, `request-latency-avg`.
- The docs recommend watching GC, CPU and I/O on brokers; on clients, message and byte rates, request rate/size/time,
  and for consumers **max lag and min fetch rate** ("max lag needs to be less than a threshold and min fetch rate needs
  to be larger than 0").

## 13. Introduction: events, topics, partitions; tiered storage; eligible leader replicas

Sources: https://kafka.apache.org/43/getting-started/introduction ; https://kafka.apache.org/43/operations/tiered-storage/ ;
https://kafka.apache.org/43/operations/eligible-leader-replicas/

- **Event streaming** = capturing data in real time as streams of events, storing them durably, processing and reacting
  to them in real time and later, and routing them. Kafka combines three capabilities: **publish/subscribe** to
  streams (including import/export), **store** them durably, and **process** them as they occur or retrospectively.
- An **event** (record, message) records that "something happened"; it has a **key, value, timestamp and optional
  headers**. Events are stored in **topics**, which are multi-producer and multi-subscriber. **Events are not deleted
  when consumed**; retention is configured per topic.
- Topics are **partitioned** across brokers so clients read and write many brokers at once. **Events with the same key
  go to the same partition**, and any consumer of a partition reads its events in the order they were written.
- A common production setting is **replication factor 3**.
- **Tiered storage** (KIP-405): a local tier (broker disks) and a remote tier (e.g. HDFS, S3) for **completed** log
  segments. Reasoning: most reads are tail reads served from page cache; older data is read rarely (backfill,
  recovery). Off by default (`remote.log.storage.system.enable`); **Kafka ships no `RemoteStorageManager`
  implementation**, you must plug one in; per topic `remote.storage.enable`, with `local.retention.*` ≤ `retention.*`.
  **Limitations listed:** no compacted topics; disable on every topic before disabling on the broker.
- **Eligible Leader Replicas** (4.0, default on new clusters from 4.1): with the "strict min ISR" rule the high
  watermark cannot advance while the ISR is below `min.insync.replicas`; the controller tracks replicas outside the
  ISR that are still safe leaders. Election order: an ISR member; else an unfenced ELR member; else the last known
  leader if unfenced.

## 14. Kafka Connect

Sources: https://kafka.apache.org/43/kafka-connect/overview/ ; https://kafka.apache.org/43/kafka-connect/user-guide/

- A framework for streaming data **between Kafka and other systems**: source connectors import, sink connectors export.
  Features: a common connector framework, **standalone and distributed** modes, a **REST API**, **automatic offset
  management**, scaling through Kafka's group management (add workers).
- **Standalone:** one process, simpler, fits a single-worker job (e.g. collecting log files); no fault tolerance.
  **Distributed:** balances work automatically, scales, and is fault tolerant for tasks, configuration and offsets;
  connectors are created through the REST API, not the command line.
- Distributed workers keep state in three topics: `config.storage.topic` (**one partition**, replicated, compacted),
  `offset.storage.topic` (many partitions, replicated, compacted), `status.storage.topic` (replicated, compacted).
- `tasks.max`: the maximum tasks; a connector may create fewer.
- **Single message transforms** (SMTs): lightweight one-record-at-a-time changes, chained with `transforms`. Built-ins
  include `Cast`, `DropHeaders`, `ExtractField`, `Filter`, `Flatten`, `HeaderFrom`, `HoistField`, `InsertField`,
  `InsertHeader`, `MaskField`.
- **Errors:** by default a connector **fails fast** on a conversion or transform error (`errors.tolerance=none`,
  `errors.retry.timeout=0`, `errors.log.enable=false`). `errors.tolerance=all` skips bad records;
  `errors.log.enable=true` logs them; `errors.deadletterqueue.topic.name` sends them, for a **sink** connector, to a
  dead-letter topic, with `errors.deadletterqueue.context.headers.enable=true` adding the error context as headers.
- **Exactly-once source connectors:** set `exactly.once.source.support=enabled` on every worker (existing clusters need
  two rolling upgrades), and the connector must support it.

## 15. Kafka Streams

Sources: https://kafka.apache.org/43/streams/core-concepts/ ; https://kafka.apache.org/43/streams/architecture/

- A **client library** for processing data in Kafka: event-time vs processing-time, windowing, state management.
  One record at a time, millisecond latency.
- **Time:** event time (when it happened at the source), processing time (when the app processes it), ingestion time
  (when the broker appended it). Timestamps come from a `TimestampExtractor`.
- **Stream-table duality:** a stream is a changelog of a table; a table is a snapshot of a stream. Modelled as
  `KStream`, `KTable`, `GlobalKTable`. An aggregation's output is always a `KTable`, so it can be updated when late
  records arrive.
- **Windows** have a **grace period**: how long to wait for out-of-order records; records after it are dropped.
- **Parallelism:** a fixed number of **tasks**, from the input topic partitions; **max parallelism = number of input
  partitions** (5 partitions, up to 5 instances). Threads run tasks; more instances replicate the topology over other
  partitions. Each task can have **local state stores**, backed by changelog topics; **standby replicas** cut restore
  time.
- **Exactly-once:** `processing.guarantee` (default `at_least_once`) set to `exactly_once_v2` (brokers 2.5+).

## 16. Security

Sources: https://kafka.apache.org/43/security/security-overview/ ; …/listener-configuration/ ;
…/encryption-and-authentication-using-ssl/ ; …/authentication-using-sasl/ ; …/authorization-and-acls/ ;
the 4.3 `config/log4j2.yaml` and `StandardAuthorizerData.java` in apache/kafka (branch 4.3)

- **Authentication** of clients, brokers and tools with **SSL (mTLS) or SASL**. SASL mechanisms: **GSSAPI (Kerberos),
  PLAIN, SCRAM-SHA-256, SCRAM-SHA-512, OAUTHBEARER.** **Encryption in transit** with SSL (a performance cost that
  depends on CPU and JVM). **Authorization** of reads and writes, pluggable. **Security is optional**, and secured and
  unsecured clients can be mixed.
- **Listeners:** `{LISTENER_NAME}://{host}:{port}`; each listener's protocol comes from
  `listener.security.protocol.map`: `PLAINTEXT`, `SSL`, `SASL_PLAINTEXT`, `SASL_SSL`.
- **SSL:** `ssl.client.auth` = `none` / `requested` / `required`; "requested" is discouraged as giving a false sense of
  security. Hostname verification is on (`ssl.endpoint.identification.algorithm`); the docs warn against disabling
  it and prefer the SAN field over the common name.
- **SASL/PLAIN** and **SCRAM** should be used only with TLS; OAUTHBEARER only with TLS in production, and its default
  unsecured implementation must be replaced in production.
- **Authorization (KRaft):** `authorizer.class.name=org.apache.kafka.metadata.authorizer.StandardAuthorizer`. A
  resource with **no ACLs is accessible only to super users** unless `allow.everyone.if.no.acl.found=true`.
  `super.users=User:Bob;User:Alice` (semicolon-separated). Principals without an allowing ACL are denied. Deny ACLs
  exist for "everyone except X"; **if any DENY ACL matches, the operation is denied regardless of ALLOW ACLs**
  (StandardAuthorizerData). `kafka-acls --producer` grants WRITE, DESCRIBE and CREATE on the topic; `--consumer`
  grants READ and DESCRIBE on the topic and READ on the group. Prefixed patterns: `--resource-pattern-type prefixed`.
  **Operations:** Read, Write, Create, Delete, Alter, Describe, ClusterAction, DescribeConfigs, AlterConfigs,
  IdempotentWrite, CreateTokens, DescribeTokens, All. Deleting a topic needs **Delete** on the topic; changing its
  configs needs **AlterConfigs** on the topic.
- **Audit log:** the shipped log4j2 config routes `kafka.authorizer.logger` at INFO to `kafka-authorizer.log`. The
  authorizer logs **denied** explicit requests at **INFO** and **allowed** ones only at **DEBUG**, so by default the
  file records refusals, not every access.

## 17. Schemas: Avro, Protobuf, Parquet, JSON, Schema Registry

Sources: https://avro.apache.org/docs/1.12.0/specification/ ; https://protobuf.dev/programming-guides/proto3/ ;
https://parquet.apache.org/docs/overview/ ; https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html ;
https://docs.confluent.io/platform/current/schema-registry/fundamentals/serdes-develop/index.html

- **Avro binary data carries no field names or types**; a reader always needs the writer's schema. **Schema
  resolution:** a field the writer has but the reader doesn't is ignored; a field the reader has but the writer
  doesn't takes the reader's **default**; with no default, **error**. (So adding a field needs a default to stay
  readable.)
- **Protobuf** identifies fields by **number** on the wire: a number must be unique and **cannot be changed once in
  use**; deleted field numbers should go in `reserved` and **never be reused**.
- **Parquet** is an open-source **column-oriented** file format for efficient storage and retrieval, with compression
  and encoding schemes for bulk data. It is a file format for analytics sinks, not a per-record Kafka message format.
- **JSON** with no schema (e.g. Kafka Connect's schemaless JSON) carries field names in every record and enforces
  nothing; the learner's own JSONDecodeError (a topic mixing plain text and JSON) is the classic failure.
- **Schema Registry (Confluent, not part of Apache Kafka):** schemas are stored under a **subject**; each version gets a
  unique ID. **Default compatibility: BACKWARD**: consumers on the new schema read data written with the previous
  one (delete fields, add optional fields). **FORWARD**: consumers on the old schema read new data. **FULL**: both.
  `*_TRANSITIVE`: checked against **all** earlier versions, not just the last. `NONE` turns checks off.
- **Upgrade order:** BACKWARD → **upgrade consumers first**; FORWARD → producers first; FULL → independently.
  BACKWARD is the default partly so consumers can rewind to the start of a topic. For Protobuf the docs recommend
  BACKWARD_TRANSITIVE.
- **Subject naming:** `TopicNameStrategy` (default: from the topic name), `RecordNameStrategy`,
  `TopicRecordNameStrategy` (several record types in one topic). A broker-side strategy does not propagate to clients.
- **Wire format (schema ID in the payload prefix, the default):** byte 0 = version byte `0`; bytes 1 to 4 = the
  **4-byte schema ID** (big-endian); then, for Protobuf, a message index; then the encoded data. Applies to keys and
  values. (Confluent Platform 8.1.1 added an option to carry a schema GUID in a header instead.)

## 18. ksqlDB

Sources: https://docs.confluent.io/platform/current/ksqldb/overview.html ;
https://docs.confluent.io/platform/current/ksqldb/developer-guide/joins/join-streams-and-tables.html

- Confluent's **streaming SQL database** on Kafka (not part of Apache Kafka). **Confluent now recommends Flink for new
  stream-processing workloads**; ksqlDB stays supported for existing applications.
- **Stream-stream joins must have a `WITHIN` window**; only stream-stream joins are windowed.
- Most joins need **co-partitioned** inputs (same partition count and key); the exception is a foreign-key table-table
  join.

## 19. Multi-cluster: MirrorMaker 2, Cluster Linking, multi-region

Sources: https://kafka.apache.org/43/operations/geo-replication-cross-cluster-data-mirroring/ ;
https://docs.confluent.io/platform/current/multi-dc-deployments/cluster-linking/index.html

- **MirrorMaker 2** (part of Apache Kafka) replicates **topics, topic configurations, consumer groups and their
  offsets, and ACLs** between clusters. It is built on **Kafka Connect source connectors**.
- Topologies: **active/passive** (A to B) and **active/active** (A to B and B to A), plus fan-in, fan-out, chains.
- Replicated ("remote") topics are **renamed** by the replication policy: `foo-topic` from `us-west` becomes
  `us-west.foo-topic` (separator configurable; `DefaultReplicationPolicy`). The renaming keeps records from different
  clusters out of the same partition and makes active/active loops avoidable.
- **Exactly-once** for dedicated MirrorMaker clusters since 3.5.0 (`exactly.once.source.support=enabled`).
- Metric `checkpoint-latency-ms`: time to replicate consumer offsets.
- **Cluster Linking (Confluent Server / Confluent Cloud, not Apache Kafka):** mirror topics replicated **byte for
  byte**, with **the same offsets** as the source, and **no Connect cluster** needed; described as exact mirrors "to enable migration and failover".

## 20. Where the learner's material and the docs differ

The guide follows the docs in every case below.

| Learner's material says | The 4.3 docs say |
|---|---|
| Big-picture image lists "Zookeeper / KRaft" for metadata | ZooKeeper was removed in 4.0; 4.x is KRaft only (§9). |
| Image: `linger.ms=10-50`, `batch.size=32KB+`, `compression.type=lz4` as "common configurations" | These are tuning choices, not defaults: the defaults are `linger.ms=5` (since 4.0), `batch.size=16384`, `compression.type=none` (§1). The guide teaches them as levers to measure. |
| Image: "Exactly Once (Idempotent): acks=all, retries>0, idempotent=true" | Idempotence is **on by default** and prevents duplicates from producer retries **within the log**; end-to-end exactly-once needs transactions plus `read_committed` (§1, §5). |
| Image: "At Most Once: acks=0" | At-most-once is a consumer-and-producer pattern: no producer retries and committing before processing (§5). `acks=0` alone is a durability choice. |
| Image: "Rules of thumb: 3–12 / 12–100 / 100+ partitions" | No such ranges in the docs; partition count follows throughput, consumer parallelism, ordering and broker limits, and can't be reduced later (§12). The learner's own guide already flags this. |
| Transcript: `config\kraft\server.properties` | Since 4.0 the files are in `config\` (§9). |
| Transcript guidance: `--from-beginning` "does not force replay from offset zero on every restart" | True only with `--group`. The 4.3 console consumer source (`ConsoleConsumerOptions.java`): `--from-beginning` means "if the consumer does not already have an established offset", start from the earliest (i.e. `auto.offset.reset=earliest`); **without `--group` it joins a new random group `console-consumer-<n>` with auto-commit off**, so it never has an offset and replays everything on every run. With `--group`, a second run resumes from the committed offset. |
| Traffic-failure chat: "3 retries at 4 layers can produce up to 81 attempts if each layer makes four total attempts" | The arithmetic is 3 attempts per layer across 4 layers = 3⁴ = 81 (four attempts per layer would be 4⁴ = 256). The guide states it as 3 attempts per layer. This is a general reliability point, not a Kafka fact. |
| Two sizing images disagree on arrow directions | The guide uses one table built from §12 and the learner's written guide. |
| Images contain misspellings ("Partiability", "Staneful", "Connocation") and repeated panels | Not used. The guide's diagrams are redrawn. |

## 21. Tools and source checks (apache/kafka, branch 4.3)

Source: https://github.com/apache/kafka/tree/4.3

Where the docs are silent about a tool the hands-on steps use, the 4.3 source or shipped config was read instead.

- `raft/README.md`: "KRaft (Kafka Raft) is a protocol based on the Raft Consensus Protocol tailored for Apache Kafka."
- `kafka-metadata-quorum --bootstrap-server … describe --status` prints `LeaderId`, `HighWatermark`, `CurrentVoters`
  among others (KRaft page example; `MetadataQuorumCommand.java`).
- `kafka-cluster cluster-id --bootstrap-server …` prints the cluster ID (`ClusterTool.java`).
- Console producer: `--reader-property` (the older `--property` is deprecated), with `parse.key=true`,
  `key.separator` and `null.marker` (a field equal to the marker becomes null, which is how to send a tombstone);
  `--command-property` and `--command-config` for producer settings (`--producer-property` and `--producer.config` are
  **deprecated in 4.3**) (`ConsoleProducer.java`, `LineMessageReader.java`).
- `kafka-producer-perf-test`: `--command-property k=v k=v …` (`--producer-props` deprecated), `--num-records`,
  `--record-size`, `--throughput -1`, `--transactional-id`, `--transaction-duration-ms`; prints records/sec, MB/sec,
  average, max and percentile latencies. `kafka-consumer-perf-test`: `--num-records` (`--messages` deprecated),
  `--group`, `--command-property` (one per flag); prints MB.sec and nMsg.sec.
- Other tools used: `kafka-get-offsets --topic` (end offsets per partition), `kafka-transactions list|describe|
  find-hanging|abort|describe-producers`, `kafka-leader-election --election-type preferred|unclean
  --all-topic-partitions`, `kafka-jmx --jmx-url … --object-name … --one-time true` (JMX enabled on Windows by setting
  `JMX_PORT` before starting the broker), `kafka-consumer-groups … --describe --members|--state`,
  `connect-standalone` with the quickstart's `connect-file-source.properties` (connector `local-file-source`, file
  `test.txt` to topic `connect-test` to `test.sink.txt`) and `plugin.path` pointing at `libs/connect-file-<version>.jar`.
- `kafka-topics --create` warns when a name contains `.` or `_`; the controller rejects a name that collides with an
  existing topic ("collides with existing topic") (`TopicCommand.java`, `ReplicationControlManager.java`).
- `KafkaPrincipal.ANONYMOUS` = `User:ANONYMOUS`, the principal of unauthenticated connections.
- Console consumer: `--formatter-property` (also `--property`) with `print.key`, `print.partition`, `print.offset`,
  `print.timestamp`, `print.headers`, `print.value`; `--command-property` (`--consumer-property` and `--property` deprecated in 4.3); `--group`; `--partition` with `--offset`;
  without a group it uses `console-consumer-<random>` with auto-commit off (`ConsoleConsumerOptions.java`,
  `DefaultMessageFormatter.java`).
- `config/server.properties` (combined node 1: `PLAINTEXT://:9092`, `CONTROLLER://:9093`,
  `controller.quorum.bootstrap.servers=localhost:9093`, internal topics at replication factor 1) and
  `config/broker.properties` (broker-only template, `process.roles=broker`, `node.id=2`) ship in 4.3.
- `config/log4j2.yaml` and `StandardAuthorizerData.java`: see §16.
- Topic names (`clients/…/common/internals/Topic.java`): only ASCII letters and digits, `.`, `_` and `-`; at most 249
  characters; `.` and `..` are invalid. "Due to limitations in metric names, topics with a period ('.') or underscore
  ('_') could collide" (e.g. `orders.eu` and `orders_eu`); the topic tool warns about it. The 4.3 metric tables also
  note an extra underscore-form metric for topic names with periods.

## 22. The consumer API (KafkaConsumer Javadoc, 4.3) and kafka-python

Sources: https://kafka.apache.org/43/javadoc/org/apache/kafka/clients/consumer/KafkaConsumer.html ;
https://kafka-python.readthedocs.io/en/master/apidoc/KafkaConsumer.html (the learner's Python client; a community
library, not part of Apache Kafka)

- **Two positions per partition.** The **position** is the offset of the next record `poll` will give out, one past the
  highest seen; it advances on every `poll`. The **committed position** is the last offset stored securely, the one a
  restarted consumer recovers to. **The committed offset should always be the offset of the next message the
  application will read** (last processed + 1).
- **Liveness:** heartbeats keep a member in the group; if it stops heartbeating for the session timeout it is
  considered dead. Separately, a consumer that keeps heartbeating but makes no progress ("livelock") leaves the group
  when it doesn't call `poll` within `max.poll.interval.ms`; a later `commitSync()` then fails with
  `CommitFailedException`. "To stay in the group, you must continue to call poll."
- **Auto-commit gives at-least-once only if** all records returned by a `poll` are processed before the next `poll`
  (or before closing); otherwise the committed offset can get ahead of what was processed, and records are missed.
- `commitSync` blocks until the commit succeeds or fails; `commitAsync` doesn't. Manual commits give direct control
  over when a record counts as consumed.
- `ConsumerRebalanceListener.onPartitionsRevoked` runs before revoked partitions are given to another consumer: the
  place to commit what was processed.
- **The consumer is not thread-safe**; only `wakeup()` may be called from another thread (to break out of a blocking
  `poll`, raising `WakeupException`).
- **Flow control:** `pause(partitions)` and `resume(partitions)` stop and restart consumption of assigned partitions in
  later `poll` calls; the Javadoc's multi-threaded example pauses "so that no new records are received from poll".
  Membership still depends on calling `poll`: "As long as you continue to call poll, the consumer will stay in the
  group." So a paused consumer keeps polling to keep its partitions.
- kafka-python: `commit(offsets=None)` commits and **blocks until success or error**; defaults `enable_auto_commit=True`,
  `auto_offset_reset='latest'`, `max_poll_records=500`, `max_poll_interval_ms=300000`, matching the Java client.

## 23. Poison records, dead-letter topics, graceful shutdown, durability recipe

Sources: KafkaConsumer.java and RecordDeserializationException.java (apache/kafka 4.3);
https://kafka.apache.org/43/configuration/kafka-streams-configs/ ; https://kafka.apache.org/43/configuration/group-configs/ ;
https://kafka.apache.org/43/operations/basic-kafka-operations/ (Graceful shutdown) ; broker and topic configs

- **Plain consumer:** a record that can't be deserialized makes `poll` throw `RecordDeserializationException`, which
  carries the topic-partition and offset (in 4.3 also the raw key and value bytes). The consumer won't move past it by
  itself; the application decides (log, write it to a dead-letter topic, `seek` past it). **The Apache Kafka client
  has no built-in dead-letter topic.**
- **Kafka Streams:** `deserialization.exception.handler`, default `LogAndFailExceptionHandler` (stop);
  `LogAndContinue…` skips. `errors.dead.letter.queue.topic.name` (default null) makes the default handlers send a
  dead-letter record to that topic; ignored by custom handlers; not for global state stores.
- **Kafka Connect:** `errors.tolerance`, `errors.deadletterqueue.topic.name` for sink connectors (§14).
- **Share groups:** delivery attempts are counted; `share.delivery.count.limit` default **5** (minimum 2); a consumer
  can **reject** a record so it is never redelivered (§6). Lock duration `share.record.lock.duration.ms` 30 s.
- **Graceful shutdown** (`controlled.shutdown.enable`, default true): the broker syncs logs and moves the leadership of
  its partitions to other replicas before stopping, cutting unavailability to "a few milliseconds"; it succeeds only if
  each partition has another live replica. `broker.session.timeout.ms` default **9 s**.
- **The docs' durability recipe** (broker/topic `min.insync.replicas` description): "A typical scenario would be to
  create a topic with a replication factor of 3, set min.insync.replicas to 2, and produce with acks of 'all'", so a
  majority of replicas must persist a write before it is acknowledged and visible.
- **Design (Persistence, Efficiency):** Kafka relies on the OS page cache and linear (sequential) writes rather than an
  in-process cache; batching gives larger network packets and sequential disk operations; compressed batches stay
  compressed in the log and are decompressed by the consumer (end-to-end batch compression).
- **Rebalance triggers** (KafkaConsumer Javadoc): members joining or leaving, failure detection, and also **new
  partitions added to a subscribed topic** or **a new topic matching a subscribed pattern**.
