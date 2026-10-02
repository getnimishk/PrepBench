# Python project craft

**Course:** Agentic AI, from first principles to production · Module 2 Developer Toolkit · lesson 10 of 77 · **about 5 hours** · paper draft for review.  
**Success criterion:** A repository with a locked dependency file, type-checked code, a Pydantic model that rejects bad input, and 5 passing tests, cloned and run from scratch by following your own README.

> Sources (read 2026-10-02; details and gaps in docs/research/agentic-ai): Python 3 tutorial 'Virtual Environments and Packages' (venv, pip, freeze); Python Packaging User Guide 'Writing your pyproject.toml'; uv documentation 'Project structure' (lockfile); Pydantic v2 documentation 'Models'; mypy 'Getting started'; pytest 'Get Started', all read 2026-10-02 through page summaries. The Pydantic and pytest examples were run on Pydantic 2.13.4, pytest 9.1.1 and Python 3.14.7 and the outputs shown are what they printed. Not run here: mypy (not installed in the check environment), so its example output comes from the mypy page, not from our run. The Packaging guide page says nothing about lock files, so the lock-file explanation comes from the uv page only; other tools have their own formats. The five-step project checklist is ours. Unverified: tool versions move quickly, so use the versions your own install gives you.

---

## Part 1 · Why a project is more than a script

A script runs on your machine today. A project can be cloned by someone else, built the same way, tested and run next month. For agent work that matters twice: model libraries change fast, and a bug you cannot reproduce is a bug you cannot fix.

A minimal professional Python project has five things: an isolated environment, a declared list of dependencies, a lock of exact versions, type checking and tests. The next four parts take them in turn, and the lab has you build all five.

**Worked example**

Fictional. Your agent works on your laptop. A colleague installs the latest versions of its libraries, one has a changed argument name, and the agent fails on their first call. A locked dependency file would have given them your exact versions.

**Common mistake**

Installing packages straight into the system Python. Two projects that need different versions of one library cannot both be satisfied.

**Check yourself.** Give two reasons a script is not yet a project.

<details><summary>Model answer (write yours first)</summary>

Nobody else can reproduce its environment, and nothing checks that it still works after a change. A project adds isolation, declared and locked dependencies, type checks and tests.

</details>

---

## Part 2 · Environments, dependencies and the lock file

**Virtual environment.** The Python tutorial explains that different applications may need different versions of the same library, so each gets its own self-contained environment. Create one with `python -m venv .venv` (the tutorial notes `.venv` is a common name). Activate it with `.venv\Scripts\activate` on Windows or `source .venv/bin/activate` on Linux and macOS, and leave with `deactivate`.

**Installing.** `python -m pip install requests==2.6.0` pins one version. `python -m pip freeze > requirements.txt` records exactly what is installed and `python -m pip install -r requirements.txt` recreates it.

**`pyproject.toml`.** This is the standard configuration file. Its `[project]` table holds `name`, `version`, `dependencies` and `requires-python`, and `[build-system]` names the build tool. Dependencies there are usually *ranges*, for example `"httpx>=0.28"`.

**Lock file.** Ranges say what is acceptable; a lock file records what was actually chosen. uv's documentation describes `uv.lock` as a cross-platform file holding the exact resolved version of every package, and says to commit it. The commands: `uv init` creates a project, `uv add httpx` adds a dependency, `uv sync` installs from the lock, `uv run pytest` runs a command inside the environment. Other tools (pip with a frozen requirements file, Poetry) do the same job in their own formats. In Java terms: `pyproject.toml` is your `pom.xml` dependency section, and the lock file is what Gradle's lockfile does.

**Worked example**

Fictional. `pyproject.toml` says `httpx>=0.28`. The lock file says `httpx 0.28.1` and the hash of that release. Both are committed, so a fresh clone installs 0.28.1, not whatever is newest today.

**Common mistake**

Committing `requirements.txt` generated from a machine full of unrelated packages, so it lists tools your project never uses.

**Check yourself.** What is the difference between a range in `pyproject.toml` and an entry in the lock file?

<details><summary>Model answer (write yours first)</summary>

The range is what versions are acceptable. The lock entry is the exact version that was resolved and installed. Committing both makes installs repeatable.

</details>

---

## Part 3 · Type hints and a type checker

Annotations like `def greet(name: str) -> str` are not enforced when the program runs. A type checker such as mypy reads them without running the code and reports mismatches. The mypy page's own example error is: Argument 1 to "greeting" has incompatible type "int"; expected "str". You run it as `mypy program.py`. Two details from that page: you can ignore its reports and still run the code, and unannotated functions are skipped by default, which lets you adopt it gradually.

Treat the checker as a build step that fails the build, like the compiler you are used to. It catches wrong calls between your own functions. It cannot catch bad data that arrives at runtime, such as a model's JSON reply, and that needs the next part.

**Worked example**

Fictional. A helper expects `priority: int`. Another function passes it a string read from a file. The checker flags the call before the code runs.

**Common mistake**

Writing annotations and never running a checker, so the annotations quietly become wrong.

**Check yourself.** Why does a type checker not replace input validation?

<details><summary>Model answer (write yours first)</summary>

It checks the code you wrote against its annotations before running. It cannot see the actual values that arrive at runtime, like a model's reply or a user's form input.

</details>

---

## Part 4 · Pydantic: validate data at the boundary

Pydantic models look like dataclasses and check their input when you create them. Define a class from `BaseModel` with annotated fields; creating an instance validates the data, and bad data raises `ValidationError` listing every problem. This is the tool for model replies and API inputs.

```python
from pydantic import BaseModel, Field

class Ticket(BaseModel):
    id: int
    title: str = Field(min_length=3)
    priority: int = Field(ge=1, le=3)
```
Running `Ticket(id=1, title='x', priority=9)` on Pydantic 2.13.4 raised one error object listing both problems:

```text
2 validation errors for Ticket
title
  String should have at least 3 characters [type=string_too_short, input_value='x', input_type=str]
priority
  Input should be less than or equal to 3 [type=less_than_equal, input_value=9, input_type=int]
```
The methods to know: `Ticket.model_validate(a_dict)`, `Ticket.model_validate_json(a_json_string)`, `ticket.model_dump()` back to a dict, and `Ticket.model_json_schema()` for a JSON Schema, which lesson 14 uses to tell a model what shape to produce.

**Coercion.** By default Pydantic converts compatible values: the string "7" becomes the integer 7, as the documentation's own example shows. Strict mode turns that off and demands the exact type. Decide per field whether silent conversion is acceptable. For money or identifiers it often is not.

**Worked example**

Fictional. A model returns `{"id": "12", "title": "VPN slow", "priority": 4}`. Validation fixes the id to 12 and rejects priority 4, so the bad record never reaches the next step.

**Common mistake**

Catching `ValidationError` and carrying on with half the data. Reject the record, log why, and decide whether to retry the model call.

**Check yourself.** A model reply has `priority: 9` where the schema allows 1 to 3. What should happen, and where?

<details><summary>Model answer (write yours first)</summary>

Validation raises `ValidationError` at the boundary where the reply enters your code. Reject the record, log the error, and decide whether to retry or escalate. It should never reach later steps.

</details>

---

## Part 5 · Tests with pytest

pytest finds test files named `test_*.py` or `*_test.py`, and functions named `test_*`. A test is a plain function with a plain `assert`. Use `with pytest.raises(SomeError):` to say 'this should fail'. Run `pytest` for everything, `pytest test_file.py` for one file and `-k name` to pick by name; `-q` shortens the output.

Five tests for the `Ticket` model above, all of which passed in a real run (`5 passed`):

```python
import pytest
from pydantic import ValidationError
from models import Ticket

def test_valid_ticket():
    assert Ticket(id=1, title='Printer down', priority=2).priority == 2

def test_string_number_is_coerced():
    assert Ticket(id='7', title='Slow VPN', priority=1).id == 7

def test_short_title_rejected():
    with pytest.raises(ValidationError):
        Ticket(id=1, title='x', priority=1)

def test_priority_out_of_range_rejected():
    with pytest.raises(ValidationError):
        Ticket(id=1, title='Slow VPN', priority=9)

def test_non_numeric_id_rejected():
    with pytest.raises(ValidationError):
        Ticket(id='abc', title='Slow VPN', priority=1)
```
Note that half the tests check what is rejected. For agent code, the failure paths matter more than the happy one.

**Worked example**

Fictional. When you later change the title rule from 3 to 5 characters, `test_short_title_rejected` still passes and tells you nothing broke; a new test for 4 characters tells you the new rule works.

**Common mistake**

Only testing inputs that should work. Bad inputs are the ones an agent will actually meet.

**Check yourself.** Why write tests that expect an error?

<details><summary>Model answer (write yours first)</summary>

Because agents receive messy and unexpected input all the time. A test that expects rejection proves the guard works and keeps working after later changes.

</details>

---

## Do it: lab

1. Create a new folder and a virtual environment inside it. Install `pydantic` and `pytest`.
2. Write a `pyproject.toml` with a `[project]` table (name, version, `requires-python`, dependencies). Produce a lock: with uv, `uv init` then `uv add pydantic pytest`; otherwise `pip freeze > requirements.txt`. Commit the lock file.
3. Create a Pydantic model for something you know, for example a ticket, an invoice line or a server record, with at least three fields and two rules (a minimum length, a numeric range).
4. Write 5 pytest tests: at least two that pass valid data and at least two that must be rejected.
5. Add annotations to your functions and run a type checker (`pip install mypy`, then `mypy .`). Note what it reported, or that it found nothing.
6. Write a README with the exact commands to set up and run the tests. Then delete your environment, clone the repository into a new folder and follow only your README.

**Done when:** from a fresh clone, the README's commands install the locked dependencies and all 5 tests pass, and the model rejects at least two kinds of bad input.

---

## Interview check

**Question.** Your teammate says 'it works on my machine'. What would you put in a Python repository so it works on everyone's, and in CI?

<details><summary>A strong answer has this shape</summary>

1. An isolated environment per project, never the system Python.
2. Declared dependencies in `pyproject.toml` and a committed lock file with exact versions, so installs are repeatable.
3. A README with the commands to set up and test, proven by following it on a clean clone.
4. A type check and the test suite run automatically on every pull request, and failing them blocks the merge.
5. Validation at the edges (Pydantic) so bad data fails loudly at the boundary.
For a delivery role, add: who owns upgrading dependencies, and how often.

</details>

---

## Evidence to keep

Keep the repository link or folder, your README, and the passing test run. This repository is the base for your lesson 12 script and the Module 4 assistant.

---
