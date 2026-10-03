"""A write that commits but whose reply is lost, then retried. With and without an idempotency key."""
import tools
from tools import AddComment, add_comment


class Transient(Exception):
    pass


def flaky(fn, fail_first):
    state = {"calls": 0}

    def wrapped(args, key):
        state["calls"] += 1
        result = fn(args, key)                  # the write is applied...
        if state["calls"] <= fail_first:
            raise Transient("reply lost")       # ...but the caller never hears back
        return result
    return wrapped


def call_with_retry(fn, args, key, attempts=3):
    for n in range(1, attempts + 1):
        try:
            return fn(args, key)
        except Transient:
            print(f"  attempt {n} failed, retrying")
    raise RuntimeError("gave up")


args = AddComment(ticket_id=101, text="Called the user")

print("Without a stable key (a new key on every retry):")
tools.TICKETS[101]["comments"].clear(); tools.APPLIED.clear()
f = flaky(add_comment, 1)
n = {"i": 0}
def fresh(a, _k):
    n["i"] += 1
    return f(a, f"key-{n['i']}")
call_with_retry(fresh, args, None)
print("  comments on ticket:", len(tools.TICKETS[101]["comments"]))

print("With one stable key per action:")
tools.TICKETS[101]["comments"].clear(); tools.APPLIED.clear()
f = flaky(add_comment, 1)
call_with_retry(f, args, "toolu_123")
print("  comments on ticket:", len(tools.TICKETS[101]["comments"]))
