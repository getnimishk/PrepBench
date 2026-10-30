---
id: unity-catalog
title: Unity Catalog: the object model
summary: One metastore per region, a three-level namespace, and securable objects that cover data, storage access and sharing.
sources: §6, §17
---

## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 38 — Unity Catalog Object Model** (Full)
  - *Relevant sections:* What Unity Catalog does; The three-level namespace; Securable objects; Try it in Free Edition
  - *Learning evidence:* Draw the hierarchy for one table, one volume and one external location, with who owns each.

## What Unity Catalog does
Unity Catalog is "the unified governance layer for data and AI built into Databricks". For every query it:

- **enforces access control** on the objects the query touches;
- **tracks lineage**, down to columns (chapter 10);
- **logs activity** for audit.

You use it through Catalog Explorer, SQL, the CLI and REST APIs. It is **enabled automatically** for workspaces created after 8 November 2023, and older workspaces are upgraded. The legacy per-workspace Hive metastore still works, but Databricks recommends Unity Catalog for everything.

![The Unity Catalog hierarchy: a metastore per region holds catalogs, catalogs hold schemas, schemas hold tables, views, volumes, functions and models; storage credentials and external locations sit beside them at the metastore level](/assets/content/packs/databricks/uc-hierarchy.svg)

## The three-level namespace
Every data object has a three-part name: **`catalog.schema.object`**, for example `sales.silver.orders`.

- The **metastore** is the top container. It is managed at the **account** level, one per region, and attached to the workspaces in that region (chapter 1). Only admins work with it directly.
- A **catalog** groups schemas, usually by domain, environment or both (`sales_prod`, `sales_dev`).
- A **schema** (also called a database) holds tables, views, volumes, functions and models.

A workspace has a **default catalog**, used when a query names only `schema.table`. Depending on how the workspace was enabled, that is a `main` catalog with a `default` schema, or a **workspace catalog** named after the workspace, where all workspace users can use the catalog and create tables and volumes in its `default` schema.

## Securable objects
A **securable** is anything you can grant privileges on (chapter 10). The table below lists them by kind. Two of them aren't data at all:

- A **storage credential** wraps a long-term cloud credential; on Azure, the managed identity of an Access Connector (chapter 9).
- An **external location** is a storage path plus the credential that can reach it. Every external table and external volume must sit inside one.
- Every securable has an **owner**, who holds all privileges on it.

Workspace assets (notebooks, jobs, dashboards, queries) are not securables; workspace permissions govern them (chapter 1).

| Kind | Securables |
|---|---|
| Containers | metastore, catalog, schema |
| Data | table, view, materialized view, volume |
| Logic and AI | function, model |
| Storage access | storage credential, external location |
| Federation and sharing | connection, OpenSharing share, provider, recipient |

## Try it in Free Edition

```
SHOW CATALOGS;
SHOW SCHEMAS IN prep;
SHOW TABLES IN prep.lakehouse;
DESCRIBE TABLE EXTENDED prep.lakehouse.orders;
SHOW GRANTS ON SCHEMA prep.lakehouse;
```

**What you should see:** your catalogs (including the ones Free Edition created for you), the schema and tables from earlier chapters, the table's owner and type (`MANAGED`) in the extended description, and the grants on the schema. You are the owner of what you created, so you hold all privileges on it.

## Design trade-off
How you cut catalogs decides how easy access control will be later. Catalogs per environment make "nobody writes to prod from dev" a single grant; catalogs per domain make data ownership clear. Many organisations combine both, and set storage locations per catalog so data is physically separated as well (chapter 24).

## Interview takeaway
"Unity Catalog is the governance layer: one metastore per region, shared by that region's workspaces, with a three-level namespace catalog.schema.object. Every table, view, volume, function and model is a securable with an owner, and so are storage credentials and external locations, which is how storage access itself is governed. Notebooks and jobs are workspace objects with their own permissions. Lineage and audit come with it, so I design the catalog layout around domains and environments from the start."
