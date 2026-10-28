---
id: topic-design
title: Designing topics
summary: A topic is a contract between teams: decide what it holds, what it is called, who owns it and how it is configured before the first producer writes to it.
sources: §3, §4, §12, §16, §17, §21
---
## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 7 — Topic Design** (Full)
  - *Relevant sections:* What one topic should hold; Names: the rules Kafka enforces and the ones you choose; Ownership: one writer team per topic; Settings to decide per topic; Try it on your cluster
  - *Learning evidence:* Write a topic naming and ownership standard for three teams (orders, payments, analytics), including who may write, who may read, and the per-topic settings each team must choose.

## What one topic should hold
A topic is a stream of events that consumers will treat as one thing. Three questions decide its boundaries.

- **Do consumers need these events in order relative to each other?** Order exists only within a partition, and a partition belongs to one topic. Events that must be ordered together (an order's CREATED, PAID, SHIPPED) belong in the same topic with the same key. That is the strongest argument for putting several event types in one topic.
- **Do they share a schema and a retention need?** Retention, cleanup policy and compaction are per topic. A compacted "latest customer profile" stream and a seven-day clickstream should not share a topic.
- **Who owns them?** A topic with one producing team has one owner who can change it safely. A topic many teams write to has none.

With Schema Registry (chapter 16), the default subject naming ties **one value schema to one topic**. Several event types in one topic is possible, but needs the `RecordNameStrategy` or `TopicRecordNameStrategy` subject naming, a decision to make up front.

## Names: the rules Kafka enforces and the ones you choose
**Kafka enforces only a few rules.** A topic name may contain ASCII letters, digits, `.`, `_` and `-`, and be at most **249 characters**. Names starting with `__` are used by Kafka's internal topics (`__consumer_offsets`, `__transaction_state`, `__cluster_metadata`).

**One rule is easy to miss.** Because of how metric names are built, a period and an underscore can collide: `orders.eu` and `orders_eu` produce clashing metric names, and `kafka-topics` warns you when a name contains either. Pick **one** separator for your organisation and never mix them.

**Everything else is a convention you choose.** The documentation does not prescribe one. A convention that works well puts the most general part first, because ACLs can match a **prefix** (chapter 19):

```
<domain>.<dataset>.<event-or-purpose>
orders.order.lifecycle
payments.payment.authorised
orders.order.lifecycle.dlq
```

With that shape, "the orders team may write to every topic starting `orders.`" is one prefixed ACL, and a new topic is covered the moment it is created. Avoid putting things that change into names: a team name that will be reorganised, an environment that belongs in a cluster, or a version number that forces every consumer to switch topics.

## Ownership: one writer team per topic
For a multi-team organisation, an ownership standard should answer:

- **Who may write?** Usually one team: the owner. Enforce it with a prefixed WRITE ACL for that team's principals.
- **Who may read?** Any team that asks, through READ ACLs for the topic and their consumer group.
- **Who changes the schema?** The owner, under a compatibility mode that protects readers (chapter 16).
- **Who sets the settings?** The owner, in a reviewed definition (code or a ticket), not by hand on a running cluster.
- **Where is it documented?** Owner, purpose, key, schema subject, retention and an on-call contact.

## Settings to decide per topic
The broker defaults are made for convenience, not for your workload. Decide these per topic when you create it.

| Setting | Broker or topic default | The question to answer |
|---|---|---|
| partitions | num.partitions = 1 | How much consumer parallelism and throughput, now and later? It can grow but never shrink (chapter 10) |
| replication factor | default.replication.factor = 1 | How many broker losses must it survive? The docs recommend 2 or 3; 3 is the common production setting |
| min.insync.replicas | 1 | How many copies must exist before a write with acks=all is accepted? (chapter 12) |
| cleanup.policy | delete | History (delete) or latest value per key (compact), or both? (chapter 13) |
| retention.ms | 7 days | How long must a consumer be able to fall behind, or replay, and still find the data? |
| retention.bytes | -1 (no limit), per partition | Is there a disk budget? Remember it applies to each partition |
| max.message.bytes | 1048588 | Can any event be bigger than about 1 MB? If so, should it be in Kafka at all? |

## Automatic topic creation
Brokers create a topic automatically the first time something writes to a name that doesn't exist (`auto.create.topics.enable` defaults to `true`). The topic gets the broker defaults: **one partition, replication factor 1**. A typo in a producer's topic name silently creates a new, unreplicated, one-partition topic.

The documentation leaves this to you, noting only that you may want to tune the defaults if you rely on it. Many teams turn it off in shared clusters so every topic is created on purpose, with its owner's settings.

## Try it on your cluster
1. Create a topic with its settings stated, not inherited:

```
kafka-topics.bat --bootstrap-server localhost:9092 --create --topic orders.order.lifecycle --partitions 6 --replication-factor 1 --config retention.ms=1209600000 --config cleanup.policy=delete
```

2. See only the settings that differ from the defaults:

```
kafka-configs.bat --bootstrap-server localhost:9092 --entity-type topics --entity-name orders.order.lifecycle --describe
```

3. Try a colliding name and read the warning:

```
kafka-topics.bat --bootstrap-server localhost:9092 --create --topic orders_order_lifecycle --partitions 1 --replication-factor 1
```

**What you should see:** a warning that names with a period or underscore could collide in metrics, and, because `orders.order.lifecycle` already exists, an error that the new name collides with it.

## What the docs don't say: a topic is a public API
**Practical implication:** once other teams consume a topic, its name, key, schema and retention are an interface you cannot change casually.

**Why it matters:** renaming means every consumer must move; changing the key changes which events share a partition and so what stays in order; shortening retention silently breaks a consumer that relies on replaying a week.

**What to do:** treat a topic like an API: an owner, a documented contract, versioned schemas under a compatibility rule, and a deprecation process (create the new topic, run both, move consumers, retire the old one).

**Verify further:** [Basic Kafka operations: adding and removing topics](https://kafka.apache.org/43/operations/basic-kafka-operations/).

## Interview takeaway
"I design topics around consumers: events that must be ordered together share a topic and a key, and events with different retention or ownership don't. Names follow one convention with the domain first, so prefixed ACLs give each team write access to its own namespace, and I avoid mixing periods and underscores because they collide in metric names. Every topic is created explicitly with its partitions, replication factor, min ISR and retention chosen. The broker defaults are one partition and no replication, which is never what production wants."
