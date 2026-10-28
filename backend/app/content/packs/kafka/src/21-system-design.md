---
id: system-design
title: Designing with Kafka
summary: Put Kafka where decoupling, buffering and replay pay for themselves, size it from measured numbers, and explain each decision as a trade-off.
sources: §1, §3, §7, §10, §12, §13, §19, §23
---
## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 43 — Event-Driven Architecture Design** (Full)
  - *Relevant sections:* Where Kafka belongs, and where it doesn't; An order platform, end to end; Ch 14 (Poison pills, retries and dead-letter topics)
  - *Learning evidence:* Design an event-driven order platform (order, payment, inventory, notification services), naming topics, keys, consumer groups, delivery semantics and failure handling.
- **Topic 44 — Capacity Planning** (Full)
  - *Relevant sections:* Capacity planning, worked through; Ch 10 (Partition keys, sizing and hot partitions); Ch 13 (Retention, compaction and tiered storage)
  - *Learning evidence:* Produce a capacity plan (partitions, storage, brokers) from a given message rate, size, retention and replication factor, with the assumptions stated.
- **Topic 45 — Mock System Design Practice** (Full)
  - *Relevant sections:* A 45-minute mock, step by step; Questions you should expect
  - *Learning evidence:* Complete a 45-minute mock system-design session end to end, out loud, recorded, and review it against the checklist.

## Where Kafka belongs, and where it doesn't
Kafka is not a system design; it is a **durable, replayable transport and buffer** inside one. It earns its place when you need:

- **Decoupling:** a producer publishes once; any number of services react, without the producer knowing or waiting for them.
- **Buffering:** a burst of traffic, or a slow consumer, is absorbed in the log instead of overloading the next service.
- **Replay:** a new service, or a fixed one, reads history from the log.
- **Ordering per entity at high volume**, through keys and partitions.
- **Integration:** streams from databases (change data capture through Connect) into many systems.

It is the wrong tool for a request that needs an immediate answer (a synchronous call fits), a tiny job queue where a simple queue would do, or point-to-point messaging with per-message acknowledgement and routing. Share groups (chapter 7) narrow that last gap, but don't erase it.

## An order platform, end to end
Your traffic-failure notes worked through this design. Here it is, with the Kafka decisions made explicit.

```
Client -> API gateway (timeouts, rate limits) -> Order service
Order service: writes the order to its database, then publishes OrderPlaced
    topic orders.order.lifecycle   key OrderId   RF 3, min ISR 2, acks=all, idempotent producer
Consumer groups, each independent:
    payment     -> payment API (timeout, circuit breaker, idempotency key = OrderId)
                   failures -> orders.payment.retry.5m -> .retry.30m -> orders.payment.dlq
    inventory   -> reserves stock, publishes StockReserved / StockFailed
    notification-> sends email (at-least-once, deduplicated by event id)
    analytics   -> sink to the lake as Parquet (Kafka Connect)
```

The decisions, and the reasons to say out loud:

- **Key by OrderId:** each order's events stay in sequence; orders spread evenly. CustomerId would risk hot keys for big customers.
- **One topic for the order lifecycle**, so CREATED, PAID and SHIPPED for an order are in one partition, in order.
- **acks=all, min ISR 2, replication factor 3:** an acknowledged order survives a broker failure.
- **At-least-once everywhere, with idempotent effects:** the payment API gets an idempotency key; notifications dedupe by event id. Kafka transactions wouldn't make an email or a card charge exactly-once (chapter 8).
- **Retry topics and a dead-letter topic for payment**, plus a circuit breaker, so a payment-provider outage doesn't stall the partition or turn into a retry storm (chapter 14).
- **Back-pressure:** the gateway rate-limits; consumer lag is the alarm; retention is set longer than the longest outage you plan to absorb.

One problem to name: the order service **writes its database and publishes an event** as two separate steps. If it crashes between them, they disagree. The usual answers are to publish from the database's change log (change data capture with a Connect source connector), or to write the event to an "outbox" table in the same database transaction and publish it from there. Kafka transactions don't cover a database write.

## Capacity planning, worked through
State assumptions, show the arithmetic, add headroom, and say what you'd measure. Illustrative inputs:

- Peak **20,000 messages/s**, average message **1 KB** (after compression), so about **20 MB/s** in.
- Daily volume at an average of 8,000 messages/s: about **0.69 TB/day**.
- Retention **7 days**, replication factor **3**.
- Measured on your hardware: one partition sustains **5 MB/s** produce and the slowest consumer handles **2,000 messages/s** per instance.

**Partitions.** Throughput: 20 MB/s ÷ 5 MB/s = 4. Consumer parallelism: 20,000 ÷ 2,000 = **10** instances at peak, so at least 10 partitions. Take the larger (10), add 2× headroom: **about 20 partitions**, chosen up front because adding them later moves keys.

**Storage.** 0.69 TB/day × 7 days = 4.8 TB of data; × 3 replicas = **14.5 TB** on disk across the cluster. Then plan headroom for growth and for re-copying a failed broker's data; keeping disks around half full, a common planning choice rather than a Kafka rule, means about **29 TB** of raw disk.

**Brokers.** Divide storage and throughput by what one broker can carry (its disk, its network, its partition count), keep at least 3 brokers for replication factor 3, and make sure the cluster can lose one broker and still hold the load: N+1.

**Network.** Every MB/s produced is written once by the leader, copied twice to followers, and read once per consumer group. With 4 consumer groups at peak: 20 MB/s in, 40 MB/s replication, 80 MB/s out. Network often runs out before disk does.

**What you'd measure before committing:** per-partition throughput with real records, consumer processing rate, compression ratio, and recovery time after a broker loss. Tiered storage (chapter 13) can cut the local disk figure if long retention is the driver.

## A 45-minute mock, step by step

Practise it out loud and record yourself. PrepBench's interview studio can record and review the take.

| Minutes | Do | Say |
|---|---|---|
| 0 to 5 | Clarify the problem | Who produces, who consumes, volumes and peaks, latency and durability needs, what must be ordered |
| 5 to 10 | Rough numbers | Messages per second, bytes per second, retention, storage, out loud |
| 10 to 20 | The high-level design | Services, topics, keys, consumer groups, and why Kafka at all |
| 20 to 30 | Kafka decisions | Partitions, replication and min ISR, acks, idempotence, delivery semantics per flow |
| 30 to 40 | Failure | Broker loss, consumer crash before commit, poison record, slow dependency, region loss |
| 40 to 45 | Trade-offs and monitoring | What you'd watch (lag, under-min-ISR), what you'd change at 10× scale |

## Questions you should expect
- Why Kafka here, and not a queue or a direct call?
- What is your partition key, and what happens if one customer sends 90% of the traffic?
- How many partitions, and how did you get that number?
- What happens if a consumer crashes after processing but before committing?
- How do you avoid charging a customer twice?
- A broker dies. Walk me through what happens to writes and reads.
- The payment provider is down for an hour. What does your system do?
- How would you know the system is falling behind, before customers notice?
- How would you survive losing the region?

## What the docs don't say: the hard part of the design is outside Kafka
**Practical implication:** most of what goes wrong in a Kafka-based system happens at its edges: the database write and the publish, the external API call, the duplicate email.

**Why it matters:** Kafka's guarantees (ordering per partition, committed data surviving broker loss, exactly-once between Kafka topics) stop at the producer's `send` and the consumer's `poll`. What a service does around them is the design.

**What to do:** in every design, name the boundary crossings (database to Kafka, Kafka to API) and say how each stays correct under a crash and a retry: outbox or change data capture on the way in, idempotent effects on the way out.

**Verify further:** [Design: message delivery semantics](https://kafka.apache.org/43/design/design/).

## Interview takeaway
"I use Kafka where decoupling, buffering and replay are worth it: key by the entity that needs ordering, size partitions from measured per-partition throughput and needed consumer parallelism with headroom, and run replication factor 3, min ISR 2, acks=all with idempotent producers. Each consumer group gets its own semantics. Mostly that's at-least-once with idempotent effects, with retries behind circuit breakers and a dead-letter topic for poison records. I'm explicit about the boundaries Kafka doesn't cover, such as the database write plus publish, and solve them with an outbox or CDC. And I size storage as volume times retention times replication, with room to lose a broker."
