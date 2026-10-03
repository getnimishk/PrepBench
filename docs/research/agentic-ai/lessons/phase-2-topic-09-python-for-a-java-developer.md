# Python for a Java developer

**Course:** Agentic AI, from first principles to production · Module 2 Developer Toolkit · lesson 9 of 77 · **about 6 hours** · paper draft for review.  
**Success criterion:** Rewrite a 100-line Java utility you wrote before in idiomatic Python and explain 5 differences (typing, collections, exceptions, packaging, concurrency).

> Sources (read 2026-10-02; details and gaps in docs/research/agentic-ai): Python 3 tutorial pages read 2026-10-02 through page summaries: 'Classes' (docs for Python 3.14.8), 'Errors and Exceptions', 'Data Structures', 'More Control Flow Tools' (default arguments, annotations, indentation) and the 'dataclasses' library page. The Java-to-Python comparisons, the worked examples and the mapping of each difference to an agent-building habit are ours. Every code sample on this page was run on Python 3.14.7 and the output shown is what it printed. Background, not from those pages: the global interpreter lock explanation in part 5. Unverified: nothing here depends on a vendor claim.

---

## Part 1 · Why this matters, and the one shift to make

You already think in types, classes and exceptions, so Python's syntax will take a weekend. The harder part is a change of contract. In Java the compiler refuses code that breaks the declared types. In Python the types you write are notes for people and tools, and the interpreter runs the code anyway. The Python tutorial says of annotations that they have no effect on function behaviour.

That matters for this course because agent code is mostly glue: it takes text from a model, turns it into data, calls other code and sends text back. Most real bugs in that glue are wrong-shaped data arriving at the wrong place, which Java would have caught at compile time and Python catches only if you build the checks yourself. Lesson 10 shows how, with Pydantic and a type checker.

Five differences you will meet, which are also the five the success criterion asks for: typing, collections, exceptions, packaging and concurrency. Each has a part below or a pointer to the next lesson.

**Worked example**

Fictional. A Java method `int total(List<Integer> xs)` cannot be called with the string "5". The Python version `def total(xs: list[int]) -> int` can be, and it fails only when the code inside tries to add a string to a number, possibly several calls later. Same intent, later and vaguer failure.

**Common mistake**

Writing Java in Python: getters and setters, one class per file, interfaces for everything. Python favours plain functions, simple data classes and the standard library.

**Check yourself.** Name the one change of contract between Java and Python, and why it matters for glue code around a model.

<details><summary>Model answer (write yours first)</summary>

Java enforces declared types at compile time. Python does not enforce annotations at runtime. Glue code moves data of uncertain shape between a model and your functions, so wrong shapes show up late unless you add explicit validation.

</details>

---

## Part 2 · Collections and comprehensions

The tutorial's four built-in structures, with the one-line description each gets there:

- **list**: a mutable sequence. Closest to `ArrayList`.
- **tuple**: immutable, often a fixed group of mixed values. Closest to a small record.
- **set**: an unordered collection with no duplicates. Closest to `HashSet`.
- **dict**: indexed by keys, which must be immutable. Closest to `HashMap`. Use `d.get(key)` when a missing key is normal, because `d[key]` raises `KeyError`.

A list comprehension builds a list in one expression: `[x * x for x in range(5)]` gives `[0, 1, 4, 9, 16]`. Dict comprehensions work the same way. For loops over several things, `enumerate` gives index and value, `zip` walks two sequences together, and `dict.items()` gives key and value.

```python
t = (1, 2, 3)
t[0] = 9            # TypeError: 'tuple' object does not support item assignment
d = {'a': 1}
d['z']              # KeyError: 'z'
d.get('z')          # None
{k: v for k, v in zip('ab', (1, 2))}   # {'a': 1, 'b': 2}
```
Those results are real output from Python 3.14.7.

**Worked example**

Fictional. Counting tickets per team: `counts = {}` then `counts[team] = counts.get(team, 0) + 1` for each ticket. In Java this is `merge` or a three-line `containsKey` dance.

**Common mistake**

Using a list where a set or dict gives a faster lookup, then checking `x in big_list` in a loop. Membership in a list scans it; in a set or dict it does not.

**Check yourself.** You need to know whether a ticket ID has been seen before, across 100,000 IDs. Which structure, and why?

<details><summary>Model answer (write yours first)</summary>

A set. Adding and checking membership are fast on average, and it holds no duplicates. A list would scan up to 100,000 items on every check.

</details>

---

## Part 3 · Functions: the default-argument trap

Functions are plain objects, there is no overloading, and arguments can be passed by name. The tutorial's most important warning for Java developers: a default value is evaluated once, when the function is defined, not on each call. With a mutable default the same object is reused.

```python
def f(a, L=[]):
    L.append(a)
    return L

print(f(1))   # [1]
print(f(2))   # [1, 2]   <- the same list as before
print(f(3))   # [1, 2, 3]

def g(a, L=None):
    if L is None:
        L = []
    L.append(a)
    return L
```
`g` is the fix the tutorial gives: default to `None` and create the list inside. This is the same bug the dataclasses page warns about for class fields.

Other things you will see: `*args` collects extra positional arguments, `**kwargs` collects extra named ones, a bare `*` in the signature makes everything after it keyword-only, and type annotations such as `def f(ham: str, eggs: str = 'eggs') -> str` document intent and feed type checkers.

**Worked example**

Fictional. A function `add_label(ticket, labels=[])` used in a ticket agent would quietly share one label list across every ticket, so ticket 7 would show ticket 3's labels.

**Common mistake**

Trusting an annotation to stop bad input. `typed('not an int')` on a function annotated `x: int` runs and returns the string, as we checked.

**Check yourself.** Why does `def f(a, L=[])` misbehave, and what is the standard fix?

<details><summary>Model answer (write yours first)</summary>

The default list is created once at definition time and reused by every call that does not pass its own. Fix: default to None, then create a fresh list inside the function.

</details>

---

## Part 4 · Classes and dataclasses

Python classes differ from Java in four ways that bite early. Fields are not declared; they come into being when first assigned, usually in `__init__`. The first parameter of every method is an explicit `self` (a convention, not a keyword). There are no truly private members: a leading underscore, as in `_balance`, is a convention that says 'not public, may change', and nothing enforces it. And every method is effectively virtual.

A class-level attribute is shared by all instances, which is the same trap as the mutable default:

```python
class A:
    shared = []                 # one list for the class
    def __init__(self):
        self.own = []           # one list per instance

a, b = A(), A()
a.shared.append(1); a.own.append(1)
print(b.shared, b.own)          # [1] []
```
For plain data, use `@dataclass`. It generates `__init__`, `__repr__` and `__eq__` from the annotated fields. `frozen=True` makes instances immutable, and `field(default_factory=list)` gives each instance its own list:

```python
from dataclasses import dataclass, field

@dataclass(frozen=True)
class Point:
    x: float
    y: float
    tags: list = field(default_factory=list)

p1, p2 = Point(1.0, 2.0), Point(1.0, 2.0)
print(p1 == p2, p1.tags is p2.tags)   # True False
p1.x = 5                              # FrozenInstanceError
```
Printed results above are real. In lesson 10 you will meet Pydantic models, which look like dataclasses but also validate their input.

**Worked example**

Fictional. A `Ticket` as a frozen dataclass with `id`, `title` and `priority` is a few lines, compares by value and cannot be changed by accident, which is what you want for a record passed between agent steps.

**Common mistake**

Declaring a mutable value at class level and expecting each instance to get its own copy.

**Check yourself.** What does `frozen=True` give you, and what does `field(default_factory=list)` prevent?

<details><summary>Model answer (write yours first)</summary>

Frozen makes instances immutable, so changing a field raises an error. The default factory gives each instance a new list instead of one shared list.

</details>

---

## Part 5 · Errors, resources and concurrency

**Exceptions.** Python has no checked exceptions: nothing forces you to declare or catch anything. The shape is `try`, `except`, an optional `else` that runs only when nothing was raised, and `finally`. Use `raise NewError(...) from original` to keep the cause attached; the original shows up as `__cause__`:

```python
try:
    try:
        int('x')
    except ValueError as exc:
        raise RuntimeError('bad config') from exc
except RuntimeError as e:
    print(repr(e), '| cause:', repr(e.__cause__))
# RuntimeError('bad config') | cause: ValueError("invalid literal for int() with base 10: 'x'")
```
Custom exceptions are classes that extend `Exception`, and their names end in `Error` by convention.

**Resources.** `with open(path) as f:` replaces try-with-resources: the file closes even if the body raises.

**Packaging.** Instead of Maven or Gradle, Python uses a virtual environment per project plus a `pyproject.toml`. That is lesson 10.

**Concurrency.** Python has threads, but the usual way to wait on many network calls is `asyncio`: one thread, many tasks that hand control back while they wait. The asyncio documentation says its `to_thread` helper is typically useful only for IO-bound functions. Background, not from the page: that limit comes from CPython's global interpreter lock, which lets one thread run Python bytecode at a time. For agents this is fine, because they spend their time waiting on models and services, not computing. Lesson 11 builds on it.

**Worked example**

Fictional. Parsing a model's reply with `json.loads` raises `JSONDecodeError`. Catch it, raise your own `BadModelReply` from it, and the log shows both the friendly message and the original error.

**Common mistake**

A bare `except:` that swallows everything, including bugs. Catch the specific error you can handle and let the rest surface.

**Check yourself.** How do you keep the original error when you raise a different one?

<details><summary>Model answer (write yours first)</summary>

Use `raise NewError(...) from original`. The original is stored as `__cause__` and appears in the traceback.

</details>

---

## Do it: lab

1. Pick a Java utility you wrote before, about 100 lines: a parser, a small cache, a report formatter. Keep the Java file as a reference.
2. Rewrite it in idiomatic Python: plain functions and one dataclass where Java had a class, a dict or list comprehension where Java had a loop, a `with` block for any file, and a specific exception where Java had a checked one.
3. Add type annotations to every function signature. Then call one function with the wrong type on purpose and write down what happened.
4. Write the five differences you hit (typing, collections, exceptions, packaging, concurrency) as five short sentences, each with one line of your own code or the Java line it replaced.
5. Run both versions on the same input and confirm they give the same output.

**Done when:** the Python version gives the same output as the Java version, and your five written differences each point at a real line of your code.

---

## Interview check

**Question.** You are strong in Java and new to Python. What are the first three things in Python that would cause a bug in a Java developer's code, and how do you prevent them?

<details><summary>A strong answer has this shape</summary>

1. Annotations are not enforced, so wrong-shaped data fails late. Prevent with validation at the edges (Pydantic) and a type checker in the build.
2. Mutable default arguments and class-level lists are shared, not copied. Prevent by defaulting to None or using `default_factory`.
3. No checked exceptions, so errors you forgot to handle surface in production. Prevent by catching specific errors you can act on, using `raise ... from`, and testing the failure paths.
A delivery-minded addition: put a type check and tests in CI, so these are caught before review and not after release.

</details>

---

## Evidence to keep

Keep the Java file, the Python rewrite, and your five written differences. They are your first portfolio evidence that you can move between ecosystems.

---
