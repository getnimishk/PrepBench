# CCDAK exam — research notes

**Purpose:** ground the CCDAK question bank (`backend/app/content/question_banks/ccdak/`) in official sources. Every question
cites a section here (`ccdak §2`) or a section of `kafka-documentation-notes.md` (`notes §5`), the notes the Kafka study guide
is built on. A fact a question needs that neither file has goes into this file first, from an official page.

**Sources:** Confluent's CCDAK exam guide (April 2025) and exam page; the Apache Kafka 4.3 Javadoc and configuration
reference (https://kafka.apache.org/43/). Read 2026-10-29. Quotes are marked; everything else is in my own words.

**Version.** The exam guide names no Kafka version. Third-party guides say the exam is built around Kafka 4.x; that is not
an official statement, so the bank states 4.3 behaviour (the learner's install, and the version the notes use) and avoids
questions whose answer changed between 3.x and 4.x unless the question names the version.

---

## 1. The exam (official)

Sources: https://assets.confluent.io/m/26d0f06b432e68e9/original/20250414-DS-Certified_Developer_Apache_Kafka.pdf (the "exam
guide" linked from the exam page) ; https://training.confluent.io/learn/courses/1102/confluent-certified-developer-for-apache-kafka-r ;
https://www.confluent.io/certification/

- **Sections and weights:** 1 Apache Kafka Fundamentals 23%; 2 Apache Kafka Application Development 28%; 3 Apache Kafka
  Streams 12%; 4 Kafka Connect 15%; 5 Application Testing 8%; 6 Application Observability 13%.
- **Length:** 90 minutes, proctored. USD 150. The certification expires after two years.
- **Formats:** multiple-choice (one answer), multiple-response (more than one), matching, build list (put in order). The
  examinee chooses from "four (4) or more response options"; distractors are "generally plausible responses".
- **Tasks the exam validates** include: connect to a secured cluster; produce and consume; model datasets; define topic
  configurations like partitions; understand compression; understand the Admin API; deploy clients; test client
  applications; tune applications; write Streams applications; understand SerDe; monitor applications; implement
  processing semantics (exactly once / at least once); configure and deploy connectors; troubleshoot; work from the command
  line; core concepts (partitions, topics, ordering); Connect core concepts (sink, source, CDC).
- **Product knowledge listed:** basic principles, replication, retention, security, topics/partitions/offsets, client
  configuration and tuning (batching and parallelism), tools and APIs, application metrics, error handling (retryable v.
  non-retryable), message headers, Kafka Connect. General: serialization formats (Avro, JSON, Proto), schema evolution,
  message keying, key hashing, data modeling, encryption, distributed systems, performance tuning and scaling.
- **Out of scope:** Confluent components (RBAC, ksqlDB, CFK), system-specific connectors, plugins and extensions,
  networking, administering and deploying Kafka, infrastructure provisioning.
- **Not published:** the number of questions and the pass mark. (Third-party sites say 60 questions; the bank does not
  rely on it.)

## 2. The producer API (KafkaProducer Javadoc, 4.3)

Source: https://kafka.apache.org/43/javadoc/org/apache/kafka/clients/producer/KafkaProducer.html

- **Thread safety:** the producer is thread safe; "sharing a single producer instance across threads will generally be
  faster than having multiple instances."
- **`send()` is asynchronous:** it adds the record to a buffer of pending sends and returns at once, with a
  `Future<RecordMetadata>`; `get()` on it blocks until the request completes and throws any exception from sending.
- **Callbacks** run, generally, in the producer's I/O thread, so they "should be reasonably fast"; slow callbacks delay
  other threads' sends. **Callbacks for records sent to the same partition execute in order.**
- **`flush()`** makes all buffered records immediately available to send and blocks until their requests complete; it
  must not be called from within a send callback.
- **`close()`** blocks until all previously sent requests complete. `close(Duration)` waits up to the timeout, then fails
  unsent and unacknowledged records, and aborts an ongoing transaction.
- `key.serializer` / `value.serializer`: classes implementing `org.apache.kafka.common.serialization.Serializer`; no
  default (§5).
- **Idempotence** is on by default from Kafka 3.0; setting `transactional.id` enables it automatically.
- **Transactions:** send to multiple partitions and topics atomically; only one open transaction per producer at a time.
  With transactions, callbacks and `get()` are not required: the transactional calls (finally `commitTransaction()`) throw
  the error of a failed send.
- **Fatal transactional errors:** `ProducerFencedException`, `OutOfOrderSequenceException`, `UnsupportedVersionException`,
  `AuthorizationException`: "the only option left is to call close()"; the producer is then defunct. Other errors: abort
  the transaction and try again.
- **`send()` throws directly:** `SerializationException` (key or value not valid for the configured serializers),
  `IllegalStateException`, `InterruptException`, `KafkaException`.

## 3. Retriable and non-retriable errors

Sources: https://kafka.apache.org/43/javadoc/org/apache/kafka/clients/producer/Callback.html ;
https://kafka.apache.org/43/javadoc/org/apache/kafka/common/errors/RetriableException.html ;
KafkaProducer.java and Callback.java (apache/kafka, branch 4.3)

- `Callback.onCompletion(metadata, exception)`: on success `metadata` has the partition and offset and `exception` is
  null. On failure `exception` is non-null and the metadata's offset and other values are -1. The Javadoc says "-1 value
  for all fields" and adds "If topicPartition cannot be chosen, a -1 value will be assigned"; the 4.3 source builds
  failure metadata as `new RecordMetadata(topicPartition(), -1, -1, …)`, so **the topic-partition is kept when one was
  chosen**, and only the rest is -1.
- **Non-retriable (fatal, "the message will never be sent"):** `InvalidTopicException`, `OffsetMetadataTooLarge`,
  `RecordBatchTooLargeException`, `RecordTooLargeException`, `UnknownServerException`, `UnknownProducerIdException`,
  `InvalidProducerEpochException`, `AuthenticationException`, `AuthorizationException`.
- **Retriable ("transient, may be covered by increasing #.retries"):** `CorruptRecordException`,
  `InvalidMetadataException`, `NotEnoughReplicasAfterAppendException`, `NotEnoughReplicasException`,
  `OffsetOutOfRangeException`, `TimeoutException`, `UnknownTopicOrPartitionException`, `BufferExhaustedException`.
- `RetriableException`: "A retriable exception is a transient exception that if retried may succeed." Its subclasses
  include `NotEnoughReplicasException`, `TimeoutException`, `CoordinatorLoadInProgressException`, `NotControllerException`,
  `RetriableCommitFailedException` (consumer).
- The producer retries retriable errors itself (`retries`, bounded by `delivery.timeout.ms`, notes §1); the application
  sees a retriable error only once retrying has run out of time.

## 4. Message headers

Source: https://kafka.apache.org/43/javadoc/org/apache/kafka/common/header/Headers.html ; notes §13

- A record has a key, a value, a timestamp and optional headers (notes §13).
- A header is a `String` key and a `byte[]` value (which may be null). **Multiple headers may have the same key.**
- `add(key, value)` adds to the end; `remove(key)` removes all headers with that key; `lastHeader(key)` returns the last
  one; `headers(key)` returns all for the key in insertion order. `add`/`remove` throw `IllegalStateException` when the
  headers are read-only.

## 5. Serialization (org.apache.kafka.common.serialization)

Source: https://kafka.apache.org/43/javadoc/org/apache/kafka/common/serialization/package-summary.html ; notes §17

- `Serializer<T>`: "An interface for converting objects to bytes." `Deserializer<T>` the reverse. `Serde<T>` wraps a
  serializer and a deserializer for a type; `Serdes` is a factory (`Serdes.String()`, `Serdes.Long()`, …).
- Built-ins: `String`, `ByteArray`, `ByteBuffer`, `Bytes`, `Integer`, `Long`, `Short`, `Float`, `Double`, `Boolean`,
  `UUID`, `List`, `Void` serializers and deserializers. **Apache Kafka ships no Avro, Protobuf or JSON Schema serializer**;
  those come with Schema Registry (Confluent, notes §17).
- The broker stores keys and values as bytes; producer and consumer must agree on the format. A consumer whose
  deserializer can't read a record gets `RecordDeserializationException` from `poll` (notes §23).

## 6. The consumer API (KafkaConsumer Javadoc, 4.3)

Source: https://kafka.apache.org/43/javadoc/org/apache/kafka/clients/consumer/KafkaConsumer.html ; notes §22

- **`subscribe` vs `assign`:** subscription uses group management; `assign` is manual partition assignment, which "does not
  use the consumer's group management functionality", so no rebalance happens when membership or metadata change. The two
  cannot be combined. A subscription is not incremental: a new list replaces the current one.
- Each partition is assigned to exactly one consumer in the group.
- `seek(partition, offset)` overrides the offset the next `poll` fetches from; `seekToBeginning` / `seekToEnd` move to the
  first / last offset.
- **Storing offsets outside Kafka:** turn off auto-commit, store each record's offset with its result, and on restart
  `seek` to it. Simplest with manual assignment; with group assignment, use a `ConsumerRebalanceListener`. Done atomically
  with the output, it can give exactly-once.
- `poll(Duration)`: an error if nothing is subscribed or assigned; returns at once if records are available, otherwise
  waits up to the timeout and returns an empty set.
- A deserializer passed directly to the constructor is not `configure()`d by the consumer (the same holds for producer
  serializers).

## 7. The Admin API

Source: https://kafka.apache.org/43/javadoc/org/apache/kafka/clients/admin/Admin.html

- "The administrative client for Kafka, which supports managing and inspecting topics, brokers, configurations and
  ACLs." Created with `Admin.create(Properties)`; thread safe. Methods return results holding `KafkaFuture`s; for
  synchronous use, call `get()`.
- Methods: `createTopics`, `listTopics`, `describeTopics`, `deleteTopics`; `createPartitions`; `describeConfigs`,
  `incrementalAlterConfigs`; `describeCluster`; `listGroups` (`listConsumerGroups` deprecated since 4.1),
  `describeConsumerGroups`, `deleteConsumerGroups`; `listConsumerGroupOffsets`, `alterConsumerGroupOffsets`,
  `deleteConsumerGroupOffsets`; `createAcls`, `describeAcls`, `deleteAcls`; `listOffsets`; `deleteRecords`.
- **`createPartitions` only increases:** a count less than or equal to the current one fails with
  `InvalidPartitionsException`; the Javadoc warns that increasing partitions for a keyed topic affects partitioning and
  ordering.
- `deleteRecords` deletes records whose offset is smaller than the given offset of a partition.

## 8. Client connection and security settings

Source: https://kafka.apache.org/43/configuration/producer-configs/ (the consumer and admin configs repeat these) ; notes §16

- `bootstrap.servers`: host/port pairs for the initial connection, used to discover the full set of brokers; order doesn't
  matter, and more than one is recommended in case a server is down. No default.
- `client.id`: a logical application name sent with requests, for server-side request logging. Default `""`.
- `security.protocol`: default `PLAINTEXT`; also `SSL`, `SASL_PLAINTEXT`, `SASL_SSL`.
- `sasl.mechanism`: default `GSSAPI`. `sasl.jaas.config`: JAAS login module parameters,
  `loginModuleClass controlFlag (optionName=optionValue)*;`.
- `ssl.truststore.location`: the trust store (to trust the brokers' certificates). `ssl.keystore.location`: "optional for
  client and can be used for two-way authentication for client" (mTLS).
- `ssl.endpoint.identification.algorithm`: default `https` (hostname verification on).
- `interceptor.classes`: `ProducerInterceptor`s that see (and may change) records before they are published; none by
  default.
- `metadata.max.age.ms`: default 300000 (5 min): metadata is refreshed at least this often, to discover new brokers or
  partitions.
- Compression levels: `compression.gzip.level` (default -1), `compression.lz4.level` (default 9),
  `compression.zstd.level` (default 3).

---

*Sections 9 to 16 were added for the bank's second half (Streams, Connect, Testing, Observability). They were read
from the Apache Kafka 4.3 documentation's own source files (apache/kafka, branch 4.3, `docs/`), the generated metric
tables the 4.3 monitoring page includes, and the 4.3 Java source where the docs are silent (2026-10-29).*

## 9. Kafka Streams: the DSL

Source: https://kafka.apache.org/43/streams/developer-guide/dsl-api/ ; https://kafka.apache.org/43/streams/core-concepts/

- **KStream** is a record stream: each record is a self-contained datum, an insert; a repeated key adds another record.
  **KTable** is a changelog stream: each record is an update (upsert) for its key, and a null value is a delete.
  **GlobalKTable** is populated with data from **all** partitions of its topic on every instance, so joins against it
  don't need co-partitioning, at the cost of more local storage and broker load. An aggregation of a KStream yields a
  KTable, which is updated when out-of-order records arrive.
- **Stateless** operations need no state; **stateful** ones (aggregations, joins, windowing) depend on state.
- **Repartitioning:** `map`, `flatMap` and `selectKey` can change the key, so a grouping or join after them repartitions
  the records; `mapValues` and `flatMapValues` never do. `groupBy` always repartitions; `groupByKey` repartitions only if
  the stream was already marked for it.
- **Aggregations:** grouping gives a `KGroupedStream` / `KGroupedTable`; `count` counts per key; `reduce` keeps the value
  type; `aggregate` may change it.
- **Windows:** *tumbling*: fixed-size, non-overlapping, gap-less; a record belongs to exactly one window; a hopping window
  whose advance equals its size. *Hopping*: fixed size with an advance interval ("hop"), possibly overlapping, so a record
  can be in several windows. Both are aligned to the epoch, lower bound inclusive, upper exclusive. *Sliding*: aligned to
  the records' timestamps, both bounds inclusive, used for windowed aggregations (`SlidingWindows`) and joins
  (`JoinWindows`). *Session*: periods of activity separated by an inactivity gap, tracked per key, with varying sizes;
  a record within the gap of an existing session is merged into it. A **grace period** bounds how late a record may be
  and still be accepted: a 09:00-10:00 window with 10 minutes' grace accepts out-of-order records until 10:10, then
  closes. `suppress(Suppressed.untilWindowCloses(...))` emits only a window's final result.
- **Joins:** KStream-KStream joins are **always windowed**. KStream-KStream and KTable-KTable joins support inner, left
  and outer; KStream-KTable, KStream-GlobalKTable and KTable-KTable foreign-key joins support inner and left.
  **Co-partitioning** (same number of partitions, same partitioning strategy, so equal keys land in the same partition
  number) is required for joins, except KTable-KTable foreign-key joins and GlobalKTable joins.
- **Branching:** `split()` sends each record to the first branch whose predicate matches; unmatched records go to the
  default branch, or are dropped if there is none.
- Change data capture (CDC) records from a database's changelog are an example of a changelog stream, read as a KTable.

## 10. Kafka Streams: configuration and runtime

Source: https://kafka.apache.org/43/streams/developer-guide/config-streams/ ; StreamsConfig.java (apache/kafka 4.3) ;
https://kafka.apache.org/43/streams/architecture/ ; https://kafka.apache.org/43/streams/developer-guide/manage-topics/ ;
https://kafka.apache.org/43/streams/developer-guide/running-app/ ; https://kafka.apache.org/43/streams/developer-guide/processor-api/ ;
https://kafka.apache.org/43/streams/developer-guide/interactive-queries/

- `application.id` (required, unique in the cluster) is used as the consumer group ID, the client ID prefix, the state
  directory's subfolder name and the prefix of internal topic names. `bootstrap.servers` is required too.
- `num.stream.threads` default 1. `processing.guarantee`: `at_least_once` (default) or `exactly_once_v2`.
  `commit.interval.ms`: 30000 by default, **100 with exactly_once_v2**. `num.standby.replicas` default 0.
  `replication.factor` (for changelog and repartition topics) default -1, the broker default. `state.dir` default
  `${java.io.tmpdir}/kafka-streams`. `statestore.cache.max.bytes` default 10485760.
- Exception handlers (4.3 source): `deserialization.exception.handler` default **`LogAndFailExceptionHandler`**;
  `production.exception.handler` default `DefaultProductionExceptionHandler` (fails); `processing.exception.handler`
  default `LogAndFailProcessingExceptionHandler`.
- `topology.optimization` default none; to apply it, the same properties must also be passed to
  `StreamsBuilder.build(props)`.
- **Parallelism:** an application reading a topic with ten partitions can run up to ten instances; more instances are
  idle (notes §15: tasks come from input partitions).
- **Internal topics** are created by the application, named `<application.id>-<operatorName>-<suffix>` (not
  guaranteed for the future). Repartition topics: delete policy, infinite retention. Changelog topics of key-value
  stores: **compacted**; of windowed stores: `delete,compact`. On a secured cluster the application needs permission to
  create them.
- Each state store has a changelog topic; a task restarted on another machine **restores its store by replaying the
  changelog** before processing. **Standby replicas** keep copies to cut that restore time.
- State stores: **RocksDB is the default persistent store** ("recommended for most use cases", local disk, can exceed
  heap); in-memory stores exist too.
- **Punctuation** (Processor API): `ProcessorContext#schedule()` with stream time (advances only with input data) or
  wall-clock time.
- **Interactive queries** read an instance's local state stores, read-only; to query other instances the application adds
  its own RPC layer (for example a REST API).

## 11. Testing Kafka Streams applications and tools

Source: https://kafka.apache.org/43/streams/developer-guide/testing/ ;
https://kafka.apache.org/43/streams/developer-guide/app-reset-tool/

- Test utilities come in a separate artifact, `org.apache.kafka:kafka-streams-test-utils`, added as a test dependency.
- **`TopologyTestDriver`** pipes data through a `Topology` (DSL or Processor API) **without a broker**: it simulates the
  runtime fetching records and traversing the topology, captures output, and lets tests query state stores
  (`getKeyValueStore`). `createInputTopic` gives a `TestInputTopic` (`pipeInput`, with serializers);
  `createOutputTopic` a `TestOutputTopic` (`readKeyValue`, `isEmpty`, with deserializers). Event-time punctuations fire
  from piped records' timestamps; wall-clock punctuations by `advanceWallClockTime`. Call `close()` after each test.
- **Application reset tool** (`kafka-streams-application-reset`): resets input topics' offsets (to the beginning by
  default) and **deletes internal topics**; it does **not** reset output topics or delete local state, which you must
  do yourself.

## 12. Testing client applications: MockProducer and MockConsumer

Source: https://github.com/apache/kafka/blob/4.3/clients/src/main/java/org/apache/kafka/clients/producer/MockProducer.java ;
MockConsumer.java (same branch)

- **`MockProducer`**: "A mock of the producer interface you can use for testing code that uses Kafka". With
  `autoComplete=true` each send completes successfully at once and runs its callback; with `false` the test calls
  `completeNext()` or `errorNext(RuntimeException)` to finish sends, so it can test error handling. `history()` returns
  the records sent; `clear()` resets it; `flushed()`, `closed()`, `transactionCommitted()` and `fenceProducer()` support
  transaction tests. No broker is involved.
- **`MockConsumer`**: a mock of the `Consumer` interface, **not thread safe**; `schedulePollTask` runs code on the next
  `poll` for multithreaded tests. Tests `assign` or `subscribe` then `rebalance(...)`, set offsets with
  `updateBeginningOffsets` / `updateEndOffsets`, add records with `addRecord`, and inject failures with
  `setPollException`.

## 13. Kafka Connect: workers, connectors, tasks, converters, transforms

Source: https://kafka.apache.org/43/kafka-connect/user-guide/ ; https://kafka.apache.org/43/kafka-connect/connector-development-guide/ ;
https://kafka.apache.org/43/kafka-connect/administration/ ; notes §14

- A **connector** does no copying itself: it describes the data and splits the job into **tasks** (`SourceTask`,
  `SinkTask`) that workers run; it may create fewer tasks than `tasks.max`. A source task emits `SourceRecord`s carrying
  a **source partition** and **source offset** (for a file: the file name and byte position), so Connect tracks where it
  is in the external system.
- **Converters** (`key.converter`, `value.converter`, set on the worker and optionally overridden per connector)
  convert between Connect's data format and the bytes written to Kafka, independently of connectors, so any connector
  works with any format (JSON and Avro are examples). With the JSON converter, `*.converter.schemas.enable=false`
  gives schemaless JSON.
- Common connector configs: `name` (unique; registering it again fails), `connector.class` (full name or alias, e.g.
  `FileStreamSink`), `tasks.max`, converter overrides. Sink connectors take `topics` or `topics.regex`.
- `plugin.path`: directories holding plugins (connectors, converters, transformations).
- **Distributed workers** share a `group.id`, which must **not conflict with consumer group IDs**; connectors are created
  through the REST API, not the command line. Client settings for source tasks' producers and sink tasks' consumers take
  the `producer.` / `consumer.` prefixes on the worker; only `bootstrap.servers` is inherited without one. Per connector:
  `producer.override.` / `consumer.override.`.
- A sink connector's consumer group is `connect-<connector name>` by default.
- **Transformations** (SMTs) can be applied conditionally with **predicates**; `Filter` with a predicate drops selected
  messages.
- **Rebalancing:** adding a connector, changing tasks or config, or a worker joining or leaving rebalances the tasks.
  Since 2.3 the default is **incremental cooperative rebalancing** (only affected tasks move). When a worker leaves,
  Connect waits `scheduled.rebalance.max.delay.ms` (default 5 minutes) before reassigning its tasks.
- **Connect does not automatically restart failed tasks**; restart them through the REST API.
- CDC connectors (change data capture) may use extra topics, for example for schema history; specific connectors are out
  of the exam's scope (ccdak §1).

## 14. Kafka Connect: the REST API and states

Source: https://kafka.apache.org/43/kafka-connect/user-guide/ ; https://kafka.apache.org/43/kafka-connect/administration/

- The REST API runs in standalone and distributed mode, by default on **port 8083** over HTTP (`listeners`).
- `GET /connectors`; `POST /connectors` (body: `name`, `config`, optional `initial_state`); `GET /connectors/{name}`;
  `GET|PUT|PATCH /connectors/{name}/config` (PATCH: a null value removes a key); `GET /connectors/{name}/status`
  (connector and task states, worker, errors); `GET /connectors/{name}/tasks`; `GET /connectors/{name}/tasks/{id}/status`;
  `PUT /connectors/{name}/pause` (stops processing, keeps resources); `PUT /connectors/{name}/stop` (shuts tasks down and
  frees resources; offsets can be changed only when stopped); `PUT /connectors/{name}/resume`;
  `POST /connectors/{name}/restart?includeTasks=…&onlyFailed=…`; `POST /connectors/{name}/tasks/{id}/restart`;
  `DELETE /connectors/{name}`; `GET /connectors/{name}/offsets`, and `DELETE` / `PATCH` of it (connector must be
  stopped); `GET /connector-plugins`; `PUT /connector-plugins/{type}/config/validate`.
- Restarting a task during a rebalance returns **409 (Conflict)**.
- **States:** UNASSIGNED, RUNNING, PAUSED, STOPPED (connectors only), FAILED, RESTARTING.
- **Pause** is persistent across restarts: a paused source stops being polled, a paused sink stops receiving messages.

## 15. Client metrics

Source: https://kafka.apache.org/43/operations/monitoring/ ; https://kafka.apache.org/43/generated/producer_metrics.html ;
https://kafka.apache.org/43/generated/consumer_metrics.html

- Java clients use Kafka Metrics and **expose metrics through JMX**, with pluggable reporters. Every rate metric has a
  cumulative `-total` partner (`records-consumed-rate` / `records-consumed-total`).
- **Producer** (`kafka.producer:type=producer-metrics,client-id=…`): `record-send-rate`; `record-error-rate` (sends that
  resulted in errors); `record-retry-rate`; `request-latency-avg`; `record-queue-time-avg` (time batches spend in the send
  buffer); `batch-size-avg`; `records-per-request-avg`; `compression-rate-avg` (compressed / uncompressed size);
  `buffer-available-bytes`; `bufferpool-wait-ratio` (fraction of time waiting for buffer space);
  `produce-throttle-time-avg`.
- **Consumer fetch** (`kafka.consumer:type=consumer-fetch-manager-metrics,…`): `records-lag-max` (max lag in records for
  any partition, **based on the current offset, not the committed offset**); per-partition `records-lag`;
  `records-lead-min`; `records-consumed-rate`; `bytes-consumed-rate`; `fetch-rate`; `fetch-latency-avg`;
  `fetch-throttle-time-avg`.
- **Consumer** (`consumer-metrics`): `time-between-poll-avg` / `-max`, `last-poll-seconds-ago`, `poll-idle-ratio-avg`
  (fraction of time `poll` is idle rather than waiting for user code). **Coordinator** (`consumer-coordinator-metrics`):
  `commit-latency-avg`, `assigned-partitions`, `heartbeat-rate`, `rebalance-latency-avg`, `failed-rebalance-total`,
  `last-rebalance-seconds-ago`.
- Common: `io-wait-ratio`, `connection-count`; per node `request-latency-avg`.
- The docs recommend watching, on clients, message and byte rates and request rate/size/time, and on consumers **max
  lag and min fetch rate** (notes §12).

## 16. Streams and Connect metrics

Source: https://kafka.apache.org/43/operations/monitoring/ ; https://kafka.apache.org/43/generated/connect_metrics.html

- A Streams instance has all producer and consumer metrics plus its own, in four layers (client, thread, task,
  processor node / state store / cache), with recording levels `info`, `debug`, `trace` chosen by
  `metrics.recording.level` (default `info`).
- Client: `state`, `alive-stream-threads`, `failed-stream-threads`. Thread: `process-rate`, `process-latency-avg`,
  `commit-latency-avg`, `poll-records-avg`, `punctuate-rate`, `blocked-time-ns-total`. Task: `record-lateness-avg`,
  `dropped-records-rate` / `-total` (at `info`; most task metrics are `debug`).
- A Connect worker has all producer and consumer metrics plus its own: worker `connector-count`, `task-count`,
  `connector-failed-task-count`, `connector-running-task-count`; connector `status`; task `batch-size-avg`,
  `offset-commit-failure-percentage`; sink tasks `sink-record-read-rate`, `sink-record-lag-max`,
  `put-batch-avg-time-ms`; source tasks `source-record-poll-rate`, `poll-batch-avg-time-ms`; errors
  (`task-error-metrics`) `total-record-errors`, `total-errors-logged`, `deadletterqueue-produce-requests`.
