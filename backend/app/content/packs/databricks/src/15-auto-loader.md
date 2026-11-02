---
id: auto-loader
title: Auto Loader in depth
summary: Incremental file ingestion with exactly-once tracking in the checkpoint, two ways to find new files, schema inference, rescued data and the schema evolution modes.
sources: §7, §8, §24
---

## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 63 — Auto Loader File Detection** (Full)
  - *Relevant sections:* What Auto Loader does; Finding new files: listing or notifications
  - *Learning evidence:* Explain what Auto Loader does when the same file name is dropped twice, and where it remembers it.
- **Topic 64 — Auto Loader Schema Inference and Evolution** (Full)
  - *Relevant sections:* Schema inference and the rescued data column; Schema evolution modes; Try it in Free Edition
  - *Learning evidence:* Add a new column to incoming files and show what addNewColumns and rescue each do.

## What Auto Loader does
**Auto Loader** incrementally processes **new files as they arrive** in cloud storage, through a Structured Streaming source called **`cloudFiles`**. It can include the files already there when it starts. It reads ADLS (`abfss://`), Unity Catalog volumes and other cloud storage, in JSON, CSV, XML, Parquet, Avro, ORC, text and binary formats, and scales to billions of files.

```
(spark.readStream.format("cloudFiles")
   .option("cloudFiles.format", "json")
   .option("cloudFiles.schemaLocation", "/Volumes/sales/landing/meta/orders_schema")
   .load("/Volumes/sales/landing/files/orders/")
 .writeStream
   .option("checkpointLocation", "/Volumes/sales/landing/meta/orders_checkpoint")
   .trigger(availableNow=True)
   .toTable("sales.bronze.orders"))
```

**Exactly-once:** Auto Loader records the files it has discovered in **RocksDB inside the checkpoint location**. A file it has already processed is not processed again, and a failed stream resumes where it stopped. So the same file landing twice is ingested once, and the place it "remembers" is the checkpoint: delete the checkpoint and it starts over (chapter 16). **Each source location loaded into a target needs its own checkpoint.**

Databricks recommends Auto Loader in Lakeflow pipelines (which manage schema and checkpoint locations for you), and whenever Structured Streaming reads files from cloud storage.

## Finding new files: listing or notifications
- **Directory listing** (the default) lists the input path to find new files. It needs only read access to the data.
- **File notification** uses cloud notification and queue services to be told about new files. With Unity Catalog **file events** enabled on the external location, it needs no extra permissions, and Databricks **recommends file notification with file events** for most workloads.

You can switch modes between restarts without losing exactly-once. In **either** mode, **Auto Loader never guarantees the order** in which files are processed: don't build logic that assumes file order.

If a notified file is deleted before it's processed, the stream fails with `CLOUD_FILE_SOURCE_FILE_NOT_FOUND`: don't delete landing files before they're ingested (chapter 24).

## Schema inference and the rescued data column
Set `cloudFiles.schemaLocation` (it can be the checkpoint path) and Auto Loader infers the schema and stores it in a `_schemas` folder there.

- The first inference samples the first **50 GB or 1,000 files**.
- For JSON, CSV and XML, every column is inferred as **string** unless `cloudFiles.inferColumnTypes` is `true`; Parquet and Avro bring their own types. CSV files are assumed to have headers.
- **Schema hints** (`cloudFiles.schemaHints`, for example `"amount DECIMAL(10,2)"`) override inferred types.
- When inferring, Auto Loader adds a **`_rescued_data`** column: values that don't fit the schema (a wrong type, an unexpected column, a different case) land there instead of being lost.

## Schema evolution modes
`cloudFiles.schemaEvolutionMode` decides what happens when files bring a new column (all five modes are in the table below).

The default `addNewColumns` **fails on purpose**, then succeeds on restart. That's why Databricks recommends running Auto Loader streams as **Lakeflow Jobs that restart automatically**, or in pipelines (chapter 24).

| Mode | What happens with a new column |
|---|---|
| addNewColumns (default without a given schema) | The stream fails with UNKNOWN_FIELD_EXCEPTION after recording the new column, and resumes with it on restart |
| addNewColumnsWithTypeWidening (Public Preview) | As addNewColumns, and also widens types such as int to long |
| rescue | Never evolves or fails; new columns go to _rescued_data |
| failOnNewColumns | Fails until the schema or the file is fixed |
| none (default when you give a schema) | New columns are ignored, and not rescued unless rescuedDataColumn is set |

## Try it in Free Edition
1. Upload `a.json` containing `{"id": 1, "name": "Ana"}` into `/Volumes/prep/lakehouse/files/al_in/`. Then run, in Python:

```
src = "/Volumes/prep/lakehouse/files/al_in/"
meta = "/Volumes/prep/lakehouse/files/al_meta/"
def load(mode):
    (spark.readStream.format("cloudFiles")
       .option("cloudFiles.format", "json")
       .option("cloudFiles.schemaLocation", meta + mode)
       .option("cloudFiles.schemaEvolutionMode", mode)
       .load(src)
     .writeStream.option("checkpointLocation", meta + mode + "_cp")
       .trigger(availableNow=True)
       .toTable("prep.lakehouse.al_" + mode.lower())
     .awaitTermination())
load("addNewColumns"); load("rescue")
```

2. Upload `b.json` containing `{"id": 2, "name": "Ben", "city": "Oslo"}` and run `load("addNewColumns")` again: **it fails** with an unknown-field error. Run it once more: it succeeds and `city` is a new column. Run `load("rescue")`: it succeeds, and `{"city":"Oslo"}` appears in `_rescued_data`.
3. Run `load("rescue")` a third time: it loads nothing, because both files are recorded in its checkpoint.

(`awaitTermination()` is fine here in an interactive notebook; production jobs shouldn't use it, chapter 24.)

## Design trade-off
`addNewColumns` keeps bronze complete and evolving, at the cost of a deliberate failure and restart per new column; `rescue` never stops the stream but leaves new fields buried in a JSON column until someone promotes them. Pick per source: well-behaved internal feeds can evolve; noisy external feeds are safer with `rescue` and a review step.

## Interview takeaway
"Auto Loader is the cloudFiles streaming source: it finds new files by listing or, better, by file notifications with file events, and records every file it has processed in RocksDB in the checkpoint, so each file is ingested exactly once even if it lands twice. It infers the schema into the schema location, rescues values that don't fit into _rescued_data, and by default fails once on a new column and resumes with it on restart, so we run it as a job that restarts automatically. It never guarantees file order."
