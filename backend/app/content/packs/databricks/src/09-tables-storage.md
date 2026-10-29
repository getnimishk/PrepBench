---
id: tables-storage
title: Managed and external tables, volumes and storage access
summary: Who manages a table's files, what DROP does to them, volumes for files that aren't tables, and how Unity Catalog reaches ADLS through an Access Connector.
sources: §6, §14, §17, §24
---
## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 39 — Managed vs External Tables** (Full)
  - *Relevant sections:* Managed tables; External tables; Converting external to managed; Try it in Free Edition
  - *Learning evidence:* Drop a managed and an external table and explain what happened to each one's files.
- **Topic 40 — Volumes** (Full)
  - *Relevant sections:* Volumes: governed files that aren't tables
  - *Learning evidence:* Upload a CSV into a volume in Free Edition and read it with read_files.
- **Topic 41 — Storage Credentials and External Locations on Azure** (Full)
  - *Relevant sections:* Reaching ADLS Gen2: Access Connector, storage credential, external location
  - *Learning evidence:* Describe the five steps to let Unity Catalog read an ADLS container, with the Azure role at each step.

## Managed tables
**Managed tables** are "the default and recommended table type". Unity Catalog manages their reads, writes, storage and optimization; their files live in the **managed storage location** of their schema, catalog or metastore. They are always Delta, cost less to store and query, and get features external tables don't:

- predictive optimization and automatic liquid clustering (chapter 7);
- multi-statement transactions and metadata caching;
- **automatic file deletion after `DROP TABLE`**, once a recovery period ends (default 7 days; settable to 0 or 7-30 days per catalog or schema with `RETAIN DROPPED`). Within that period, `UNDROP TABLE` brings the table back.

## External tables
**External tables** keep their files at a path **you** choose, which must lie inside a registered external location. Unity Catalog manages only the metadata, not the files' lifecycle, layout or optimization.

- **`DROP TABLE` removes the metadata and leaves the files.** The data is still in your storage account.
- Formats: Delta, CSV, JSON, Avro, Parquet, ORC, text.
- Use them for data that must stay in a format managed tables can't hold, or that **non-Databricks clients read directly** from storage. Note that Unity Catalog privileges are **not** enforced on direct file access.
- Creating one needs `CREATE EXTERNAL TABLE` on the external location, plus `USE CATALOG`, `USE SCHEMA` and `CREATE TABLE`. If an external tool changes the table's metadata, `MSCK REPAIR TABLE t SYNC METADATA` resyncs it.

| Question | Managed table | External table |
|---|---|---|
| Who chooses where files live | Unity Catalog (managed storage) | You (a path in an external location) |
| Formats | Delta | Delta, CSV, JSON, Avro, Parquet, ORC, text |
| What DROP TABLE does | Removes metadata; files deleted after the recovery period | Removes metadata; files stay |
| Predictive optimization | Yes | No |
| Typical use | Almost everything | Data other engines read directly; files that must stay where they are |

## Converting external to managed
`ALTER TABLE t SET MANAGED` converts a Delta external table to managed (Databricks Runtime 17.3 LTS and above, or serverless; you must own it). It keeps the name, settings, permissions, views and **history**, and redirects path-based code. You can roll back within **14 days** with `ALTER TABLE t UNSET MANAGED`; writes made after the conversion are kept. A `CREATE TABLE AS SELECT` copy also works but loses these benefits, including history.

## Volumes: governed files that aren't tables
**Volumes** govern **non-tabular files** of any format: managed volumes in the schema's managed storage, or external volumes over an existing path. A file's path is `/Volumes/<catalog>/<schema>/<volume>/<path>/<file>`.

Uses: landing zones for raw files, staging for Auto Loader or `COPY INTO` (chapters 14-15), libraries, logs, checkpoints. Files in a volume **can't be registered as tables**; volumes are for path-based access, with the same grants as everything else.

## Reaching ADLS Gen2: Access Connector, storage credential, external location
On Azure, the recommended way for Unity Catalog to reach your ADLS Gen2 data is a **managed identity**:

1. Create an **Access Connector for Azure Databricks**, a first-party Azure resource that holds a system-assigned and/or user-assigned **managed identity**.
2. Grant that identity a storage role on the ADLS account, for example **Storage Blob Data Contributor** (or Storage Blob Delegator on the account plus Contributor on one container).
3. In Unity Catalog, create a **storage credential** that uses the Access Connector.
4. Create an **external location** for the path, `abfss://<container>@<account>.dfs.core.windows.net/<path>`, using that credential.
5. Grant users privileges on the external location (to create external tables or read files) and on the tables built over it.

Managed identities need **no secret rotation** and can reach a firewall-protected storage account from a VNet-injected workspace (chapter 23). The older pattern, a service principal's client secret or account keys set in Spark properties and kept in a secret scope, is documented as legacy; Databricks recommends Unity Catalog instead. Errors at step 5 look like `INSUFFICIENT_PERMISSIONS_EXT_LOC` (chapter 24). This step can't be run in Free Edition: **read, not run**.

## Try it in Free Edition
1. Upload a small CSV into the volume from chapter 2 (`prep.lakehouse.files`) using Catalog Explorer's upload, then read it:

```
SELECT * FROM read_files('/Volumes/prep/lakehouse/files/<your-file>.csv', format => 'csv', header => true);
```

2. See what `DROP` does to a managed table, and undo it within the recovery period:

```
CREATE TABLE prep.lakehouse.drop_me AS SELECT * FROM range(3);
DROP TABLE prep.lakehouse.drop_me;
UNDROP TABLE prep.lakehouse.drop_me;
SELECT * FROM prep.lakehouse.drop_me;
```

**What you should see:** the CSV's rows; then the table back with its three rows after `UNDROP`. An external table can't be tried in Free Edition (no storage credentials), so compare the two from the table above.

## Design trade-off
External tables feel safer ("our files stay where we put them") but give up predictive optimization, automatic cleanup and protection from direct file access that bypasses Unity Catalog. Default to managed; use external only where another engine must read the files directly or the files can't move.

## Interview takeaway
"Managed tables are the default: Unity Catalog owns their files, optimizes them, and deletes the files after a recovery period when the table is dropped, with UNDROP inside that window. External tables keep files at a path in an external location; dropping them leaves the files, and direct file access bypasses Unity Catalog grants. On Azure, storage access goes through an Access Connector's managed identity, wrapped in a storage credential and external locations, so no secrets to rotate. Volumes govern the files that aren't tables."
