---
id: security
title: Security: authentication, authorization, encryption and audit
summary: Kafka ships with security off; listeners decide how clients connect, SASL or mTLS proves who they are, ACLs decide what they may do, TLS hides the traffic, and the authorizer log records refusals.
sources: §4, §9, §14, §16, §21, §23
---
## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 36 — Authentication (SASL/mTLS)** (Full)
  - *Relevant sections:* Security is off by default; Listeners: one port per kind of traffic; Authentication: who is this?; Try it on your cluster
  - *Learning evidence:* Configure a listener that requires SCRAM authentication, and show a client with the wrong password being refused.
- **Topic 37 — Authorization (ACLs)** (Full)
  - *Relevant sections:* Authorization: what may they do?; ACLs in practice; Try it on your cluster
  - *Learning evidence:* Write the ACLs that let one client produce to a single topic and another consume it in one consumer group, and nothing else.
- **Topic 38 — Encryption in Transit** (Full)
  - *Relevant sections:* Encryption in transit: TLS
  - *Learning evidence:* Explain how to enable TLS on a broker listener, what hostname verification protects against, and why "requested" client authentication is discouraged.
- **Topic 39 — Audit & Compliance Logging** (Full)
  - *Relevant sections:* Audit: what Kafka records, and what it doesn't
  - *Learning evidence:* Define an audit-logging policy for topic access in a regulated environment, stating what Kafka's authorizer log captures by default and what must be added.

## Security is off by default
A fresh Kafka cluster, like yours, accepts any connection on a `PLAINTEXT` listener, from anyone who can reach the port, with no password and no encryption, and lets them do anything. The documentation says security is **optional**: unsecured clusters are supported, as is a mix of authenticated and unauthenticated, encrypted and unencrypted clients.

Kafka's security has four parts, and a production cluster needs all four:

1. **Authentication:** proving who a client (or broker) is, with SSL/TLS client certificates (**mTLS**) or **SASL**.
2. **Authorization:** deciding what an authenticated principal may do, with **ACLs**.
3. **Encryption in transit:** TLS on the connections, so traffic can't be read or altered.
4. **Audit:** a record of access decisions.

## Listeners: one port per kind of traffic
A broker can listen on several ports, each with its own security. In `listeners`, each entry is `{LISTENER_NAME}://{host}:{port}`; `listener.security.protocol.map` gives each listener one of four protocols:

Separate listeners let you treat traffic differently: for example `CLIENT` on SASL_SSL for applications, `BROKER` for brokers replicating to each other, `CONTROLLER` for the KRaft quorum. Your cluster already has two: `PLAINTEXT` on 9092 and `CONTROLLER` on 9093.

| Protocol | Authentication | Encryption |
|---|---|---|
| PLAINTEXT | None | None |
| SSL | Optional client certificate (mTLS) | TLS |
| SASL_PLAINTEXT | SASL | None |
| SASL_SSL | SASL | TLS |

## Authentication: who is this?
**mTLS:** with an `SSL` listener and `ssl.client.auth=required`, every client must present a certificate signed by a CA the broker trusts; the certificate's distinguished name becomes the principal. The option `requested` lets clients without certificates connect anyway, and the documentation discourages it for exactly that reason: it gives a false sense of security.

**SASL mechanisms** Kafka supports:

SCRAM credentials are created with `kafka-configs --alter --add-config 'SCRAM-SHA-256=[password=…]' --entity-type users --entity-name <user>` (or at format time with `kafka-storage format --add-scram`), and stored, salted and hashed, in the metadata log. Kafka requires at least **4096** iterations.

| Mechanism | What it is | Documentation's caution |
|---|---|---|
| GSSAPI | Kerberos | For organisations already running Kerberos |
| PLAIN | Username and password, checked by the broker or a plug-in | Use only with TLS, or passwords cross the network in clear text |
| SCRAM-SHA-256 and SCRAM-SHA-512 | Salted challenge-response: the password itself never crosses the network | Use only with TLS; credentials live in the KRaft metadata log, so the controllers must be secure |
| OAUTHBEARER | OAuth 2 tokens | Use only with TLS in production, and replace the default unsecured implementation |

## Authorization: what may they do?
In KRaft clusters the built-in authorizer is `org.apache.kafka.metadata.authorizer.StandardAuthorizer`, set with `authorizer.class.name`. Once it is on, the rules are:

- **Deny by default.** A principal with no ACL allowing an operation on a resource is refused.
- **A resource with no ACLs at all is open only to super users**, unless `allow.everyone.if.no.acl.found=true` (avoid it).
- **Super users** bypass ACLs: `super.users=User:admin;User:ops` (semicolon-separated).
- **Deny wins.** If any DENY ACL matches, the operation is refused, whatever ALLOW ACLs say. Deny ACLs exist for "everyone except this principal" rules.

An ACL says: **principal** P is **allowed or denied** **operation** O on **resource** R, **from host** H. Resources include topics, consumer groups, transactional IDs and the cluster. Operations include Read, Write, Create, Delete, Alter, Describe and others.

## ACLs in practice
`kafka-acls` has two shortcuts that cover most applications:

- `--producer` grants **WRITE, DESCRIBE and CREATE** on the topic.
- `--consumer` grants **READ and DESCRIBE** on the topic, and **READ on the consumer group** (which you must name).

```
kafka-acls.bat --bootstrap-server localhost:9092 --add --allow-principal User:orders-svc --producer --topic orders.order.lifecycle
kafka-acls.bat --bootstrap-server localhost:9092 --add --allow-principal User:billing-svc --consumer --topic orders.order.lifecycle --group billing
```

**Prefixed** ACLs pair with a naming convention (chapter 5): one rule covers every topic a team will ever create.

```
kafka-acls.bat --bootstrap-server localhost:9092 --add --allow-principal User:orders-svc --producer --topic orders. --resource-pattern-type prefixed
```

## Encryption in transit: TLS
TLS on a listener (`SSL` or `SASL_SSL`) encrypts the traffic between clients and brokers, and between brokers. The documentation notes a **performance cost**, which depends on the CPU and the JVM.

Setting it up means a keystore on each broker with its certificate, a truststore with the CA, and the client side configured to trust the CA. The documentation's strongest advice is about **hostname verification**: it is on by default (`ssl.endpoint.identification.algorithm`), it checks that the broker's certificate matches the name the client connected to, which stops a man-in-the-middle, and disabling it to "just get it to work" is the mistake to avoid. Put the broker's hostnames in the certificate's **Subject Alternative Name** field, which the documentation prefers to the deprecated common-name check.

Two more things to protect: the **controller listener** (it carries the metadata, including SCRAM credentials), and the data **at rest**. Kafka's documented encryption covers data in transit, not data on disk; encrypting the disks is the platform's job.

## Audit: what Kafka records, and what it doesn't
Kafka's shipped logging configuration sends the authorizer's decisions (logger `kafka.authorizer.logger`) to its own file, **kafka-authorizer.log**, at level INFO. The 4.3 authorizer logs:

- **Denied** requests at **INFO**: so by default, **refusals are recorded**.
- **Allowed** requests only at **DEBUG**: so by default, **successful access is not recorded**.

For a regulated environment that needs "who read this topic, and when", the default is not enough. A policy should cover:

- **What to capture:** denied access always; allowed access to sensitive topics (raise the authorizer logger to DEBUG, accepting a large log volume); ACL changes; SCRAM credential changes; topic creation and deletion.
- **Who:** principals that map to real people or named services, never shared accounts.
- **Where:** shipped off the broker to a central, append-only store, so a broker administrator can't edit it.
- **How long:** the retention your regulator requires.
- **Review:** alerts on denied spikes and on any ACL change outside a change window.

## Try it on your cluster
A learning setup only, on your single node: SCRAM on a new listener, ACLs on. The `PLAINTEXT` listener stays open for you as a super user so you can't lock yourself out, which is **never acceptable in production**.

1. While your broker is running as it is now, create SCRAM credentials for two users:

```
kafka-configs.bat --bootstrap-server localhost:9092 --alter --add-config "SCRAM-SHA-256=[password=alice-secret]" --entity-type users --entity-name alice
kafka-configs.bat --bootstrap-server localhost:9092 --alter --add-config "SCRAM-SHA-256=[password=bob-secret]" --entity-type users --entity-name bob
```

2. Stop the broker. In `config\server.properties`, add a `SASL_PLAINTEXT` listener on port 9096 and turn the authorizer on. Change or add these lines:

```
listeners=PLAINTEXT://:9092,CONTROLLER://:9093,SASL_PLAINTEXT://:9096
advertised.listeners=PLAINTEXT://localhost:9092,CONTROLLER://localhost:9093,SASL_PLAINTEXT://localhost:9096
sasl.enabled.mechanisms=SCRAM-SHA-256
authorizer.class.name=org.apache.kafka.metadata.authorizer.StandardAuthorizer
super.users=User:ANONYMOUS
```

`ANONYMOUS` is the principal of unauthenticated connections, which covers your PLAINTEXT and CONTROLLER listeners. Making it a super user keeps the cluster working for this exercise only.

3. Create a broker JAAS file, as the documentation shows, at `config\kafka_server_jaas.conf`:

```
KafkaServer {
  org.apache.kafka.common.security.scram.ScramLoginModule required
  username="admin"
  password="admin-secret";
};
```

4. Start the broker with the JAAS file passed to the JVM:

```
set KAFKA_OPTS=-Djava.security.auth.login.config=E:/workspace/Kafka_Learning/kafka/config/kafka_server_jaas.conf
kafka-server-start.bat E:\workspace\Kafka_Learning\kafka\config\server.properties
```

5. Create `alice.properties` for the client:

```
security.protocol=SASL_PLAINTEXT
sasl.mechanism=SCRAM-SHA-256
sasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required username="alice" password="alice-secret";
```

6. Try to produce as alice, before any ACL exists:

```
kafka-console-producer.bat --bootstrap-server localhost:9096 --topic orders --command-config alice.properties
```

**What you should see:** an authorization error for the topic. Open `logs\kafka-authorizer.log` in your Kafka folder: the denial is recorded with `User:alice`.

7. Grant alice producer rights on that one topic, and produce again: it works.

```
kafka-acls.bat --bootstrap-server localhost:9092 --add --allow-principal User:alice --producer --topic orders
```

8. Change the password in a copy of `alice.properties` and try again: the connection itself is refused (authentication failed), before ACLs are even checked.

9. Undo it afterwards: remove the three security lines and the extra listener, clear `KAFKA_OPTS`, and restart.

## What the docs don't say: authentication without TLS is half a control
**Practical implication:** SASL on a plaintext listener proves who connected, but everything after the handshake (every record, every ACL decision's subject) crosses the network readable.

**Why it matters:** the documentation tells you to use PLAIN, SCRAM and OAUTHBEARER only with TLS. SCRAM keeps the password itself off the wire, but not the data, and PLAIN without TLS sends the password in clear text.

**What to do:** in production, client listeners are `SASL_SSL` or `SSL`, never `SASL_PLAINTEXT`; the inter-broker and controller listeners are secured too; and nothing runs with `super.users=User:ANONYMOUS`.

**Verify further:** [Security overview](https://kafka.apache.org/43/security/security-overview/).

## Interview takeaway
"Kafka security is off by default, so I'd secure all four layers. Authentication with mTLS or SASL, preferring SCRAM or OAuth, always over TLS. Authorization with the StandardAuthorizer, which denies by default; deny ACLs win, and prefixed ACLs follow the topic naming convention, so each team owns its namespace. TLS with hostname verification on every listener, controller included. Audit: by default the authorizer log records only denials, so for regulated data I'd turn on allowed-access logging for sensitive topics and ship it off-broker to append-only storage, alongside ACL and credential changes."
