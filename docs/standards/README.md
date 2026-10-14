# PrepBench standards

## PrepBench Instructional Standard

- **Last approved version:** 1.3 (Reusable Product Standard), approved 2026-10-13. The approved text is preserved in Git history (commit `5142d31`, PR #96).
- **Proposed amendment:** 1.4, **Draft, not approved**. It amends the section 6 visual sourcing cascade (search, reuse first, create an original only as a justified fallback) and section 15 step 2, and extends section 14 item 5. It supersedes nothing until it is formally approved.
- **Scope:** every PrepBench learning pack (ADF, Databricks, Agentic AI and future packs): roadmaps, study guides, learning units, tutorials, labs and assessments.

| File | Role |
|---|---|
| [`PrepBench_Instructional_Standard.md`](PrepBench_Instructional_Standard.md) | **Canonical.** The authoritative text. Currently the **v1.4 draft, not approved**; the last approved text is v1.3 (see above). Apart from the intentional v1.3/v1.4 difference described below, if the copies disagree, this one wins. |
| [`PrepBench_Instructional_Standard.pdf`](PrepBench_Instructional_Standard.pdf) | Reading copy. Fixed layout for review and circulation. **Currently the published v1.3 (approved) export.** It does not contain the v1.4 draft. |
| [`PrepBench_Instructional_Standard.docx`](PrepBench_Instructional_Standard.docx) | Editable convenience copy, for people who prefer Word. Not a source of truth. **Currently the published v1.3 (approved) export.** It does not contain the v1.4 draft. |

Until v1.4 is formally approved, the PDF and DOCX intentionally differ from the Markdown: they are the v1.3 approved exports, and the Markdown is the v1.4 draft. When v1.4 is formally approved, regenerate both exports from the approved Markdown and validate that all three agree on version, status, approval date and requirements before relying on them as v1.4 copies.

## Pack annexes

Section 14 of the standard makes a pack annex mandatory for every learning pack. The annex says how the standard applies to that technology (learner profile, source hierarchy, terminology, lab safeguards, overview visual, curriculum mapping, conformance register, review plan). Pack annexes are kept in `packs/`, and each carries its own approval status. The ADF annex, [`packs/adf.md`](packs/adf.md), is a draft awaiting review and is not approved. No other pack has an annex.

## Changing the standard

A policy change is a new version, never a silent edit of the approved text.

1. Change the Markdown first, in a pull request, like any other doc.
2. Raise the version number, add a change-log entry that says what changed and why, and record the new status and approval date. Mark the text a draft until it is approved.
3. Regenerate the PDF and DOCX from the Markdown when the version is approved. Until then (a draft), they stay at the last approved version, as the table above says. Once regenerated, all three must show the same version, status and approval date, and the same requirements. Do not hand-edit an export.
4. Update the references to the version here, in `CLAUDE.md` and in any pack annex that cites it, in the same pull request.
5. Typo and formatting fixes that change no requirement still go through a pull request, and the three copies must stay identical in wording.
6. An annex may add rigor to the standard but cannot waive any of its requirements. If an annex needs a waiver, change the standard instead.
