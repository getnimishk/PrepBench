# Unit 1 · Loading only new data

**Level 1 · about 30 minutes · paper draft for review.** Every fact here comes from Microsoft's Azure Data Factory
documentation (see [the notes](../adf-documentation-notes.md), §9, §10, §12, §13, §18.2, §21, §23). The company and numbers in
the case are **fictional**.

---

## Part 1 · The concept

### The problem

A factory's production database gets new rows all day: every wafer lot, every test result. Every night that data has
to be copied to the cloud (the data lake), where reports read it.

The first night, you copy **everything**. That's called the **initial full load**.

On the second night, copying everything again would be wasteful. The table might have 2 billion rows when only 50,000
are new. It would also get slower every month. So from night two on, you want to copy **only what's new or changed
since last time**. The docs call this an **incremental** (or **delta**) load.

### Three ways to do it, depending on the table

The question is always the same: *how can I tell which rows are new?* Microsoft's SAP white paper gives three answers,
and they hold for any source:

| If the table… | Then… | Example |
|---|---|---|
| **has a date/time column** that says when each row changed | Copy one **time window** at a time: "everything changed between 02:00 yesterday and 02:00 today" | an orders table with `LastModified` |
| **has a number that only goes up** (like an ID), or a last-modified time you trust | Keep a **bookmark** of the last value you copied, and copy only rows after it. This bookmark is the **watermark**. | a test-results table with an increasing `ResultID` |
| **is small** (a list of products, plants, currencies) | Don't be clever. **Copy the whole table and overwrite** it every time. | a 300-row list of machines |

This unit is about the middle one, the watermark, because it's the most common and the easiest to get wrong.

### The watermark, in plain English

A **watermark** is a **bookmark**. It remembers the last row you copied, so the next run starts right after it.

It lives in a tiny table of its own, the **control table** (or watermark table), with one row per source table:

| Source table | Last value copied |
|---|---|
| `lot_results` | 2026-09-23 02:00 |

Each night, the pipeline (the list of steps ADF runs) does four things **in this order**:

1. **Read the bookmark.** "Last time I stopped at 2026-09-23 02:00." This is the *old* watermark.
2. **Look at the source and note where it ends now.** "The newest row is 2026-09-24 01:58." This is the *new* watermark.
3. **Copy the rows in between.** In plain English: *give me every row changed after the old value, up to and
   including the new one.* In SQL that's
   `WHERE LastModified > '2026-09-23 02:00' AND LastModified <= '2026-09-24 01:58'`.
4. **Only if the copy succeeded, move the bookmark** to the new value.

Step 4's condition is the whole lesson. In ADF, every step has four exits: *on success*, *on failure*, *on completion*
(either way), and *on skip*. Microsoft's own incremental-copy tutorial connects "move the bookmark" to the copy's **Success**
output. (The "Delta copy from database" template has the same four activities, but its page doesn't say which exit the last
one is wired to, so check it when you import the template.) That way a failed copy leaves the bookmark where it was, and the next run simply tries the same rows again.

> **Analogy.** You're reading a book on a train. You move your bookmark *after* you've read the pages, not before.
> If you move it first and then fall asleep, tomorrow you'll skip the pages you never read.

### Two limits a Product Owner should know

- **A watermark can't see deletes.** If a row is deleted in the source, there's no "new" row to copy, so the cloud copy
  keeps it forever. If deletes matter (cancelled orders, for example), you need a method that tracks them: the
  database's **Change Tracking** or **Change Data Capture (CDC)**. Those are later units.
- **It trusts the date column completely.** If the application sometimes updates a row *without* updating
  `LastModified`, that change is never copied. Nobody gets an error.

---

## Part 2 · Check yourself

Answer before you read on. The answers are at the end.

1. A table has 800 million rows and a trustworthy `LastModified` column. Which of the three approaches fits?
2. A table lists the company's 40 warehouses and changes a few times a year. Which approach fits, and why not a
   watermark?
3. In step 4, the bookmark update is connected to the copy's "on completion" exit instead of "on success". The copy
   fails halfway. What happens to the bookmark, and what happens on the next run?
4. A customer is deleted in the source system. With a watermark load, what happens to that customer in the cloud copy?

---

## Part 3 · The case (fictional)

**Setting.** A semiconductor manufacturer is moving its reporting to Azure. A nightly ADF pipeline copies the
`lot_results` table, one row per finished wafer lot, from the factory's on-premises database into the data lake using
a watermark. The yield dashboard reads from the lake.

**What happened.**

- **Tuesday night.** The copy starts at 02:00. At about 60% through, the network link to the factory drops and the copy
  fails. The on-call engineer sees one red "Failed" run in the ADF monitor.
- **Wednesday night.** The pipeline runs again and shows **Succeeded**. The engineer closes the ticket: "Transient
  network issue, resolved by the next run."
- **Two weeks later.** Finance reconciles the monthly yield report against the factory system and finds **260 lots**
  missing from the cloud data. All of them were finished on Tuesday.

**The pipeline, as built:**

1. Lookup: read the old watermark
2. Lookup: read the new watermark from the source
3. Copy: rows between the two
4. Stored procedure: update the watermark (**connected to step 3's "on completion" exit**)

**Your task, as Product Owner.** You don't need to fix the pipeline yourself. Write down:

- **(a)** Why did Wednesday's successful run not bring back Tuesday's missing lots?
- **(b)** Why did nobody notice for two weeks?
- **(c)** Which **two questions** you'd ask the team tomorrow morning.
- **(d)** What you'd add to the **acceptance criteria** so this can't happen silently again.

Take ten minutes before reading the debrief.

---

## Part 4 · Debrief

**(a) Why the rerun didn't help.** "On completion" means *whether the copy succeeded or failed*. So when Tuesday's copy
failed at 60%, step 4 still ran and moved the bookmark to Tuesday's end point. On Wednesday, the pipeline read the
bookmark and started **after** Tuesday. The 40% of Tuesday's rows that never arrived were now *behind* the bookmark, and
no future run would ever look there again. The pipeline did exactly what it was told.

**(b) Why nobody noticed.**
- The only red signal was Tuesday's failed run, and Wednesday's green run looked like the fix.
- No step compared **how many rows the source had** with **how many arrived**. ADF's own "data consistency
  verification", for tables, checks row counts *within one copy*. It doesn't know about rows a previous run skipped.
- A monitoring gotcha: ADF keeps run history for only **45 days**. If Finance had found this in month three, the evidence
  of Tuesday's failure would already be gone, unless the logs were sent to Log Analytics.

**(c) Good questions for the team:**
- "What exit is the watermark update connected to: success, or completion?" (the root cause)
- "When a load fails and the next one succeeds, how do we *prove* nothing was skipped?" (the process gap)
- Also useful: "Can we rerun Tuesday's window on its own, and is the destination safe to load twice?"

**(d) Acceptance criteria that would have caught it.** For example:
- *The watermark moves only after a successful copy (on the success exit). This is verified by a test where the copy
  fails and the watermark is checked afterwards.*
- *After every load, the row count for the window in the source matches the count that landed. A mismatch fails the run
  and alerts the owner.*
- *Loading the same window twice doesn't create duplicates: the destination merges on the key or replaces the window.*
- *Run history is kept for at least 13 months* (longer than the 45-day default), for audit and reconciliation.

**The flip side: duplicates.** Suppose it's wired correctly, on success. Tuesday's copy fails, the bookmark stays put,
and Wednesday re-copies Tuesday's window. Nothing is lost. **But** if the destination simply *appends* rows, and
Tuesday's failed attempt had already written some before it died, those rows now arrive twice. The docs' answer is to
make the load safe to repeat: **merge** on the key (update if it exists, insert if not), or delete that window first and
then write it. So the full lesson is:

> **Missing rows** come from moving the bookmark too early.
> **Duplicate rows** come from a destination that isn't safe to load twice.
> A good design has neither, and a good PO asks about both.

---

## Part 5 · Say it

**The interview question:** *"How would you make sure a nightly incremental load doesn't lose or duplicate data?"*

**How to be honest about where this comes from.** If you haven't built this yourself, don't say you have. Say what you
know and how you'd run it. Interviewers for PO roles usually value the *questions you'd ask* and the *criteria you'd
set* more than hands-on configuration. And if you have a real story where data went missing, counts didn't match, or a
load had to be rerun, lead with it and use this unit's vocabulary to describe it.

**A structure that works (fill it in in your own words):**

1. **Name the pattern.** "For a large table with a reliable change date, I'd expect a watermark: a control table that
   records the last value loaded, so each run copies only what's newer."
2. **Name the two risks.** "The two ways it goes wrong are missing rows, if the watermark moves before the copy is
   confirmed, and duplicates, if a rerun writes into a destination that just appends."
3. **Say what you'd require.** "So in the acceptance criteria I'd want the watermark updated only on success, a
   source-vs-target row count on every run that fails loudly on a mismatch, and a merge on the business key so reruns
   are safe."
4. **Say what you'd watch.** "Operationally I'd want failed-run alerts, logs kept longer than ADF's 45 days, and a clear
   owner for reconciliation, because a failed run followed by a green one can hide a gap."
5. **Name the limit.** "And I'd check whether deletes matter. A watermark can't see them, so if they do, we'd need
   Change Tracking or CDC instead."

**Try it now:** close this page and answer the question out loud in under two minutes. Then compare against the five
points. Which did you miss?

---

## Answers to Part 2

1. **The watermark** (or a time window). A trustworthy date column on a huge table is exactly its use case. A full copy
   of 800 million rows every night is wasteful.
2. **Full copy and overwrite.** It's tiny, so copying all of it costs nothing. Overwriting also picks up deletes and
   changes that a watermark could miss.
3. "On completion" runs **even when the copy fails**, so the bookmark moves past rows that never arrived. The next run
   starts after them, and **those rows are never copied**. Nobody gets an error.
4. **Nothing happens. It stays in the cloud copy forever.** A watermark only finds new or changed rows; a delete leaves
   nothing behind to find. You'd need Change Tracking or CDC.

---

*Questions for you after trying this unit:*
- Was anything in Part 1 still unclear?
- Could you answer the interview question better than before?
- Did the case feel like something that happens on real projects?
