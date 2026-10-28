---
id: streams
title: Kafka Streams and ksqlDB
summary: Kafka Streams is a library that turns topics into stateful, scalable, fault-tolerant processing; ksqlDB puts SQL on top of the same ideas.
sources: §5, §8, §11, §15, §18, §23
---
## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 33 — Kafka Streams** (Full)
  - *Relevant sections:* What Kafka Streams is; Streams and tables; Time and windows; State, tasks and scaling; Exactly-once in Streams; Try it on your cluster
  - *Learning evidence:* Run the WordCount demo, explain the KStream to KTable aggregation and its compacted output topic, and say how many instances the application can usefully run.
- **Topic 34 — ksqlDB** (Full)
  - *Relevant sections:* ksqlDB; Joins need co-partitioned inputs
  - *Learning evidence:* Write a ksqlDB query joining an orders stream to a payments stream within a time window, and explain why the window is required.

## What Kafka Streams is
**Kafka Streams** is a **client library** for processing data that is in Kafka and writing results back to Kafka. It is not a cluster or a service: it's a JAR inside your Java application, which you deploy and scale like any other application. Every instance is, underneath, a set of consumers and producers.

It provides what plain consumers make you build yourself: stateful operations (counts, aggregations, joins) with fault-tolerant local state, event-time windowing that copes with late records, one record at a time at millisecond latency, and exactly-once processing with one setting.

## Streams and tables
The central idea is the **stream-table duality**:

- A **stream** is a sequence of facts: "order 1001 was placed", "order 1001 was paid". Modelled as a `KStream`.
- A **table** is the current state per key: "order 1001 is PAID". Modelled as a `KTable` (partitioned across instances) or a `GlobalKTable` (fully copied to every instance, for small reference data).
- A **stream is the changelog of a table**: replay it and you rebuild the table. A **table is a snapshot of a stream**: every update to it is a change event. Kafka's compacted topics (chapter 13) are exactly this.

An **aggregation** (count, sum, reduce) turns a stream into a table, and its output is always a `KTable`, so the result can be updated when a late record arrives.

## Time and windows
Kafka Streams distinguishes three times:

- **Event time:** when the event happened at its source (the GPS reading's timestamp).
- **Processing time:** when the application processes it, which may be seconds or days later.
- **Ingestion time:** when the broker appended it to the topic.

Windowed operations (counts per five minutes, joins within an hour) work on the record timestamps. Records arrive out of order in real life, so a window has a **grace period**: how long it keeps accepting late records. A record arriving after its window's grace period has passed is **dropped**.

## State, tasks and scaling
- An application is split into a fixed number of **tasks**, one per input partition (for the topology's input topics). **Maximum parallelism = number of input partitions**: a 5-partition input means at most 5 instances (or threads) doing work; more sit idle, as in a consumer group.
- Each task can keep **local state stores** (counts, join buffers) on the instance's disk. Each store is backed by a **changelog topic** in Kafka, so if the instance dies, another rebuilds the state by replaying it.
- Rebuilding can take long for big state. **Standby replicas** (`num.standby.replicas`, default **0**) keep warm copies on other instances to cut that time.
- Threads and instances are added freely; Kafka Streams moves tasks between them. The **Streams rebalance protocol** (KIP-1071, early access in 4.1, production-ready for its core features in 4.2) moves task assignment to the broker, like the consumer protocol in chapter 9; an application opts in with `group.protocol=streams`.

## Exactly-once in Streams
`processing.guarantee` defaults to `at_least_once`. Set it to **`exactly_once_v2`** and Kafka Streams uses transactions under the hood (chapter 8): input offsets, state-store changelog writes and output records are committed atomically. By default it needs a cluster of **three brokers**, like any transactions.

Errors: a record that can't be deserialized is handled by `deserialization.exception.handler`, default **LogAndFail** (stop the application); you can switch to log-and-continue, and in 4.3 `errors.dead.letter.queue.topic.name` makes the default handlers send failed records to a dead-letter topic (chapter 14).

## ksqlDB
**ksqlDB** is a **Confluent** product, not part of Apache Kafka: a streaming SQL engine on top of Kafka. You declare **streams** and **tables** over topics and write continuous queries in SQL; it runs them on Kafka Streams-style processing.

```
CREATE STREAM orders_paid AS
  SELECT o.id, o.amount, p.method
  FROM orders o
  INNER JOIN payments p WITHIN 1 HOURS ON p.order_id = o.id
  EMIT CHANGES;
```

Two facts to know in 2026:

- **A stream-stream join must have a `WITHIN` window.** Only stream-stream joins are windowed: two unbounded streams can only be matched over a bounded time range, because each side must be buffered while waiting for the other.
- **Confluent now recommends Apache Flink for new stream-processing workloads**; ksqlDB remains supported for existing applications. In an interview, know ksqlDB's model, and know that the strategic direction has moved.

## Joins need co-partitioned inputs
For most joins, in Kafka Streams and ksqlDB alike, the two inputs must be **co-partitioned**: the **same number of partitions**, and records keyed the **same way**, so that matching keys sit in the same partition number on both sides and one task sees both. The exception in ksqlDB is a **foreign-key table-table join**.

If the inputs aren't co-partitioned, the application must **repartition** one side: re-key it and write it through an extra internal topic. That costs a topic, a network round trip, and storage.

## Try it on your cluster
Kafka ships the WordCount demo. It needs Java, which you have.

1. Create the input topic and the compacted output topic:

```
kafka-topics.bat --bootstrap-server localhost:9092 --create --topic streams-plaintext-input --partitions 1 --replication-factor 1
kafka-topics.bat --bootstrap-server localhost:9092 --create --topic streams-wordcount-output --partitions 1 --replication-factor 1 --config cleanup.policy=compact
```

2. Start the demo application:

```
kafka-run-class.bat org.apache.kafka.streams.examples.wordcount.WordCountDemo
```

3. Read the output. The counts are longs, so tell the console consumer how to decode them:

```
kafka-console-consumer.bat --bootstrap-server localhost:9092 --topic streams-wordcount-output --from-beginning --formatter-property print.key=true --formatter-property print.value=true --formatter-property key.deserializer=org.apache.kafka.common.serialization.StringDeserializer --formatter-property value.deserializer=org.apache.kafka.common.serialization.LongDeserializer
```

4. Type lines into a console producer on `streams-plaintext-input`, such as `all streams lead to kafka` and then `hello kafka streams`.

**What you should see:** each word with its running count, and `kafka` printed again with **2** after the second line. That is a table's changelog: each output record is the new value for a key. The output topic is compacted because only the latest count per word matters.

5. List the topics. You'll find extra ones the application created, with names starting with its application ID, such as a `-changelog` topic backing its count store. That is its state, held in Kafka.

## What the docs don't say: your state is only as fast as its changelog
**Practical implication:** a stateful Streams application can take minutes or longer to recover after an instance moves, because the new instance must replay the changelog to rebuild the store.

**Why it matters:** during that restore the moved tasks process nothing, so lag builds on their input partitions. Big state and frequent rebalances (chapter 9) multiply the effect.

**What to do:** keep state lean (windows with retention, not unbounded tables), use standby replicas for large state, use static membership or the newer group protocols to avoid needless moves, and watch restore times as part of deployment.

**Verify further:** [Kafka Streams architecture](https://kafka.apache.org/43/streams/architecture/).

## Interview takeaway
"Kafka Streams is a library, not a cluster: my app becomes consumers and producers plus local state stores backed by changelog topics. Streams and tables are two views of the same data; aggregations produce tables. Windows work on event time with a grace period for late records. Parallelism is capped by input partitions, and joins need co-partitioned inputs or a repartition. exactly_once_v2 gives transactional end-to-end processing inside Kafka. ksqlDB offers the same model in SQL; stream-stream joins need a WITHIN window, and Confluent now points new workloads to Flink."
