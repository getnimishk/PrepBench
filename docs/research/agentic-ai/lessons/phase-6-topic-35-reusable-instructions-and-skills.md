# Reusable instructions & skills

**Course:** Agentic AI, from first principles to production · Module 6 Real Agents · lesson 35 of 77 · **about 2 hours** · paper draft for review.  
**Success criterion:** Write a short project-guidance file and one skill for your DataOps agent, show a test that the skill triggers on the right task and not on an unrelated one, and name one rule that must be enforced by code, not left as advice.

> Sources (read 2026-10-02; details and gaps in docs/research/agentic-ai): Anthropic documentation 'Agent Skills' (SKILL.md with YAML frontmatter, required name and description, their limits; three levels of progressive disclosure with about 100 tokens of metadata per skill and a body under about 5,000 tokens; where skills live; 'use skills only from trusted sources'; custom skills do not sync across surfaces; undated page); Claude Academy AI-native SDLC Playbook, lessons 'The CLAUDE.md' and 'Skills as institutional knowledge' and 'Hooks as approval gates' (project guidance kept short, in version control, changed by pull request; skills are advisory, back a must-comply rule with a deterministic hook), read 2026-09-30 through page summaries. The reference code on this page (the dataops folder) was written by us and run on Python 3.14.7 with Pydantic 2.13.4 and pytest 9.1.1 against a scripted stand-in for the model; the folder's tests passed (58 in all, covering lessons 33 to 55; 16 of them cover the state, memory and skills code). It uses the same message shapes as Anthropic's documented Messages API but has not been run against a real model (no key). The SKILL.md in our folder, its linter and the proxy test are ours. Unverified: how reliably any model triggers a skill from its description alone; the real test needs a model, and the lab describes it. The limits we lint against are the ones in the vendor page we read and may change.

---

## Part 1 · Instructions that travel: project guidance and skills

An agent that knows nothing about your team makes the same mistakes every day. Two kinds of reusable instruction carry knowledge into it, and they differ in when they load:

| | Project guidance | Skill |
|---|---|---|
| Example | A `CLAUDE.md` or `AGENTS.md` style file at the root of a repository | A folder with a `SKILL.md` and optional files |
| When it enters the model's context | **Always**, at the start | **On demand**: only the name and description are always there; the body loads when the skill is judged relevant |
| Best for | A short set of conventions, commands, architecture notes and 'things it gets wrong' | A procedure for one kind of task, with detail and files that would clutter every conversation |
| Cost when unused | Tokens on every run, so keep it short | About 100 tokens per skill for its metadata (Anthropic's figure), none for the body |
| Owned and changed | Version control, by pull request | The same: it is a file, reviewed like code |

The SDLC Playbook's advice on guidance files is brief: keep it short, in version control, changed by pull request, and add to it when the agent repeats a mistake. Anthropic's skills page describes **progressive disclosure** in three levels: (1) metadata, name and description, always loaded; (2) the body of `SKILL.md`, loaded when the skill is triggered, recommended under about 5,000 tokens; (3) extra files and scripts, read or run only when the instructions point to them, with script *output*, not code, entering the context. That is why you can install many skills without paying for them all on every call.

What a skill file looks like (ours, for the DataOps agent you build in lesson 37):

```markdown
---
name: dataops-triage
description: Triage a failed or anomalous data pipeline run. Use when a ticket mentions a pipeline failure, an ERR- error code, stale or missing data, or a row-count anomaly. Do not use for access requests, expenses or general questions.
---

# DataOps triage

## Steps
1. Read the ticket and name the pipeline. If no pipeline is named, ask; do not guess.
2. Call `get_run_log` for that pipeline.
3. If the log has an `ERR-` code, call `search_runbook` with that code.
4. Say what you found and what the runbook recommends, in two or three sentences.
5. Only if the runbook names a fix that matches a write tool, propose it and wait for a person's approval.

## Advice, not enforcement
Never change data without approval. This sentence is advice to the model. The real control is the approval gate in code
(`ApprovalGate`), which blocks every write tool whatever this file says.
```

**Worked example**

Fictional. Without guidance, the DataOps agent proposes a rerun for every failure. After a reviewer adds a line to the project file ('a quota error ERR-6001 has no automatic fix; page on-call'), that mistake stops. The line was added by pull request, with the failing ticket in the description.

**Common mistake**

Putting everything into one giant always-loaded file. It costs tokens every time, buries the important rules, and nobody reads it. Move procedures into skills and keep the always-on file to what applies to every task.

**Check yourself.** Which loads at the start of every run, a project guidance file or a skill's body, and what does that imply for how long each should be?

<details><summary>Model answer (write yours first)</summary>

The project guidance file is always loaded, so it must be short. A skill's body loads only when triggered, so it can hold more detail; only its name and description are always present.

</details>

---

## Part 2 · The description decides whether a skill is used

A model chooses a skill by reading its **description**, so the description is the most important line in the file. The vendor page says it must state both what the skill does and when to use it, and gives limits: `name` at most 64 characters, lowercase letters, digits and hyphens, no reserved words ('anthropic', 'claude'); `description` non-empty, at most 1,024 characters, no XML tags.

Two failure modes follow:

- **Under-triggering:** the description is vague ('helps with data'), so the model never reaches for it when it should.
- **Over-triggering:** the description is so broad ('for anything about pipelines or tickets or users') that it loads on unrelated tasks, wasting context and steering the model wrongly.

Our description names positives and a negative: 'Triage a failed or anomalous data pipeline run. Use when a ticket mentions a pipeline failure, an ERR- error code, stale or missing data, or a row-count anomaly. Do not use for access requests, expenses or general questions.'

Testing it has two layers, and it matters to be honest about which is which.

**Offline checks (ours, cheap, run in CI).** A linter checks the documented limits and that the description says when to use the skill. A *proxy* trigger test checks that a task shares meaningful words with the part of the description before 'Do not use'. Both are sanity checks. They catch a typo in the name, a missing 'Use when', and a description that shares no words with its target tasks. **They do not prove the model triggers the skill**, because the model's judgement is not word overlap.

```python
"""Check a SKILL.md against the documented limits and run a cheap PROXY test of its description.

Real triggering is decided by the model reading the descriptions, so the only true test of 'does it trigger on the
right task' is a run with a model. `proxy_trigger` is a sanity check you can run offline: it catches a description that
shares no words with the tasks it is meant for, or that matches everything.
"""
import re

RESERVED = ("anthropic", "claude")


def parse(path):
    text = open(path, encoding="utf-8").read()
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    if not m:
        raise ValueError("no YAML frontmatter")
    meta = dict(line.split(": ", 1) for line in m.group(1).splitlines() if ": " in line)
    return meta, m.group(2)


def lint(path):
    meta, body = parse(path)
    problems = []
    name, desc = meta.get("name", ""), meta.get("description", "")
    if not re.fullmatch(r"[a-z0-9-]{1,64}", name):
        problems.append("name must be 1-64 characters: lowercase letters, digits, hyphens")
    if any(w in name.lower() for w in RESERVED):
        problems.append("name contains a reserved word")
    if not desc or len(desc) > 1024:
        problems.append("description must be non-empty and at most 1024 characters")
    if "<" in desc or "<" in name:
        problems.append("no XML tags in name or description")
    if "use when" not in desc.lower():
        problems.append("description should say WHEN to use the skill ('Use when ...')")
    if len(body.split()) > 3500:                       # the docs suggest keeping the body under about 5k tokens
        problems.append("body is long; split detail into separate files")
    return problems


def words(text):
    return {w for w in re.findall(r"[a-z0-9-]+", text.lower()) if len(w) > 3}


def proxy_trigger(description, task, threshold=2):
    """True if the task shares at least `threshold` meaningful words with the part of the description before 'Do not use'."""
    positive = re.split(r"do not use", description, flags=re.I)[0]
    return len(words(positive) & words(task)) >= threshold
```

**The real test needs a model.** Write 10 to 20 task descriptions labelled 'should trigger' or 'should not'. Run your agent on each with the skill installed, and record whether the model read the skill's `SKILL.md` (visible in the tool-call trace). Report the counts both ways: triggered when it should, and (just as important) not triggered when it should not. That is the test your lab asks for, and it is the same shape as every evaluation in this course.

**Worked example**

```python
desc = parse(SKILL)[0]['description']
proxy_trigger(desc, 'The payments pipeline failed with ERR-4417 overnight')       # True
proxy_trigger(desc, 'Please approve my travel expenses for the hotel')           # False
```

**Common mistake**

Treating the offline proxy test as proof that the skill triggers. It only checks that the words are plausible; run the real labelled tasks through a model.

**Check yourself.** Why must a skill's description say when to use it, and what two ways can a description go wrong?

<details><summary>Model answer (write yours first)</summary>

The model matches the task to the description to decide whether to load the skill, so 'when' is the trigger. It can be too vague (never triggers) or too broad (triggers on unrelated tasks).

</details>

---

## Part 3 · Advice versus enforcement

The most important sentence in this lesson is one the SDLC Playbook makes in its skills lesson: **a skill is advisory, not enforcement.** A model that has read 'never change data without approval' can still do it, because an instruction is text and text can be ignored, misread or overridden by something in the conversation. A rule that must hold needs a control the model cannot talk its way past, which means code. The Playbook's own phrase is to back any must-comply rule with a deterministic hook.

In our DataOps agent the line in `SKILL.md` ('Never change data without approval') is advice. The real control is three things in code:

1. **The write tools are marked `writes=True`**, and the tool runner refuses to run one unless the approval gate returns yes.
2. **Tier 2 runs are never given the write tools at all**, so the model cannot even request one.
3. **The gate logs who approved what**, so a write without a recorded approval is evidence of a bug.

A test shows the difference: a tier-2 run where the scripted model asks for `rerun_job` anyway. The call fails as 'unknown tool', nothing changes, and the gate is never reached. The model asked; the code did not allow it.

So when you write a rule, ask: **what happens if the model ignores this sentence?** If the answer is 'something bad and irreversible', it belongs in code (a gate, a permission, a tool that is simply absent, a validation). If the answer is 'a slightly worse answer', advice is fine. Skills also deserve the care of any code that can steer an agent: Anthropic's page says to use skills only from sources you trust, because a malicious skill can direct the agent to misuse tools, so review a skill, its scripts and any URLs it fetches before installing it.

**Worked example**

Fictional rule: 'never email a customer without a manager's approval.' As advice in a skill it will be followed most of the time. As a send-email tool that refuses to run without a recorded approval, it is followed always. Do both: the advice saves tokens by avoiding refused calls, the code is the guarantee.

**Common mistake**

Writing 'never' and 'always' into instructions and calling the matter closed. 'Never' in a prompt is a request, not a control.

**Check yourself.** Name one rule from a DataOps agent that must be enforced by code, not left as advice, and how.

<details><summary>Model answer (write yours first)</summary>

'No write without approval.' Mark write tools in code and have the runner block them unless an approval gate returns yes, give lower-autonomy tiers no write tools, and log each approval.

</details>

---

## Do it: lab

1. Write a short project-guidance file for your DataOps agent (under 40 lines): conventions, the commands to run the tests, the architecture in five lines, and three 'things it gets wrong'. Put it in version control.
2. Write one skill for the agent in a `SKILL.md` with a description that says what it does, when to use it and when not. Run the linter on it and fix every finding.
3. Write 12 labelled tasks (6 that should trigger the skill, 6 that should not, including tricky near-misses). Run the offline proxy test. Then run the real test: have your agent (with a model) do each task and record whether it read the skill. Report both counts.
4. Name one rule that must be enforced by code, not left as advice. Implement it and write the test that fails if the model asks to break it.
5. Review a skill you did not write (for example one from a public repository) using the security checklist: scripts, network calls, URLs it fetches, files it touches. Write down what you would need to see before trusting it.

**Done when:** you have a guidance file, one skill that passes the linter, a labelled trigger test with both counts (proxy and real model), a rule enforced by code with a test that proves the model cannot break it, and a short security review of a skill.

---

## Interview check

**Question.** Our team wants to put all our rules into a prompt file so the agent behaves. What do you tell them?

<details><summary>A strong answer has this shape</summary>

1. Instructions help a model do the right thing most of the time. Keep them short, in version control, changed by pull request, and add to them when the agent repeats a mistake.
2. Put procedures into skills with precise descriptions so they load only when relevant; test the triggering on labelled tasks, counting both misses and false triggers.
3. Anything that must always hold, such as approvals, permissions, data access or spend limits, goes into code: a gate, a missing tool, a validation. An instruction is advice and can be ignored.
4. Treat skills like code you install: review who wrote them and what they can reach.

</details>

---

## Evidence to keep

Keep the guidance file, the skill and its lint result, the labelled task set with both counts, the enforced rule and its test, and the security review. They are part of the DataOps build (lesson 37).

---
