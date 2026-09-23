# Phase 13 Gate Report — Insights and Recommendations

**Date:** 2026-09-14 · **Format:** plan §40 · **Gate decision: PASS**

---

## Audit first

The plan asks for evidence → aggregation → weakness → recommendation → action, nothing hardcoded, and every recommendation able to answer: *Why am I seeing this? What evidence caused it? What should I do? What would change it?*

Already real: the readiness rule (server-side, mocks only, with structured blockers), Home's next-action ladder, Practice's recommendation cards, and Insights' "What changed / What is holding you back / Why".

Gaps found:

1. **Insights mixed preparations.** "Everything you have ever answered" and the score trend pooled every preparation's answers. With two preparations, one showed the other's areas.
2. **Insights didn't reload when you switched preparation.** It fetched once and kept showing the old figures.
3. **No area detail.** The prototype's domain page (accuracy, misses, what's due, topics, questions) didn't exist.
4. **Recommendations explained why, but not the evidence or what would change them.**
5. **Rule numbers were copied into the client.** The 80% floor and "three in a row" were hardcoded in page code and copy.

## Implemented

- **Insights per preparation.** Area accuracy and the score trend are now filtered to the picked preparation (by the question's preparation and the session's preparation, the same rules the review queue and readiness use). The page names the preparation, reloads when you switch, and ignores late responses from the previous one.
- **Area detail page** (`/analytics/area?subject=…&domain=…`), opened from any area row in Insights:
  - accuracy, questions (and how many attempted), missed (answered wrong at least once), due now;
  - topics lowest first (a topic is listed once it has 3 answers);
  - every question in the area, missed first, then due, then not attempted, with an **Open** link into the Question Bank;
  - actions: **Practise this area** (a drill for that area), **Review N misses** when mock misses wait for review, **Review N due** (the spaced deck narrowed to that area);
  - a reading of what it means, in order: misses waiting for review → reviews due → under the floor *in your mocks* → too few mock answers to judge → nothing waiting. Each has *Why am I seeing this?*;
  - honest states: nothing answered shows "—" and "not measured", not 0%; an area the preparation doesn't have says so; failures offer Retry; switching preparation goes back to Insights.
- **"Why am I seeing this?"** on Home's next action, Practice's recommendation cards, Insights' verdict and the area reading. It lists the evidence, each item with its number (for example *Scrum Events: 67% across your last 3 mocks, 24 questions answered*), and what would change it (for example *Scrum Events reaching 80% in the mocks that decide readiness*).
- **One recommendation engine.** Home's ladder moved into `services/recommendation.ts`; Home, Practice, Insights and the area page all read from it.
- **Rule numbers come from the server.** Readiness now includes its `rules` (floor, mocks needed, recency days, plateau size). Explanations and the verdict sentences use them. If they're missing, the text leaves the number out rather than guessing.
- **Spaced review narrowed to an area** (`/practice/spaced?domain=…`), which says it's narrowed, links to everything due, and exits back to the area.
- **Question Bank deep link** (`/question-bank?question=ID`) opens that question; closing it clears the link.

### Design decisions

- **Two populations, named.** The area's figures use every answer including drills (same as the Insights row you clicked). Whether it's *under the floor* comes only from readiness (mocks only). This way the area page can never call an area weak that Home calls fine.
- **Not the prototype's "misses outnumber what is scheduled".** "Missed" never decreases, so that headline couldn't be acted on. It was replaced by the ordered reading above.
- **"Why am I seeing this?" isn't a second call to action.** Home still has exactly one action button. The tests count action buttons separately from the disclosure.

## Files changed

**Backend** — `services/readiness.py` (`rules()`), `api/v1/subjects.py`, `repositories/analytics_repository.py`, `services/analytics_service.py`, `schemas/analytics.py`, `api/v1/analytics.py`, `repositories/spaced_repetition_repository.py`, `services/spaced_review_service.py`, `api/v1/spaced.py`

**Frontend** — new: `services/recommendation.ts`, `components/common/WhyThis.tsx`, `pages/InsightsDomainPage.tsx`; changed: `pages/AnalyticsPage.tsx`, `pages/HomePage.tsx`, `pages/HubPages.tsx`, `pages/SpacedReviewPage.tsx`, `pages/QuestionBankPage.tsx`, `pages/ExamReviewPage.tsx`, `pages/SubjectPage.tsx`, `services/readinessText.ts`, `services/api.ts`, `types/subject.ts`, `types/analytics.ts`, `App.tsx`; `e2e/helpers.ts` (area name for a test mock)

**Docs** — `docs/api/openapi.json` (regenerated, 108 paths)

## API changes (additive)

| Endpoint | Change |
|---|---|
| `GET /analytics/domain-performance` | optional `subject_id`; 404 for an unknown one |
| `GET /analytics/score-trends` | optional `subject_id`; 404 for an unknown one |
| `GET /analytics/domain-detail` | **new**: `subject_id`, `domain` (query, so names with `/` work); 404 when the preparation has nothing in the area |
| `GET /spaced/deck` | optional `domain` |
| `GET /subjects`, `/subjects/{id}` | readiness gains `rules` |

Without the new parameters, responses are unchanged.

## DB changes

None.

## Tests

| Suite | Before | After |
|---|---|---|
| Backend | 640 | **652** (+12: area performance and trend per preparation; unknown preparation 404; the area read from real answers — accuracy, attempted, missed, due, topic grouping, ranking; nothing answered → no percentage; another preparation's same-named area not counted; unknown area 404; a name with `/` through the API; long areas bounded but fully counted; unreviewed mock misses counted, drills not; deck narrowed to an area; readiness carries its rules) |
| Frontend unit | 571 | **605** (+34: the ladder's order and all four answers on every rung; numbers from the rule, none when absent; area reading order; Home and Practice explanations; Insights reads and re-reads the picked preparation, rows open the area; area page counts, actions, reading, topics, questions, empty/404/error/retry, preparation switch; narrowed deck; question deep link opens and clears; verdict sentences follow the rule) |
| E2E | 29 | **31** (+2: two preparations with real mocks — Insights shows only the picked one's area, the verdict's working, the area page matches the server, a question opens in the Question Bank; switching preparation on an area page returns to Insights for the new one) |

Typecheck clean. Lint 0 errors (17 existing warnings).

## Known limitations

- **Review isn't filtered by area.** *Review N misses* opens the preparation's whole review queue.
- **System Design and Interview insights stay shared** across preparations (earlier decision: those practice types aren't tied to one certification).
- **`GET /analytics/dashboard` is still across all preparations.** Nothing in the app calls it.

## Gate decision

**PASS.** Phase 13 is complete. Next: Phase 14, Settings / Data / AI / Onboarding.
