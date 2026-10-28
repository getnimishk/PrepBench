---
id: first-cluster
title: Your first cluster, hands-on
summary: Format, start and use a single-node KRaft cluster on Windows, and recognise the errors you will meet on the way.
sources: §2, §9, §12, §21
---
## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 6 — Local Install & First Cluster** (Full)
  - *Relevant sections:* The four steps; Produce and consume end to end; Errors you have already met; A consumer group you can watch
  - *Learning evidence:* Stand up a single-node KRaft cluster from scratch and pass keyed messages end to end with the console tools, then show the group's lag with `kafka-consumer-groups --describe`.

## The four steps
A KRaft cluster needs four things, in this order. These are the steps you already ran; this chapter explains each one.

1. **Make a cluster ID.** `kafka-storage random-uuid` prints a random ID. Every server in one cluster is formatted with the same ID.

```
kafka-storage.bat random-uuid
```

2. **Format the storage.** Formatting writes the cluster ID and the initial metadata into the folder named by `log.dirs`. Your first server is the only controller, so it is formatted `--standalone`: it becomes the single voter of the metadata quorum.

```
kafka-storage.bat format --standalone -t <your-cluster-id> -c E:\workspace\Kafka_Learning\kafka\config\server.properties
```

3. **Start the server** in its own terminal, and leave it running:

```
kafka-server-start.bat E:\workspace\Kafka_Learning\kafka\config\server.properties
```

4. **Create a topic** (from another terminal) rather than relying on automatic creation:

```
kafka-topics.bat --bootstrap-server localhost:9092 --create --topic orders --partitions 3 --replication-factor 1
```

The shipped `config\server.properties` makes one combined server: `node.id=1`, client listener `PLAINTEXT://:9092`, controller listener `CONTROLLER://:9093`, and the internal topics (consumer offsets, transactions, share groups) at replication factor 1, because there is only one broker to hold them.

## Produce and consume end to end
Keep three terminals: the server, a producer, a consumer.

```
kafka-console-producer.bat --bootstrap-server localhost:9092 --topic orders --reader-property parse.key=true --reader-property key.separator=:
```

```
kafka-console-consumer.bat --bootstrap-server localhost:9092 --topic orders --group order-readers --from-beginning --formatter-property print.key=true --formatter-property print.partition=true --formatter-property print.offset=true
```

Type `101:CREATED`, `101:PAYMENT_COMPLETED`, `102:CREATED`, `101:SHIPPED` in the producer. The consumer prints each with its partition and offset; every `101` line shows the same partition.

Now stop the consumer with Ctrl+C, type two more lines in the producer, and start the same consumer command again. Because it uses `--group order-readers`, it resumes after the last committed position and prints only the two new lines. `--from-beginning` did nothing the second time: it applies only when the group has no committed offset yet.

## A consumer group you can watch
With the consumer stopped, describe the group:

```
kafka-consumer-groups.bat --bootstrap-server localhost:9092 --describe --group order-readers
```

**What you should see:** one row per partition with `CURRENT-OFFSET` (the group's committed position), `LOG-END-OFFSET` (the next offset the partition will assign) and `LAG` (the difference). Produce a few more lines while the consumer is stopped and run it again: the lag grows on the partitions those keys went to. Start the consumer and the lag returns to 0. This is the number operators watch most (chapter 9).

The tool also lists all groups: `kafka-consumer-groups.bat --bootstrap-server localhost:9092 --list`. The random `console-consumer-…` groups you see there come from consumer runs without `--group`.

## Errors you have already met
Each of these came up in your own setup. They are worth knowing because they are typical, not because they are rare.

| What you saw | Why | The fix |
|---|---|---|
| NoSuchFileException for config\kraft\server.properties | Since Kafka 4.0 the KRaft configuration files live in config, not config\kraft | Point -c at config\server.properties |
| Format refused: controller.quorum.voters unset, use --standalone, --initial-controllers or --no-initial-controllers | The shipped config uses a dynamic quorum, so format must be told how the voters start | First controller: --standalone. A broker joining later: --no-initial-controllers |
| A Log4j 1.x deprecation warning | A KAFKA_LOG4J_OPTS environment variable pointed at an old Log4j file, and the launcher keeps any value already set | Remove the variable, or point it at a Log4j2 file |
| No key separator found | The producer was given parse.separator, which is not an option | Use key.separator |
| JSONDecodeError in the Python consumer | The topic held earlier plain-text test lines as well as JSON events | Use a clean topic per data format, or handle old records explicitly (chapter 16) |
| A restarted consumer re-read everything, or nothing | Without --group a new random group starts each time; with a group it resumes | Name the group when you want to resume |

## What the docs don't say: one node can't show you failure
**Practical implication:** everything in this chapter works on one node, and that is exactly why it teaches nothing about failure.

**Why it matters:** with replication factor 1 there are no followers, so there is no in-sync replica set to shrink, no leader election and no `min.insync.replicas` to refuse a write. With one controller, losing it stops the cluster.

**What to do:** in chapter 12 you add two broker-only nodes to this same cluster, on other ports, and stop one of them while producing. Until then, treat this setup as a learning tool, not a model of production.

**Verify further:** [Basic Kafka operations](https://kafka.apache.org/43/operations/basic-kafka-operations/).

## Interview takeaway
"Standing up KRaft is: generate a cluster ID, format each node's storage with it (standalone for the first controller), start the nodes, and create topics explicitly. Then I'd prove the path end to end with keyed records and a named consumer group, and check `kafka-consumer-groups --describe` for current offset, log-end offset and lag. A one-node cluster is fine for learning, but I'd never use it to reason about durability."
