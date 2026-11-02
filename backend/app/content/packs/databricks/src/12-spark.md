---
id: spark
title: Spark essentials for data engineering
summary: How Spark splits work into jobs, stages and tasks; the DataFrame and SQL operations you use daily; and the union and join traps that catch people.
sources: §9, §24
---
## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 54 — Spark Execution Model** (Full)
  - *Relevant sections:* How Spark runs your code
  - *Learning evidence:* Explain which step of a groupBy causes a shuffle and why it splits the work into two stages.
- **Topic 55 — DataFrame and SQL Transformations** (Full)
  - *Relevant sections:* Everyday transformations; Try it in Free Edition
  - *Learning evidence:* Write the same aggregation in PySpark and SQL and show identical results.
- **Topic 56 — Joins, Unions and Deduplication** (Full)
  - *Relevant sections:* Joins; Unions: the classic trap; Deduplication
  - *Learning evidence:* Explain why DataFrame union() kept duplicates that SQL UNION removed, with a 3-row example.

## How Spark runs your code
A Spark application has a **driver** that plans the work and **executors** on the workers that do it. Your DataFrame or SQL code is **lazy**: transformations build a plan, and an **action** (writing a table, `count()`, `display()`) runs it.

- The plan becomes one or more **jobs**.
- Each job is split into **stages** at every **shuffle**: a point where rows must move between executors because the next step needs rows with the same key together.
- Each stage runs as many **tasks** in parallel, one per data partition.

A `groupBy("customer_id").sum("amount")` is the standard example. The first stage reads the data. Then the data is **shuffled**, "re-distributed so that it's grouped differently across partitions", so all of one customer's rows meet in one partition. The second stage sums them. The shuffle is the expensive part: it "involves disk I/O, data serialization, and network I/O". How many partitions a shuffle creates is `spark.sql.shuffle.partitions` (Apache Spark's default is 200; Databricks suggests `auto`), and adaptive query execution adjusts it at run time (chapter 19).

## Everyday transformations
The same operations exist in PySpark and SQL:

```
from pyspark.sql import functions as F
(spark.table("prep.lakehouse.orders")
   .filter(F.col("amount") > 0)
   .groupBy("order_id")
   .agg(F.sum("amount").alias("total"), F.approx_count_distinct("order_id").alias("n")))
```

```
SELECT order_id, sum(amount) AS total, approx_count_distinct(order_id) AS n
FROM prep.lakehouse.orders WHERE amount > 0 GROUP BY order_id;
```

Functions worth knowing:

- **`explode(col)`** returns one row per element of an array (or entry of a map): how you flatten nested JSON.
- **`approx_count_distinct(col, rsd=0.05)`** estimates a distinct count cheaply (maximum relative standard deviation 0.05 by default; below 0.01, an exact `count_distinct` is more efficient).
- **`summary()`** on a DataFrame gives count, mean, stddev, min, approximate quartiles and max: a quick profile of a new dataset.

## Joins
`df.join(other, on, how)`. `how` defaults to **`inner`** and may be `inner`, `cross`, `outer`/`full`, `left`, `right`, `semi`/`left_semi` or `anti`/`left_anti`. `on` can be a list of columns for a **multi-key** join, for example `on=["order_id", "line_no"]`.

- A **semi** join keeps rows of the left side that have a match, without adding columns: "orders that have a payment".
- An **anti** join keeps rows that have **no** match: "orders with no payment", a common reconciliation check.

How Spark executes a join (broadcast or shuffle) is in chapter 19.

## Unions: the classic trap
- **`union()`** and **`unionAll()`** on DataFrames both **keep duplicates** and match columns **by position**.
- **`unionByName()`** matches columns **by name**; with `allowMissingColumns=True` it fills missing columns with null.
- In **SQL**, `UNION` (the same as `UNION DISTINCT`) **removes** duplicates, and `UNION ALL` keeps them.

So DataFrame `union()` behaves like SQL `UNION ALL`, not like SQL `UNION`. Union `[1, 2]` with `[2, 3]` in PySpark and you get four rows, 1, 2, 2, 3; the same in SQL with `UNION` gives three. And matching by position means two DataFrames with the same columns in a different order are silently mixed up: use `unionByName()`.

## Deduplication
- **`dropDuplicates(subset)`** removes duplicate rows, optionally on chosen columns (`dropDuplicates(["order_id"])` keeps one row per order). On a stream it keeps state across micro-batches, which must be bounded with a watermark (chapter 16).
- **`distinct()`** removes rows duplicated on every column.
- To keep the **latest** row per key, rather than an arbitrary one, use a window: `row_number()` over the key ordered by a timestamp, then keep row 1. That is what a `MERGE` source needs (chapter 6).

## Try it in Free Edition

```
from pyspark.sql import functions as F
a = spark.createDataFrame([(1,), (2,)], "x INT")
b = spark.createDataFrame([(2,), (3,)], "x INT")
print(a.union(b).count(), a.union(b).distinct().count())
a.createOrReplaceTempView("a"); b.createOrReplaceTempView("b")
print(spark.sql("SELECT x FROM a UNION SELECT x FROM b").count(),
      spark.sql("SELECT x FROM a UNION ALL SELECT x FROM b").count())
spark.createDataFrame([(1, ["a", "b"])], "id INT, tags ARRAY<STRING>").select("id", F.explode("tags")).show()
```

**What you should see:** `4 3`, then `3 4`, then two rows for id 1, one per tag.

## Design trade-off
DataFrames and SQL compile to the same plans, so choose by team and task: SQL for set-based transformations analysts can read, Python where logic needs functions, tests and reuse. What matters more is avoiding needless shuffles and knowing which operations cause them.

## Interview takeaway
"Spark is lazy: transformations build a plan and an action runs it as jobs, split into stages at each shuffle, with one task per partition. Group-bys and most joins shuffle, which is the expensive part. The trap I always check is unions: DataFrame union keeps duplicates and matches by position, like SQL UNION ALL, so I use unionByName and deduplicate explicitly. And for 'latest row per key' I use a row_number window rather than dropDuplicates."
