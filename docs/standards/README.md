# PrepBench standards

## PrepBench Instructional Standard

- **Version:** 1.3 (Reusable Product Standard)
- **Status:** Approved baseline, approved 2026-10-13
- **Scope:** every PrepBench learning pack (ADF, Databricks, Agentic AI and future packs): roadmaps, study guides, learning units, tutorials, labs and assessments.

| File | Role |
|---|---|
| [`PrepBench_Instructional_Standard.md`](PrepBench_Instructional_Standard.md) | **Canonical.** The authoritative text. If the copies ever disagree, this one wins. |
| [`PrepBench_Instructional_Standard.pdf`](PrepBench_Instructional_Standard.pdf) | Reading copy. Fixed layout for review and circulation. |
| [`PrepBench_Instructional_Standard.docx`](PrepBench_Instructional_Standard.docx) | Editable convenience copy, for people who prefer Word. Not a source of truth. |

## Pack annexes

Section 14 of the standard makes a pack annex mandatory for every learning pack. The annex says how the standard applies to that technology (learner profile, source hierarchy, terminology, lab safeguards, overview visual, curriculum mapping, conformance register, review plan). Annexes sit beside the standard in this folder once approved. No pack annex has been registered yet.

## Changing the standard

A policy change is a new version, never a silent edit of the approved text.

1. Change the Markdown first, in a pull request, like any other doc.
2. Raise the version number, add a change-log entry that says what changed and why, and record the new status and approval date. Mark the text a draft until it is approved.
3. Regenerate the PDF and DOCX from the Markdown in the same pull request. All three must show the same version, status and approval date, and the same requirements. Do not hand-edit an export.
4. Update the references to the version here, in `CLAUDE.md` and in any pack annex that cites it, in the same pull request.
5. Typo and formatting fixes that change no requirement still go through a pull request, and the three copies must stay identical in wording.
6. An annex may add rigor to the standard but cannot waive any of its requirements. If an annex needs a waiver, change the standard instead.
