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
https://kafka.apache.org/43/javadoc/org/apache/kafka/common/errors/RetriableException.html

- `Callback.onCompletion(metadata, exception)`: on success `metadata` has the partition and offset and `exception` is
  null; on failure `exception` is non-null and `metadata` has -1 in every field.
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
