---
id: failures
title: Poison pills, retries and dead-letter topics
summary: Kafka keeps delivering the same bad record until your code decides what to do; timeouts, bounded retries, backoff, circuit breakers and dead-letter topics are those decisions.
sources: §1, §2, §6, §14, §15, §20, §22, §23
---
## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 24 — Poison Pill Messages & DLQ** (Full)
  - *Relevant sections:* The poison pill; What Kafka gives you, by API; A dead-letter path in a plain consumer; A dead-letter topic design
  - *Learning evidence:* Design a dead-letter topic for an order consumer: what goes to it, what is recorded with each record, who watches it, and how a fixed record is replayed.
- **Topic 25 — Resilience Patterns** (Full)
  - *Relevant sections:* Two kinds of failure; The chain: timeout, retry, backoff, jitter, circuit breaker; Retry topics; Failure scenario: the retry storm
  - *Learning evidence:* Design a payment consumer that keeps working, or degrades gracefully, when the payment API is slow or down for an hour.

## Two kinds of failure
A consumer's processing fails for one of two reasons, and they need opposite handling.

- **The record is bad** (a **poison pill**): it can't be deserialized, it fails validation, it breaks a business rule. Retrying it will fail forever. It must be moved out of the way.
- **Something else is broken** (a **transient** failure): the database is down, the API times out, a network blip. The record is fine. Retrying later will probably work. Moving it to a dead-letter topic would be wrong, because it would discard good data during an outage.

Telling them apart is the first design decision. Validation and parse errors are poison; timeouts, 5xx errors and connection failures are transient; a `4xx` from an API usually means the request itself is wrong and won't succeed on retry.

## The poison pill
Kafka never skips a record for you. If your code throws on offset 1,000 and doesn't commit, the next poll (or the next owner after a rebalance) gets offset 1,000 again. The partition is **stuck**: lag grows on that one partition, the others carry on. That is the signature of a poison pill.

The textbook example is the one you met: a topic holding old plain-text test lines and new JSON events, read by a JSON deserializer. Every plain-text line is a poison pill for that consumer.

## What Kafka gives you, by API
Each of Kafka's APIs treats a record it can't handle differently, and only some have a dead-letter topic built in.

| Where | When a record can't be handled | Dead-letter support |
|---|---|---|
| Plain consumer (Java) | poll throws RecordDeserializationException with the partition and offset | None built in: your code writes it to a dead-letter topic and seeks past it |
| Kafka Streams | deserialization.exception.handler, default LogAndFailExceptionHandler (stop) | errors.dead.letter.queue.topic.name sends failed records to a topic through the default handlers |
| Kafka Connect | errors.tolerance=none by default: the connector fails fast | errors.tolerance=all with errors.deadletterqueue.topic.name, for sink connectors, with context headers |
| Share groups (4.2+) | Delivery attempts are counted; share.delivery.count.limit defaults to 5 | A consumer can reject a record so it is never delivered again |

## A dead-letter path in a plain consumer
The plain consumer has no dead-letter support, so you build the path yourself. In Python (kafka-python), wrap the parse and the processing:

```
for message in consumer:
    try:
        event = json.loads(message.value)
        process(event)
    except (ValueError, ValidationError) as err:      # poison: never retry
        dlq_producer.send("orders.order.lifecycle.dlq", key=message.key, value=message.value,
                          headers=[("error", str(err).encode()), ("source-offset", str(message.offset).encode())])
    consumer.commit()
```

## A dead-letter topic design
A dead-letter topic (DLT, or DLQ) is an ordinary topic that holds records the consumer gave up on, so the main flow keeps moving and nothing is lost.

What a good design specifies:

- **What goes there:** only records that can never succeed as they are (poison), plus transient failures that exhausted their retry budget.
- **What travels with each record:** the original key and value bytes, unchanged, plus headers with the source topic, partition and offset, the error, the time, and the consumer group. Without these nobody can debug or replay it.
- **Who watches it:** an alert when anything arrives, and an owner who triages. A dead-letter topic nobody reads is a silent data-loss mechanism.
- **How records come back:** after a fix (code or data), a replay tool re-produces them to the main topic, or to a retry topic, keyed as before.
- **Retention:** long enough to cover a weekend and a slow investigation.
- **Ordering caveat:** sending one record of a key aside and carrying on means later records for that key are processed without it. If per-key order matters (a ledger), you may have to park the whole key, or stop the partition and page someone, rather than skip.

## The chain: timeout, retry, backoff, jitter, circuit breaker
Your reliability notes give the order these patterns stack in. Each one exists because of the one before it:

1. **Timeout:** never wait forever. A call with no timeout ties up a thread; enough of them and the whole consumer stalls. Derive timeouts from the latency budget (p99, not the average), and keep each layer's timeout inside its caller's.
2. **Retry:** transient failures often succeed the second time. Retry only those, and **bound** the retries.
3. **Exponential backoff:** retrying immediately hammers a struggling service. Wait longer each time (1 s, 2 s, 4 s, 8 s…), with a cap.
4. **Jitter:** if every client backs off by the same schedule, they all retry at the same moment. Add randomness to spread them out.
5. **Circuit breaker:** when a dependency is clearly down, stop calling it for a while (open), try one call after a pause (half-open), and resume when it works (closed). It saves the dependency from your retries and your threads from waiting.

Kafka's own clients already do some of this for **their** calls: the producer retries transient errors within `delivery.timeout.ms`, with exponential backoff from `retry.backoff.ms` to `retry.backoff.max.ms` and **±20% jitter**. Your **business** calls inside the consumer (a database, a payment API) need the same treatment from your code.

## Retry topics
![Failure handling for a payment consumer: poison records go straight to a dead-letter topic; transient failures pass through 1-minute, 10-minute and 1-hour retry topics before the dead-letter topic; a circuit breaker stops calls while the payment API is down](/assets/content/packs/kafka/kafka-retry-dlq.svg)

Retrying inside the poll loop has a limit: you must call `poll` again within `max.poll.interval.ms` (5 minutes by default), and while you retry one record, the rest of the partition waits.

**Retry topics** move waiting out of the loop. A record that fails with a transient error is written to a delay topic, and the main consumer moves on:

```
orders  ->  orders.retry.1m  ->  orders.retry.10m  ->  orders.retry.1h  ->  orders.dlq
```

A consumer for each retry topic waits until the record's delay has passed (pausing, not busy-looping) and tries again, sending it on to the next level on failure. This is a **pattern you build**; Kafka has no delayed-delivery feature. Its costs: more topics and consumers, and **per-key order is lost** for anything that goes through a retry topic, because later records overtake it.

Combine it with a circuit breaker: when the payment API's breaker is open, the payment consumer doesn't even try. It parks records in the retry path (or pauses consumption) until the breaker half-opens.

## Failure scenario: the retry storm
**What happens:** the payment API slows down. Calls time out. Every layer retries: the API gateway, the order service, the consumer, the database client. If each of four layers makes 3 attempts, one original request can become 3 × 3 × 3 × 3 = **81** calls at the bottom. The slow service gets a multiplied load exactly when it is weakest; it collapses; lag explodes on every partition; the database connection pool runs dry; it cascades.

**What stops it:**

- **One layer owns retries**; the others fail fast.
- **Retry budgets:** cap retries as a share of traffic, not just per request.
- **Backoff with jitter** everywhere a retry exists.
- **Circuit breakers** around every external dependency.
- **Idempotency keys**, so the retries that do happen can't double-charge.
- **Back-pressure and load shedding:** Kafka absorbs a burst, but only for as long as retention and disk allow. When lag keeps climbing, slow producers or shed low-priority work, rather than hoping.

## What the docs don't say: Kafka buys time, not infinite capacity
**Practical implication:** "Kafka will buffer it" is true only within retention and disk limits.

**Why it matters:** during an outage producers keep writing while consumers can't process. Lag grows until either the outage ends, or `retention.ms` deletes records the consumers never read. A consumer whose committed offset has been deleted resets according to `auto.offset.reset`, and `latest` skips the gap without an error.

**What to do:** know your topic's catch-up budget (retention minus the longest outage you plan for), alert on lag age, not just lag count, and set `auto.offset.reset` deliberately on critical consumers.

**Verify further:** [Consumer configs: auto.offset.reset](https://kafka.apache.org/43/configuration/consumer-configs/).

## Interview takeaway
"First I separate poison records from transient failures. Poison goes straight to a dead-letter topic with its original bytes and the source topic, partition, offset and error in headers, and someone owns and replays that topic. Transient failures get bounded retries with exponential backoff and jitter, behind a circuit breaker, and if they need to wait longer than a poll interval they go through retry topics. One layer owns retries, so a slow dependency doesn't become an 81-fold retry storm. Kafka absorbs the burst, but only within retention, so I watch lag and degrade gracefully rather than letting it run out."
