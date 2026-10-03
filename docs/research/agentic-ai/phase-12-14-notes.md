# Notes for modules 12 to 14 (wave 5)

Read, written and run 2026-10-03. Companion to `phase-5-11-notes.md`. Most pages were read through page summaries; where we say "in full" the page text itself was read.

## How the sources were chosen

- **Topics 60 to 68 (Module 12, product and program leadership)** use new primary sources, because the earlier modules do not cover this ground.
- **Topics 69 to 72 (Module 13 and the case-study topic)** are builds and write-ups on our own earlier work and on the roadmap's portfolio criteria.
- **Topics 73 to 77 (Module 14, interviews)** use the roadmap criteria and our own lessons as the question bank; each question points back to the lesson that answers it.

## Sources by topic (dated in the lessons)

- **60 to 62:** Google PAIR guidebook (problem framing, error types); Microsoft Cloud Adoption Framework AI strategy and AI-adoption pages (2026); the SDLC Playbook lessons used in module 6; Anthropic "Building effective agents".
- **63:** Intercom's RICE article (formula, scales and the author's cautions).
- **64:** Rodden, Hutchinson and Fu, HEART framework (CHI 2010); Anthropic "Demystifying evals for AI agents".
- **65:** Microsoft Cloud Adoption Framework strategy pages; our own cost model from lesson 49.
- **66:** Microsoft Cloud Adoption Framework AI strategy; Anthropic AI Fluency framework (4D).
- **67:** NIST AI RMF 1.0 (Govern, Map, Measure, Manage); the Google SRE book chapters on incident management and postmortems.
- **68:** our practice; the SRE postmortem culture chapter.
- **69 to 72:** our builds and the roadmap's criteria; Starlette documentation for the deployment sample.
- **73 to 77:** our lessons; the rubric in `reference-code/module14-drills/selfscore.py`.

## Verified by running

- Product folder: 8 tests. RICE ranking and its stability test; ROI range and sensitivity simulation; build/extend/buy scorecard and weight stability; metric spec and risk register validators.
- Migration folder: 7 tests. A naive converter passes 4 of 6 queries and fails on NULL handling in concatenation and integer division; the second converter passes 6 of 6; the approval gate blocks unapproved changes and logs each decision.
- Deploy folder: 6 tests with the framework's test client (authentication, per-user cap, kill switch, content-free logs, health).
- Drills folder: 9 tests. Bank sizes (20 fundamentals, 14 leadership, 15 platform, 4 designs) and every question citing a lesson; summary, story, case-study and mock helpers.
- `rag_report.py` runs on the lesson 27 to 31 build and prints the access test, stage metrics, modelled cost per query and a "what this report does not show" section.

## Not run, and not claimed

- Any real model call, embedding model, cloud account or hosting platform. All figures in Module 12 are fictional assumptions for the DataOps agent, labelled as such.
- A real legacy database. The Oracle-style behaviours in lesson 70 (NULL in concatenation, integer division) are common database knowledge that we did not verify against an Oracle instance; the "golden" results are human-reviewed reference queries on SQLite.
- Lessons 71 (deploy) and 76 (stories) are guidance. We cannot deploy for the learner, and the stories must be the learner's own experiences.
- Management practice (lessons 60 to 62, 65 to 68) mixes cited sources with our own practice; each lesson says which is which.

## Open items

- Databricks supervisor-agent naming and deprecation status is unresolved (flagged in lesson 58).
- MCP over HTTP in our Windows environment is undiagnosed (noted in `phase-5-11-notes.md`).
- No outside review of wave 5, no owner review of any lesson, and no in-app load and render check of all 77 lessons yet.
