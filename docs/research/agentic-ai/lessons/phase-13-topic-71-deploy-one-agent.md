# Deploy One Agent

**Course:** Agentic AI, from first principles to production · Module 13 Portfolio · lesson 71 of 77 · **about 8 hours** · paper draft for review.  
**Success criterion:** A working URL or hosted demo with authentication, cost limits and logging enabled, and a rollback plan.

> Sources (read 2026-10-03; details and gaps in docs/research/agentic-ai): Lessons 47 and 49 (logging and operations), 51 and 52 (identity and permissions), 56 (Azure cost controls: budgets alert, they do not stop spend), 59 (managed versus custom hosting) and 67 (rollout and incidents); Starlette documentation for the application structure used by the reference code. Management practice is less settled than engineering. Where a source supports a statement we cite it; where a lesson gives our own practice we say 'our practice' and do not borrow authority for it. The reference code for this module was written by us and run on Python 3.14.7: the product, migration, drills and deploy folders have 8, 7, 9 and 6 passing tests, and the RAG evidence report generator runs on the lesson 27 to 31 build. Nothing here ran against a real embedding model, a real LLM, a real legacy database or a cloud account. This lesson is guidance: we cannot deploy for you and ran no hosting platform. The reference app was tested locally with the framework's test client. Unverified: any platform-specific setting; follow your platform's current documentation for the steps and treat our checklist as the controls to look for.

---

## Part 1 · What 'deployed' has to mean

The criterion: *a working URL or hosted demo with authentication, cost limits and logging enabled, and a rollback plan.* Read each word. A server on your laptop is not deployed; a URL anyone can call and spend your money through is deployed **badly**. The five controls are what separate a demo from a service:

| Control | What it must do | Where it usually fails |
|---|---|---|
| **Authentication** | No token, no run; a token per user | Shared keys in the client; an open `/docs` page that runs the agent |
| **Cost limits** | A per-user and a global daily cap, checked **before** the run | Only a billing alert, which tells you after |
| **Logging** | One line per request with ids, status, cost and duration; **never** the content or the token | Logging the prompt, or nothing at all |
| **Rollback** | A way back that needs no new deploy | Rollback meaning 'rebuild the previous version' under pressure |
| **Health check** | An unauthenticated probe that reveals nothing | A probe that returns your configuration |

The reference app (`app.py`, about 60 lines on Starlette) has all of them in a form you can read in ten minutes, with a stand-in for the agent so the controls can be tested without a model. In your deployment, the stand-in becomes your agent. Six tests prove the controls: health needs no auth; no token and wrong token get 401 with nothing run; a valid token runs and records cost against that user; a per-user cap stops one user without stopping another; the kill switch stops everything with no redeploy; and logs carry ids, status and cost but never the content or the token.

**Worked example**

```python
if cfg['kill']:
    log(run=run_id, route='triage', status=503, reason='kill switch')
    return JSONResponse({'error': 'temporarily disabled'}, status_code=503)
```

**Common mistake**

Leaving the framework's auto-generated docs page open on a public URL with the agent behind it.

**Check yourself.** Why must the cost cap be checked before the run, and not only alerted afterwards?

<details><summary>Model answer (write yours first)</summary>

A budget alert tells you after the money is spent; a cap checked before the run prevents the spend (lesson 56 makes the same point about platform budgets).

</details>

---

## Part 2 · Cost limits, kill switch and logs, in the reference app

Three design decisions in `app.py` are worth copying.

**Cost.** Before each run the app adds a small estimate to the user's spend so far and compares it with the daily cap; and it checks a global ceiling (ten times the per-user cap). After the run it records the **actual** cost. Estimating first and recording the actual after is the same approach as budgets for agents in lesson 49. In our test the cap is $0.05 and the stand-in costs $0.013 a run: three runs succeed, and the fourth would exceed the cap once its estimate is added (0.039 + 0.02 = 0.059 against 0.05), so it returns 429. Another user is unaffected.

**Kill switch.** An environment variable `AGENT_KILL=1` makes every request return 503 immediately. It is the fastest **rollback lever** because it needs no deploy: change one setting in your platform and restart or reload. Test it before you need it, and write down who may flip it.

**Logging without content.** Each line holds time, run id, user, route, status, cost and duration. The test sends a request containing the text 'SECRET customer text' and asserts it appears nowhere in the log, and neither does the token. If your platform captures request bodies by default (some do, for diagnostics), turn that off or sanitise it; **check what your platform records**, because your own code is not the only logger.

Two things the reference app does not do, and you must treat as hard constraints for the lab, not options: it keeps spend in memory (a restart resets it; use a store in a real deployment) and it uses static tokens from the environment (use your platform's identity service where available, lesson 51).

**Worked example**

```python
if SPEND.get(user, 0.0) + cfg['est'] > cfg['cap'] or SPEND['global'] + cfg['est'] > cfg['cap'] * 10:
    log(run=run_id, user=user, route='triage', status=429, reason='cost cap')
    return JSONResponse({'error': 'daily cost cap reached'}, status_code=429)
```

**Common mistake**

Storing the cap or spend only in process memory on a platform that runs several instances; each instance then has its own count.

**Check yourself.** What does the kill switch give you that a redeploy does not?

<details><summary>Model answer (write yours first)</summary>

Speed and no dependency on a build: one setting stops all runs immediately, which is the right first action in an incident.

</details>

---

## Part 3 · Your deployment checklist and rollback plan

We cannot tell you the exact clicks for your platform, and they change; use its current documentation. What you can do is **verify each control on the running URL**, which is platform independent:

1. **Authentication.** `curl` the endpoint with no token: expect 401. With a wrong token: 401. Open the docs or schema pages: they must be off or protected.
2. **Cost cap.** Set a very low cap, call until you get 429, then restore the cap. Confirm another user is unaffected.
3. **Logging.** Send a request with a unique marker phrase. Search the platform's logs for it. It must not be there.
4. **Kill switch.** Flip it, confirm 503, flip back, confirm 200. Time it.
5. **Health.** Confirm `/health` answers without a token and returns only `ok`.
6. **Budget alert.** Set a platform budget notification at 50, 80 and 100 percent as a second line, remembering it only notifies.

**Rollback plan** (one page): the fast lever (kill switch), the slower lever (redeploy the previous image or version, with the exact command or portal step and the time it takes when you tried it), the data you must not roll back (audit log), who decides, and how you tell users. A rollback you have not practised is a hope. **Practise once** and write down the minutes it took.

Then record the deployment as evidence: the URL (or a screenshot of the working demo if you do not want it public), the six checks with their results, the rollback timing, the monthly cost estimate from lesson 65, and the date. If the URL is public, **consider taking it down after the interview season**; an unattended endpoint is a liability.

**Worked example**

Fictional rollback line: 'Kill switch: change AGENT_KILL to 1 in the app settings; verified 503 in 40 seconds on 2026-10-10. Redeploy previous version: 6 minutes. Owner: me.'

**Common mistake**

Claiming 'rollback plan' as a document with no timings. Tried and timed beats written and hoped.

**Check yourself.** Name three checks you can do on the running URL that prove a control works.

<details><summary>Model answer (write yours first)</summary>

Call with no token and expect 401; call past a low cap and expect 429; send a marker phrase and confirm it is absent from logs; flip the kill switch and confirm 503.

</details>

---

## Do it: lab

1. Before anything is deployed, meet the pre-deployment gate: synthetic or non-sensitive data only; no production credentials or customer data; a platform where you can set a hard spend limit, or one that is free with no payment method attached (check its billing behaviour first); and do not deploy the in-memory reference limiter unchanged. Pick ONE platform and stay on it for the whole lab, because learning a second platform is not the point (the course prescribes none, since platform steps change). Note the cost and the data it will hold.
2. Adapt `app.py` so your agent replaces the stand-in; keep the controls and the tests; run the tests locally.
3. Deploy, following your platform's current documentation, and record each setting you changed.
4. Run the six checks on the live URL and record the results.
5. Set a platform budget notification as a second line.
6. Write the one-page rollback plan, practise the fast and slow levers, and record the timings.

**Done when:** you have a working URL or hosted demo, with six verified controls, a budget notification, a rollback plan with measured timings, and a note of what your platform logs by default.

---

## Interview check

**Question.** How do you deploy an agent responsibly?

<details><summary>A strong answer has this shape</summary>

1. Authentication per user, a cost cap checked before the run (alerts only tell you afterwards), and logging of ids, status and cost but never content.
2. A kill switch that needs no redeploy, a health probe that reveals nothing, and a rollback plan I have practised and timed.
3. I verify each control on the live URL, not only in tests, and I check what the platform itself logs.
4. I treat a public demo as a liability to be removed when it has served its purpose.

</details>

---

## Evidence to keep

Keep the six-check results, the timings, the rollback page and the platform settings list.

---
