---
id: access
title: Privileges, fine-grained access, lineage and audit
summary: Grants and inheritance, the three privileges a reader needs, row filters and column masks, ABAC across many tables, and how lineage and audit answer "who touched what".
sources: §6, §15, §19
---

## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 42 — Privileges and Inheritance** (Full)
  - *Relevant sections:* Grants and inheritance; The three privileges a reader needs; Try it in Free Edition
  - *Learning evidence:* Grant an analyst group read on one schema and prove it works for a table created afterwards.
- **Topic 43 — Ownership and the Missing DENY** (Full)
  - *Relevant sections:* Owners, MANAGE, and why there is no DENY
  - *Learning evidence:* Explain why a 'DENY' answer refers to the legacy model, and how you would block access in Unity Catalog.
- **Topic 44 — Row Filters and Column Masks** (Full)
  - *Relevant sections:* Row filters and column masks
  - *Learning evidence:* Write a mask so only one group sees real email addresses, apply it, and say what a user outside the group sees.
- **Topic 45 — ABAC and Dynamic Views** (Full)
  - *Relevant sections:* ABAC: one policy for many tables; Dynamic views
  - *Learning evidence:* Say when you'd use an ABAC policy, a column mask and a dynamic view, with one example each.
- **Topic 46 — Lineage and Audit** (Full)
  - *Relevant sections:* Lineage and audit
  - *Learning evidence:* Use lineage to list every downstream table affected if a source column is renamed.

## Grants and inheritance
In Unity Catalog, users start with **no access**. Privileges are granted to **principals**: users, groups and service principals (by application ID). Grant to groups, not people.

```
GRANT USE CATALOG ON CATALOG sales TO `analysts`;
GRANT USE SCHEMA, SELECT ON SCHEMA sales.gold TO `analysts`;
REVOKE SELECT ON SCHEMA sales.gold FROM `analysts`;
SHOW GRANTS ON SCHEMA sales.gold;
```

**Inheritance:** a privilege granted on a catalog or schema applies to the **current and future** objects inside it. `SELECT` on `sales.gold` covers every table and view in it, including ones created next month.

Other privileges you'll use: `MODIFY` (insert, update, delete; also needs `SELECT` and the usage privileges), `CREATE TABLE`, `CREATE SCHEMA`, `REFRESH` (materialized views), `BROWSE` (see that objects exist and request access, without reading data; Databricks recommends granting it to `All account users` on a catalog), and `ALL PRIVILEGES`.

## The three privileges a reader needs
To read a table a user needs **all three**:

`USE CATALOG` and `USE SCHEMA` give no data by themselves; they are boundaries the catalog and schema owners control. So a table owner who grants `SELECT` to analysts has given them nothing until someone also grants the usage privileges above it. "It works for me but not for the analysts" is usually this.

| Level | Privilege |
|---|---|
| Catalog | USE CATALOG |
| Schema | USE SCHEMA |
| Table or view | SELECT |

## Owners, MANAGE, and why there is no DENY
Every object has an **owner**, who holds all privileges on it. Privileges can be granted by the owner, by the owner of the containing catalog or schema, by a user with **`MANAGE`** on the object, or by a metastore admin. Databricks recommends groups as owners, so ownership survives people leaving.

**There is no `DENY` statement in Unity Catalog SQL.** Privileges not granted are simply not held: least privilege by default. `GRANT`, `REVOKE` and `DENY` statements together belong to the **legacy Hive metastore** table access control. In Unity Catalog, the only denial is an **ABAC DENY policy**, in Beta and limited to the `MANAGE ACCESS CONTROL` privilege.

Be aware that the Data Engineer Associate exam outline still lists "GRANT, REVOKE, and DENY". An exam question about `DENY` is about the legacy model. To block someone in Unity Catalog, you **revoke** the grant that gives access (on the object or on a parent it inherits from), or use a row filter, column mask or ABAC policy.

## Row filters and column masks
Table-level controls, set by the table owner (or with `MANAGE`), one table at a time:

- A **row filter** is a SQL function evaluated for each row at query time; rows where it returns `FALSE` are hidden. `ALTER TABLE sales SET ROW FILTER us_only ON (region)`.
- A **column mask** is a SQL function that returns the real value or a masked one; one mask per column.

```
CREATE FUNCTION mask_email(email STRING) RETURN
  CASE WHEN is_account_group_member('support') THEN email ELSE '***' END;
ALTER TABLE crm.customers ALTER COLUMN email SET MASK mask_email;
```

A member of `support` sees real addresses; everyone else sees `***`. Checks such as `is_account_group_member` run as the user querying. Keep these functions simple and deterministic; with ANSI mode off, a type mismatch can silently return `NULL` and a filter can return every row.

## ABAC: one policy for many tables
Masks and filters per table don't scale to hundreds of tables. **Attribute-based access control (ABAC)** is Databricks' recommended approach for consistency:

- **Governed tags** (key-value pairs defined at the account level, inherited from catalog and schema) mark data, for example a `PII` tag on columns.
- A **policy** attached to a catalog, schema or table applies a row filter, column mask, grant or deny wherever the tags match, for example "mask every column tagged PII for all account users except HR admins".
- New tables carrying the tag are covered **automatically**, and table owners can't override the policy.

## Dynamic views
A **dynamic view** wraps base tables in a view that filters or masks, usually with `is_account_group_member()`. Use it to expose a curated or joined slice to people who have no access to the base tables at all. So: an ABAC policy for a rule across many tables, a column mask for one table's sensitive column, a dynamic view for a tailored slice of several tables.

## Lineage and audit
**Lineage** is captured automatically, **down to column level**, for queries through Spark DataFrames or Databricks SQL, across every workspace on the metastore. It shows in Catalog Explorer and is queryable in `system.access.table_lineage` and `system.access.column_lineage`. Uses: impact analysis before a change ("what breaks if I rename this column?"), root cause of a bad report, tracking regulated data. Viewing lineage needs at least `BROWSE` on the catalog.

**Audit**: Unity Catalog logs activity, and the audit log is available as the `system.access.audit` system table (chapter 20) for questions like "who read this table last week?".

## Try it in Free Edition

```
CREATE SCHEMA IF NOT EXISTS prep.secure;
CREATE TABLE prep.secure.customers (id INT, email STRING);
INSERT INTO prep.secure.customers VALUES (1, 'ana@example.com');
CREATE FUNCTION prep.secure.mask_email(email STRING) RETURN
  CASE WHEN is_account_group_member('support') THEN email ELSE '***' END;
ALTER TABLE prep.secure.customers ALTER COLUMN email SET MASK prep.secure.mask_email;
SELECT * FROM prep.secure.customers;
SHOW GRANTS ON TABLE prep.secure.customers;
```

**What you should see:** `***` in the email column, because you are not in a `support` group. Drop the mask with `ALTER TABLE prep.secure.customers ALTER COLUMN email DROP MASK` and the address comes back. Granting to other users and groups needs other identities, which Free Edition's single-user setup may not have: read the grant examples above.

## Design trade-off
Grants on catalogs and schemas are simple and inherit automatically, but they are all-or-nothing per object. Row filters, masks and ABAC give finer control at a query-time cost and with more to test. Start coarse (catalogs and schemas per domain and environment), then add fine-grained rules only where the data needs them, preferably as ABAC policies so new tables are covered.

## Interview takeaway
"Unity Catalog starts from no access. Reading a table needs USE CATALOG, USE SCHEMA and SELECT, and grants on a catalog or schema inherit to future objects. There's no DENY statement in Unity Catalog SQL: that's the legacy Hive model, so we revoke, or use filters, masks or ABAC. For sensitive columns across many tables I'd use governed tags and an ABAC policy so new tables are covered automatically. And column-level lineage plus the audit system table answer impact and who-did-what questions."
