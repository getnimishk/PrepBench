# Azure Data Lake Storage Gen2 — documentation walkthrough notes

**Source:** https://learn.microsoft.com/en-us/azure/storage/blobs/data-lake-storage-introduction and the Blob Storage
pages it depends on (read 2026-09-26).
**Purpose:** the source for the Study Library's ADLS Gen2 guide and its sandbox scenarios.
**Status:** complete for the core concept, security, data protection, cost tiers, redundancy, networking, performance
and migration pages. The coverage log at the bottom lists what was skipped.

Written in my own words. Every default, limit and number is quoted as the documentation states it. Each page was read
in full from the page text; no automatic summary was relied on.

---

## 1. What it is

- **Not a separate service or account type.** Data Lake Storage is "a set of capabilities dedicated to big data
  analytics, built on Azure Blob Storage". You unlock it by turning on the **hierarchical namespace** (HNS) setting on
  a storage account.
- **Built on Blob Storage**, so you also get Blob Storage's low-cost tiers, high availability, disaster recovery,
  diagnostic logging and lifecycle management.
- **A data lake** is "a single, centralized repository where you can store all your data, both structured and
  unstructured": you store data raw, in its native format, without first making it fit a structure.
- **The five capabilities the docs name:**
  1. Hadoop-compatible access
  2. hierarchical directory structure
  3. optimized cost and performance
  4. a finer-grained security model
  5. massive scalability (no limits on account size, file size or amount of data; files from KBs to hundreds of TBs)
- **Terminology trap.** The Blob docs say *blob* and *container*; the Data Lake docs say *file* and *file system*.
  They're the same things. A file you ingest *is* a blob.
- **Endpoints:**
  - Data Lake: `dfs.core.windows.net`
  - Blob: `blob.core.windows.net`
  - Both work on the same data ("multi-protocol access").

## 2. The hierarchical namespace

- **Without it,** folders are an illusion: a "folder" is just part of each blob's name (`a/b/c.csv`). Renaming or
  deleting a folder means touching **every blob** under it, possibly millions.
- **With it,** directories are real objects, so renaming or deleting one is a **single atomic metadata operation**.
- **Why that matters:** Spark and Hive write output to a temporary location and rename it at the end of a job. Without
  HNS, that rename "can often take longer than the analytics process itself".
- **Cost argument:**
  - Compute is often **more than 85%** of total cost, so faster jobs lower total cost of ownership even if storage
    costs rise.
  - The upgrade itself is free. Storage prices don't change, but the price of a transaction can depend on which
    endpoint clients use.
- **One-way.** Once HNS is enabled "you can't revert it back to a flat namespace". Upgrading an existing account:
  - **Writes are disabled** during the upgrade (the docs say to suspend reads too).
  - Validate in a **non-production** account first.
  - Hadoop jobs using the old **WASB** driver must move to **ABFS**.
- **When not to use it:** backups, image storage, and apps that keep their organisation elsewhere (e.g. in a database).
- **Behaviour changes after enabling it:**
  - Uploading to a path creates the missing directories.
  - Listing returns directories and files in depth-first order.
  - Renaming a blob **doesn't update its last-modified time**.
  - Event Grid events may show either endpoint's URL.

## 3. Access: ABFS and the URI

- The **ABFS driver** (Azure Blob File System) is part of Apache Hadoop. It's how Spark, Hive and Presto read the lake
  as if it were HDFS.
- **URI format:** `abfs[s]://<file_system>@<account>.dfs.core.windows.net/<path>`. `abfss` means TLS; use it.
- **Authentication,** two forms:
  - **Shared Key**: full access to everything.
  - **Microsoft Entra ID OAuth** (a user or a service principal): "authorize all access on a per-call basis… evaluated
    against the assigned POSIX ACL".
- **WASB** is the old Blob-only driver. It isn't supported against HNS accounts.

## 4. Security model: RBAC, ABAC and ACLs

- **Five ways to authorize:**
  1. Shared Key
  2. SAS (shared access signature)
  3. Azure RBAC
  4. Azure ABAC
  5. ACLs
- **Shared Key and account/service SAS bypass everything.** They carry no identity, so RBAC, ABAC and ACLs "have no
  effect". Shared Key is effectively **super-user**. The exception is a **user-delegation SAS**, which is secured by
  Entra and can be checked against ACLs.
- **RBAC is coarse-grained:** read or write on **all** data in an account or container. The data roles:

  | Role | Can do |
  |---|---|
  | Storage Blob Data **Owner** | Full access; can set owners and change any ACL |
  | Storage Blob Data **Contributor** | Read, write and delete; can change ACLs only on items it owns |
  | Storage Blob Data **Reader** | Read and list |

  Owner, Contributor and Storage Account Contributor **manage** the account but don't grant data access. However,
  **all except Reader can read the storage keys**, and with the keys they get full data access.
- **ABAC** adds conditions to RBAC (e.g. only blobs with a certain tag). It **can't deny**.
- **ACLs are fine-grained:** per directory and file.
- **Evaluation order:**
  1. RBAC role assignment.
  2. If there is one: ABAC conditions (none, or all match → **granted**).
  3. Otherwise: ACLs.
  4. Denied only if the ACLs don't allow it either.

  **You can't use an ACL to restrict access that a role already grants.** If the role and its conditions grant
  sufficient access, ACLs are ignored. If a condition doesn't match, evaluation continues to the ACLs (it doesn't
  deny). (Wording tightened 2026-09-26 after an external review.)
- **Limits:**
  - 4,000 role assignments per subscription.
  - **32 ACL entries per file or directory (effectively 28)**. Access ACLs and default ACLs each have their own 32.
- **Use Microsoft Entra security groups in ACLs, never individual users.**
  - The docs' example: a `/LogData` folder:
    - `LogsWriter` group has `rwx`;
    - `LogsReader` group has `r-x`;
    - ADF's managed identity is in the writers group;
    - the Databricks identity is in the readers group.
  - Someone leaves: remove them from the group. No ACLs to rewrite across the whole tree.
  - Keep a principal's group memberships **under 200** (a token-size limit).

## 5. ACLs in detail

- **Permissions:**

  | | File | Directory |
  |---|---|---|
  | Read (R) | Read contents | Needs R **and** X to list |
  | Write (W) | Write or append | Needs W **and** X to create children |
  | Execute (X) | Means nothing | Needed to **traverse** into the directory |

- **The rule people miss:** with ACLs only, reading one file needs **`--X` on the root and on every folder on the
  path**, plus `R--` on the file itself. Examples from the docs' table:
  - **Create a file:** `-WX` on its parent folder.
  - **Delete a file:** `-WX` on its parent. **No permission on the file is needed.**
  - **Delete a directory tree:** `-WX` on its parent, and `RWX` on every directory inside it.
- **Access ACL vs default ACL:** an access ACL controls the item itself. A **default ACL** (directories only) is a
  template copied to **new** children.
- **No inheritance after the fact:** changing a default ACL "doesn't affect … child items that already exist". Fixing
  existing items needs a **recursive** ACL update (Storage Explorer, PowerShell, CLI, SDKs; **not the portal**).
- **Identities per item:** owning user, owning group, named users, groups, service principals and managed identities,
  and "all other users". Evaluated in order: super-user, owner, named user, groups, other; first match wins.
- **Owner:** whoever created the item. A container's root is owned by its creator. Anything created with Shared Key or
  SAS is owned by `$superuser`.
- **Defaults:**
  - A new container's root is **750** for directories and **640** for files.
  - The **umask is fixed at 007**: "other" gets nothing on new children.
  - The **mask** caps named-user and group entries.
  - The **sticky bit** is rarely needed; when on, only an item's owner, the directory's owner or `$superuser` can
    delete or rename it.
- **GUIDs in ACLs** usually mean a user who no longer exists in Entra. Service principals and groups also show as
  object IDs.
- **Service principals:** use the **service principal's** object ID, not the app registration's.
- **A container has no ACL.** You set the ACL on its root directory.
- **If a container allows anonymous read access, ACLs don't apply to reads.**
- **Storage browser in the portal:** you must click through folders, so read access to a file isn't enough to see it
  there without read on the folders above it.

## 6. Data protection: what is and isn't available with HNS

**This is the section most likely to surprise people.** Several Blob Storage protection features **don't work** once the
hierarchical namespace is on.

| Protection | With HNS (Data Lake) |
|---|---|
| Resource Manager **lock** on the account | Yes. It stops the **account** being deleted, not the data inside |
| **Container soft delete** | Yes |
| **Blob soft delete** (files and directories) | Yes |
| Immutability policy on a container (WORM) | Yes |
| Azure Blob **vaulted backup** (copies to Microsoft's tenant) | Yes |
| **Blob versioning** | **No** |
| **Point-in-time restore** | **No** |
| **Change feed** | **No** |
| **Object replication** | **No** |
| Blob snapshots | Preview in the feature table. The protection overview lists snapshots as "No" for Data Lake Storage but also recommends "manual snapshots" for Data Lake workloads. **The docs contradict themselves; treat snapshots as not dependable.** |

- **Soft delete basics:**
  - **Retention is 1 to 365 days.** The docs recommend at least 7.
  - Soft-deleted data is billed like active data.
  - Deleting a **directory** soft-deletes it and everything in it.
  - **Renaming a directory that holds soft-deleted items disconnects them.** To restore them, rename it back.
  - ACLs come back with a restored item.
  - Soft delete does **not** protect against deleting the storage account (use a lock) or a container (use container
    soft delete).
- **Redundancy is not backup.** "Deletions and overwrites are applied to all copies simultaneously. Redundancy protects
  against hardware failure, not against data-modifying operations."
- **Deleted account:** can be recovered if deleted within **14 days**, and only if no new account took its name.
- **Customer-managed failover** for HNS accounts (corrected 2026-09-26 after an external review; the earlier "preview
  only" was out of date): storage-disaster-recovery-guidance lists planned and unplanned failover as **supported** for
  Data Lake Storage. storage-failover-faq still labels planned failover "(preview)" in one table.
  - Planned: regions swap, geo-redundancy kept, no data loss expected; blocked by change feed, object replication,
    point-in-time restore, or a Last Sync Time over 30 minutes.
  - Unplanned: the account becomes **LRS** in the new primary; writes after the Last Sync Time can be lost.
  - HNS replicates at file level: "Consistency for all files within a container or directory after a storage account
    failover isn't guaranteed."

## 7. Cost: access tiers and lifecycle management

- **Tiers:**

  | Tier | Minimum stay | First byte | Storage vs access cost |
  |---|---|---|---|
  | Hot | none | milliseconds | highest storage, lowest access |
  | Cool | 30 days | milliseconds | lower storage, higher access |
  | Cold | 90 days | milliseconds | lower still, higher access |
  | Archive | 180 days | **hours** (rehydrate up to **15 hours**) | lowest storage, highest access |

- **Early deletion penalty:** leave a tier before its minimum and you pay the rest of the minimum. The docs' examples:
  - deleted from cool after 21 days: 9 days' charge;
  - moved out of archive after 45 days: 135 days.

  Soft-deleted items don't trigger it until their retention ends.
- **Archive is offline:** you can't read it until it's rehydrated to an online tier. It's **not supported with ZRS,
  GZRS or RA-GZRS**. Change redundancy on an account holding archived data and you must rehydrate everything first.
- **The default tier** for new blobs is **hot**, and archive can't be the default. Changing the default re-tiers every
  blob without an explicit tier, and those tier changes are charged.
- **Smart tier** moves data automatically between hot, cool and cold by usage.
- **Transactions are billed in 4 MB increments.** Many tiny files cost more in transactions as well as in speed.
- **Lifecycle management:**
  - Rules move data to cooler tiers or delete it, by creation date, last modified or last accessed (if access-time
    tracking is on). They can filter by prefix or blob index tag. Rules can include, **not exclude**.
  - **Up to 24 hours** for a new or changed policy to take effect.
  - Policies are free; tier changes are charged.
  - **They can't rehydrate from archive.**
  - They won't delete from an immutable container.
  - With soft delete on, a policy's deletes become soft deletes.
  - Up to 10 prefixes per rule.
  - A directory is removed the day after all its blobs are.

## 8. Redundancy

| Option | Copies | Durability (per year) | Survives |
|---|---|---|---|
| **LRS** | 3 in one datacentre | 11 nines | a disk, server or rack failure |
| **ZRS** | across 3+ availability zones | 12 nines | a whole datacentre or zone |
| **GRS / RA-GRS** | LRS here + LRS in a paired region | 16 nines | a regional outage (after failover) |
| **GZRS / RA-GZRS** | ZRS here + LRS in a paired region | 16 nines | both of the above |

- **The docs recommend ZRS in the primary region for Data Lake Storage workloads.**
- **Geo-replication is asynchronous,** so a regional disaster can lose recent writes (the RPO). Geo priority
  replication keeps the RPO for block blobs at **15 minutes or less**.
- The "RA-" options let you read from the secondary during an outage. Without them, you wait for a failover.
- Redundancy is set per account, and applies to everything in it.

## 9. Networking

- **By default an account accepts connections from any network.**
- **Network rules** (anything not allowed is denied):
  - **virtual network rules**: up to 400, needing a service endpoint on the subnet;
  - **IP rules**: up to 400, for on-premises public IPs, or ExpressRoute Microsoft-peering NAT IPs;
  - **resource instance rules**: up to 200, for specific Azure resources;
  - the **trusted Microsoft services** exception.
- **Turning the firewall on also blocks other Azure services and the portal** unless you add the trusted-services
  exception.
- **Private endpoints** (up to 200) give the account a private IP inside your VNet. **For an HNS account, create one
  for both `blob` and `dfs`.** Some operations (managing ACLs, creating or deleting directories) need the dfs one.
- **Security recommendations:**
  - Use Entra ID, not Shared Key; **disallow Shared Key** if you can.
  - Use least privilege.
  - Prefer **user-delegation SAS**. A service SAS without a stored access policy can't be revoked, so keep it **one
    hour or less**.
  - Keep any keys in **Key Vault** and rotate them.
  - Require **HTTPS** and a minimum TLS version.
  - **Disable anonymous read.**
  - Turn on **Microsoft Defender for Storage**.
  - Lock the account.
  - Log **how requests were authorized** (anonymous, OAuth, Shared Key or SAS).

## 10. Performance and data layout

- **Ingest bottlenecks:** source hardware, network (use **ExpressRoute** from on-premises; same region if the source is
  in Azure), and not enough parallelism. Tuning knobs:

  | Tool | Setting |
  |---|---|
  | DistCp | `-m` (mappers) |
  | ADF | `parallelCopies` |
  | AzCopy | `AZCOPY_CONCURRENCY_VALUE` |

- **File size:** aim for **256 MB to 100 GB** per file. Many small files cost more (per-file overhead, and transactions
  billed per 4 MB). Some engines struggle above 100 GB. Compact small files; a streaming engine can batch them.
- **Formats:**
  - **Parquet or ORC** (columnar) for read-heavy analytics.
  - **Avro** (row-based) for write-heavy work, such as a message bus.
  - All three are compressed and carry their own schema.
- **Folder layouts from the docs:**
  - **IoT:** `{Region}/{SubjectMatter}/{yyyy}/{mm}/{dd}/{hh}/`. **Put the date last** so security can be set on
    region and subject once. With the date first you'd need ACLs under every hour folder, and the folder count grows
    without end.
  - **Batch:** `.../In/{yyyy}/{mm}/{dd}/`, `.../Out/...`, and a **`/Bad/`** folder for files that fail processing.
  - **Time series:** `/DataSet/YYYY/MM/DD/datafile_YYYY_MM_DD.tsv`, with the date in both folder and file name.
- **Premium block blob storage** (SSD) is for low latency or many transactions: higher storage cost, lower transaction
  cost. **Access tiers and lifecycle tiering aren't available on premium.**
- **Throttling:**
  - Over a partition's limit you get **503 (Server Busy)** or **500 (Operation Timeout)**. Retry with exponential
    backoff.
  - Default account limits in major regions:
    - **40,000 requests per second**;
    - **60 Gbps ingress**;
    - **200 Gbps egress**;
    - **5 PiB** capacity (more on request).
- **Monitoring:** Azure Storage logs in Azure Monitor. Send them to Log Analytics (to query the `StorageBlobLogs`
  table), to a storage account (long retention), or to Event Hubs (Splunk and other tools).

## 11. Migrating from Hadoop (HDFS)

- **Tools:**
  - ADF, DistCp or AzCopy online;
  - **Azure Data Box** offline: Disk; 80, 120 or 525 TiB boxes; a 770 TiB Data Box Heavy;
  - WANdisco LiveData Migrator.
  - ExpressRoute for sets of several terabytes.
- **Data Box path:**
  1. DistCp to the device.
  2. Ship it.
  3. Microsoft uploads the data.
  4. Verify against the **BOM (manifest) files**.
  5. **Only then apply permissions.**
- **Permissions don't travel with the data.**
  1. Export each file's HDFS owner and permissions.
  2. **Map every Hadoop user and group to a Microsoft Entra identity** (an `id_map.json` file).
  3. Reapply the ACLs with a service principal that has Storage Blob Data Contributor.

  **In a migration plan, identity mapping is its own workstream.**
- **Exclude cluster-state folders** (e.g. Ranger audit, HBase WALs) from the copy.
- **Old Hadoop versions:** code on Hadoop older than branch-3 that uses WASB should raise a support ticket for the
  right path; WASB against an HNS account isn't supported.

## 12. How other Azure services use it

- **Generally available with Entra ID auth:** ADF, **Azure Databricks**, Synapse, **Power BI**, HDInsight, Stream
  Analytics, Event Grid, Machine Learning, Data Explorer, AI Search, SSIS.
- **Shared Key only:** Event Hubs capture, Logic Apps, Data Box.
- **Preview:** SQL Managed Instance.
- **Other known issues:**
  - Blob APIs and Data Lake APIs can't both write to the same file (except to overwrite).
  - Blob `Delete` removes a directory only if it's empty.
  - Only **AzCopy v10** and Storage Explorer **1.6.0+** support HNS.

---

## Coverage log

| Area | Pages read (in full) |
|---|---|
| Overview | data-lake-storage-introduction |
| Namespace | data-lake-storage-namespace |
| Upgrade | upgrade-to-data-lake-storage-gen2 |
| Access | data-lake-storage-abfs-driver, data-lake-storage-multi-protocol-access |
| Security | data-lake-storage-access-control-model, data-lake-storage-access-control, security-recommendations, storage-network-security |
| Protection | soft-delete-blob-overview, data-protection-overview, storage-feature-support-in-storage-accounts |
| Cost | access-tiers-overview, lifecycle-management-overview |
| Resilience | storage-redundancy, storage-disaster-recovery-guidance, storage-failover-faq |
| Performance | data-lake-storage-best-practices, scalability-targets-standard-account |
| Migration | data-lake-storage-migrate-on-premises-hdfs-cluster |
| Integrations and issues | data-lake-storage-supported-azure-services, data-lake-storage-known-issues |

**Not read, on purpose:**
- **Per-language SDK and ACL how-tos** (.NET, Java, Python, JS, PowerShell, CLI, REST). They're procedures, not
  concepts.
- **NFS 3.0 and SFTP.** Protocols this stack doesn't use.
- **Query acceleration.**
- **Gen1-to-Gen2 migration.** Gen1 is retired.
- **Pricing pages.** Prices change; the cost structure is recorded above.

**Next:** Databricks-side access to the lake (Unity Catalog external locations and storage credentials) belongs in the
Azure Databricks and Unity Catalog walkthroughs, from their own documentation.
