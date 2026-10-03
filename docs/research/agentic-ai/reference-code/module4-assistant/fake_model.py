"""A scripted stand-in for the model, so loops can be tested without a key or a network."""
from types import SimpleNamespace as NS


def text(t):
    return NS(type="text", text=t)


def call(id_, name, **inp):
    return NS(type="tool_use", id=id_, name=name, input=inp)


class ScriptedModel:
    def __init__(self, turns):
        self.turns, self.i = list(turns), 0
        self.messages = NS(create=self._create)

    def _create(self, **kw):
        content = self.turns[min(self.i, len(self.turns) - 1)]
        self.i += 1
        stop = "tool_use" if any(b.type == "tool_use" for b in content) else "end_turn"
        return NS(content=content, stop_reason=stop, usage=NS(input_tokens=100, output_tokens=40))
