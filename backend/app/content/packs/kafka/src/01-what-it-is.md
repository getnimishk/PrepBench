---
id: what-it-is
title: What Kafka is: events, logs and records
summary: Kafka stores events in durable, replayable logs; it is not a queue that forgets what it delivered.
sources: §5, §13, §20
---
## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 1 — Event Streaming Fundamentals** (Full)
  - *Relevant sections:* Event streaming in one paragraph; Queue, publish-subscribe and Kafka; The mental shift
  - *Learning evidence:* Explain in your own words how Kafka differs from a traditional message queue such as RabbitMQ, using the order example.
- **Topic 2 — Kafka Record Structure** (Full)
  - *Relevant sections:* What is inside a record; How a record travels; Try it on your cluster
  - *Learning evidence:* Trace one order event from the producer to a partition to two consumer groups, naming the key, value, headers, timestamp, partition and offset at each step.

## Event streaming in one paragraph
**Event streaming** is capturing what happens in a business as a continuous stream of events, storing those events durably, and letting applications react to them as they happen and again later. An **event** records that something happened: an order was placed, a payment cleared, a sensor reported a temperature. The documentation also calls it a **record** or a **message**; the three words mean the same thing.

Kafka combines three capabilities in one system:

- **Publish and subscribe**: applications write streams of events and other applications read them, including continuous import from and export to other systems.
- **Store**: events are kept durably, for as long as the topic's retention says, whether or not anyone has read them.
- **Process**: events can be processed as they arrive or replayed and processed again later.

The short definition to keep: **Kafka is a distributed event-streaming platform that stores events in partitioned, replicated, append-only logs, and lets many independent applications read those logs at their own pace.**

## Queue, publish-subscribe and Kafka
Most confusion about Kafka comes from treating it as a queue. The three models behave differently.

The important column is the last one. Kafka does not delete an event because someone read it. Each reader keeps its own position in the log, so a second team can start reading a topic a week later, and a team that found a bug can rewind and read again.

| Model | How delivery works | What it is good at | Where it stops |
|---|---|---|---|
| Traditional work queue | Each message goes to one worker in a pool, then is removed once acknowledged | Spreading work across workers | Replay is limited; once acknowledged, a message is usually gone |
| Publish-subscribe | Every subscription receives its own copy | Several applications reacting to the same event | Classic pub-sub does not split one subscriber's work across partitions or keep a replayable history |
| Kafka | Events stay in partition logs for the retention period; each consumer group tracks its own position | Independent subscribers, parallel work inside each subscriber, and replay | Order is guaranteed only within a partition, not across a whole topic |

## The mental shift
![Kafka end to end: a producer writes keyed records to a topic's partitions, each partition is replicated across three brokers, and two consumer groups read the same partitions independently with their own committed offsets](/assets/content/packs/kafka/kafka-big-picture.svg)

Kafka gives you both behaviours of the table above through one mechanism, the **consumer group** (chapter 7):

- **Across groups it behaves like publish-subscribe.** The `analytics` group and the `notifications` group each read every event of the `orders` topic, independently.
- **Inside one group it behaves like a work queue.** The partitions of the topic are shared out among the group's consumers, so the group's work runs in parallel.
- **Replay** comes from the log: a group can move its position back, or a new group can start from the beginning.

The phrase to remember: a queue mindset is "send a message to a consumer"; the Kafka mindset is **"write an event to a durable log, and let consumers read the log independently."**

Kafka 4.2 also made **share groups** production-ready (chapter 7): a second kind of group with queue-like behaviour, where records are acknowledged one by one and a group can have more consumers than partitions. Consumer groups remain the normal way to read Kafka.

## What is inside a record
A record has four parts you set, and two Kafka assigns.

The value is opaque to Kafka: a JSON document, an Avro record, or a whole XML order are all just bytes. **Kafka never splits a value across partitions.** One record, however large within the size limits, lands in exactly one partition.

| Part | Who sets it | What it is for |
|---|---|---|
| Key | Producer (optional) | Chooses the partition: records with the same key go to the same partition, which is what keeps them in order |
| Value | Producer | The event itself, as bytes: JSON, Avro, Protobuf, XML |
| Headers | Producer (optional) | Small metadata such as a content type or a trace id, kept apart from the value |
| Timestamp | Producer, or the broker | When the event was created (CreateTime, the default) or appended (LogAppendTime), chosen per topic |
| Partition | Producer, through the partitioner | Which partition of the topic holds the record |
| Offset | The partition leader | The record's position in its partition: 0, 1, 2 and so on |

## How a record travels
Using the order example from your own notes: the order service publishes `ORDER-1001` with its status as the value.

1. The producer builds a record with key `ORDER-1001`, the event as the value, and perhaps a `content-type` header.
2. The producer's partitioner picks a partition. With a key, it hashes the key, so every event for `ORDER-1001` goes to the same partition.
3. The producer sends the record straight to the broker that leads that partition. There is no routing layer in between.
4. The leader appends the record to the end of the partition's log and gives it the next offset.
5. Follower replicas on other brokers copy the record (chapter 12).
6. Each consumer group reading the topic fetches the record when it reaches that position.
7. Each group commits its new position, so it can resume after a restart.

The key is a design decision, not a detail. Keying by `OrderId` keeps each order's lifecycle in order. Keying by `CustomerId` keeps all of a customer's events in order, and risks one busy customer overloading one partition (chapter 10).

## Try it on your cluster
Your single-node KRaft cluster is enough for this. The commands assume Kafka's `bin\windows` folder is on your PATH, as it is in your setup; otherwise run them from that folder.

1. Create a topic with three partitions:

```
kafka-topics.bat --bootstrap-server localhost:9092 --create --topic orders-ch1 --partitions 3 --replication-factor 1
```

2. Start a producer that reads `key:value` lines. The option is `key.separator`, not `parse.separator`:

```
kafka-console-producer.bat --bootstrap-server localhost:9092 --topic orders-ch1 --reader-property parse.key=true --reader-property key.separator=:
```

3. Type these lines:

```
1001:CREATED
1001:PAYMENT_COMPLETED
1002:CREATED
1001:SHIPPED
```

4. In a second terminal, read them with the partition, offset, key and timestamp shown:

```
kafka-console-consumer.bat --bootstrap-server localhost:9092 --topic orders-ch1 --from-beginning --formatter-property print.partition=true --formatter-property print.offset=true --formatter-property print.key=true --formatter-property print.timestamp=true
```

**What you should see:** all three `1001` events share one partition, in the order you typed them, at consecutive offsets in that partition. `1002` may be in another partition, starting again at offset 0. The timestamp is in epoch milliseconds.

**Why does this replay everything each time?** Without `--group`, the console consumer joins a brand-new random group named `console-consumer-<number>` and turns auto-commit off, so it never has a saved position. `--from-beginning` only applies when there is no saved position, so it applies every time. Add `--group ch1-readers` and run it twice: the second run starts where the first stopped.

## What the docs don't say: a topic is not one ordered list
**Practical implication:** reading a topic with several partitions does not give you events in the order they were produced.

**Why it matters:** each partition has its own offsets, and a consumer reading several partitions interleaves them. `1002:CREATED` can arrive before `1001:CREATED` even if it was typed later.

**What to do:** decide which events must stay in order relative to each other, and give them the same key. Everything else is free to interleave.

**Verify further:** [Kafka introduction: main concepts and terminology](https://kafka.apache.org/43/getting-started/introduction).

## Interview takeaway
"Kafka is a distributed log, not a queue. Producers append events to partitions; consumer groups read them independently and keep their own offsets, so the same event can feed analytics, notifications and an audit store, and any of them can replay. Inside a group, partitions are shared out for parallelism. The price is that ordering is per partition, so the key you choose decides what stays in order."
