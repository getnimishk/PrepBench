"""A scripted stand-in for the model so loops, checkpoints and evaluations run without a key."""
from types import SimpleNamespace as NS


def text(t):
    return NS(type="text", text=t)


def call(id_, name, **inp):
    return NS(type="tool_use", id=id_, name=name, input=inp)


class ScriptedModel:
    """Returns the scripted turns in order. `calls` counts how many times the model was asked (cost of a replay)."""

    def __init__(self, turns):
        self.turns, self.calls = list(turns), 0
        self.messages = NS(create=self._create)

    def _create(self, **kw):
        n = len(kw["messages"])                              # which turn are we on? derived from the conversation, so a
        turn_no = sum(1 for m in kw["messages"] if m["role"] == "assistant")   # resumed run asks for the NEXT scripted turn
        self.calls += 1
        content = self.turns[min(turn_no, len(self.turns) - 1)]
        stop = "tool_use" if any(b.type == "tool_use" for b in content) else "end_turn"
        return NS(content=content, stop_reason=stop, usage=NS(input_tokens=100 + 20 * n, output_tokens=40))
