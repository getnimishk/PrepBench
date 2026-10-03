# Disposition of the outside review of wave 5 (ChatGPT, 2026-10-03)

The reviewer ran the product, migration, deploy and drills suites (8, 6, 6, 8 passed) and checked source attributions against current primary pages. They could not run the LangChain folder (`langchain_core` not installed in their environment), so they did not reproduce that run; they did not call it false. Our run: langchain-core 1.6.6 and langchain 1.4.3, pinned in `reference-code/requirements.txt`.

Legend: fixed = changed; wording = text only; none = no change needed.

| ID | Verdict | What we did |
|---|---|---|
| F-01 Diligence narrowed | accepted, wording | Lesson 66 now says recording and disclosing is our operationalisation of Diligence, not Anthropic's wording |
| F-02 "poor at predicting" unsourced | accepted, wording | Lesson 60 labels it our practice and a common heuristic with no source |
| F-03 HEART adapted | accepted, wording | Lesson 64 says "adapt" and notes the authors' caution that not every dimension fits every product |
| F-04 NIST wording | none | Reviewer found it sound |
| F-05 incident roles | accepted, wording | Lesson 67 marks the role-separation sentence as our practice |
| F-06 RICE, F-07 CAF | none | Reviewer found them accurate |
| C-01 fourth request "pass the cap" | accepted, fixed | Lesson 71 now says it would exceed the cap (0.039 + 0.02 = 0.059 against 0.05) |
| C-02 gate criterion broader than code | accepted, fixed | Added `strict=True` to `gate()` (applies nothing without a named approver, defects still blocked), a test, and a lesson 70 paragraph; the default is unchanged and the learner is told to choose and say so |
| C-03 LangChain tool lost caller groups | accepted, fixed | Replaced the module-level tool with `make_search_tool(groups)`; groups are bound by the application and are not in the schema the model sees; new test (5 tests now) |
| C-04 equivalence test scope | accepted, wording | Lesson 36 says it is an adapter-preservation test on 25 fixed questions, not evidence about LangChain quality, and that the conclusion holds "for this experiment only" |
| C-05 exit-plan check is weak | accepted, wording | Lesson 66 says it is a lint for required fields and phrases, not a judgement of the plan |
| C-06 case-study checker | accepted, wording | Lesson 72 says passing is structural only |
| C-07 drills do not test modules 12 and 13 | accepted, fixed (the largest finding) | New `LEADERSHIP` bank of 14 questions tied to lessons 60 to 71 with key points and limits, a test, a table and a lab step in lesson 73, and a mention in lesson 77 mocks |
| C-08 `coverage()` false confidence | accepted, wording | Lesson 73 now requires the learner (or a peer) to mark each key point before recording a pass |
| C-09 evidence only for high open risks | accepted, wording | Lesson 67 says so and recommends evidence for all |
| S-01 deployment cost and data exposure | accepted, fixed | Lesson 71 lab now opens with a pre-deployment gate: synthetic data only, no production credentials, a hard spend limit or a free platform with no payment method, check billing first |
| S-02 in-memory limiter | accepted, fixed | The two gaps are now hard lab constraints, and the lab says not to deploy the in-memory limiter unchanged |
| S-03 Oracle behaviour | accepted, wording | Lesson 70's table labels it expected legacy behaviour, not verified against Oracle |
| S-04 "production decision" | accepted, wording | Template and table say hypothetical unless the learner operated the system (the heading keeps its name because the checker and the roadmap criterion use it) |
| P-01 sensitivity is not confidence | accepted, wording | Lesson 63 says so and says the bands are our assumptions |
| P-02 ROI case too rosy | accepted, fixed | Lesson 65 says the result is illustrative, and a new lab step builds an adverse case |
| P-03 model-assisted converter not in code | accepted, wording | Lab now says two rule-based versions; a model-assisted converter is an optional extra not in the reference code |
| P-04 canonical platform | partly accepted | Lab says pick ONE platform and stay on it; we do not prescribe one because we ran none and platform steps change |
| P-05 checklist as script | accepted, wording | Lesson 74 says to prioritise when the interviewer constrains scope |
| P-06 crib | accepted, wording | Lesson 75's crib is organised as service, purpose, tradeoff and which source to check |

Counts after the fixes: migration 7 tests, drills 9, LangChain 5 (product 8 and deploy 6 unchanged). Not changed, on purpose: the reviewer's advice not to add more management theory.
