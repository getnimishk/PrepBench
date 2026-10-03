# lesson 9 checks
def f(a, L=[]):
    L.append(a); return L
print(f(1), f(2), f(3))
def g(a, L=None):
    if L is None: L = []
    L.append(a); return L
print(g(1), g(2))
from dataclasses import dataclass, field
@dataclass(frozen=True)
class Point:
    x: float
    y: float
    tags: list = field(default_factory=list)
p1, p2 = Point(1.0, 2.0), Point(1.0, 2.0)
print(p1 == p2, p1.tags is p2.tags, p1)
try:
    p1.x = 5
except Exception as e: print(type(e).__name__)
class A:
    shared = []
    def __init__(self): self.own = []
a, b = A(), A(); a.shared.append(1); a.own.append(1)
print(b.shared, b.own)
t = (1, 2, 3); 
try: t[0] = 9
except TypeError as e: print("TypeError", e)
d = {"a": 1}
try: d["z"]
except KeyError as e: print("KeyError", e)
print(d.get("z"), [x**2 for x in range(5)], {k: v for k, v in zip("ab", (1, 2))})
def typed(x: int) -> int: return x
print(typed("not an int"))   # annotations are not enforced
try:
    try: int("x")
    except ValueError as exc: raise RuntimeError("bad config") from exc
except RuntimeError as e: print(repr(e), "| cause:", repr(e.__cause__))
class _Acct:
    def __init__(self): self._bal = 5
print(_Acct()._bal)
