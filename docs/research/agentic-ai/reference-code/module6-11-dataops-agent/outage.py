"""A provider outage and a rate-limit storm, simulated second by second, against two clients.

Timeline (seconds):   0-99 normal | 100-199 rate-limit storm (70% of calls get 429; some replies are lost after the work was done)
                      200-299 outage (every call fails with 503) | 300-599 recovery
One task arrives every second and needs ONE provider call whose effect must happen exactly once. The provider can serve 3 calls a second.

naive   : retries a failed call straight away, up to 5 times, then drops the task. No queue, no breaker, no idempotency key.
robust  : per-task exponential backoff with jitter that honours the provider's retry-after, a circuit breaker, a queue, an idempotency key per task, and a person-escalation after 300 s waiting.
NOT modelled: the degradation ladder (read-only, log-only) and 'writes stopped first'. Every task here is one effectful call; that ladder is a design in the lesson, tested by you in the lab.
Nothing here uses real time or a real provider; it is a model of behaviour.
"""
import random

STORM, OUTAGE, RECOVERY, END = range(100, 200), range(200, 300), 300, 600
CAPACITY = 3


class Provider:
    def __init__(self, rng):
        self.rng, self.applied, self.calls, self.second, self.in_second = rng, {}, 0, -1, 0
        self.retry_after = 0                                              # seconds the provider asks us to wait after a 429 (like a retry-after header)

    def call(self, t, task_id, key=None):
        """Returns 'ok', '429', '503' or 'lost' (the work was done but the reply never arrived)."""
        self.calls += 1
        if t != self.second:
            self.second, self.in_second = t, 0
        self.in_second += 1
        if t in OUTAGE:
            return "503"
        if t in STORM and self.rng.random() < 0.7:
            self.retry_after = 3
            return "429"
        if self.in_second > CAPACITY:
            self.retry_after = 1
            return "429"
        if key is not None and key in self.applied:                      # same idempotency key: do not do it again
            return "ok"
        self.applied[(key or f"{task_id}#{self.calls}")] = task_id        # without a key every call is a new effect
        return "lost" if (t in STORM and self.rng.random() < 0.1) else "ok"


def naive(seed=3):
    rng = random.Random(seed)
    prov, done, lost = Provider(rng), set(), set()
    for t in range(END):
        task = t
        for _ in range(5):                                                # retry immediately
            r = prov.call(t, task)
            if r == "ok":
                done.add(task)
                break
        else:
            lost.add(task)
    effects = {}
    for tid in prov.applied.values():
        effects[tid] = effects.get(tid, 0) + 1
    return dict(completed=len(done), lost=len(lost), escalated=0, duplicated=sum(v > 1 for v in effects.values()), provider_calls=prov.calls, peak_queue=0)


def robust(seed=3, sla=60, give_up=300):
    """Queue + per-task exponential backoff with jitter that never waits less than the provider's retry-after + a circuit breaker + one idempotency key per task."""
    rng = random.Random(seed)
    prov, queue, done, late, escalated = Provider(rng), [], set(), set(), set()
    state, fails, reopen_at, peak, waits = "closed", 0, 0, 0, []
    for t in range(END):
        queue.append({"tid": t, "arrived": t, "attempts": 0, "next": t})
        peak = max(peak, len(queue))
        budget = 2                                                        # we send at most 2 calls a second, below the provider's 3
        for item in list(queue):
            if not budget:
                break
            if t - item["arrived"] > give_up:                             # waited too long: a person takes it
                queue.remove(item)
                escalated.add(item["tid"])
                continue
            if item["next"] > t:                                          # still backing off
                continue
            if state == "open":
                if t >= reopen_at:
                    state = "half-open"
                else:
                    break
            budget -= 1
            r = prov.call(t, item["tid"], key=f"task-{item['tid']}")      # one stable key per task, reused on every retry
            if r == "ok":
                queue.remove(item)
                (done if t - item["arrived"] <= sla else late).add(item["tid"])
                fails, state = 0, "closed"
                continue
            fails += 1
            item["attempts"] += 1
            backoff = min(2 ** item["attempts"], 60)                       # 2, 4, 8 ... capped at 60 s
            wait = max(backoff * rng.uniform(0.5, 1.0), prov.retry_after if r == "429" else 0)   # jitter, but never below retry-after
            item["next"] = t + wait
            waits.append(wait)
            if state == "half-open" or fails >= 5:                        # trip the breaker and wait before testing again
                state, reopen_at = "open", t + 20
                break
    effects = {}
    for tid in prov.applied.values():
        effects[tid] = effects.get(tid, 0) + 1
    return dict(completed=len(done) + len(late), on_time=len(done), late=len(late), lost=0, still_queued=len(queue), escalated=len(escalated),
                duplicated=sum(v > 1 for v in effects.values()), provider_calls=prov.calls, peak_queue=peak,
                retries=len(waits), longest_wait=round(max(waits), 1) if waits else 0)


if __name__ == "__main__":
    for name, fn in (("naive", naive), ("robust", robust)):
        r = fn()
        print(f"{name:7}", ", ".join(f"{k}={v}" for k, v in r.items()))
