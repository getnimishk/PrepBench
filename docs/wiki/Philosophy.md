# Philosophy

PrepBench is a preparation *instrument*, not a preparation *platform*. An instrument tells you something true about where you stand and then gets out of the way. A platform asks you to operate it.

Most of the design decisions recorded across this wiki follow from that one distinction. So do most of the arguments still open.

## The thesis

> PrepBench should feel like a quiet personal coach that already understands your preparation, gets you into the right exercise quickly, and gets out of the way while you learn.

Both halves are load-bearing, and they pull against each other.

**"Already understands"** is why the machinery underneath is as careful as it is — evidence-bound readiness, the mock/drill split, hint-aware scoring, the typed coupling ledger in the Chart Sandbox, roadmap state reconciliation. None of that is decoration. It is what makes the product's statements defensible.

**"Gets out of the way"** is why almost none of that machinery should appear on screen.

When a decision in this codebase looks strange, it is usually one of those two halves winning an argument against the other.

## What the product is for

The [Readiness](Readiness) page opens by saying PrepBench exists to answer one question — *would you pass?* — and that everything else is evidence feeding it.

That was true when there was one subject and one format. It is now too narrow.

System design attempts, design reviews and interview recordings are not weaker evidence toward certification readiness. They are **first-class outcomes with no certification behind them at all**, which is exactly why `skill` subjects exist and can never reach `ready`. A product whose single output is exam readiness quietly becomes certification-first, and two of the three built-in subjects are not certifications.

The honest current statement is that PrepBench has **several outcomes and one mature one**:

| Outcome | Maturity |
|---|---|
| Certification readiness | Modelled end to end in `readiness.py`, with states, thresholds and evidence |
| System design capability | Attempts and grading exist; no rolled-up outcome |
| Interview performance | Recording and analysis exist; no rolled-up outcome |
| Learning progress | Roadmap state and the Chart Sandbox concept graph; no rolled-up outcome |

> [!NOTE]
> This is a known gap, not a settled design. Readiness is currently written as though it were the product's single output. Treat it as the first outcome to be modelled properly, rather than the only one that matters.

## The rules

Four of these are stated on the wiki [Home](Home) page. They are repeated here with the reasoning, because the reasoning is the part that generalises to the next decision.

### 1. Never fabricate a number

If a score cannot be computed, the UI says so. Grading with no provider configured returns *"Not Graded"*, not `0%`. A percentage with no denominator renders as an em dash.

An invented grade is worse than a missing one, because **the learner cannot tell the difference**. A missing number prompts a question. A wrong number ends the enquiry.

### 2. Never claim more than the evidence supports

Readiness is computed from full mocks alone. A drill is not a weaker measurement of whether you would pass — it is not a measurement of it. Zero mocks is *"needs evaluation"*, not zero per cent. A subject with no pass mark can never be *"ready"*, because there is nothing to be ready against.

The cost asymmetry is the whole argument: an encouraging app that leads to a failed exam costs the fee and the confidence. It is worse than no app.

### 3. Never present a modelling choice as a fact

In the Chart Sandbox this is enforced structurally: every relationship between models is typed `arithmetic | assumption | convention`, and assumptions render on-chart as assumptions.

*"High WIP raises defect injection"* stated as fact is a claim you cannot defend when someone asks for the evidence.

### 4. The machine boundary is real

No telemetry, no analytics SDK, no account system. The only outbound path is a cloud AI provider you configure yourself, and PrepBench will not download or launch a model on your behalf.

> [!IMPORTANT]
> The accurate promise is **local-first**, not *"100% offline"*. The product ships an optional cloud provider path, and the settings screen helps you configure it. A permanent offline badge over a product that can call an API is a trust problem, not a copy problem.

### 5. State, not instructions

`GET /api/v1/home` returns state and deliberately nothing more. There is no `suggested` or `next_actions` field, and `test_home.py` pins the response shape so one cannot be added by accident. A ranked list of things to do was put to the user and rejected as nagging.

The refinement worth holding on to: **guidance and task management are not the same thing.**

> *"Review the 6 unreviewed misses from your last mock — your latest score is already near the pass line."*

is a different object from

> *"You have 8 things to do. Complete your daily goal!"*

The first is one evidence-backed sentence a person can disagree with. The second is a backlog with a guilt mechanic. Rule 5 forbids the second. Whether it should also forbid the first is an open question — see [Product Review](Product-Review).

### 6. Absence must be honest in both directions

Newer than the others, and added after the [September 2026 review](Product-Review).

Rules 1 and 2 protect against **over-claiming**: never invent a score, never declare readiness the evidence does not support. They say nothing about the opposite failure — refusing to recognise evidence that genuinely exists.

Both are dishonest. A product that reports *"needs evaluation"* to someone who has just sat six full 80-question papers and cleared the pass mark twice is not being careful. It is being wrong, modestly.

> [!IMPORTANT]
> "Never invent" and "never miss" are separate disciplines.

Both are now implemented. `reconcile_evidence.py` recognises papers that were sat at full length, timed, against a subject's own exam profile, before the app was able to record what kind of session they were — `session_kind` arrived as `ALTER TABLE … DEFAULT 'drill'`, so "drill" on a historical row was a schema default rather than anything the learner said. The criteria are structural and strict, and a session that fails any of them stays a drill.

It claims the shape and nothing more. What it cannot prove is motive: an 80-question, 60-minute, PSM I-filtered paper is both exactly the real exam and exactly what the old app handed you if you changed nothing. So the rule is stated on Insights where the count is claimed, and every recognised session stays listed and dated under Review, where it can be disagreed with.

## What PrepBench refuses to be

Stated once, so the answer is short when the question comes up.

| Not this | Because |
|---|---|
| A streak or gamification system | It optimises for opening the app, not for passing the exam |
| A nagging task list | See rule 5 |
| An account-based service | See rule 4 |
| A content operations product | Import, audit and refine are infrastructure. They are not why anyone opens PrepBench |
| A configurable AI platform | Provider, task binding and capability are implementation vocabulary. AI is a capability of PrepBench, not a subsystem the learner administers |
| Encouraging | See rule 2. It is meant to be accurate, which is sometimes discouraging and always more useful |

## The direction

**Quiet surface. Deep system.**

The standing design direction, and now realised in the UI. Its practical consequences:

- **Hierarchical inconsistency is correct.** Practice should be minimal and immersive; learning editorial and calm; analytics dense and factual; settings functional; content management operational. Applying one visual grammar to all five makes everything feel equally important, which means nothing does.
- **A metric without a corresponding action is secondary.** Metrics should answer *what changed*, not *what can we display*.
- **Defaults come from the system, not the learner.** Prefer `Start a mock` with an `Adjust` affordance over seven controls presented at equal weight.
- **Do not promote a concept to the UI merely because the system contains it.** A provider capability need not become a chip; a learning state need not become a badge; a format need not become a navigation item.

That last one is the general form of the failure the September review diagnosed, and it is the most useful sentence on this page.

## Where the philosophy is under tension

Recorded rather than resolved. A philosophy page that lists only settled principles is marketing.

| Tension | Status |
|---|---|
| Honest absence (rule 2) vs. the false negative it produced (rule 6) | **Resolved.** Readiness reads the six recognised papers and reports `almost_there`. Both disciplines are implemented and tested |
| State, not instructions (rule 5) vs. *"what should I do now?"* | **Settled.** Home offers exactly one continuation, always naming the evidence it came from. One claim a person can disagree with is not a ranked backlog with a completion percentage, and the difference is not subtle |
| Readiness as the single output vs. four first-class outcomes | **Settled.** Readiness is the headline; the other three formats appear under *Other preparation*, counted from real rows, and a format with nothing behind it is omitted rather than shown as zero |
| Subject as the conceptual anchor vs. format-centric data underneath | **Partly resolved.** Coverage now reports only what a subject actually owns. Design reviews still map to subjects through a hardcoded slug dictionary, kept deliberately: generalising an abstraction with one populated member is the error this page warns about two rows above |
| Surface built ahead of usage | **Addressed.** Two correction passes deleted three pages, four navigation groups, six dead settings columns and every metric that had no action behind it. See [Product Review](Product-Review) |
| Recognising evidence (rule 6) vs. inferring intent | **Live, and deliberate.** The reconciliation reads a session's shape, never a motive. It is the one place the product interprets rather than reports, which is why the rule is stated in the UI rather than only in the code |

## See also

- [Product Review](Product-Review) — the September 2026 review that produced rule 6, tested against the database
- [Readiness](Readiness) — where rules 1, 2 and 5 are implemented
- [Chart Sandbox](Chart-Sandbox) — where rule 3 is enforced structurally
- [AI Providers](AI-Providers) — where rule 4 is drawn
