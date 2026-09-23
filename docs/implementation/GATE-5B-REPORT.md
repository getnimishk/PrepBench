# Phase 5b Gate Report — Study Guide

**Date:** 2026-09-13 · **Format:** plan §40 · **Gate decision: PASS**

Content source decided by you: **AI drafts it, you can edit.**

---

## Implemented

**Study guide page** — `/roadmaps/:roadmapId/topics/:topicId/guide`, opened from a
new "Study guide" button on each topic.

- **Draft with AI** writes sections using the AI set up in Settings: an explanation,
  a worked example, a common mistake, and a check question with a model answer. The
  prompt aims the guide at the topic's success criterion — what you'll later have to
  demonstrate.
- **Write a section** yourself, or **Edit** / **Delete** any section.
- **Contents** with "N of M read", and **I have read this** per section.
- **Check yourself** — write your answer, then compare with the model answer.
  Labelled on screen as private practice that isn't saved or graded.
- **Demonstrate this topic** at the end of the guide.

Drafting appends to what you have; it never replaces sections you wrote.

## Honesty rules

| Rule | How it's held |
|---|---|
| Nothing invented | No AI set up → the button is disabled and says why; nothing is saved. AI error or unusable answer → reported as a failure; nothing is saved. A missing example stays missing rather than becoming filler. |
| AI text labelled | Shows *"Drafted by AI (provider · model) — check it against what you know"*, and after editing, *"Drafted by AI, edited by you"*. An edit can't disguise a model's text as yours. |
| Reading isn't completion | "Read" is stored, but a topic is still completed only by demonstrating it. Tested. |
| Topic text treated as data | Your topic's title and objective are fenced in the prompt so they can't act as instructions. |

## What the prototype had, and what replaced it

| Prototype | Now |
|---|---|
| Five hardcoded section titles | Real sections per topic |
| One Scrum paragraph under every section | Each section's own content |
| "2 of 5 sections complete" at 42% | Counted from what you've actually marked read |
| "Mark complete" that only showed a message | "I have read this", which is saved — and doesn't claim completion |

## API / DB changes

- **New table** `topic_guide_sections`, deleted along with its topic.
- **New AI task** `topic_guide_drafting` — appears automatically in Settings → AI task routing, so you can pick which provider drafts guides.
- **New endpoints** under `/roadmaps/{id}/topics/{tid}/guide`: get, draft, add, edit, delete, mark read.

## Tests

| Suite | Before | After |
|---|---|---|
| Backend | 563 | **575** (+12: no-AI, failure and error paths save nothing; labels survive edits; drafts append; reading ≠ completion; scoping; cascade) |
| Frontend unit | 476 | **476** |
| E2E | 13 | **15** (+2: honest no-AI state; write → check yourself → read → reload → still not completed) |

The AI drafting path is tested against a faked AI response, not a live provider.

## Known limitations

- **Not linked to a certification's weakest area.** The prototype's guide opened on a preparation's weakest domain (e.g. "Scrum Events"). This one belongs to roadmap topics. PSM I has no roadmap yet, so Learn can't offer a guide for its weak areas.
- **No reordering of sections**, only add/edit/delete.
- **Check-yourself answers aren't saved**, by design and stated on screen. The topic's saved evidence is its demonstrations.

## Gate decision

**PASS.** Phase 5 is complete.
