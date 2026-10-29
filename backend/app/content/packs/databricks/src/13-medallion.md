---
id: medallion
title: The medallion architecture - bronze, silver, gold
summary: Raw data kept as it arrived, validated data built from it, and business-ready tables on top; what each layer is for and how data moves between them.
sources: §13, §10
---

## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 57 — Bronze to Silver to Gold** (Full)
  - *Relevant sections:* Three layers; Bronze: as it arrived; Silver: validated and conformed; Gold: ready for the business; Moving between layers
  - *Learning evidence:* Design the three tables for one source system and list the checks that move data between them.

## Three layers
The **medallion architecture** (also called "multi-hop") is a data design pattern in which data improves in quality as it moves through layers: **bronze → silver → gold**. Databricks calls it "a recommended best practice but not a requirement". It is a way to organise tables, not a product feature: the layers are just schemas or catalogs you name.

![The medallion flow: sources land in bronze as they arrived, silver cleans, deduplicates and conforms them, gold builds business aggregates and dimensional models for dashboards and ML](/assets/content/packs/databricks/medallion.svg)

## Bronze: as it arrived
Bronze keeps the **raw state of the source**, appended incrementally. It is the base for reprocessing and audit: if silver logic was wrong, you rebuild silver from bronze instead of asking the source again.

- Minimal validation. Databricks suggests storing most fields as **string, `VARIANT` or binary**, so a surprise in the source schema doesn't drop data.
- Add **provenance metadata**: the source file name (`_metadata.file_name` with Auto Loader), load time.
- Bronze is **not for analysts**.

## Silver: validated and conformed
Silver is where data becomes trustworthy: cleaning, **deduplication**, normalisation, null handling, type casting, joins, schema enforcement and evolution, handling late and out-of-order data, and quality checks. It keeps **at least one validated, non-aggregated version of each record**.

Build silver **from bronze, not straight from ingestion**, mostly with **streaming reads** of the append-only bronze tables (chapter 16); small dimension tables can be read in batch.

## Gold: ready for the business
Gold holds **dimensional models and aggregates** shaped for business needs, such as a `weekly_bookings` materialized view behind a dashboard. Gold is optimised for reading. Some organisations keep several gold areas per domain (finance, HR, sales).

## Moving between layers
For one source system, say an order feed, the table at the end of this section shows what each layer holds and what moves data into it.

The checks between layers are where data quality lives. In declarative pipelines they are **expectations** that warn, drop or fail (chapter 17). How often each layer is refreshed is the main cost and latency lever: continuous incremental processing costs more and is fresher.

| Layer | Example table | What gets it there |
|---|---|---|
| Bronze | bronze.orders_raw | Auto Loader appends every file as it arrived, with file name and load time; rescued data kept |
| Silver | silver.orders | Cast types, drop or quarantine rows failing checks, deduplicate to one row per order (latest change), conform codes |
| Gold | gold.daily_sales | Aggregate silver orders by day and region, as a materialized view or scheduled table |

## Design trade-off
Three layers mean three copies of the data and more pipelines to run. The benefit is that each layer has one job, so a bad transformation can be fixed and rebuilt without re-ingesting, and consumers only ever see gold or silver. Small, simple datasets may not need all three; regulated or many-consumer data usually does.

## Interview takeaway
"Medallion is a convention, not a feature: bronze keeps source data as it arrived, append-only and loosely typed, so we can always reprocess; silver is validated, deduplicated and conformed, built incrementally from bronze; gold is business-shaped aggregates and models for dashboards and ML. The quality checks between layers, as pipeline expectations, are where trust is earned, and refresh frequency per layer is the cost lever."
