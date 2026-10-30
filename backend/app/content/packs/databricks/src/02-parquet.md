---
id: parquet
title: Parquet, the columnar file underneath
summary: Row groups, column chunks and pages, with the footer written last; statistics that let readers skip data; and why a folder of Parquet files is not yet a table.
sources: §22, §2
---
## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 7 — Columnar Storage** (Full)
  - *Relevant sections:* Why columns
  - *Learning evidence:* Explain, with a 3-column example, how many bytes a one-column query reads in row vs columnar storage.
- **Topic 8 — Parquet File Anatomy** (Full)
  - *Relevant sections:* Inside a Parquet file
  - *Learning evidence:* Sketch a Parquet file from memory and explain why the footer is written after the data and read first.
- **Topic 9 — Statistics, Page Index and Bloom Filters** (Full)
  - *Relevant sections:* Skipping data: statistics, page index, bloom filters
  - *Learning evidence:* For an equality filter on a high-cardinality ID column, say which of the three helps most and why.
- **Topic 10 — Types, Encodings and Compression** (Full)
  - *Relevant sections:* Types, encodings and compression; Sizes the specification recommends
  - *Learning evidence:* Explain why a column with few distinct values compresses well and what happens when its dictionary grows too big.
- **Topic 11 — Parquet in Spark** (Full)
  - *Relevant sections:* How Spark reads Parquet; Try it in Free Edition
  - *Learning evidence:* Read a folder of Parquet files with two schemas in Free Edition and show the result with and without mergeSchema.
- **Topic 12 — Hive-Style Partitioning and Small Files** (Full)
  - *Relevant sections:* Partition folders, small files, and what Parquet lacks
  - *Learning evidence:* Explain to a stakeholder why a table partitioned by customer ID got slower, in three sentences.

## Why columns
Apache Parquet is "an open source, column-oriented data file format designed for efficient data storage and retrieval". It is the file format under every Delta table on Databricks.

Take a table with three columns, `order_id`, `customer_id` and a long `notes` text. A query that sums `order_id` counts only needs one column.

- In a **row** layout, each row's three values sit together on disk, so the engine reads every row in full, `notes` included.
- In a **columnar** layout, each column's values sit together, so the engine reads only the `order_id` values and skips the rest.

Two more gains come from storing a column's values side by side: values of one type and similar content **compress much better**, and the engine can **skip whole blocks** using statistics about each block (below).

## Inside a Parquet file
A Parquet file has a fixed hierarchy:

- A **file** holds one or more **row groups**: horizontal slices of the rows.
- A row group holds **exactly one column chunk per column**, stored contiguously.
- A column chunk is split into **pages**, the indivisible unit of encoding and compression.

```
PAR1                                   <- 4-byte magic number
row group 1: [col A chunk][col B chunk][col C chunk]
row group 2: [col A chunk][col B chunk][col C chunk]
...
footer (file metadata: schema, where every chunk starts, statistics)
footer length (4 bytes)
PAR1
```

The **footer is written after the data**. That lets a writer produce the file in a **single pass**: it can't know where each chunk starts until it has written them. A reader does the opposite: it **reads the footer first**, finds the chunks for the columns it needs, and reads only those.

The units of parallel work follow the hierarchy: a file or row group is the unit for splitting work, a column chunk the unit of I/O, a page the unit of encoding and compression.

## Skipping data: statistics, page index, bloom filters
Parquet keeps information that lets a reader skip data a filter can't match.

- **Statistics:** minimum and maximum values per column chunk. A filter `amount > 1000` skips any chunk whose maximum is 900.
- **Page index** (optional): per-page minimums and maximums kept near the footer, so a reader jumps straight to matching pages instead of reading every page header. On a column the data is sorted by, a single-row lookup reads one page per column.
- **Bloom filters** (optional): a compact structure that answers "definitely not here" or "probably here" for a value, with no false negatives. They help on **high-cardinality** columns such as IDs, where each chunk's min and max span almost everything, so statistics skip nothing.

For an equality filter on a customer ID column with millions of values, the bloom filter is the one that helps; min/max only helps once the data is sorted or clustered on that column. Delta Lake does the same thing one level up, with statistics per file in its transaction log (chapter 7).

## Types, encodings and compression
- **Physical types** are deliberately few: BOOLEAN, INT32, INT64, INT96 (deprecated, legacy timestamps only), FLOAT, DOUBLE, BYTE_ARRAY, FIXED_LEN_BYTE_ARRAY. **Logical types** such as strings, decimals, dates and timestamps are annotations on top of them.
- **Nested data** (structs, lists, maps) is stored with **definition levels**, which record how many optional fields on a path are present (this is how nulls are kept), and **repetition levels**, which record where a repeated field repeats.
- **Dictionary encoding** stores each distinct value once in a dictionary page and replaces values with small indexes. A `country` column with 200 distinct values compresses very well. If the dictionary grows too big in size or distinct values, the writer **falls back to plain encoding** for the rest of the chunk.
- **Compression** applies per page: SNAPPY, GZIP, ZSTD, LZ4_RAW, BROTLI and others. Spark writes Parquet with **snappy** by default (`spark.sql.parquet.compression.codec`).

## Sizes the specification recommends
The Parquet specification recommends **large row groups, 512 MB to 1 GB**, for long sequential reads, and **data pages of 8 KB**. This guidance was written for HDFS. Engines choose their own defaults, and the Databricks pages read for this guide don't state Databricks' write defaults, so treat these as the format's design intent, not as settings to copy.

## How Spark reads Parquet
- Reading Parquet keeps the schema, but **every column is read as nullable**, "for compatibility reasons".
- **Schema merging is off by default** (since Spark 1.5) because it is "relatively expensive". If files in one folder have different columns, Spark uses one schema unless you set the `mergeSchema` option (or `spark.sql.parquet.mergeSchema`).
- **Partition discovery** reads Hive-style folder names such as `country=FR/` as a column, inferring its type.
- On Databricks, Parquet is "the underlying storage format for Delta Lake". You can query Parquet files directly with `read_files(..., format => 'parquet')` or create a table `USING PARQUET`; streaming Parquet files needs Auto Loader (chapter 15).

## Partition folders, small files, and what Parquet lacks
When Spark writes partitioned Parquet it uses **Hive-style partitioning**: one folder per value, `customer_id=1001/`, `customer_id=1002/`, and so on. Partition by a column with many values and you get many folders, each holding a few **small files**. Every query then opens and reads the footers of thousands of tiny files, which is slower than reading a few large ones.

A folder of Parquet files is also **not a table** in the transactional sense. It has no transaction log, so it has no atomic commits (a reader can see half a write), no schema enforcement, no time travel and no `MERGE`. That is exactly what Delta Lake adds (chapter 3). Databricks' own guidance on partitioning is in chapter 7: most tables don't need it at all.

## Try it in Free Edition
1. In a Python notebook, create a volume to hold files, then write two small Parquet datasets with different columns into one folder (replace the catalog and schema with yours):

```
spark.sql("CREATE VOLUME IF NOT EXISTS prep.lakehouse.files")
base = "/Volumes/prep/lakehouse/files/parquet_demo"
spark.createDataFrame([(1, "FR")], "id INT, country STRING").write.mode("overwrite").parquet(base + "/part=a")
spark.createDataFrame([(2, "DE", 9.5)], "id INT, country STRING, score DOUBLE").write.mode("overwrite").parquet(base + "/part=b")
```

2. Read the folder twice:

```
spark.read.parquet(base).printSchema()
spark.read.option("mergeSchema", "true").parquet(base).printSchema()
```

**What you should see:** both reads add a `part` column from the folder names (partition discovery). Only the `mergeSchema` read is guaranteed to include `score`; without it Spark doesn't merge the files' schemas. All columns show `nullable = true`.

3. Query the files with SQL, without a table: `SELECT * FROM read_files('/Volumes/prep/lakehouse/files/parquet_demo', format => 'parquet')`.

## Design trade-off
Partitioning a Parquet lake by a column lets queries that filter on it skip folders, but it multiplies files. A low-cardinality column (a date) can be worth it on a very large table; a high-cardinality one (a customer ID) almost never is. Statistics and clustering (chapter 7) give most of the skipping without the small-file cost.

## Interview takeaway
"Parquet stores each column's values together in row groups, with a footer written last that holds the schema, chunk locations and min/max statistics. A reader reads the footer first and touches only the columns and row groups a query needs, which is why columnar formats are fast for analytics. But a folder of Parquet files has no transaction log, so no atomic commits or time travel; Delta Lake adds that. And partitioning by a high-cardinality column creates thousands of small files, which is slower, not faster."
