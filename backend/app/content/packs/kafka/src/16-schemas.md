---
id: schemas
title: Data formats and Schema Registry
summary: Kafka stores bytes; the format and the schema rules decide whether producers and consumers can change independently without breaking each other.
sources: §13, §14, §17, §20, §22
---
## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 27 — JSON** (Full)
  - *Relevant sections:* Kafka stores bytes; JSON: flexible and fragile
  - *Learning evidence:* State JSON's strengths and weaknesses against a schema-enforced format, using your own JSONDecodeError as the example.
- **Topic 28 — Avro** (Full)
  - *Relevant sections:* Avro: the schema travels separately; Compatibility modes; Try it: a compatibility check
  - *Learning evidence:* Make a backward-compatible change to an order schema (add a field with a default) and an incompatible one, and explain why each passes or fails.
- **Topic 29 — Protobuf** (Full)
  - *Relevant sections:* Protobuf: fields are numbers; Choosing a format
  - *Learning evidence:* Compare Protobuf and Avro for a multi-language microservices platform, and explain why a deleted Protobuf field number must be reserved.
- **Topic 30 — Parquet** (Full)
  - *Relevant sections:* Parquet: for the lake, not the topic; Choosing a format
  - *Learning evidence:* Explain why events travel through Kafka as Avro or Protobuf but land in the lake as Parquet.
- **Topic 31 — Schema Registry** (Full)
  - *Relevant sections:* Schema Registry; Compatibility modes; Who upgrades first; Try it: a compatibility check
  - *Learning evidence:* Configure BACKWARD compatibility for a subject, register a compatible change, and show the registry rejecting an incompatible one.

## Kafka stores bytes
To Kafka, a record's key and value are **byte arrays**. It never parses them. The producer's serializer turns objects into bytes; the consumer's deserializer turns bytes back. Everything about format, structure and evolution is an agreement **between applications**, and Kafka does not enforce it.

That agreement is the real subject of this chapter. A topic often outlives the code that first wrote it, and many teams read it. The format decides whether a producer can add a field on Tuesday without breaking a consumer nobody remembers.

## JSON: flexible and fragile
**Strengths:** human-readable, every language parses it, no setup, easy to inspect with the console consumer.

**Weaknesses:**

- **No enforced schema.** Nothing stops a producer renaming `status` to `state`. The consumer finds out at runtime, with a `KeyError` or worse, a silent `null`.
- **Field names in every record**, so it is larger than binary formats.
- **Types are loose:** numbers vs strings, dates as strings in any format, no decimal type for money.
- **Mixed content goes unnoticed** until a consumer chokes, exactly what happened in your setup: earlier plain-text test lines in the `orders` topic made the JSON consumer fail with `JSONDecodeError`.

JSON is fine for a topic owned and read by one team, or for logs. For a shared, long-lived topic, use a schema: JSON Schema, Avro or Protobuf, with a registry.

## Avro: the schema travels separately
Avro data in its binary form contains **no field names and no types**. A reader cannot decode it without knowing the schema it was **written** with. That is why Avro on Kafka almost always comes with a schema registry: each record carries a small schema ID, and the reader fetches the writer's schema by ID.

When the reader's schema differs from the writer's, Avro **resolves** them field by field. The rules from the specification:

- A field the writer has and the reader doesn't: **ignored**.
- A field the reader has and the writer doesn't: the reader uses its **default value**.
- A field the reader has with **no default**, missing from the writer's data: **error**.

So the golden rule of Avro evolution is: **give every new field a default**, and only remove fields that had one.

## Protobuf: fields are numbers
Protocol Buffers identify fields on the wire by **number**, not name. The rules that keep old and new code compatible:

- A field number must be unique, and **cannot be changed once in use**: it identifies the field in the encoded data.
- When you delete a field, put its number (and name) in a `reserved` list, and **never reuse** it. Reuse makes old data decode into the wrong field.

Protobuf generates typed code for many languages, which suits polyglot microservices. For Protobuf schemas in a registry, Confluent's documentation recommends **BACKWARD_TRANSITIVE** compatibility, because adding new message types is not forward compatible.

## Parquet: for the lake, not the topic
Parquet is a **column-oriented file format** for efficient storage and analytical reads: it stores each column together, compresses and encodes it well, and lets a query read only the columns it needs.

It is not a per-record message format. A Kafka record is one event; a Parquet file holds many rows organised by column. The usual pattern: events travel through Kafka as Avro, Protobuf or JSON, and a sink (a Kafka Connect sink connector, a Spark or Flink job) writes them to the lake **as Parquet files**, batched by time or size.

## Choosing a format
| Format | Schema enforced | Size | Evolution | Best for |
|---|---|---|---|---|
| JSON (no schema) | No | Large: names in every record | Anything goes, so anything breaks | One-team topics, logs, prototypes |
| JSON Schema | Yes, with a registry | Large | Registry compatibility rules | Teams that want JSON's readability with checks |
| Avro | Yes, with a registry | Small binary | Resolution by name with defaults | Data platforms, Kafka Connect, Java and JVM-heavy shops |
| Protobuf | Yes, with a registry | Small binary | By field number; reserve deleted numbers | Polyglot microservices, gRPC shops |
| Parquet | Yes, in the file | Columnar, compressed | Per file | Analytics storage after Kafka, not in it |

## Schema Registry
Schema Registry is a **Confluent** service, not part of Apache Kafka, that stores schemas and checks changes to them. It supports **Avro, JSON Schema and Protobuf**.

- Schemas are stored under a **subject**. By default (**TopicNameStrategy**) the subject is the topic name plus `-key` or `-value`, so one topic has one value schema. `RecordNameStrategy` and `TopicRecordNameStrategy` allow several record types per topic.
- Each version gets a **unique ID**. The serializer registers or looks up the schema and puts the ID in the record. The default wire format is a **version byte 0** (often called the magic byte), then the **4-byte schema ID** (big-endian), then for Protobuf a message index, then the encoded data. It applies to keys and values alike.
- The deserializer reads the ID, fetches that schema from the registry, and decodes.
- `auto.register.schemas` controls whether the serializer may register new schemas itself. Confluent's documentation shows turning it off (`auto.register.schemas=false`, with `use.latest.version=true`) so production producers only use schemas that were registered on purpose.
- When a new version is registered, the registry **checks compatibility** first and rejects a change that breaks the subject's rule.

## Compatibility modes

Confluent's documentation explains why BACKWARD is the default: it lets consumers **rewind** to the start of a topic and still read old data with the new schema. Note that plain BACKWARD only checks against the **latest** version; if consumers may read data from many versions ago, use BACKWARD_TRANSITIVE.

| Mode | Guarantees | Allowed changes | Checked against |
|---|---|---|---|
| BACKWARD (the default) | Consumers using the new schema can read data written with the previous schema | Delete fields; add optional fields (with defaults) | The latest version only |
| BACKWARD_TRANSITIVE | The same, for all earlier versions | The same | Every earlier version |
| FORWARD | Consumers using the old schema can read data written with the new schema | Add fields; delete optional fields | The latest version |
| FULL | Both directions | Add or delete optional fields only | The latest version |
| FULL_TRANSITIVE, FORWARD_TRANSITIVE | As above, across all versions | As above | Every earlier version |
| NONE | Nothing | Anything | Not checked |

## Who upgrades first
The mode decides the rollout order, and getting it wrong is the classic outage:

- **BACKWARD:** upgrade **consumers first**. Old consumers aren't guaranteed to read new data.
- **FORWARD:** upgrade **producers first**, and make sure consumers won't meet old data they can't handle.
- **FULL:** upgrade in any order.

## Try it: a compatibility check
This needs a running Schema Registry (by default on port 8081), which is a separate download from Kafka. With one running, the REST calls from Confluent's documentation are:

1. Set BACKWARD on a subject:

```
curl -X PUT -H "Content-Type: application/vnd.schemaregistry.v1+json" --data "{\"compatibility\": \"BACKWARD\"}" http://localhost:8081/config/orders-value
```

2. Register version 1 of an order schema (`order_id`, `status`), then test a version 2 that adds `currency` **with** a default:

```
curl -X POST -H "Content-Type: application/vnd.schemaregistry.v1+json" --data @order-v2.json "http://localhost:8081/compatibility/subjects/orders-value/versions/latest?verbose=true"
```

**What you should see:** `{"is_compatible":true}`. Now remove the default from `currency` and test again: `false`, and with `?verbose=true` the reason, because a new consumer reading old records would have no value for `currency`.

If you don't run a registry, do the same exercise on paper with the Avro resolution rules above: it's exactly the reasoning the registry automates.

## What the docs don't say: a registry doesn't stop a bad producer
**Practical implication:** the registry checks schemas when they are **registered**, not every record a producer writes.

**Why it matters:** a producer that isn't using the registry's serializer (a script, a misconfigured service, the console producer) can still write anything to the topic, and the consumer's deserializer will fail on it as a poison pill (chapter 14).

**What to do:** restrict who can write to shared topics with ACLs (chapter 19), let only registry-aware serializers write, turn off automatic schema registration in production producers so schema changes go through review, and keep a dead-letter path for the records that slip through.

**Verify further:** [Schema evolution and compatibility](https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html).

## Interview takeaway
"Kafka only sees bytes, so the format is a contract between teams. For shared topics I use Avro or Protobuf with a schema registry: records carry a schema ID, and the registry rejects incompatible changes. BACKWARD is the default, which means adding fields with defaults is safe and consumers upgrade first; I'd use BACKWARD_TRANSITIVE if consumers replay old data, and the docs recommend it for Protobuf. Protobuf identifies fields by number, so deleted numbers are reserved and never reused. Parquet isn't a Kafka message format; it's where the data lands in the lake, written in batches by a sink."
