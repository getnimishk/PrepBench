---
id: delta-log
title: Delta Lake internals - the transaction log
summary: Parquet data files plus a _delta_log of numbered commits; how readers rebuild a snapshot, how writers commit without locks, and what a table's protocol demands of every client.
sources: §2, §8, §19
---
## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 13 — Delta Lake = Parquet + Transaction Log** (Full)
  - *Relevant sections:* Parquet files plus a log
  - *Learning evidence:* Create a Delta table and use DESCRIBE DETAIL to show its location, file count and protocol, then explain what its _delta_log folder holds.
- **Topic 14 — Commit Files in _delta_log** (Full)
  - *Relevant sections:* Commits: one JSON file per version; Try it in Free Edition
  - *Learning evidence:* Make three writes, list them with DESCRIBE HISTORY, and name the version and JSON commit file each one created.
- **Topic 15 — Log Actions** (Full)
  - *Relevant sections:* What a commit records
  - *Learning evidence:* In a real commit file, identify every action and say what each changed in the table.
- **Topic 16 — Snapshots, Tombstones and Log Replay** (Full)
  - *Relevant sections:* Snapshots and tombstones
  - *Learning evidence:* Explain why an UPDATE leaves the old data file on storage and what eventually deletes it.
- **Topic 17 — Checkpoints and _last_checkpoint** (Full)
  - *Relevant sections:* Checkpoints: not replaying 10,000 commits
  - *Learning evidence:* Explain how a reader finds the latest snapshot of a table with 10,000 commits without listing every file.
- **Topic 18 — Optimistic Concurrency and Write Conflicts** (Full)
  - *Relevant sections:* Writing without locks: optimistic concurrency
  - *Learning evidence:* Describe step by step what happens when two jobs MERGE into the same table at the same time.
- **Topic 19 — Isolation Levels and Transaction Scope** (Full)
  - *Relevant sections:* Isolation and how far a transaction reaches
  - *Learning evidence:* Explain what a long-running report sees while another job overwrites the table it reads.
- **Topic 20 — Protocol Versions and Table Features** (Full)
  - *Relevant sections:* Protocol versions and table features
  - *Learning evidence:* Say what happens to an external reader when deletion vectors or liquid clustering are enabled on a table.
- **Topic 21 — Idempotent Writes with Transaction Identifiers** (Full)
  - *Relevant sections:* Idempotent writes: transaction identifiers
  - *Learning evidence:* Explain why a restarted stream doesn't write the same micro-batch twice into a Delta table.

## Parquet files plus a log
Delta Lake is "the optimized storage layer that provides the foundation for tables in a lakehouse on Databricks". It is open-source software that adds a **file-based transaction log** to **Parquet data files**, giving ACID transactions and scalable metadata. **Every table on Databricks is a Delta table unless you say otherwise.**

A Delta table's directory holds two things:

- **Data files:** ordinary Parquet files (chapter 2).
- **`_delta_log/`:** the transaction log, a folder of small files that says which data files make up the table at each version.

The log is the source of truth. A Parquet file sitting in the folder is **not** part of the table unless the log says so. That is why Databricks says never to touch data or log files directly in a table's directory.

![A Delta table: Parquet data files, and a _delta_log of numbered JSON commits that add and remove files, with a Parquet checkpoint every so often and a _last_checkpoint pointer](/assets/content/packs/databricks/delta-log.svg)

## Commits: one JSON file per version
A table has "a single serial history of atomic versions", numbered 0, 1, 2 and up with no gaps. Each version is **one JSON file** in `_delta_log`, named by its version padded to 20 digits:

```
_delta_log/00000000000000000000.json   <- version 0 (CREATE)
_delta_log/00000000000000000001.json   <- version 1 (first INSERT)
_delta_log/00000000000000000002.json   <- version 2 (UPDATE)
```

A version's JSON file is "the unit of atomicity": either the whole file exists and the version happened, or it doesn't and nothing happened.

**A write has two phases.** First the writer writes new Parquet data files (or rewritten copies of existing ones). Then it **commits** by creating the next JSON file. Until the commit exists, readers can't see the new files. If the job dies between the two phases, the files it wrote are never part of the table, and `VACUUM` deletes them later (chapter 4).

## What a commit records
Each line of a commit file is an **action**:

- **`metaData`**: the table's schema, partition columns and configuration. Version 0 must have one; at most one per version; each one **replaces** the previous metadata completely.
- **`add`**: a data file joins the table, with **per-file statistics** (min, max, null counts, row count) used for data skipping (chapter 7).
- **`remove`**: a data file leaves the table, with a timestamp. The file is not deleted, only marked.
- **`protocol`**: what a client must support to read or write the table (below).
- **`cdc`**: change data files written for change data feed (chapter 6).
- **`txn`**: an application's progress marker, used for idempotent writes (below).
- **`commitInfo`**: provenance: the operation, user and parameters. This is what `DESCRIBE HISTORY` shows (chapter 4).

An `UPDATE` that changes one row in a file typically **removes** that file and **adds** a rewritten copy (deletion vectors change this, chapter 7).

## Snapshots and tombstones
A **snapshot** is the table at one version: its protocol, its metadata, and the set of live files. A reader builds it by **replaying** the log: start from nothing, apply every `add` and `remove` in version order, and the files left over are the table. This is multi-version concurrency control: each reader works on one consistent snapshot, even while writers commit new versions.

A `remove` stays in the state as a **tombstone** until it expires. The file it names stays on storage, so a reader still working on an older snapshot can finish, and so **time travel** to an older version can find its files. Physical deletion happens later and lazily: that is `VACUUM`'s job, after the retention period (default 7 days, chapter 4).

## Checkpoints: not replaying 10,000 commits
Replaying thousands of JSON files would be slow. So Delta writes **checkpoints**: Parquet files holding "the complete replay of all actions" up to a version, with cancelled actions removed and unexpired tombstones kept.

- **Classic checkpoints** are named `n.checkpoint.parquet`; **V2 checkpoints** are UUID-named and may point to **sidecar** files in `_delta_log/_sidecars`.
- **`_delta_log/_last_checkpoint`** points to a recent checkpoint, so a reader doesn't have to list a log folder that can hold "10,000+" files.
- A reader loads the newest complete checkpoint, then replays only the JSON commits after it. For time travel, it uses a checkpoint no newer than the version it wants.
- **Log compaction files** (`x.y.compacted.json`) can aggregate a range of commits, and an optional **version checksum** file per commit lets clients detect changes to a log that "must remain an append-only log".

Databricks chooses checkpoint frequency automatically.

## Writing without locks: optimistic concurrency
Databricks uses **optimistic concurrency control**: there are **no locks** on reading or writing, and "deadlock is not a possibility". A write goes through three steps:

1. **Read** the latest version, if it needs to (an `UPDATE` or `MERGE` must find the files to rewrite; a plain append doesn't read).
2. **Write** its data files.
3. **Validate and commit:** check whether anything committed since its snapshot conflicts with what it read. No conflict: commit the next version. Conflict: **fail with a concurrent modification exception** rather than corrupt the table.

So when two jobs `MERGE` into the same table at the same time, both read version 10 and write their files. The first to commit creates version 11. The second, at commit time, sees version 11; if version 11 touched files it read, it fails (for example `DELTA_CONCURRENT_APPEND`), and the job must retry (chapter 24 lists these errors).

## Isolation and how far a transaction reaches
- **Reads** use **snapshot isolation**: a long report keeps reading the version it started with, even if another job overwrites the table meanwhile.
- **Writes** use **WriteSerializable** by default; **Serializable** is stronger and set with the table property `delta.isolationLevel`. Row-level concurrency (with deletion vectors) reduces conflicts between writers touching the same files.
- **Metadata changes** (schema, table properties, protocol) can make every concurrent write fail, and a **streaming read stops** at a commit that changes metadata and must be restarted.
- **Scope:** by default each SQL statement is its own transaction on one table. The current ACID documentation also describes `BEGIN ATOMIC ... END`, which groups statements across several tables into one transaction, for tables with **catalog commits** enabled.

Databricks also writes `_started_<id>` and `_committed_<id>` marker files for commits to object storage and cleans up stale ones; you never need to touch them.

## Protocol versions and table features
Every Delta table has a **protocol**: the minimum reader version (1 to 3) and writer version (2 to 7) a client needs. At reader 3 and writer 7 the protocol lists individual **table features** instead.

- A **writer feature** blocks only clients that write the table.
- A **reader feature** blocks clients that read it too.
- A client that doesn't support all of a table's features **can't read or write** it.

Most new capabilities upgrade the protocol. Enabling **deletion vectors** or **liquid clustering** (chapter 7) adds features that older clients and some external engines don't support, so they lose access to the table; some features can be removed again with `ALTER TABLE ... DROP FEATURE`. Check who reads a table before enabling a feature.

## Idempotent writes: transaction identifiers
A **`txn` action** records an application ID and a version number, committed in the same atomic commit as the data. Structured Streaming's Delta sink uses it: before committing micro-batch 42, it checks whether the table already records batch 42 for this stream. If it does, the batch was committed before a failure, and the sink skips it. That is why a restarted stream doesn't write the same micro-batch twice into a Delta table (chapter 16).

## Try it in Free Edition
In Free Edition your managed tables live in Databricks default storage, which you can't browse, so you see the log through SQL instead of through the folder.

```
CREATE TABLE prep.lakehouse.log_demo (id INT, status STRING);
INSERT INTO prep.lakehouse.log_demo VALUES (1, 'new'), (2, 'new');
UPDATE prep.lakehouse.log_demo SET status = 'paid' WHERE id = 1;
DESCRIBE HISTORY prep.lakehouse.log_demo;
DESCRIBE DETAIL prep.lakehouse.log_demo;
```

**What you should see:** `DESCRIBE HISTORY` lists one row per version, newest first: the `UPDATE`, the `WRITE` or `INSERT`, and the `CREATE TABLE`, each with its version number, user and timestamp. That is the `commitInfo` of each JSON commit. `DESCRIBE DETAIL` shows `numFiles`, the table's `location`, and `minReaderVersion` and `minWriterVersion`, its protocol.

## Design trade-off
Optimistic concurrency makes reads free and lets many writers work at once, but it pushes the cost onto conflicts: two jobs that rewrite the same files fail and retry. Design writers so they rarely overlap (different partitions or clustering ranges of the table, or one writer per table), rather than relying on retries.

## Interview takeaway
"A Delta table is Parquet files plus a `_delta_log` of numbered JSON commits. Each commit adds and removes files and is atomic, so readers rebuild a consistent snapshot from the log, with Parquet checkpoints so they don't replay everything. Removed files stay as tombstones until VACUUM, which is what makes time travel work. Writes use optimistic concurrency: no locks, and a conflicting commit fails instead of corrupting the table. And enabling features like deletion vectors upgrades the protocol, which can lock out older readers."
