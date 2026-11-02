---
id: schemas
title: Schemas: enforcement and evolution
summary: Delta refuses writes that don't fit the table, and lets you change the schema on purpose; every schema change stops the streams that read the table.
sources: §3, §24
---
## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 27 — Schema Enforcement** (Full)
  - *Relevant sections:* Enforcement: what Delta refuses; Try it in Free Edition
  - *Learning evidence:* Append a DataFrame with an extra column and a wrong type, and explain each error.
- **Topic 28 — Schema Evolution** (Full)
  - *Relevant sections:* Evolution on purpose: explicit changes; Evolution with a write: automatic changes; What a schema change does to everyone else
  - *Learning evidence:* Add a column to a table both by mergeSchema and by ALTER TABLE, and say which one a reviewer can see coming.

## Enforcement: what Delta refuses
Schema enforcement applies to Delta tables (not to loose CSV or JSON files). Delta checks every write against the table's schema.

- **On `INSERT`:** every inserted column must exist in the target, and types must match. Databricks first tries a **safe cast**: an `INT` into a `BIGINT` column succeeds. A column the table doesn't have fails with `UNRESOLVED_COLUMN.WITH_SUGGESTION`. A value that can't be cast fails, for example with `CAST_INVALID_INPUT`.
- **On `MERGE`:** columns named in `UPDATE` and `INSERT` actions must exist. With `INSERT *` or `UPDATE SET *`, the **source must have every target column**, and extra source columns are **ignored** unless schema evolution is on (chapter 6).

Enforcement is the reason a lakehouse table stays trustworthy: a producer that starts sending a new field, or a string where a number should be, fails loudly instead of quietly corrupting the table.

## Evolution on purpose: explicit changes
Delta supports adding columns (anywhere), reordering, renaming and type widening.

- **Add:** `ALTER TABLE t ADD COLUMNS (discount DECIMAL(5,2) COMMENT 'promo' AFTER amount)`. New columns are nullable.
- **Reorder or comment:** `ALTER TABLE t ALTER COLUMN c FIRST | AFTER x | COMMENT '...'`; `REPLACE COLUMNS` replaces the list.
- **Rename and drop without rewriting** need **column mapping** enabled on the table. A dropped column's data stays in the files until `REORG TABLE` and then `VACUUM` (chapter 4).
- **Change a type or name by rewriting the table:** overwrite it with `.mode("overwrite").option("overwriteSchema", "true")`.

## Evolution with a write: automatic changes
A write can also evolve the schema as it goes:

- `.option("mergeSchema", "true")` on a batch or streaming write.
- `MERGE WITH SCHEMA EVOLUTION INTO ...` (or `.withSchemaEvolution()` in Python).
- `INSERT WITH SCHEMA EVOLUTION INTO ...` (Databricks Runtime 18.1 and above).

New columns are added **at the end** of the table (or of their struct), keeping their case. The old session setting `spark.databricks.delta.schema.autoMerge.enabled` is **legacy**: Databricks recommends asking for evolution on each write, which also takes precedence.

## What a schema change does to everyone else
A schema change is a metadata change (chapter 3), so:

- It **conflicts with every concurrent write** to the table.
- It **terminates any stream reading the table**; the stream must be restarted to pick up the new schema (chapter 16; the errors are in chapter 24).

So an `ALTER TABLE` is visible in code review and can be scheduled for a quiet moment; a `mergeSchema` buried in a job changes the table whenever the data says so. The first is predictable; the second is convenient. Most teams allow automatic evolution in bronze and require explicit changes in silver and gold (chapter 13).

## Try it in Free Edition

```
CREATE TABLE prep.lakehouse.schema_demo (id BIGINT, amount DOUBLE);
INSERT INTO prep.lakehouse.schema_demo VALUES (1, 9.5);
```

Then in Python:

```
df = spark.createDataFrame([(2, 3.0, "promo")], "id BIGINT, amount DOUBLE, note STRING")
df.write.mode("append").saveAsTable("prep.lakehouse.schema_demo")
```

**What you should see:** the append fails because `note` isn't in the table. Now add `.option("mergeSchema", "true")` before `saveAsTable` and run it again: it succeeds, `note` appears as the last column, and the first row's `note` is `NULL`. Check `DESCRIBE HISTORY`: the evolving write is a normal version with a changed schema.

Finally try a wrong type: `INSERT INTO prep.lakehouse.schema_demo (id, amount) VALUES (3, 'abc')` is refused, while `VALUES (3, 4)` succeeds because an integer safely casts to `DOUBLE`.

## Design trade-off
Strict enforcement protects consumers but stops pipelines when sources change; automatic evolution keeps data flowing but lets the source decide your schema. Choose by layer: lenient where data lands, strict where people and reports depend on it.

## Interview takeaway
"Delta enforces the table schema on every write: unknown columns and unsafe casts fail, while safe casts like INT to BIGINT go through. We evolve schemas on purpose, with ALTER TABLE for planned changes and mergeSchema or WITH SCHEMA EVOLUTION per write where we accept source-driven columns, usually in bronze. Any schema change conflicts with concurrent writes and stops streams reading the table, so it needs a restart plan."
