# Governance, privacy & compliance

**Course:** Agentic AI, from first principles to production · Module 10 Security and Governance · lesson 54 of 77 · **about 6 hours** · paper draft for review.  
**Success criterion:** Produce a governance checklist for taking one agent into a regulated company, with the points that need legal review clearly marked.

> Sources (read 2026-10-02 and 2026-10-03; details and gaps in docs/research/agentic-ai): European Commission, 'AI Act' regulatory framework page (digital-strategy.ec.europa.eu; last updated 2026-08-03: four risk categories; high-risk obligations; general-purpose AI model rules from 2025-08-02; the application timeline including the AI Omnibus amendments, adopted 2025-11-19 with political agreement 2026-05-07 and entry into force 2026-07-27, and the dates it gives for high-risk systems); Government of India, Press Information Bureau document 'DPDP Rules, 2025 Notified' (dated 2025-11-17: the Rules notified on 14 November 2025; the seven principles; key terms; penalties up to 250, 200 and 50 crore rupees; an eighteen-month phased compliance period; separate consent notices; breach notification; duties of Significant Data Fiduciaries; a 90-day response to rights requests; verifiable parental consent for children; the Data Protection Board; TDSAT appeals); Anthropic documentation 'Pricing' (read 2026-10-02: a US-only inference setting carries a 1.1 times price multiplier) and 'Agent Skills' (the page states Agent Skills is not covered by zero-data-retention arrangements); Microsoft Learn 'Agent evaluators' and agent-identity pages for logging; lessons 34, 47, 51 to 53. The MeitY page for the Rules returned an access error, so the Indian facts come from the PIB document; we read none of the statutes or the Rules' own text. The code on this page (the dataops folder) was written by us and run on Python 3.14.7 with Pydantic 2.13.4 and pytest 9.1.1; the folder's tests passed (58 in all, covering lessons 33 to 55). Permission names, policy values, owners and approvers in it are examples for the exercise, not recommendations for your organisation. THIS IS NOT LEGAL ADVICE. Dates and obligations change (the EU timeline was amended in 2026, and the page says so); every row marked LEGAL below needs a qualified lawyer's review before you rely on it. Unverified: the exact commencement dates of individual DPDP Rules (a secondary source gave 13 November 2025 for notification and 13 May 2027 for the end of the phase, which differ from or go beyond the PIB document, so check the Rules themselves); whether the AI Act or the DPDP Act applies to a given system; GDPR (not read in this course).

---

## Part 1 · Data classification and where an agent puts your data

Governance starts with knowing what data you have and how it is treated. A **classification** gives each kind of data a label that sets rules for access, storage, sharing and retention. A typical scheme (yours will differ):

| Class | Examples | Typical rule |
|---|---|---|
| Public | Published docs | No restriction |
| Internal | Runbooks, pipeline logs | Staff only; not sent outside without review |
| Confidential | Contracts, unpublished figures | Named groups; encrypted; logged access |
| Personal data | Names, emails, IDs, anything about an identifiable person | Purpose-limited, minimised, retention-limited, rights-respecting (see below) |
| Special or regulated | Health, financial, children's data, payment data | Stricter rules; often legal review before any AI use |

An agent creates **new places where data lands**, and a classification only helps if you trace them. Walk through one request and list every store it touches:

| Where | What lands there | Lesson | Typical control |
|---|---|---|---|
| The prompt and the model provider | Whatever you put in the request, including retrieved text and tool results | 12, 27 | Send the minimum; check the provider's retention and training terms; use a residency setting if you need one |
| Traces and logs | Steps, sizes, sometimes content | 47 | Store sizes and hashes by default; content opt-in, short retention, restricted readers |
| Checkpoints | Whole conversations and tool outputs | 33 | Same classification as the data; expiry; per-user access |
| Long-term memory | Preferences and facts about people | 34 | Scope, expiry, refuse personal and sensitive data, allow deletion |
| The vector index | Chunks of source documents, with their access labels | 27, 32 | Same access rules as the source; reindex on deletion |
| Audit log | Who did what, with arguments | 47, 53 | Long retention, restricted, append-only |

The practical rule: **data does not become less sensitive because it went into an AI system.** A confidential document in a chunk, a trace or a memory is still confidential, and deleting the source does not delete its copies unless you built that in.

**Worked example**

Fictional. A support agent's trace backend stores full tool results for debugging. A customer asks for their data to be erased. The source row is deleted, but copies remain in traces, checkpoints and the vector index. The fix was designed up front: traces store sizes and hashes, checkpoints expire in 7 days, and the index is rebuilt from the source nightly.

**Common mistake**

Classifying the database and forgetting the copies the agent makes. Draw the data flow and list every place a copy can land.

**Check yourself.** Name three places an agent system stores data other than the database it reads, and one control for each.

<details><summary>Model answer (write yours first)</summary>

Traces (store sizes and hashes, restrict content), checkpoints (expiry and access control), the vector index (same access rules as the source, rebuild on deletion); also memory, provider logs and the audit log.

</details>

---

## Part 2 · Regulation: what the sources say, and what needs a lawyer

**This section summarises what we read. It is not legal advice, and the rules change.** Each item is marked with where we got it.

**European Union: the AI Act** (European Commission page, last updated 2026-08-03). The Act sorts AI systems into four risk categories: **unacceptable risk** (nine banned practices, such as social scoring and certain biometric uses), **high risk** (systems with serious implications for health, safety or rights, with examples such as AI in hiring, education access or critical infrastructure), **transparency risk** (people must be told when they interact with AI, and synthetic content must be labelled) and **minimal risk** (most current applications, with no specific obligations). For high-risk systems the page lists risk assessment and mitigation, high-quality datasets, detailed documentation, human oversight, robustness and security, and activity logging for traceability. Providers of general-purpose AI models have had transparency and copyright obligations since 2 August 2025, with more for those posing systemic risk.

The **timeline** is the part to re-check often. The page gives: entered into force 1 August 2024; prohibited practices and AI literacy obligations from 2 February 2025; governance and general-purpose model rules from 2 August 2025; general applicability from 2 August 2026; and, after the **AI Omnibus** amendments (adopted 19 November 2025, political agreement 7 May 2026, in force 27 July 2026), **2 December 2027** for high-risk uses in sensitive areas (biometrics, education, employment, migration) and **2 August 2028** for high-risk systems embedded in regulated products. Those dates moved in 2026, which is the reason to read the Commission page the day you need it.

What this means for you: your DataOps agent, which diagnoses pipeline failures, is plausibly low risk. An agent that screens candidates or scores students is the kind of use the page lists as high risk. **LEGAL: classification of any real system.**

**India: the Digital Personal Data Protection (DPDP) Act, 2023 and the DPDP Rules, 2025** (PIB document dated 2025-11-17). The Rules were notified on 14 November 2025 and give an **eighteen-month period for phased compliance**. The Act rests on seven principles: consent and transparency, purpose limitation, data minimisation, accuracy, storage limitation, security safeguards and accountability. Key terms: the **Data Fiduciary** decides why and how personal data is processed, the **Data Principal** is the person the data is about (a parent or guardian for a child), a **Data Processor** acts on a fiduciary's behalf, and a **Consent Manager** is a platform through which a principal manages consent. The PIB document lists these obligations and rights:

- a separate, clear **consent notice** that states the specific purpose of collection and use;
- **breach notification** to affected individuals without delay, in plain language, saying what happened, the likely impact and what was done (and to the Board);
- a displayed **contact point** for questions (a designated officer or a Data Protection Officer);
- **Significant Data Fiduciaries** face stronger duties: independent audits, impact assessments, stricter checks on new or sensitive technologies, and in some cases directions on restricted data categories including local storage;
- individuals' rights to **access, correct, update and erase** their data and to nominate someone to act for them, with a response required **within ninety days**;
- **verifiable parental consent** for children's data, unless the processing is for essential services such as healthcare, education or real-time safety.

Penalties under the Act, per the document: up to **250 crore rupees** for failing to maintain reasonable security safeguards; up to **200 crore** each for failing to notify the Board and individuals of a breach and for violations of the children's obligations; up to **50 crore** for other violations. A Data Protection Board of India (four members, digital-first) oversees compliance, and appeals go to the Telecom Disputes Settlement and Appellate Tribunal (TDSAT). **LEGAL: whether your organisation is a fiduciary, processor or significant fiduciary; cross-border and residency questions; the exact commencement date of each Rule.**

**Worked example**

Fictional. An agent that drafts replies to customers uses personal data. Under the Indian principles above, the team needs a clear purpose and notice, minimisation (send the model only the fields it needs), a retention limit for traces and memory, a way to erase on request within 90 days, and a breach process, with every item reviewed by counsel for their situation.

**Common mistake**

Quoting a regulatory date from memory or from a blog. The EU's high-risk dates changed in 2026; read the authority's current page and write the date you read it.

**Check yourself.** Name the four EU AI Act risk categories, and say why you should re-read the timeline before relying on it.

<details><summary>Model answer (write yours first)</summary>

Unacceptable, high, transparency and minimal risk. The application dates, especially for high-risk systems, were amended by the AI Omnibus in 2026, so the current official page must be checked.

</details>

---

## Part 3 · Vendor risk, retention and residency

Your agent depends on other organisations' services, so their terms are part of your compliance. Questions to ask about any model, tool or platform vendor, with examples from pages we read:

| Question | Why it matters | Example from our reading |
|---|---|---|
| Is data **retained** or used for **training**, and for how long? | Prompts and tool results may contain personal or confidential data | Retention differs by feature: the Agent Skills page says that feature is not covered by zero-data-retention arrangements, so check each feature you use, not only the base API |
| Can we choose **where** processing happens? | Residency and sector rules | The pricing page says a US-only inference setting applies a 1.1 times price multiplier: residency is a product option with a cost |
| Who are the **sub-processors**? | You remain accountable for the chain | Ask for the list and change notices **(LEGAL)** |
| How are **incidents** notified, and how quickly? | Your own breach duty may start when you learn of it | Ask for the contractual notification time **(LEGAL)** |
| What **security evidence** exists (audits, certifications)? | You need to show you checked | Request and file it; do not rely on the marketing page |
| Can we **audit** or get logs? | Accountability and investigation | Check what the platform logs under the agent's identity (lesson 53) |
| What is the **exit** plan? | Lock-in and continuity | Where our data and prompts live, how to export, how long deletion takes |

Build a vendor review into delivery, as in the (fictional) Northwind rule that any vendor processing customer data needs a security review of about ten working days before a contract is signed: it is a program-management item with a lead time, not a last-minute task. And design for **change**: a vendor can add a feature, change its default retention or move a price, so record the date and the version of each term you relied on, and re-check on a schedule.

**Worked example**

Fictional. A team adopts a model feature that stores conversation state on the vendor's side. The vendor's page says that feature has different retention terms from the base API. The review finds the difference before launch, and the team either avoids the feature, or documents the retention and tells users.

**Common mistake**

Reviewing the vendor once, at purchase. Terms and features change; schedule a re-review and subscribe to change notices.

**Check yourself.** Why is 'the API does not retain data' not enough to approve every feature of a vendor?

<details><summary>Model answer (write yours first)</summary>

Retention terms can differ by feature (for example, a feature may be outside the zero-data-retention arrangement), so each feature you use must be checked.

</details>

---

## Part 4 · The governance checklist, with the legal points marked

Your deliverable is a checklist for taking **one agent** into a **regulated company**, with the points that need legal review clearly marked. Use this as a starting skeleton and mark **LEGAL** where a lawyer must decide. Fill every row for your agent.

| # | Area | Question or evidence | Owner | LEGAL? |
|---|---|---|---|---|
| 1 | Purpose | What does the agent do, for whom, and what decisions does it influence? | Product | |
| 2 | Risk class | Which regulatory category (for example under the EU AI Act) could apply? Is it used for hiring, credit, education, health or biometrics? | Compliance | **LEGAL** |
| 3 | Data inventory | Which data classes does it touch? Where do copies land (prompts, traces, checkpoints, memory, index, audit)? | Data owner | |
| 4 | Lawful basis and notice | Is personal data processed? What is the basis, the purpose, the notice to the person? | Privacy | **LEGAL** |
| 5 | Minimisation | Is only the data needed sent to the model? Is anything masked first? | Engineering | |
| 6 | Retention | Retention for each store, and how deletion reaches copies | Data owner | **LEGAL** (periods) |
| 7 | Rights requests | Can access, correction and erasure be done across all stores within the legal time (for example 90 days under the Indian Rules)? | Privacy | **LEGAL** |
| 8 | Children and special data | Is any child's, health, financial or other special data possible? What is the consent route? | Privacy | **LEGAL** |
| 9 | Cross-border and residency | Where is data processed and stored? Any localisation rule? | Architecture | **LEGAL** |
| 10 | Vendors | Retention and training terms per feature, sub-processors, incident notice, audit rights, exit | Procurement | **LEGAL** (contract) |
| 11 | Security | Identity, least privilege, secrets, revocation (lesson 51); injection defences (48) | Security | |
| 12 | Human oversight | Which actions need approval, by whom, with what evidence (lessons 53, 55) | Product | |
| 13 | Accuracy and evaluation | Evaluation set, results, known failure modes, monitoring (lessons 46, 47) | Engineering | |
| 14 | Transparency | Do users know they are dealing with AI? Is generated content labelled where required? | Product | **LEGAL** |
| 15 | Logging and audit | What is logged, retention, who can read, tamper-evidence | Security | **LEGAL** (periods) |
| 16 | Breach response | Who decides it is a breach, who is told, in what time, using what template | Security and Legal | **LEGAL** |
| 17 | Documentation | What a regulator or auditor could ask for: design, data flows, evaluation, approvals, 4D review | Program | |
| 18 | Change control | How a new model, tool or prompt is reviewed and re-evaluated before release | Engineering | |
| 19 | Sign-off | Named executive owner, and the date and version of each source relied on | Program | |

**Rows marked LEGAL are decisions for a qualified lawyer, not for the product or engineering team.** The checklist's value is that the lawyer sees a precise list of questions with the facts attached, instead of 'is this AI thing OK?'. Attach to row 2 the date you read the regulator's page, and to row 7 the retrieval path you built in lessons 27 to 34, so the answer 'can we erase this?' is a demonstration, not a promise.

**Worked example**

Fictional. For the DataOps agent: row 2 'internal operational data only, no personal data in normal operation, plausibly minimal risk; counsel to confirm'. Row 3: copies in traces (sizes only), checkpoints (7 days), index (rebuilt nightly), audit log (7 years). Row 6 LEGAL: counsel to confirm the audit retention period. Row 12: writes need a named approver (lesson 53).

**Common mistake**

Filling the legal rows with your own conclusions. Write the facts and the question, and let counsel answer.

**Check yourself.** Why mark rows LEGAL instead of answering them yourself, and what should you attach to help the reviewer?

<details><summary>Model answer (write yours first)</summary>

Whether a rule applies, which category a system falls into and what retention period is lawful are legal judgements. Attach the facts: the data flow, the sources read with their dates, and demonstrations such as a working erase path.

</details>

---

## Do it: lab

1. Pick one agent (yours, or the DataOps agent) and draw its data flow: every place a copy of data can land, from the prompt to the audit log. Classify each store.
2. Fill in the 19-row governance checklist for taking it into a regulated company (name one: a bank, an insurer, a hospital group). Mark every row that needs legal review with LEGAL and write the question and the facts you would give the lawyer.
3. Read the current official page for each regulation you cite (for example the European Commission's AI Act page and the Indian DPDP Rules or their official summary). Record the URL and the date you read it next to each date and obligation you quote.
4. Do a vendor review for the model provider and one platform you use: retention, training use, sub-processors, residency, incident notice, audit logs, exit. Note what you could not verify.
5. Show one demonstration that supports a row: for example an erase request that removes a person's data from the index and memory, or a trace with content capture off.

**Done when:** you have a checklist for taking one agent into a regulated company with every row filled, the legal-review points clearly marked and each cited date traced to an official page and the date you read it, plus one demonstration backing a row.

---

## Interview check

**Question.** What would you check before putting an AI agent into a regulated company?

<details><summary>A strong answer has this shape</summary>

1. What it does and which risk class it might fall into; anything touching hiring, credit, health, education or biometrics gets legal review first.
2. A data inventory: which data it touches and every place a copy lands (prompts, traces, checkpoints, memory, index, audit log), with classification, minimisation, retention and a working path for access and erasure requests.
3. Vendor terms per feature: retention, training use, residency, sub-processors, incident notification, audit rights and exit.
4. Security and oversight: least-privilege identity, injection defences, approval gates with named approvers, and logging.
5. Evidence a regulator could ask for: design, data flows, evaluation results, approvals, change control. And a clear list of the questions that need a lawyer, each with the facts attached, plus the date I read each regulation because the dates change.

</details>

---

## Evidence to keep

Keep the data-flow diagram, the filled checklist with legal rows marked, the dated source list, the vendor review and the demonstration.

---
