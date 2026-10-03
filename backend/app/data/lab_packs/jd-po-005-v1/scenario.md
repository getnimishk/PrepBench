**Fictional.** The group, its sites, its people and every figure in this pack are invented for practice. Nothing here describes a real organisation, and nothing here is taken from a real job advertisement: the pack is a rehearsal for a *kind* of role, a product owner for a Databricks and Azure data migration.

## Framing

A fictional port-logistics group in the Gulf runs warehouses at several ports. Every inbound shipment is inspected, and each damaged pallet, wrong label, broken seal or temperature breach becomes a *defect record*. Those records, and the reports built on them, live on an ageing on-premises Hadoop platform whose support is ending. They are moving to Databricks on Azure.

The records are not tidy in the way a textbook dataset is:

- **Inspector names are in Arabic script.** The migrated platform has to keep them intact from source to report.
- **Some dates arrive as Hijri-format text** (for example `1447-09-14`), typed by a regional office. They are text values here, not converted from the Gregorian column, and the pack does not claim they match it.
- **Repair costs are in UAE dirhams (AED)**, held to four decimals after the migration. The legacy job rounded some of them to two decimals, whole fils.
- **One legacy job wrote local Gulf time (UTC+4) as if it were UTC**, and another wrote `0` where the scrap count was unknown.

## The data

About 3,000 defect records, in five batches, in the `defects` table. Each table exists twice: a `legacy` copy, as the old jobs produced it, and a clean copy. The differences between them are planted on purpose, and the pack lists every one, so a comparison can be checked against the truth:

| Planted difference | Rows | What it teaches |
|---|---|---|
| AED amounts rounded to two decimals in the legacy copy | 180 | A sum can drift while every row count matches |
| Local Gulf time stored as UTC | about 12% | A timestamp is not just a number |
| `0` written for an unknown scrap count | 24 | Null handling changes an average, not a count |
| `inspector_id` added from batch 3 | batches 3 to 5 | Schema enforcement against schema evolution |
| A change batch of updates, deletes and inserts | 30 | Applying changes with a MERGE |
| Batch 2 delivered twice | 600 | Repeating a load safely |

## The stakeholder brief

**Operations director (the sponsor).** Wants the migration finished before the peak season. Will accept a short parallel run, not a long one. Cares that port reports do not go blank.

**Finance controller.** Wants every figure to match to the fils. Treats a rounding difference as a defect, not a detail. Will ask who signed off each reconciliation.

**Regional warehouse managers.** Type the Hijri dates and read the Arabic names on their reports. Will notice garbled text before anyone else does.

**Data platform lead.** Owns the cutover. Needs a map of who reads each dataset before any domain is switched.

You are the product owner. You do not write the jobs. You decide what "done" means for each wave, write the acceptance criteria the business can sign, and say no when a cutover is not ready.

## How to use this pack

- **Station C** runs on this pack unchanged: create the tables, append a batch, watch schema enforcement refuse the drifted batch, replay a batch, merge the change batch, and compare the legacy and migrated copies. The comparison finds every planted difference, including the AED rounding.
- **Interview questions.** `interview-questions.json` in this folder is ready for the Interview Library's import (import it once: the importer doesn't check for questions you already have): ten diagnostic questions to answer before and after the Lab, and four prompts about stakeholders and delivery. They are questions only. Your answers, and the points you want to make, are yours to write, from what you actually did in the Lab.
- Stations F, A and B are the semiconductor pack's. This pack ships only the data, so it does not offer them.

Nothing in this pack is a result. Everything the Lab shows about it comes from running it.
