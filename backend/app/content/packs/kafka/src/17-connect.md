---
id: connect
title: Kafka Connect
summary: Connect moves data between Kafka and other systems with configuration instead of code: source connectors in, sink connectors out, workers that share the tasks.
sources: §8, §14, §17, §19, §23
---
## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 32 — Kafka Connect** (Full)
  - *Relevant sections:* What Connect is for; Connectors, tasks, workers; Standalone and distributed; Transforms and converters; When records fail; Try it on your cluster
  - *Learning evidence:* Run a source and a sink connector end to end, check their status through the REST API, and explain how the same pipeline would run in distributed mode.

## What Connect is for
Most data you want in Kafka lives somewhere else: databases, files, object stores, SaaS systems. Most data you put in Kafka must end up somewhere else: a warehouse, a lake, a search index. **Kafka Connect** is Apache Kafka's framework for those two jobs:

- A **source connector** imports data **into** Kafka topics (a database's changes, a file's lines).
- A **sink connector** exports data **from** Kafka topics (to a lake as Parquet, to a search index, to a database).

The point is that you **configure** a connector instead of writing a producer or consumer. Connect handles the parts that are easy to get wrong: tracking offsets, retries, scaling, and restarting failed work. Connectors themselves come from the community and vendors; Apache Kafka ships the framework and a simple file connector for learning.

## Connectors, tasks, workers
- A **connector** is a configured job: "copy table X into topic Y".
- It splits its work into **tasks**, which do the actual copying. `tasks.max` sets the **maximum**; a connector may create fewer if the work can't be split further (one file is one task).
- **Workers** are the JVM processes that run tasks.

## Standalone and distributed

Both modes expose a **REST API**, by default on port **8083**: `GET /connectors` lists connectors, `POST /connectors` creates one, `GET /connectors/{name}/status` shows whether it and each task are running or failed (with the error), and `PUT /connectors/{name}/pause` and `/resume` stop and restart processing.

Distributed mode's state topics show why chapter 13 matters: they are **compacted**, because Connect needs the latest value per key (each connector's configuration, each source partition's offset), not their history.

| Aspect | Standalone | Distributed |
|---|---|---|
| Processes | One worker | A group of workers, joined like a consumer group |
| Where state lives | A local offsets file | Three Kafka topics: config (one partition, compacted), offsets (many partitions, compacted), status (compacted) |
| How connectors are created | Properties or JSON files on the command line | The REST API only |
| Fault tolerance | None: if the process dies, the work stops | Tasks move to surviving workers; configuration and offsets survive in Kafka |
| Good for | Development, tests, one-worker jobs such as collecting a log file | Production |

## Transforms and converters
**Converters** translate between Kafka's bytes and Connect's internal records: JSON with or without an embedded schema, or, with a schema registry, Avro, Protobuf and JSON Schema. The converter is where your format decision from chapter 16 is applied.

**Single message transforms (SMTs)** make light, one-record-at-a-time changes inside the connector, chained with the `transforms` setting. Built-in ones include `InsertField` (add a field, such as the source topic or a timestamp), `MaskField` (blank out a sensitive field), `ExtractField`, `Cast`, `Flatten`, `Filter`, `HoistField`, `InsertHeader` and `DropHeaders`. Anything beyond a light change belongs in a stream processor (chapter 18), not in an SMT chain.

## When records fail
By default a connector **fails fast**: one record that can't be converted or transformed stops the task (`errors.tolerance=none`, no retry, no error logging). For pipelines that must keep moving:

- `errors.tolerance=all` skips bad records instead of failing.
- `errors.log.enable=true` logs each failure with its topic, partition and offset.
- For **sink** connectors, `errors.deadletterqueue.topic.name` writes failed records to a dead-letter topic, and `errors.deadletterqueue.context.headers.enable=true` adds the error details as headers (chapter 14).
- `errors.retry.timeout` retries failures for a while before giving up.

**Exactly-once source connectors** are possible: every worker needs `exactly.once.source.support=enabled` (existing clusters need two rolling upgrades to switch it on), and the connector itself must support it.

## Try it on your cluster
This follows the Kafka quickstart, adapted to Windows. Run it from your Kafka folder, `E:\workspace\Kafka_Learning\kafka`.

1. Tell the worker where the file connector is. Find `connect-file-<your version>.jar` in `libs`, then add this line to `config\connect-standalone.properties`, with your jar's exact name:

```
plugin.path=libs/connect-file-4.3.x.jar
```

2. Create the input file the sample source connector reads:

```
echo foo > test.txt
echo bar >> test.txt
```

3. Start a standalone worker with the sample source and sink connectors. The source reads `test.txt` into topic `connect-test`; the sink writes that topic to `test.sink.txt`:

```
connect-standalone.bat config\connect-standalone.properties config\connect-file-source.properties config\connect-file-sink.properties
```

4. Check the result three ways: open `test.sink.txt` (it contains `foo` and `bar`); read the topic with the console consumer (`--topic connect-test --from-beginning`); and ask the REST API:

```
curl http://localhost:8083/connectors
curl http://localhost:8083/connectors/local-file-source/status
```

5. Add a line to `test.txt` (`echo baz >> test.txt`) and watch it appear in `test.sink.txt` a moment later: the pipeline is continuous.

6. Stop the worker and start it again. It does not re-copy `foo` and `bar`: the source connector's offset (how far into the file it got) was saved.

## What the docs don't say: connectors are the risky part, not Connect
**Practical implication:** the Connect framework is solid; most production incidents come from a particular connector's behaviour or configuration.

**Why it matters:** connectors are written by many different parties. Their delivery guarantees, how they handle schema changes, deletes and restarts, and how much load they put on the source system all differ, and Connect's own settings can't fix a connector that doesn't support, say, exactly-once.

**What to do:** for each connector, read its own documentation for delivery semantics, ordering and failure behaviour; test a restart and a bad record before production; watch `GET /connectors/{name}/status` and alert on a FAILED task, then restart it with `POST /connectors/{name}/restart?includeTasks=true&onlyFailed=true` once the cause is fixed; and pin connector versions like any other dependency.

**Verify further:** [Kafka Connect user guide](https://kafka.apache.org/43/kafka-connect/user-guide/).

## Interview takeaway
"Kafka Connect is how data gets into and out of Kafka without custom producers and consumers: source connectors import, sink connectors export, and tasks spread over workers. Distributed mode keeps configuration, offsets and status in compacted Kafka topics, so tasks fail over between workers and connectors are managed through the REST API. Converters apply the data format, single message transforms handle light per-record changes, and errors.tolerance plus a dead-letter topic keep a sink moving past bad records. I treat each connector as a dependency to test, because the guarantees are the connector's, not Connect's."
