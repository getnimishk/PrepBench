# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The built-in design reviews.

Each one is built around a single deciding axis, and the two options are
written so that a competent engineer would propose either. That property is
the whole feature: the moment option B is obviously wrong the exercise becomes
a quiz, and a quiz stops teaching after the second one.

Vocabulary is introduced inside the options rather than defined anywhere,
because a term attached to a decision it changed is remembered and a glossary
entry is not.

Reconciled through app/utils/seed_ledger.py, so a review added by a later
version reaches an install that has already been seeded, and one deleted by
hand stays deleted.
"""
from sqlalchemy.orm import Session

from app.models.design_review import DesignReview
from app.repositories.design_review_repository import DesignReviewRepository
from app.schemas.design_review import DesignReviewCreate
from app.utils.seed_ledger import seed_missing_content

SEED_NAMESPACE = "design_review"


SEED_DESIGN_REVIEWS = [
    # ---------------------------------------------------------------- 1
    {
        "title": "One profile, two clocks",
        "axis_label": "Freshness",
        "domain": "data_platform",
        "difficulty": "medium",
        "brief": (
            "A retailer with 50M customers wants one customer profile: name, address, "
            "lifetime value, last 10 orders, risk score. Marketing runs campaigns off it "
            "every morning. The fraud team needs the same profile within seconds of a card "
            "transaction. Twelve source systems feed it, and three of them backdate "
            "corrections by up to a week."
        ),
        "deciding_axis": (
            "Different consumers have different freshness requirements, and applying the "
            "strictest one to everything is what you pay for."
        ),
        "reveal": (
            "Most people pick A, because streaming sounds modern and one pipeline sounds "
            "clean. A is often 10-20x the compute cost, since you run always-on "
            "infrastructure so that a once-a-day reader can have seconds-fresh data.\n\n"
            "But B is not free either. The duplicated profile logic is exactly where "
            "correctness bugs live, and the day fraud sees a different lifetime value than "
            "marketing, you own that. The strongest answer names the tension and says which "
            "risk it would rather carry -- money or drift."
        ),
        "elicit_answer": (
            "What is fraud's actual latency budget, and how many fields do they need? At "
            "five minutes rather than five seconds, B's streaming path becomes a micro-batch "
            "and gets dramatically cheaper. At four fields rather than the whole profile, the "
            "duplication that makes B risky nearly disappears."
        ),
        "concepts": ["Structured Streaming", "Trigger interval", "Freshness tier", "Delta table", "Always-on compute"],
        "options": [
            {
                "label": "A",
                "name": "One streaming pipeline",
                "summary": (
                    "Everything flows through Structured Streaming into a single Delta table "
                    "on a 5-second trigger interval. Marketing and fraud read the same table."
                ),
                "flow": [
                    {"label": "12 sources", "detail": "all systems"},
                    {"label": "Structured Streaming", "detail": "always-on, 5s trigger", "emphasis": True},
                    {"label": "Delta: customer_profile"},
                    {"label": "Marketing + Fraud", "detail": "same table"},
                ],
                "key_choices": [
                    "Single pipeline, single source of truth",
                    "Always-on compute sized for peak",
                    "Both consumers read the same Delta table",
                ],
                "holds_when": "Fraud's latency need is real and the event volume genuinely justifies always-on compute.",
                "breaks_when": "You are paying for seconds-fresh data that almost every consumer reads once a day.",
                "rough_cost": (
                    "Roughly 10-20x option B's compute -- assuming batch would finish in "
                    "well under an hour at this volume. That assumption is the whole "
                    "multiplier; at much higher volume the gap narrows."
                ),
            },
            {
                "label": "B",
                "name": "Nightly batch, thin real-time path",
                "summary": (
                    "A nightly batch builds the full profile. A separate small streaming job "
                    "maintains only the four fields fraud actually needs."
                ),
                "flow": [
                    {"label": "12 sources"},
                    {"label": "Nightly batch", "detail": "full profile"},
                    {"label": "Delta: profile_full", "detail": "Marketing, daily"},
                    {"label": "+ separate 4-field stream", "detail": "Fraud, seconds - logic lives twice", "emphasis": True},
                ],
                "key_choices": [
                    "Two pipelines, two freshness tiers",
                    "Fraud path carries 4 fields, not the whole profile",
                    "Profile logic exists in two places",
                ],
                "holds_when": "The fast consumer needs a narrow slice rather than the whole profile.",
                "breaks_when": "The two paths drift and fraud sees a different lifetime value than marketing.",
                "rough_cost": (
                    "Batch compute plus one small always-on job. The real cost here is not "
                    "money, it is the correctness risk in maintaining the same logic twice."
                ),
            },
        ],
    },

    # ---------------------------------------------------------------- 2
    {
        "title": "The warehouse that sleeps",
        "axis_label": "Cost",
        "domain": "data_platform",
        "difficulty": "medium",
        "brief": (
            "A BI dashboard used by about 200 analysts queries a 4TB fact table. Load is "
            "spiky: heavy between 9 and 11am, moderate until 4pm, near zero overnight and at "
            "weekends. Finance has asked for a predictable monthly bill."
        ),
        "deciding_axis": (
            "Duty cycle -- what fraction of each paid hour is actually spent computing. Not "
            "which option is cheaper in the abstract."
        ),
        "reveal": (
            "\"Serverless, it scales to zero\" is the reflex answer, and it is wrong at high "
            "utilisation: per-second serverless rates run meaningfully above provisioned, so "
            "a warehouse that is busy six hours a day can cost more on serverless than on a "
            "cluster you simply leave running.\n\n"
            "The number that decides this is query-hours per day, and neither option is right "
            "until you know it. Note also that finance asked for *predictable*, which is not "
            "the same request as *cheapest* -- serverless is variable by construction."
        ),
        "elicit_answer": (
            "What are the actual query-hours per day, and does finance want the lowest bill "
            "or a forecastable one? Those are different questions with different winners. "
            "Worth also asking whether the 9-11am peak is concurrent users or one heavy job."
        ),
        "concepts": ["Serverless SQL warehouse", "Provisioned compute", "Auto-stop", "Cold start", "Duty cycle"],
        "options": [
            {
                "label": "A",
                "name": "Serverless SQL warehouse",
                "summary": (
                    "Starts in seconds, scales to zero when idle, billed per second of query "
                    "time. No cluster to size and no idle spend."
                ),
                "flow": [
                    {"label": "Analyst query"},
                    {"label": "Serverless warehouse", "detail": "scales to zero", "emphasis": True},
                    {"label": "Delta: fact table"},
                ],
                "key_choices": [
                    "Pay per second of query, nothing when idle",
                    "No capacity planning",
                    "Bill varies with usage",
                ],
                "holds_when": "The duty cycle is genuinely low -- short bursts separated by real idleness.",
                "breaks_when": (
                    "The warehouse is busy most of the working day. Higher per-unit rates then "
                    "outweigh the idle savings, and the bill stops being forecastable."
                ),
                "rough_cost": (
                    "Scales with query-hours. Cheaper below roughly a third utilisation and "
                    "more expensive above it -- the crossover point depends on your rates, so "
                    "treat the fraction as a shape, not a number to quote."
                ),
            },
            {
                "label": "B",
                "name": "Provisioned warehouse with auto-stop",
                "summary": (
                    "A fixed-size warehouse running 08:00 to 18:00, stopping outside those "
                    "hours. Predictable capacity and a predictable bill."
                ),
                "flow": [
                    {"label": "Analyst query"},
                    {"label": "Provisioned warehouse", "detail": "08:00-18:00, fixed size", "emphasis": True},
                    {"label": "Delta: fact table"},
                ],
                "key_choices": [
                    "Fixed size chosen for the 9-11am peak",
                    "Auto-stop outside business hours",
                    "Same bill every month",
                ],
                "holds_when": "Utilisation is high enough that you are paying for compute you actually use, and finance gets a number it can forecast.",
                "breaks_when": (
                    "You pay full rate through the 2pm lull, and the first query after "
                    "auto-stop makes an analyst wait through a cold start."
                ),
                "rough_cost": (
                    "Ten hours a day at the peak size, every working day, whether or not "
                    "anyone queries. Sizing for the peak is what you are paying for."
                ),
            },
        ],
    },

    # ---------------------------------------------------------------- 3
    {
        "title": "Three months of wrong numbers",
        "axis_label": "Reprocessing",
        "domain": "data_platform",
        "difficulty": "hard",
        "brief": (
            "A revenue table has been feeding the executive dashboard for three months. "
            "Someone discovers the currency conversion was applied twice for one region. "
            "The raw source data is intact. Finance has already closed two quarters using "
            "these numbers, and the table is joined by fourteen downstream jobs."
        ),
        "deciding_axis": (
            "Whether the history is a record that must stay auditable, or a derived artifact "
            "that can be rebuilt. That decides everything else about the fix."
        ),
        "reveal": (
            "Both are used in production, and the choice is rarely technical. A is what you "
            "do when the numbers were reported externally: overwriting a closed quarter "
            "destroys the audit trail, and nobody can afterwards answer what the dashboard "
            "showed on the day the board met.\n\n"
            "B is what you do when the table is genuinely derived and nobody promised anyone "
            "the old values. It is simpler, cheaper and leaves no confusing double history -- "
            "but it is irreversible, and it silently changes reports people have already "
            "acted on.\n\n"
            "Delta time travel lets you read the old values for as long as history is "
            "retained, which helps you investigate but is not an audit trail anyone can "
            "lean on years later. The transferable lesson is that idempotent pipelines "
            "make either option cheap. "
            "The reason this scenario is painful is almost never the size of the data."
        ),
        "elicit_answer": (
            "Were these numbers reported outside the company, and is anyone required to "
            "reproduce what the dashboard showed on a past date? Also: is the pipeline "
            "idempotent -- can a rerun of one day be repeated safely, or does it double-count?"
        ),
        "concepts": ["Backfill", "Idempotency", "Corrective entry", "Audit trail", "Time travel"],
        "options": [
            {
                "label": "A",
                "name": "Correct forward, keep the history",
                "summary": (
                    "Leave the published rows untouched. Write a corrective entry carrying the "
                    "difference, and add a valid-as-of column so any report can be "
                    "reproduced as it stood on a given date."
                ),
                "flow": [
                    {"label": "Raw source", "detail": "unchanged"},
                    {"label": "Corrective rows", "detail": "delta only", "emphasis": True},
                    {"label": "Revenue table", "detail": "old + correction"},
                    {"label": "Dashboard", "detail": "as-of aware"},
                ],
                "key_choices": [
                    "Nothing already published is overwritten",
                    "Corrections are themselves rows, with their own timestamp",
                    "Every downstream query must become as-of aware",
                ],
                "holds_when": "The numbers left the building -- filed, reported, or acted on externally.",
                "breaks_when": (
                    "All fourteen downstream jobs now have to understand as-of semantics, and "
                    "any one that does not silently double-counts the correction."
                ),
                "rough_cost": (
                    "Cheap to compute, expensive in downstream changes -- fourteen jobs to "
                    "review, on the assumption each one aggregates this table directly."
                ),
            },
            {
                "label": "B",
                "name": "Fix the logic and reprocess the window",
                "summary": (
                    "Correct the transformation and rerun it over the three affected months "
                    "from the intact raw data, replacing the bad partitions in place."
                ),
                "flow": [
                    {"label": "Raw source", "detail": "intact"},
                    {"label": "Fixed transform"},
                    {"label": "Overwrite 3 months", "detail": "partition replace", "emphasis": True},
                    {"label": "Dashboard", "detail": "unchanged"},
                ],
                "key_choices": [
                    "One backfill over the affected window, then done",
                    "One version of the truth, no as-of logic anywhere",
                    "Downstream jobs need no changes",
                    "The previously published numbers cease to exist",
                ],
                "holds_when": "The table is genuinely derived and nobody promised anyone the old values.",
                "breaks_when": (
                    "Two closed quarters silently change. Anyone reconciling against a report "
                    "they printed in March now finds figures that do not match, with nothing "
                    "in the data explaining why."
                ),
                "rough_cost": (
                    "Three months of recompute, once -- assuming the pipeline is idempotent. "
                    "If it is not, the rerun is the second bug, not the fix."
                ),
            },
        ],
    },

    # ---------------------------------------------------------------- 4
    {
        "title": "One table or five",
        "axis_label": "Governance",
        "domain": "data_platform",
        "difficulty": "medium",
        "brief": (
            "An HR analytics dataset holds records for 40,000 employees across five countries. "
            "Country HR teams may see only their own employees. Group HR sees everyone. "
            "Finance needs salary bands but no names. Works councils in two countries require "
            "evidence of who accessed what."
        ),
        "deciding_axis": (
            "Whether access rules are data that changes, or structure that is fixed. Enforcing "
            "a rule that changes by copying data means re-copying every time it changes."
        ),
        "reveal": (
            "B feels safer and is the more common instinct -- a table someone cannot query is "
            "obviously secure. The cost shows up later: five copies drift, the sixth country "
            "means a new pipeline rather than a new row in a rules table, and 'who accessed "
            "what' has to be assembled from five separate audit trails.\n\n"
            "A is the stronger answer here specifically because the works council requirement "
            "asks for access evidence. Centralised policy gives you one place that answers it. "
            "But A is only as good as the governance layer underneath it -- it assumes there "
            "is one catalogue with real row and column controls, and if there is not, A is a "
            "sketch rather than a design.\n\n"
            "Note what neither option is: hiding columns in the BI tool. That is a display "
            "choice, not access control, and the underlying table is still readable."
        ),
        "elicit_answer": (
            "How often do these access rules change, and is there already a governance layer "
            "with row filters and column masks? Also: does the works council need access "
            "evidence for queries, or only for exports?"
        ),
        "concepts": ["Row filter", "Column mask", "Unity Catalog", "Least privilege", "Access audit"],
        "options": [
            {
                "label": "A",
                "name": "One table, policy at the catalogue",
                "summary": (
                    "A single employee table. Row filters restrict each country team to its "
                    "own rows; a column mask hides names from finance. Rules live in the "
                    "catalogue -- Unity Catalog or equivalent -- not in the pipeline."
                ),
                "flow": [
                    {"label": "Source systems"},
                    {"label": "Delta: employees", "detail": "one table"},
                    {"label": "Row filter + column mask", "detail": "policy layer", "emphasis": True},
                    {"label": "All five audiences"},
                ],
                "key_choices": [
                    "One physical copy of the data",
                    "Access rules are configuration, not pipeline code",
                    "A single audit trail covers every reader",
                ],
                "holds_when": "Rules change with reorganisations, and someone has to prove who saw what.",
                "breaks_when": (
                    "The governance layer does not actually support row-level policy, in which "
                    "case this is a diagram rather than a design."
                ),
                "rough_cost": "One copy of the data. Policy evaluation adds query overhead that is usually small but is not zero.",
            },
            {
                "label": "B",
                "name": "A table per audience",
                "summary": (
                    "Five derived tables, one per country team, plus a de-identified table for "
                    "finance. Each audience is granted only its own table."
                ),
                "flow": [
                    {"label": "Source systems"},
                    {"label": "Split pipeline", "detail": "6 outputs", "emphasis": True},
                    {"label": "6 Delta tables"},
                    {"label": "Grant per table"},
                ],
                "key_choices": [
                    "Access enforced by what exists, not by a rule",
                    "Least privilege by construction: you cannot read what was never built for you",
                    "Simple to reason about and to demonstrate",
                    "Six copies to keep consistent",
                ],
                "holds_when": "The audiences are genuinely fixed and the platform has no row-level policy to lean on.",
                "breaks_when": (
                    "A reorganisation moves an employee between countries and now lives in two "
                    "tables, or a sixth country needs a new pipeline instead of a new row in a "
                    "rules table."
                ),
                "rough_cost": (
                    "Six times the storage for this dataset, which at 40,000 rows is "
                    "negligible -- the real cost is six pipelines to keep in step."
                ),
            },
        ],
    },

    # ---------------------------------------------------------------- 5
    {
        "title": "Bronze, silver, gold -- or just a table",
        "axis_label": "Layering",
        "domain": "data_platform",
        "difficulty": "easy",
        "brief": (
            "A team ingests one vendor CSV each night, about 200MB. They clean three columns, "
            "join it to an existing product table, and serve one dashboard. A reviewer asks "
            "why there is no medallion architecture."
        ),
        "deciding_axis": (
            "Whether layering is buying something this problem actually needs, or being "
            "recited because it is the pattern."
        ),
        "reveal": (
            "This one is deliberately lopsided, and knowing why is the point. B is right here, "
            "and 'we use medallion because that is the pattern' is the cargo cult answer "
            "that loses "
            "marks in an interview.\n\n"
            "But A is not stupid, and the case for it is worth being able to make: keeping raw "
            "bronze means that when the vendor changes their file format in eight months, you "
            "can reprocess history. That single benefit is often worth the layer on its own -- "
            "which is why the strong answer is 'keep raw, skip the ceremony', not 'skip "
            "layering'.\n\n"
            "What separates someone who has run pipelines from someone who has read about them "
            "is being able to say what each layer buys, rather than that there should be three."
        ),
        "elicit_answer": (
            "Is anything else ever going to read this data, and can the vendor file be "
            "re-fetched if we need to reprocess? If it cannot be re-fetched, keep raw -- that "
            "is the one layer this problem genuinely needs."
        ),
        "concepts": ["Medallion architecture", "Bronze layer", "Raw retention", "Reprocessing", "Cargo cult"],
        "options": [
            {
                "label": "A",
                "name": "Full medallion, three layers",
                "summary": (
                    "Bronze holds the raw file as delivered. Silver holds the cleaned, typed "
                    "version. Gold holds the dashboard aggregate."
                ),
                "flow": [
                    {"label": "Vendor CSV"},
                    {"label": "Bronze", "detail": "raw, as delivered", "emphasis": True},
                    {"label": "Silver", "detail": "cleaned + joined"},
                    {"label": "Gold", "detail": "dashboard aggregate"},
                ],
                "key_choices": [
                    "Raw is retained and reprocessable",
                    "Each layer is separately queryable and testable",
                    "Three tables and three jobs for one dashboard",
                ],
                "holds_when": "The vendor file cannot be re-fetched, or more consumers are coming and will want the cleaned data without the aggregate.",
                "breaks_when": "It is one dashboard and one file, and you have built three jobs to maintain where one would do.",
                "rough_cost": "Three times the storage, which at 200MB a night is trivial. The cost is maintenance, not bytes.",
            },
            {
                "label": "B",
                "name": "Raw landing plus one table",
                "summary": (
                    "Keep the vendor file exactly as delivered in storage. One job cleans, "
                    "joins and writes the single table the dashboard reads."
                ),
                "flow": [
                    {"label": "Vendor CSV"},
                    {"label": "Raw landing", "detail": "file kept as-is"},
                    {"label": "One job", "detail": "clean + join", "emphasis": True},
                    {"label": "Dashboard table"},
                ],
                "key_choices": [
                    "Raw retention is kept -- the one layer that is actually load-bearing",
                    "One job, one table, one thing to debug",
                    "No layer exists that nothing reads",
                ],
                "holds_when": "There is one consumer, and reprocessing needs only the original file.",
                "breaks_when": (
                    "A second and third consumer appear wanting the cleaned data without the "
                    "aggregate, and the single job starts growing branches."
                ),
                "rough_cost": "One job, one table. The cheapest thing that retains the ability to reprocess.",
            },
        ],
    },

    # ---------------------------------------------------------------- 6
    {
        "title": "The events that arrive late",
        "axis_label": "Late data",
        "domain": "data_platform",
        "difficulty": "hard",
        "brief": (
            "A mobile app emits usage events. Most arrive within seconds, but phones that were "
            "offline flush their queue on reconnect -- sometimes days later. A dashboard shows "
            "daily active users, and the product team checks it every morning at 9am."
        ),
        "deciding_axis": (
            "Whether the number needs to be final when it is first shown, or is allowed to "
            "change afterwards. Late data forces you to choose one."
        ),
        "reveal": (
            "There is no design that makes both true. Either yesterday's number is available "
            "at 9am and may move later, or it is correct and arrives later than 9am. Watermarks "
            "do not solve that -- they just choose where to draw the line and drop what falls "
            "outside it.\n\n"
            "A is what most streaming systems do by default, and its hidden cost is that "
            "dropped events are invisible: nobody sees the users who were excluded. B is "
            "honest but demands the product team accept a number that moves, which is a "
            "conversation, not a technical problem.\n\n"
            "The tell of someone who has run this in production is asking how late the late "
            "data really is. If 99% arrives within an hour, both designs converge and the "
            "argument was theoretical."
        ),
        "elicit_answer": (
            "What is the actual arrival delay distribution -- what fraction lands within an "
            "hour, a day, a week? And does the product team need yesterday's number to be "
            "final at 9am, or only roughly right? Those two answers decide it between them."
        ),
        "concepts": ["Watermark", "Event time vs processing time", "Restatement", "Out-of-order data", "Late arrival window"],
        "options": [
            {
                "label": "A",
                "name": "Watermark and close the day",
                "summary": (
                    "Accept events up to two hours late, then close the day. Anything arriving "
                    "after that is dropped. The 9am number never changes."
                ),
                "flow": [
                    {"label": "App events"},
                    {"label": "Stream + 2h watermark", "detail": "drops later arrivals", "emphasis": True},
                    {"label": "Daily counts", "detail": "final"},
                    {"label": "Dashboard", "detail": "stable at 9am"},
                ],
                "key_choices": [
                    "Windows are cut on event time, not processing time",
                    "One number per day, never restated",
                    "Late events are discarded, not counted",
                    "Downstream consumers can cache freely",
                ],
                "holds_when": "The number must be stable because people compare it to yesterday's screenshot, and the dropped tail is genuinely small.",
                "breaks_when": (
                    "The offline users you are dropping are a real segment -- and because they "
                    "were dropped rather than delayed, nothing in the data shows they existed."
                ),
                "rough_cost": "Cheapest to run and to reason about. The cost is accuracy you cannot see.",
            },
            {
                "label": "B",
                "name": "Restate the day as data arrives",
                "summary": (
                    "Recompute affected days whenever late events land, keeping a seven-day "
                    "window open. Yesterday's number is provisional and settles over a week."
                ),
                "flow": [
                    {"label": "App events"},
                    {"label": "Stream to raw", "detail": "nothing dropped"},
                    {"label": "Recompute 7-day window", "detail": "on late arrival", "emphasis": True},
                    {"label": "Dashboard", "detail": "marked provisional"},
                ],
                "key_choices": [
                    "Out-of-order data is absorbed rather than discarded",
                    "No event is ever discarded",
                    "Numbers are labelled provisional until the window closes",
                    "Daily recompute cost over a rolling window",
                ],
                "holds_when": "Accuracy matters more than stability, and the dashboard can carry a provisional marker.",
                "breaks_when": (
                    "The product team screenshots the number on Monday, quotes it on Thursday, "
                    "and it has moved. Technically correct, socially expensive."
                ),
                "rough_cost": (
                    "Seven days recomputed rather than one, so roughly seven times the "
                    "aggregation cost -- on the assumption the daily aggregate is cheap "
                    "relative to ingestion, which it usually is."
                ),
            },
        ],
    },

    # ---------------------------------------------------------------- 7
    {
        "title": "The column that appeared",
        "axis_label": "Schema evolution",
        "domain": "data_platform",
        "difficulty": "medium",
        "brief": (
            "An upstream team adds a field to the order events they publish. They did not tell "
            "anyone. Your ingestion job runs at 2am and consumes those events into a table "
            "that eleven dashboards read."
        ),
        "deciding_axis": (
            "Who absorbs the cost of an unannounced upstream change -- the pipeline, by "
            "stopping, or the consumers, by silently receiving something different."
        ),
        "reveal": (
            "The instinct is that failing is safer, and for a schema *change* it usually is. "
            "But this is a schema *addition*, and stopping the pipeline over a new column "
            "nobody reads means eleven dashboards are stale at 9am because of a field that "
            "affects none of them.\n\n"
            "A is right for additions and dangerous for anything else -- if the upstream team "
            "changes a type or drops a column -- a breaking change rather than an additive "
            "one -- permissive evolution turns a loud failure into "
            "a quiet one, which is the worse trade. That is why the real answer is not one of "
            "these two applied everywhere: it is 'evolve on addition, fail on change', which is "
            "a policy, not a switch.\n\n"
            "Whichever you choose, the failure that actually needs fixing is that you found out "
            "from your pipeline rather than from the upstream team."
        ),
        "elicit_answer": (
            "Is this an addition or a change? And is there a contract with the upstream team -- "
            "if not, that is the actual problem, and neither pipeline setting fixes it."
        ),
        "concepts": ["Schema evolution", "Schema enforcement", "Data contract", "Additive change", "Breaking change"],
        "options": [
            {
                "label": "A",
                "name": "Evolve the schema automatically",
                "summary": (
                    "The pipeline accepts new columns and adds them to the target table. "
                    "Existing consumers are unaffected; the new field is simply available."
                ),
                "flow": [
                    {"label": "Order events", "detail": "+1 column"},
                    {"label": "Ingest", "detail": "schema evolution on", "emphasis": True},
                    {"label": "Table", "detail": "column added"},
                    {"label": "11 dashboards", "detail": "keep running"},
                ],
                "key_choices": [
                    "Additions never interrupt the pipeline",
                    "The new column is available the next morning",
                    "Nobody is told the schema changed",
                ],
                "holds_when": "Changes are genuinely additive and consumers select named columns rather than everything.",
                "breaks_when": (
                    "The upstream change was a type change or a rename rather than an addition. "
                    "The same setting now converts a loud failure into a silent wrong number."
                ),
                "rough_cost": "No compute cost. The cost is that a schema drift you should know about arrives unannounced.",
            },
            {
                "label": "B",
                "name": "Enforce the schema and fail the run",
                "summary": (
                    "The pipeline rejects anything that does not match the declared schema. The "
                    "2am run fails, alerts, and waits for a human to look."
                ),
                "flow": [
                    {"label": "Order events", "detail": "+1 column"},
                    {"label": "Ingest", "detail": "schema enforced", "emphasis": True},
                    {"label": "Run fails", "detail": "alert raised"},
                    {"label": "11 dashboards", "detail": "stale until fixed"},
                ],
                "key_choices": [
                    "Nothing enters the table unreviewed",
                    "Every upstream change becomes visible immediately",
                    "Staleness is the cost of that visibility",
                ],
                "holds_when": "The data feeds decisions where a silently different column is worse than no update at all.",
                "breaks_when": (
                    "Eleven dashboards are stale at 9am because of a column none of them read, "
                    "and the on-call habit becomes rerunning with enforcement off."
                ),
                "rough_cost": "No compute cost. The cost is staleness and the on-call interruption, priced per false alarm.",
            },
        ],
    },

    # ---------------------------------------------------------------- 8
    {
        "title": "Lakehouse or warehouse",
        "axis_label": "Workload fit",
        "domain": "data_platform",
        "difficulty": "medium",
        "brief": (
            "A 60-person company runs finance reporting on 200GB of well-structured data from "
            "four SaaS systems. Twelve analysts write SQL. There is no data science team and "
            "no unstructured data. The current setup is a collection of scheduled scripts "
            "nobody trusts."
        ),
        "deciding_axis": (
            "Whether the workloads that justify a lakehouse actually exist here, or are being "
            "anticipated."
        ),
        "reveal": (
            "This is a workload fit question, not a size question. B is right for the "
            "company as described, and the honest reason is that 200GB of "
            "structured SQL from twelve analysts is precisely the workload warehouses were "
            "built for. Choosing a lakehouse here buys flexibility for workloads that do not "
            "exist, paid for in operational surface the team has to learn.\n\n"
            "The case for A is not wrong, though, and it is not about size: it is that "
            "warehouse formats are harder to leave than open table formats. If there is a "
            "credible chance of ML or semi-structured data within two years, A is the cheaper "
            "decision made early rather than the expensive one made under pressure later.\n\n"
            "What makes this answerable is that the stated problem is scripts nobody trusts. "
            "Neither option fixes that -- orchestration and testing do. Answering the "
            "architecture question without noticing that is the mistake."
        ),
        "elicit_answer": (
            "What is actually broken -- the storage, or the fact that nobody trusts the "
            "scripts? And is there a real plan for ML or semi-structured data, or is that a "
            "hypothetical? The first question usually reveals this is not a storage problem."
        ),
        "concepts": ["Lakehouse", "Data warehouse", "Open table format", "Vendor lock-in", "Workload fit"],
        "options": [
            {
                "label": "A",
                "name": "Lakehouse on open table format",
                "summary": (
                    "Land everything in object storage as Delta tables. Query with SQL, and "
                    "keep the door open for notebooks, ML and semi-structured data later."
                ),
                "flow": [
                    {"label": "4 SaaS systems"},
                    {"label": "Object storage", "detail": "Delta tables"},
                    {"label": "SQL engine", "detail": "open format", "emphasis": True},
                    {"label": "12 analysts"},
                ],
                "key_choices": [
                    "Storage is an open format you can read with other engines",
                    "One place for structured and future unstructured data",
                    "More moving parts to operate",
                ],
                "holds_when": "There is a credible near-term plan for ML or semi-structured data, or leaving the vendor later must stay cheap.",
                "breaks_when": (
                    "A 60-person company with no data engineer now operates a platform sized "
                    "for problems it does not have."
                ),
                "rough_cost": "Storage is cheap at 200GB either way. The cost that matters is the operational learning curve, which is a people cost.",
            },
            {
                "label": "B",
                "name": "Managed cloud warehouse",
                "summary": (
                    "Load the four sources into a managed warehouse. Analysts write SQL against "
                    "it. Almost nothing to operate."
                ),
                "flow": [
                    {"label": "4 SaaS systems"},
                    {"label": "Managed load"},
                    {"label": "Cloud warehouse", "detail": "nothing to operate", "emphasis": True},
                    {"label": "12 analysts"},
                ],
                "key_choices": [
                    "Matches the workload that actually exists",
                    "No platform for a small team to run",
                    "Data lives in a vendor format",
                ],
                "holds_when": "The data is structured, the workload is SQL, and nobody wants to operate a platform.",
                "breaks_when": (
                    "Semi-structured data or ML arrives in eighteen months and the data has to "
                    "be moved out of a proprietary format under time pressure."
                ),
                "rough_cost": (
                    "Predictable per-query or per-slot pricing. The real cost sits in the "
                    "future, on the way out: that is vendor lock-in, paid once and usually "
                    "at the worst possible moment."
                ),
            },
        ],
    },

    # ---------------------------------------------------------------- 9
    {
        "title": "Getting the data in",
        "axis_label": "Ingestion",
        "domain": "data_platform",
        "difficulty": "medium",
        "brief": (
            "An operational Postgres database backs a booking system. Analytics needs the "
            "bookings table, refreshed at least hourly. The table holds 40M rows, about 200,000 "
            "change daily, and bookings can be cancelled -- which deletes the row."
        ),
        "deciding_axis": (
            "Whether deletes matter. A timestamp-based pull cannot see a row that no longer "
            "exists, and no amount of tuning fixes that."
        ),
        "reveal": (
            "This is the one where the naive option has a specific, findable hole. A cannot "
            "detect deletes: a cancelled booking simply stops being updated, so it stays in "
            "the analytics table forever and every revenue figure is quietly too high. The "
            "brief says bookings can be cancelled, which is the detail that decides it.\n\n"
            "That does not make A worthless. It is genuinely simpler, it needs no access to "
            "the database's write-ahead log, and for append-only tables it is the right answer "
            "and CDC is over-engineering.\n\n"
            "There is also a real cost to B that is easy to skip: change data capture reads the "
            "database's replication log, which usually needs a privilege the DBA has to grant "
            "and a slot that will fill up and threaten the production database if your consumer "
            "stalls. That is an operational commitment, not a checkbox."
        ),
        "elicit_answer": (
            "Are rows ever deleted or hard-updated, and can we get replication access to the "
            "database? Deletes rule out the simple option; no replication access rules out the "
            "correct one, and then the answer is soft deletes upstream."
        ),
        "concepts": ["Change data capture", "Incremental extract", "Watermark column", "Soft delete", "Replication slot"],
        "options": [
            {
                "label": "A",
                "name": "Hourly incremental extract",
                "summary": (
                    "Every hour, select rows where updated_at is newer than the last run and "
                    "merge them into the analytics table."
                ),
                "flow": [
                    {"label": "Postgres"},
                    {"label": "Hourly query", "detail": "updated_at > last run", "emphasis": True},
                    {"label": "Merge into Delta"},
                    {"label": "Analytics"},
                ],
                "key_choices": [
                    "No special database privileges",
                    "One scheduled query, easy to reason about",
                    "updated_at is the watermark column, and must be set on every write",
                ],
                "holds_when": "The table is append-only or uses soft deletes, and updated_at is reliably set on every write.",
                "breaks_when": (
                    "A booking is cancelled and the row is deleted. Nothing in the query can "
                    "see that, so the row lives forever in analytics and revenue reads high."
                ),
                "rough_cost": "One query an hour over an indexed timestamp. Cheap, assuming updated_at is indexed.",
            },
            {
                "label": "B",
                "name": "Change data capture from the log",
                "summary": (
                    "Read the database's replication log and stream inserts, updates and "
                    "deletes into the analytics table as they happen."
                ),
                "flow": [
                    {"label": "Postgres WAL"},
                    {"label": "CDC connector", "detail": "insert/update/delete", "emphasis": True},
                    {"label": "Merge into Delta"},
                    {"label": "Analytics", "detail": "deletes applied"},
                ],
                "key_choices": [
                    "Deletes are captured like any other change",
                    "Freshness is minutes rather than an hour",
                    "Requires replication privileges and a slot to manage",
                ],
                "holds_when": "Deletes or hard updates happen and the analytics numbers have to match the source.",
                "breaks_when": (
                    "The consumer stalls, the replication slot backs up, and disk pressure now "
                    "threatens the production booking database. Analytics has become an "
                    "operational risk to the transactional system."
                ),
                "rough_cost": (
                    "A continuously running connector rather than an hourly query, plus DBA "
                    "involvement to grant and monitor the slot. The people cost usually exceeds "
                    "the compute cost."
                ),
            },
        ],
    },

    # ---------------------------------------------------------------- 10
    {
        "title": "What the dashboard reads",
        "axis_label": "Serving",
        "domain": "data_platform",
        "difficulty": "medium",
        "brief": (
            "An executive dashboard shows twelve tiles. Each is a small aggregate -- revenue "
            "this month, active accounts, churn rate -- computed over a 2TB fact table. The "
            "dashboard is opened perhaps forty times a day and must load in under two seconds. "
            "Filters let viewers slice by region and product line."
        ),
        "deciding_axis": (
            "The ratio of reads to distinct slices. Pre-computing pays when many reads hit the "
            "same few combinations, and is waste when every viewer asks something different."
        ),
        "reveal": (
            "Forty opens a day against twelve tiles is not much read volume, which is the "
            "argument for B -- pre-computing 480 results a day to serve 480 reads buys nothing.\n\n"
            "What decides it is the filters. Two dimensions with, say, six regions and eight "
            "product lines is around fifty combinations per tile, and pre-computing all of them "
            "is still cheap. Add a third filter and the combinations multiply until most of "
            "what you compute is never read.\n\n"
            "This is also the axis people most often get backwards in interviews: they reach "
            "for pre-aggregation because it sounds like optimisation, without asking how many "
            "distinct slices exist. The number of filter combinations -- the cardinality "
            "of slices -- is the question, not the "
            "size of the fact table."
        ),
        "elicit_answer": (
            "How many distinct filter combinations are actually used, and is the filter set "
            "fixed or will people ask for a third dimension next quarter? Also worth asking "
            "whether two seconds is a real requirement or a preference -- it changes the answer."
        ),
        "concepts": ["Pre-aggregation", "Materialised view", "Query-time compute", "Read-write ratio", "Cardinality of slices"],
        "options": [
            {
                "label": "A",
                "name": "Pre-compute every tile and slice",
                "summary": (
                    "A nightly job computes each tile for every region and product-line "
                    "combination into a small results table -- a materialised view in all "
                    "but name -- that the dashboard reads."
                ),
                "flow": [
                    {"label": "Fact table", "detail": "2TB"},
                    {"label": "Nightly aggregate", "detail": "all combinations", "emphasis": True},
                    {"label": "Results table", "detail": "small"},
                    {"label": "Dashboard", "detail": "sub-second"},
                ],
                "key_choices": [
                    "Read cost is constant and tiny",
                    "The two-second target is met with room to spare",
                    "Numbers are as fresh as the last nightly run",
                ],
                "holds_when": (
                    "The read-write ratio is high and the filter set is fixed and small, "
                    "so nearly everything computed is eventually read."
                ),
                "breaks_when": (
                    "A third filter dimension is added and the combinations multiply. You are "
                    "now computing thousands of results a night to serve forty reads."
                ),
                "rough_cost": (
                    "One full scan of 2TB per night regardless of whether anyone opens the "
                    "dashboard -- assuming the aggregate cannot be computed incrementally, "
                    "which for a churn rate it often cannot."
                ),
            },
            {
                "label": "B",
                "name": "Compute at query time on a warm cache",
                "summary": (
                    "The dashboard queries the fact table directly. Results are cached for an "
                    "hour, so repeated opens of the same slice are served from cache."
                ),
                "flow": [
                    {"label": "Fact table", "detail": "2TB"},
                    {"label": "Query on open", "detail": "cached 1 hour", "emphasis": True},
                    {"label": "Dashboard", "detail": "fast after first open"},
                ],
                "key_choices": [
                    "Nothing is computed that nobody looks at",
                    "Any slice works, including ones nobody anticipated",
                    "The first viewer of an uncached slice waits",
                ],
                "holds_when": "Viewers slice unpredictably, or the filter set is expected to grow.",
                "breaks_when": (
                    "The first executive of the morning opens the dashboard on a cold cache and "
                    "waits past the two-second target -- the one viewer most likely to complain."
                ),
                "rough_cost": (
                    "Scales with distinct slices viewed rather than with slices possible. "
                    "Cheaper here on the assumption the fact table is partitioned so a filtered "
                    "query does not read all 2TB."
                ),
            },
        ],
    },
]


_BY_TITLE = {r["title"]: r for r in SEED_DESIGN_REVIEWS}


def _key(review: dict) -> str:
    return review["title"]


def backfill_axis_labels(db: Session) -> int:
    """Give an axis label to any built-in review that predates the column.

    The seeder cannot do this by re-creating the review: the ledger correctly
    records it as already offered, and re-creating it would duplicate content
    the learner may have already worked through. So the label is repaired in
    place, matched by title, which is the same identity the ledger uses.

    Only touches rows whose label is missing, so a review whose label is
    deliberately different is left alone.
    """
    updated = 0
    for review in db.query(DesignReview).filter(DesignReview.axis_label.is_(None)).all():
        label = (_BY_TITLE.get(review.title) or {}).get("axis_label")
        if label:
            review.axis_label = label
            updated += 1
    if updated:
        db.commit()
    return updated


def seed_design_reviews(db: Session) -> int:
    """Add every built-in review this install has not been offered before."""
    backfill_axis_labels(db)
    repo = DesignReviewRepository(db)
    by_title = {_key(r): r for r in SEED_DESIGN_REVIEWS}

    def create(title: str) -> None:
        repo.create(DesignReviewCreate(**by_title[title]))

    return seed_missing_content(
        db,
        namespace=SEED_NAMESPACE,
        keys=list(by_title.keys()),
        bank_is_empty=repo.count() == 0,
        create=create,
    )
