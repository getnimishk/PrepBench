# Outside review of waves 2 to 4: what was decided

Reviewer: ChatGPT, no web access, run once on the state before commit `d987246` (PR #61). Findings were checked against the sources and the code before any change. **The next review should start from `d987246` and not re-open anything marked Fixed or Rejected without new evidence.**

Types: **Bug** (code or number wrong), **Doc** (wording or framing), **False positive** (reviewer wrong), **Deferred** (a judgement call, not an error).

| Finding(s) | Type | Disposition | Evidence |
|---|---|---|---|
| F-01 to F-03, C-01, C-02, C-13: checkpoint and approval did not survive a real restart | Bug | Fixed | `ApprovalGate` reloads its log on construction; `test_approval_and_progress_survive_a_real_restart_with_file_backed_state` rebuilds everything from files; lesson 33 states the in-memory default and uses files in the lab |
| F-04, F-05, C-03 to C-05: outage simulation lacked backoff, jitter, retry-after and any read/write split | Bug and Doc | Fixed (first three); the ladder is stated as not simulated | `outage.py` now models them and lesson 50's numbers were regenerated (robust: 623 calls, 313 on time, 287 late, peak queue 205); the lesson says the degradation ladder and "writes stopped first" are lab design work, not tested here |
| F-06, F-07, C-06, C-07: cost table disagrees with `cost.py` | False positive | Rejected | `python cost.py` prints $106/121/142 (A) and $68/78/89 (B) with break-even 93.0 percent, exactly as in lesson 49 |
| F-28: "signed approval" | Doc | Rejected as an error; wording tightened | Lesson 45 already said a hash is not a signature; it now says so at the first mention |
| F-08, F-15, F-16, F-17, F-35, F-37, F-49, F-50 (overstatement) | Doc | Fixed | Cache warmth, access enforcement at the data boundary, private networking versus compliance, free-offer spending protection, link-check labelled a toy, allow-list claim scoped |
| F-09, F-10, F-11 (evaluation sample size, tolerance, flaky must-pass) | Doc | Fixed | Lesson 46 labels 20 to 50 as a starting point, the 3-point tolerance as exercise policy, and says a flaky safety case blocks release |
| F-24, F-25, C-24 (A2A: SDK versus specification) | Doc | Fixed | Lesson 42 records both the page and SDK 1.2.1 behaviour and says to check the normative text |
| C-22, C-23 (test isolation, setup) | Bug | Fixed | `reference-code/requirements.txt`; the README says to run each folder's tests from inside it |
| C-09 to C-12, C-14, C-15, C-19 to C-21 | n/a | Confirmed correct by the reviewer | Arithmetic reproduced |
| F-12, F-13, F-18 to F-23, F-29 to F-34, F-36, F-38 to F-41, F-48 (vendor, protocol and legal facts "need web check") | n/a | Already dated snapshots; no change | Each lesson names the page and read date; `phase-5-11-notes.md` lists what goes stale. F-40 (Databricks Supervisor naming) stays flagged as unresolved |
| F-14, F-26, F-27, C-16 to C-18 (labelling of descriptive results, estimates, course metrics) | Doc | Mostly already stated; no change | Lessons say "in this simulation", "estimate at 4 characters per token" and "course metric" |
| F-42 to F-47, F-51 | Doc | Deferred | Small teaching refinements; revisit after the owner reads a sample |
| L-01 to L-12 (splitting long builds, platform-lab fallbacks) | Deferred | Not applied | The long builds are meant as portfolio-scale exercises; splitting could break their continuity. Decide after the owner reads the lessons |
| I-01 to I-10 (executive framing in many lessons) | Deferred | Not applied | Risks turning technical lessons into interview coaching; wave 5 covers decision and interview framing |
