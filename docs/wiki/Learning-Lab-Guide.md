# How to use the Learning Lab

This page is for you as a learner: what you are doing in each lab, which controls to use, and how to get the most out of it. If you want to know how the labs are built, see [Learning Lab](Learning-Lab) instead.

There are no answers on this page. Each lab works only if you make your own prediction first.

## The idea in one minute

A lab never starts with an explanation. It starts with a **situation and a question**: *"this happens, what do you think follows?"* You commit an answer. Then you change things and watch what a model actually does. Only then do you explain it, in your own words.

You learn most from the predictions you get **wrong**, so predict honestly rather than guessing what the lab wants. A wrong prediction costs nothing, and you can always start a challenge again later.

Three things are true in every lab:
- **You can't change a prediction once it is committed.** That is deliberate: it is what makes the comparison honest.
- **Nothing here touches a real system.** Every result comes from a simulation over a fictional company, and says so. The one exception is Lakehouse Stations C and D, which run real operations on small Delta tables on your own computer.
- **Your writing is never scored.** Explanations, acceptance criteria and rationales are kept with your attempt as evidence. The AI feedback button gives advice, never a grade.

## Before you start: pick the right preparation

Labs save your work under the preparation chosen in the header picker at the top of the screen.

| Lab | Preparation to choose | Why |
|---|---|---|
| **Agile Metrics** | Any, or none | It works on its own |
| **ADF Behaviour Lab** | A *skill* preparation with the **ADF study guide** attached | The experiments are part of that guide |
| **Lakehouse Lab** | The **Databricks** preparation | The lab keeps its work there |

To attach the ADF study guide:
1. Go to **Preparations** and open your skill preparation's **Edit** page.
2. Choose **Attach** next to the guide.

Without a Databricks preparation, the Lakehouse Lab still runs, but it can't save interview questions; it tells you so.

## The loop you will see on every screen

| Step | What you do | What to watch for |
|---|---|---|
| **1 · Predict** | Read the question, pick one answer, press **Commit prediction** | The button becomes **Prediction committed**. Your answer is now fixed |
| **2 · Manipulate** | Change the settings (the "levers") and run the model again | Change **one lever at a time**, so you know what caused the difference. **Use this challenge's scenario** puts everything back where the question started |
| **3 · Observe** | Read what the model produced | Results carry a **Simulation** label, and figures say when they are **teaching constants** (chosen to make an effect visible, not measured). Compare the outcome with your prediction |
| **4 · Explain** | Write it down in your own words | Most stations ask for **acceptance criteria** (see below). **Save** keeps them with your attempt |

### Writing good acceptance criteria

The placeholder text shows the shape: *Given … when … then …*.
- **Check structure** checks the shape only, never whether you are right. It runs four checks:
  1. **Given / When / Then**, in that order;
  2. **a number to test against**, such as a tolerance, a row count or a percentage;
  3. **what happens on failure**: roll back, stop, block or escalate;
  4. **who signs it off**. For a data domain, that is the business data owner, not only engineering QA.

  Aim for all four.
- **Get AI feedback** works only if you have set up an AI provider in **Settings → AI providers**. It sends your criteria to that provider and shows a few points of advice. Without a provider it says **Not Graded**, and why. It never changes whether your prediction counted as right.

### After you finish a challenge

- **Save as interview question** (Lakehouse Lab) turns what you observed into a practice question for the interview studio. Its talking points are your own results. Edit them into your own words, then rehearse the question aloud under **Interview practice**.
- **Evidence** (in the sidebar) shows what your work demonstrates:

| Level | When you reach it |
|---|---|
| **Activity** | You started |
| **Completed** | You finished |
| **Demonstrated** | Your prediction matched the model |
| **Evidenced** | It matched, *and* you wrote your explanation |

So to reach the top level, always write the explanation.

---

## Agile Metrics (`/chart-sandbox`)

**What you are doing:** learning to *read and explain* delivery charts by causing their shapes yourself. There are 27 charts, all driven by one model of a team's sprints. Change work-in-progress or batch size, and cycle time, defects and deployment risk move together.

**How to work through it:**
1. Follow the **guided track**: *Recognise → Commit → Act → Compare → Explain → Generalise*. Each challenge sets up a scenario and asks what a chart will show. Commit, then compare.
2. If a term is new, open the note under the question: **New to this? What the sandbox is showing**.
3. **Nothing is locked.** If you already know a concept, such as Little's Law, skip ahead.
4. Some challenges come in **pairs**: the same symptom with a different cause. Those are the ones that teach you to reason rather than recognise a shape.
5. Every link between charts is labelled **arithmetic** (follows from definitions), **assumption** (a claim the sandbox makes) or **convention**. When you explain a chart to someone, that tells you which parts you can defend as fact.

---

## ADF Behaviour Lab (`/lab/adf`)

**What you are doing:** five experiments on how Azure Data Factory pipelines behave when things go wrong. Each one is a teaching simulation, not Azure.

### The eight stages, in order

The next stage opens when you finish the one before.

| Stage | What you do |
|---|---|
| **1 · Understand** | Read the situation. Each experiment links the ADF guide chapters it comes from |
| **2 · Predict** | Commit your answer |
| **3 · Manipulate** | Change the levers and run the model |
| **4 · Observe** | See what happened, against your prediction |
| **5 · Reason** | Pick the cause, then **Submit your diagnosis** |
| **6 · Apply** | Pick the change that fixes it, then **Submit your change** |
| **7 · Explain** | Write it in your own words |
| **8 · Retrieve** | Answer a question from memory, then **Check your answer**. It is checked against a quote from the ADF guide |

A finished run stays as it is. To practise again, press **Start a new run**: you get a fresh run, and the old one stays in your Evidence.

### The five experiments and their levers

| Experiment | It is about | Levers you can change |
|---|---|---|
| **Watermark & Transient Failure** | Loading only new data, and recovering when a copy fails | When the watermark is stored · Sink · Retries after the failure · Where the copy fails |
| **Trigger Behaviour** | When pipelines run, and what late or out-of-order files do | Trigger · One file lands after the run · Two files land in the wrong order · Sink |
| **Concurrency Budget** | How runs, ForEach batches and parallel copies add up to load on a source | Pipeline concurrency · ForEach batch count · Parallel copies per copy · Connections the source accepts |
| **Copy Performance** | What actually limits a copy's speed | DIUs · Parallel copies · Source read limit |
| **Fault Tolerance** | Two modes: failing dependencies, and bad rows | Error handling around the copy · What goes wrong · Retries · When a row can't be written · Data consistency verification |

**Tip:** in Concurrency Budget, change one lever at a time and watch **connections at peak** against the source's limit. Every other result follows from that number.

---

## Lakehouse Lab (`/databricks-sandbox`)

**What you are doing:** helping a fictional semiconductor manufacturer move from Hadoop to Databricks. You work at two levels:
- **Programme:** planning the migration, identity and access;
- **Pipeline:** the data actually moving.

### The top of the page

- **The engine badge.** **Real engine** means Stations C and D run real Delta operations on this computer. **Real engine not installed** means those two stations show nothing rather than fake a result. The other stations always work.
- **Scenario.** Choose between the full migration (all six stations) and a smaller data-only pack (Station C only).
- **Journal (n).** A timeline of what you ran and predicted. **Export .md** saves it as notes.

### A good order to work in

| Order | Station | Why here |
|---|---|---|
| 1 | **F · Migration Factory** | The big picture first: why the details matter |
| 2 | **I · Identity and governance** | Who can still sign in after cutover, and who can see which rows |
| 3 | **A · ADF + Lakeflow** | How a batch moves |
| 4 | **B · ADLS** | Where it lands, and who can touch it |
| 5 | **C · Delta Lake** | What really happens to it, on the real engine |
| 6 | **D · Reconciliation Detective** | Proving the migrated data is right |

### F · Migration Factory: plan the waves

- **The question:** tier a sample of jobs, from Tier 1 (converts almost automatically) to Tier 3 (where the engineering hours go), from what you can see of each.
- **Levers:**
  - the tier of each job;
  - the **order of the waves** (move a domain earlier or later);
  - the **cluster policy** for scheduled jobs (job clusters or all-purpose);
  - a **contingency buffer** on each plan;
  - whether a **consumer map** is built for the yield waves.
- **Run plan** shows two plans side by side: one planned by job count, one weighted by complexity. Each shows the month it promised and the month it really ended, plus the cost and the decommission date.
- **Watch for:** the gap between *promised* and *ended*. That gap is the lesson.
- **Compare in Station C** sends a wave's data to Station C, to check the numbers really match.

### I · Identity and governance: two puzzles

Switch between the puzzles at the top of the station.

- **Identity at cutover.** Four workloads must keep authenticating to Databricks after the move off Kerberos. Predict whose cutover plan can't. Then use **Plan for svc-tool-feed** to try other plans and see who issues each token. **Back to the cutover plan** resets it. Finally, write the acceptance criteria for signing off the new identity.
- **A Ranger policy, redesigned.** The old Ranger row filter and mask are shown. Predict which of four Unity Catalog redesigns keeps the policy's *purpose*. Then apply each candidate and compare what each test user sees against the old policy: **Same** or **Differs**. Write why your choice keeps the purpose, and press **Save rationale**.
- **What this puzzle rests on:** every fact Station I uses, each with a link to the official page it comes from, plus every assumption the simulation makes. Read the links as you go; they are part of the lesson.

### A · ADF + Lakeflow: a batch's journey

- **The question:** what the destination holds when the watermark moves before a copy that then fails part-way.
- **Levers:**
  - the trigger and the load;
  - **when the watermark is updated**;
  - the destination;
  - injecting a failure (and how far into the copy);
  - retries;
  - a late file, files out of order, and rows deleted at the source.
- **Run pipeline** shows the pipeline run and the **batch manifest**: rows expected, missed, written twice, and deleted rows left behind.
- **Load in Station C** takes your batch to Station C, to see what the real engine makes of it.

### B · ADLS: landing and access

- **The question:** whether a vendor given access to one folder can actually write there.
- **Levers:**
  - the hierarchical namespace;
  - the landing layout (copied from HDFS, or redesigned for object storage);
  - **directory ACL or RBAC**;
  - read, write and execute on the folder and on the folders above it;
  - the storage tier, and a lifecycle rule.
- **Test access** shows **Allowed**, **Denied** or **Allowed, too broad**, and which folders the vendor can write to. Changing a setting marks the result as out of date until you test again.
- **Also watch:** the layout figures (objects and requests a day, and how many operations a rename takes) and the relative cost of hot and cool storage.

### C · Delta Lake: the load that went wrong (real engine)

- **Five guided challenges:**
  - a batch with a new column;
  - a batch delivered twice;
  - vacuum with no retention;
  - whether the migrated table matches the legacy one;
  - loading Station A's batch.
- Pick a **Challenge**, commit your prediction, then press **Use this challenge's operation** and **Run on engine**.
- **Free operations to explore once you've predicted:**
  - create table;
  - append batch;
  - merge the change batch (CDC);
  - table history;
  - read an older version (time travel);
  - restore to a version;
  - compact small files;
  - vacuum;
  - compare two tables.
- **Reset lab tables** puts the tables back to the start.
- **Export** downloads a notebook of what you did, marked *Unverified* until someone has run it on Databricks Free Edition.

### D · Reconciliation Detective: find the planted defects (real engine)

- **The setup:** the legacy and migrated totals disagree. The pack has planted a set of defects, and your score is **defects found out of those planted**.
- **How a find works:**
  1. Run operations with **Run on the engine** to look for differences.
  2. Pick the **Result to cite** that shows a defect.
  3. Name the **Defect**, then press **Claim this defect**.
- **A claim counts only if the result you cite really shows that defect.** Guessing doesn't count, and isn't recorded.
- **Save explanation** under each found defect.
- **The lesson:** matching row counts don't mean the data is right.

---

## Getting the most out of the labs

1. **Predict before you read anything else.** The learning is in the gap between your prediction and the result.
2. **Change one lever at a time.** If two things change, you won't know which one did it.
3. **Write the explanation every time.** It's what turns a right answer into **Evidenced**, and it's the part you'll use in an interview.
4. **Turn results into interview practice.** Use **Save as interview question**, rewrite the talking points in your own words, then rehearse aloud.
5. **Follow the links.** ADF experiments link their guide chapters, and Station I links its sources.
6. **Come back later.** Starting a run again a week later, and answering from memory, is what makes it stick.

## When something looks wrong

| You see | It means |
|---|---|
| **Real engine not installed** | Stations C and D need the optional engine. See the [Development Guide](Development-Guide) to install it. Every other station still works |
| You can't change your prediction | That is by design. Start a new run (ADF) or keep exploring with the levers |
| Results say **Commit your prediction to see what the model finds** | Station I keeps results hidden until you commit, so they can't give the answer away |
| **No observations recorded yet** on the interview-question panel | Finish the challenge first; the talking points come from your results |
| **Interview questions from the lab are saved under the Databricks preparation…** | Create or choose the Databricks preparation to save questions |
| **Not Graded** on AI feedback | No AI provider is set up for that task. The labs work fully without one |
| The ADF lab says it isn't available | The chosen preparation doesn't have the ADF study guide attached. Attach it on the preparation's **Edit** page |
