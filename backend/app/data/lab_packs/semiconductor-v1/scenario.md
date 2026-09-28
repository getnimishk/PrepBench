**Fictional.** The company, its systems, its people and every figure in this pack are invented for practice. Nothing here describes a real organisation.

A semiconductor manufacturer runs its yield and equipment analytics on an on-premises Cloudera platform (HDFS, Hive Metastore, Ranger, Kerberos across several realms) that is nearing end of support. About 3,000 Spark jobs run on it: roughly 70% orchestrated by Oozie, 20% by cron and shell wrappers that are in no inventory, and 10% by a partial Airflow set-up.

Five things migrate at once:

- **Storage:** HDFS to an ADLS Gen2 medallion layout.
- **Metadata and governance:** Hive Metastore and Ranger to Unity Catalog, using Hive Metastore federation as a bridge.
- **Compute:** YARN Spark to Databricks Runtime, on job clusters by default.
- **Orchestration:** Oozie to Lakeflow Jobs, with Azure Data Factory only for external triggers.
- **Identity:** Kerberos keytabs to Entra ID service principals and managed identities.

The domains go in order of how safe they are to disrupt: BI feeds, then supply chain, then finance, then yield and defect analytics, then equipment telemetry.

Why it is hard: a fab never stops, so there is no quiet cutover window. Yield numbers carry audit weight, so "near enough" parity is not acceptable. The cross-realm Kerberos trust is undocumented.

**This pack's data** is a small generated dataset: about 5,000 inspection defect records and 20,000 equipment telemetry events. Each table exists twice: a `legacy` copy, as the old Hive jobs produced it, and a clean copy. The differences between them are planted on purpose, and the pack lists every one of them, so a comparison can be checked against the truth.
