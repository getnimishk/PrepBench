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
