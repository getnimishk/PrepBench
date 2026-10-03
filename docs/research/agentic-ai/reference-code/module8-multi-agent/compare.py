"""One agent doing three investigations in one conversation, versus an orchestrator with three workers (one small conversation each).

Everything here is a MODEL OF COST, not of quality: tool results are fixed text, the 'model' is scripted, and tokens are estimated
at 4 characters each. It shows how input tokens grow when one conversation carries everything, and what a worker split changes.
Whether the multi-agent answer is better needs real model runs: that is the lab.
"""
import asyncio
import math

PIPELINES = ["orders", "payments", "customers"]
LOG = {p: f"{p}: run failed at step 4 with a long stack trace " + "x" * 1600 for p in PIPELINES}     # ~400 tokens of tool output each
SYSTEM = "You are a DataOps assistant. " * 12                                                         # ~90 tokens


def est(text) -> int:
    return math.ceil(len(str(text)) / 4)


class Meter:
    def __init__(self):
        self.calls, self.input, self.output = 0, 0, 0

    def call(self, messages, reply):
        self.calls += 1
        self.input += est(SYSTEM) + sum(est(m) for m in messages)       # every call re-sends the whole conversation
        self.output += est(reply)
        return reply


def single_agent():
    m, messages = Meter(), ["Investigate the orders, payments and customers pipelines and summarise."]
    for p in PIPELINES:
        messages.append(m.call(messages, f"tool_use get_run_log({p})"))
        messages.append(LOG[p])                                          # the tool result stays in the conversation
        messages.append(m.call(messages, f"Noted: {p} failed at step 4."))
    final = m.call(messages, "Summary: all three pipelines failed at step 4; check the shared upstream file.")
    return m, final


async def worker(p, meter):
    messages = [f"Investigate the {p} pipeline and report in one sentence."]
    messages.append(meter.call(messages, f"tool_use get_run_log({p})"))
    messages.append(LOG[p])
    return meter.call(messages, f"{p} failed at step 4.")                # only this short summary goes back up


async def multi_agent():
    meters = [Meter() for _ in PIPELINES]
    summaries = await asyncio.gather(*(worker(p, mt) for p, mt in zip(PIPELINES, meters)))
    boss = Meter()
    boss.call(["Investigate three pipelines and summarise."], "tool_use spawn x3")
    final = boss.call(["Investigate three pipelines and summarise.", *summaries], "Summary: all three failed at step 4; check the shared upstream file.")
    total = Meter()
    for mt in [*meters, boss]:
        total.calls += mt.calls
        total.input += mt.input
        total.output += mt.output
    return total, final, max(mt.calls for mt in meters) + boss.calls


if __name__ == "__main__":
    s, _ = single_agent()
    t, _, critical = asyncio.run(multi_agent())
    print(f"single agent : {s.calls} model calls in sequence, {s.input:6} input tokens, {s.output} output tokens")
    print(f"orchestrator : {t.calls} model calls ({critical} on the longest path), {t.input:6} input tokens, {t.output} output tokens")
    print(f"input tokens, multi / single: {t.input / s.input:.2f}x   model calls, multi / single: {t.calls / s.calls:.2f}x")
    # the same split with 3 pipelines becomes 12: how each design scales
    for n in (3, 6, 12, 24):
        PIPELINES[:] = [f"p{i}" for i in range(n)]
        LOG.update({p: f"{p}: run failed at step 4 " + "x" * 1600 for p in PIPELINES})
        s, _ = single_agent()
        t, _, _ = asyncio.run(multi_agent())
        print(f"{n:3} pipelines: single {s.input:8} input tokens | multi {t.input:8} | multi/single {t.input / s.input:.2f}")
