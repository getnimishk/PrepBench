# Handoffs & routing

**Course:** Agentic AI, from first principles to production · Module 8 Multi-Agent · lesson 44 of 77 · **about 2 hours** · paper draft for review.  
**Success criterion:** Describe 3 ways a handoff fails (lost context, loops, wrong route) and one fix and one test for each.

> Sources (read 2026-10-02; details and gaps in docs/research/agentic-ai): Microsoft Azure Architecture Center, 'AI agent orchestration patterns' (2026-02-12): the handoff pattern (full control transfers; avoid it when the right agent is identifiable from the input, when suboptimal routing would hurt, and when infinite loops are hard to avoid), context and state management, reliability (validate output before passing it on), security (carry the user's identity; trimming in every agent); Anthropic Engineering 'Building effective agents' (the routing workflow, via lesson 20); the course's lesson 25 on reliability, read 2026-10-02. The code on this page (the multi folder) was written by us and run on Python 3.14.7; its 12 tests passed. The agents in it are plain functions and scripted stand-ins, with no real model, so it tests control logic and cost arithmetic, not the quality of any model's answers. The keyword router and its ten test messages are ours and are deliberately weak, to give routing something to get wrong. Unverified: routing accuracy of any model-based router; the right hop limit for your system.

---

## Part 1 · Control and context: what actually moves in a handoff

A **handoff** transfers the case from one agent to another. Two things move, and both can go wrong:

- **Control:** the new agent is now the one acting. Microsoft's guide says full control transfers; the previous agent is not running alongside.
- **Context:** whatever the new agent will know. If nothing is passed, it starts blank and asks the customer again. If everything is passed, it inherits a long conversation and its cost.

The guide's advice is to decide what the next agent needs: the full raw context in some cases, a compact summary in others, and sometimes only a fresh instruction. Our design makes the choice explicit with a **handoff packet**, validated in code:

```python
class HandoffPacket(BaseModel):
    """What the receiving agent needs so it does not have to ask the customer again."""
    to: str
    goal: str = Field(min_length=5, description="what the customer wants, in one sentence")
    facts: dict[str, str] = Field(min_length=1, description="identifiers and values already established, e.g. order id")
    tried: list[str] = Field(default_factory=list, description="what has already been done or ruled out")
    ask: str = Field(min_length=5, description="what the receiving agent is being asked to do")
```

The packet has five fields: **who** to hand to, the **goal** in one sentence, the **facts** already established (at least one: an order id, an environment name), what was **tried**, and what is being **asked**. A handoff with no facts is rejected by validation. That makes 'lost context' a test failure instead of a customer complaint.

**Worked example**

Fictional packet: to=billing, goal='Get the duplicate charge refunded', facts={order_id: 'A-1042'}, tried=['checked the invoice'], ask='Issue the refund if the charge is a duplicate'. The billing agent starts with all it needs, and a person reviewing the trail sees the reason for the transfer.

**Common mistake**

Handing over only the last message. The receiving agent then lacks the identifiers and history it needs and either guesses or asks the customer to repeat everything.

**Check yourself.** What two things move in a handoff, and what does our packet do to stop context being lost?

<details><summary>Model answer (write yours first)</summary>

Control and context. The packet requires a goal, at least one established fact, what was tried, and what is asked, and is validated, so a handoff without the key facts is rejected.

</details>

---

## Part 2 · Three ways handoffs fail, with a fix and a test for each

The criterion asks for three failures, each with one fix and one test. Here they are, with the code that does it and the tests that pass (12 tests across the multi-agent folder).

**1. Lost context.**
- *What happens:* the receiving agent gets too little and has to re-ask or guess.
- *Fix:* the validated `HandoffPacket` above.
- *Tests:* a packet with no facts is rejected (`test_a_packet_without_the_order_id_is_rejected`); the receiving agent sees the facts the sender established and the final answer cites the order id (`test_the_receiver_sees_the_facts_the_sender_established`).

**2. Loops.**
- *What happens:* A hands to B, B hands back to A, forever; or a long chain of different agents never finishes. Microsoft lists infinite handoff loops as the standing risk of this pattern.
- *Fix:* a hop limit and a ping-pong check, and on either trigger the case goes to a person with its trail, instead of looping or silently failing:

```python
def route(agents: dict, start: str, packet: HandoffPacket, max_hops=4):
    trail, current = [], start
    while True:
        trail.append(current)
        if len(trail) > max_hops:
            raise Escalate(f"more than {max_hops} hops: {' -> '.join(trail)}")
        if len(trail) >= 4 and trail[-4] == trail[-2] and trail[-3] == trail[-1] and trail[-1] != trail[-2]:
            raise Escalate(f"ping-pong between {trail[-2]} and {trail[-1]}: {' -> '.join(trail)}")
        kind, out = agents[current](packet)
        if kind == "done":
            return out, trail
        packet, current = out, out.to
```
- *Tests:* a-b-a-b is stopped and escalated with the trail in the message (`test_ping_pong_is_stopped_and_escalated`); a six-agent ring is stopped by the hop limit (`test_a_long_chain_of_different_agents_is_also_stopped`); and a single legitimate hand-back (triage, technical, triage, billing) is allowed (`test_one_legitimate_hand_back_is_allowed`). That last test matters: a guard that blocks all returns would also block the fix for the third failure.

**3. The wrong route.**
- *What happens:* triage sends a case to the wrong specialist, which then gives a poor answer or bounces it back.
- *Fix:* measure routing on labelled cases so you know how often and where it is wrong, and let a specialist hand back once with a reason.
- *Tests:* `routing_report()` runs a router over ten labelled messages and reports the confusion counts; a perfect classifier scores 10 of 10 on the same set, so you can compare routers fairly (`test_routing_is_measured_on_labelled_cases`, `test_a_better_classifier_can_be_compared_on_the_same_cases`).

Our intentionally weak keyword router gets **7 of 10** right. Its mistakes are instructive: 'The invoice page is slow to load' and 'My payment failed with an error code 502' are technical problems that mention billing words, so they went to billing; and 'Can you cancel everything?' has no keywords at all, so it went to 'unknown'. The confusion counts:

| Truth | Routed to | Count |
|---|---|---|
| billing | billing | 3 |
| technical | technical | 2 |
| technical | billing | 2 |
| account | account | 2 |
| account | unknown | 1 |

Ten messages is far too few to estimate a real router (7 of 10 has a 95 percent interval of about 40 to 89 percent), but it is enough to show **how to look**: by truth and by destination, not as one accuracy figure.

**Worked example**

Fictional production rule: if a specialist hands back, the trail is logged with the reason ('this is a technical fault, not billing'). A weekly review of hand-backs by reason tells you which routing rule to fix, so the wrong-route failure becomes a source of improvement.

**Common mistake**

Adding a hop limit that also forbids a legitimate hand-back. Test the good path as carefully as the bad one.

**Check yourself.** Name the three handoff failures, one fix and one test for each.

<details><summary>Model answer (write yours first)</summary>

Lost context (validated packet; test that a packet without facts is rejected), loops (hop limit and ping-pong check with escalation; test that a-b-a-b is stopped), wrong route (measured routing set and one hand-back; test the router on labelled cases and compare).

</details>

---

## Part 3 · Routing: code, a model, or a conversation

Routing is a decision, and Microsoft's guide says to match its mechanism to the situation. Three mechanisms, in order of how much they cost and how much they surprise you:

| Mechanism | How | Use when | Risk |
|---|---|---|---|
| **Deterministic rules** | Code decides from fields or keywords | The right agent is identifiable from the input; the guide says **avoid the handoff pattern** here and use a simple dispatcher | Brittle on messy text (our keyword router: 7 of 10) |
| **A classifier call** | A model assigns one label from a fixed set; code runs the chosen branch (the 'routing' workflow of lesson 20) | Messy text, a small fixed set of destinations | A wrong label; measure it |
| **Agents decide to hand off** | The current agent judges that another is better and transfers control | The right specialist emerges only during the work | Loops, unpredictable paths; needs the guards above |

The guide's list of when **not** to use agent-decided handoff is a useful filter: when the appropriate agent is identifiable from the initial input; when routing is deterministic and rule-based; when poor routing would be a bad experience; when several operations should run at once; and when it is hard to avoid bouncing between agents. Most routing in practice should be the first or second row.

Three practices apply to all three. **Carry the user's identity** across the handoff and apply security trimming in the receiving agent: it must not return data the user may not see, even if the previous agent could. **Log the route** (who handed what to whom, why, with the packet) so a wrong answer can be traced. And **always keep a path to a person**, as an agent in the graph with its own packet, so that 'I cannot route this' is a designed outcome.

**Worked example**

Fictional. 80 percent of messages contain an order id and a clear verb ('refund', 'invoice'). A rule routes those; the rest go to a one-call classifier; and only the 3 percent that are ambiguous are left to an agent to hand off or escalate. Each layer is cheaper and more predictable than the one after it.

**Common mistake**

Using an agent-decided handoff for every routing choice because it is the most flexible. It is also the least predictable and most expensive; use it for what rules and a classifier cannot decide.

**Check yourself.** When does Microsoft's guide say to avoid the handoff pattern, and what do you use instead?

<details><summary>Model answer (write yours first)</summary>

When the right agent is identifiable from the initial input (or routing is deterministic). Use a deterministic router or a simple dispatcher that classifies and sends the case to the right agent.

</details>

---

## Do it: lab

1. Take the support scenario from lesson 43 (or your own). Write the handoff packet for each arrow in the diagram and the validation that rejects an incomplete one.
2. For each of the three failures (lost context, loops, wrong route) write one fix and one test for your scenario, and run the tests with a scripted set of agents (use `handoff.py` as the base).
3. Write 20 labelled messages for your scenario, including at least 6 that mention words from the wrong category, and 2 with no keywords. Run a keyword router and a classifier-call router over them, and report the confusion counts, not only accuracy.
4. Add the hop limit and the ping-pong check, and the single allowed hand-back. Prove with tests that the good path still works.
5. Write the routing log format (who, to whom, why, packet, user identity) and one query you would run on it each week.

**Done when:** you can describe three handoff failures (lost context, loops, wrong route), each with one fix and one passing test, you have a labelled routing set with confusion counts for two routers, and your guards stop loops without blocking a legitimate hand-back.

---

## Interview check

**Question.** How do you stop agents from bouncing a case between them, or losing information on the way?

<details><summary>A strong answer has this shape</summary>

1. Define the handoff as a validated packet: goal, established facts, what was tried, what is asked. A handoff missing the key facts is rejected, so context is not lost.
2. Put a hop limit and a ping-pong check around the whole chain, and on either trigger escalate to a person with the trail; also allow one deliberate hand-back with a reason and test that it works.
3. Measure routing on labelled cases and look at confusion counts, because one accuracy figure hides which route is wrong.
4. Use deterministic rules or a classifier where the destination is clear from the input and keep agent-decided handoff for cases that really need it.
5. Carry the user's identity through and log every handoff.

</details>

---

## Evidence to keep

Keep the packet definitions, the three fix-and-test pairs, the labelled routing set with confusion counts for both routers, the guard tests and the routing log design. They are inputs to the multi-agent build.

---
