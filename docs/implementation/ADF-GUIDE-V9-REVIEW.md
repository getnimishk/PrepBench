# ADF Study Guide v9 — rewrite report

Date: 2026-10-21. File: `backend/app/content/packs/adf/v9.json` (untracked, not committed).
Status: **written and statically checked only. Not run through any test suite, not rendered in the app, and not fact-checked again against Microsoft Learn.**

## 1. Why v9 exists

v8 moved sections between chapters, but it did not change how the chapters teach. v9 goes chapter by chapter: what the learner needs to know first, how each topic is introduced, where a warning belongs, and what is repeated. The chapter count is no longer fixed at 21. It is now **23**.

## 2. What was wrong, found by reading every chapter

1. **Chapter 2 was a patchwork.** The moved tour (features, workflow, CI/CD, monitoring, concepts) repeated the deep chapters on CI/CD, monitoring, runtimes and triggers, and "The concepts in detail" repeated the resource model in the same chapter.
2. **Warnings sat at the end of the chapter**, far from the section they belonged to, and often repeated that section's own sentences (chapters 8, 9, 11, 12, 16 and others).
3. **Some topics were taught twice.** Error-handling patterns and their table were in both the pipelines and monitoring chapters. The four networking terms were defined in both the runtimes and security chapters. The concurrency budget and the connection arithmetic appeared three times. The ADF-versus-Fabric comparison sat in the middle of a chapter about moving to Fabric.
4. **Topics were taught in the wrong order.** In the data-flow chapter, the choice of whether to use a data flow came last. In the pipelines chapter, the decision activities came after the loop that depends on them.

## 3. The chapters

Sizes are characters of text and tables.

| # | Chapter | Chars | What was done |
|---|---|---:|---|
| 1 | Introduction to Azure Data Factory | 16,575 | Reordered: problem, mental model, retail load, **what ADF is not**, the four questions (now mapped to the chapters that teach each), building blocks, scenarios. Your wording is kept. |
| 2 | How ADF works: the architecture and the workflow | 17,265 | **New, written from scratch.** One pass through the four questions with the retail load, each ending in one quiet trap and a pointer to the deep chapter. No repeats of CI/CD or monitoring detail. |
| 3 | The building blocks | 22,768 | **Rewritten around a hook** (fifty tables in three environments). The duplicated concept tour was removed, naming rules got their own section, and a wrong count ("four parts" listing three) was fixed. |
| 4 | Pipelines, activities and control flow | 34,936 | **Reordered** into a learning sequence: step, policy, order, dynamic values, discover, decide, repeat, split, call out, limits. The duplicate budget now points to chapter 18. |
| 5 | Integration runtimes | 24,476 | **Reordered** around "how do I reach private data": types, Azure, managed network, private endpoints, self-hosted, three routes, **which runtime wins**, then operations. |
| 6 | Triggers | 20,739 | Problem-first opening with the three retail requirements; each trigger introduced by the requirement it answers. |
| 7 | The Copy activity | 19,665 | Introductions added; the self-hosted resume version (5.43.8935.2) restored, which v8 had lost. |
| 8 | Bad rows, cut-off values and "verified" copies | 12,331 | Opens with the three quiet failures; each warning moved next to its section; duplicate sentences trimmed. |
| 9 | Proving the migration is complete | 12,587 | Warnings moved; the "where checks run" bullets merged with their warnings. |
| 10 | Loading only new data | 11,358 | Warnings moved; a lead-in to the watermark's limits. |
| 11 | Change data capture | 11,532 | Warnings moved; checkpoint and retention duplicates removed. |
| 12 | Transforming data | 17,368 | **The decision now comes first** ("is a data flow the right tool?"), then the tool. Warnings moved. |
| 13 | Monitoring, failures and reruns | 13,405 | The duplicate error-handling table removed (chapter 4 teaches it). **Added** the three kinds of run and the worked "investigate a failed run" example. |
| 14 | Recovering from failures | 14,570 | Warnings moved; lead-ins for rerun scope, idempotency and platform faults. |
| 15 | Security and networking | 19,884 | The duplicate networking-terms table removed (chapter 5 has it); three-questions opening. |
| 16 | Sensitive data in regulated industries | 11,833 | Two list items shortened into the warnings that cover them; warnings moved. |
| 17 | Performance and cost | 13,484 | Warnings moved; speed and cost tied together. |
| 18 | Fine-tuning copies and data flows | 18,665 | Warnings moved; the full concurrency budget lives here only. |
| 19 | From Dev to Prod | 17,889 | Environment boundary no longer re-taught; infrastructure-as-code layers point to chapter 15. |
| 20 | Migrating with ADF | 13,282 | Opens with why a migration exercises everything; warnings moved. |
| 21 | Choosing the right service | 7,281 | **New chapter.** The comparison table, pairings and three engine questions moved here, plus four worked scenarios and a scenario takeaway. |
| 22 | ADF and Fabric Data Factory | 14,614 | Now only about Fabric: what changes, what is missing, how to move. Warnings moved. |
| 23 | Pitfalls: every trap in one place | 31,118 | The manager's view now matches chapter 1's five questions; takeaway rewritten as a scenario. |

Honest split: chapters 1 to 5 and 21 got real structural rewriting or new text. Chapters 6 to 20, 22 and 23 got problem-first introductions, warnings placed beside their sections, duplicate sentences removed and references renumbered, but their sourced facts are unchanged.

## 4. Diagrams and reference material

All 16 images from earlier versions are used, none redrawn. Chapter 2 now holds the two overview diagrams (visual guide, five capabilities) and chapter 3 holds the entity diagram. The other diagrams stayed in their chapters. Nothing in the pack text was dropped, apart from what is listed in section 6.

## 5. What was checked

By script, not by the test suites:
- v9 validates against the pack schema (23 chapters).
- All ten Behaviour Lab quotes and phrases are present, in their chapters.
- Every old chapter id and title is unchanged, so the lab's chapter links still match.
- Topic lines in the alignment blocks are unchanged. Every "Relevant sections" name matches a heading, and every `Ch N (Title)` cross-reference names the right chapter.
- Every chapter has exactly one takeaway and one practice block. The scenarios and diagnostic questions are identical to v2.
- No text mentions your deleted roadmap, except the two-roadmaps point about Fabric.

## 6. For your review

1. **Chapter 4 is still the longest chapter** (35,000 characters). A split into "control flow" and "calling other engines" would be natural.
2. **Chapter 23 repeats by design** (tables of every trap, a limits register, a glossary).
3. **The alignment blocks** are still on every chapter page. Their topic lines and learning evidence are the pinned ones; the "Relevant sections" lists were updated to the new headings.
4. **Facts I did not change or re-verify.** Everything that was sourced in October 2026 is still sourced then. The new sentences I wrote (the intros, the four scenarios in chapter 21, the takeaways) only restate those facts.
5. **Dropped as duplicates:** the tour's concept list, one networking table (chapter 15), the error-handling table in chapter 13, and parts of the budget in chapter 4.

## 7. Before release

- **Tests that will fail** until updated: `test_content_packs.py` (chapter count 21 appears at lines 205, 394 and 402, and the chapter-reference list), and anything that names a moved heading.
- **Frontend:** the lab and curriculum tests import `v2.json`, so they do not see v9. When v9 is released, repoint them. The lab registry's chapter titles already match.
- **Pack folder:** v3 (valid), v4 (invalid JSON), v5 (one chapter), v6, v7 and v8 are still there. v9 is the highest valid version, so it will be the latest.
- **To see it:** restart the backend (packs are cached at startup), then upgrade the ADF preparation to v9 in the app. The preparation stays on its pinned version until you do.
