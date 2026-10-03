"""A rule-based converter standing in for a model. v1 is deliberately naive (it knows the function names and nothing about semantics);
v2 adds the two semantic fixes the harness found. In your build the converter is a model call and the harness is the part you keep.
"""
import re


def _decode(m):
    args = [a.strip() for a in _split_args(m.group(1))]
    expr, rest = args[0], args[1:]
    default = rest.pop() if len(rest) % 2 else None
    whens = " ".join(f"WHEN {rest[i]} THEN {rest[i + 1]}" for i in range(0, len(rest), 2))
    return f"CASE {expr} {whens}" + (f" ELSE {default}" if default is not None else "") + " END"


def _split_args(s):
    out, depth, cur, quote = [], 0, "", False
    for ch in s:
        if ch == "'":
            quote = not quote
        if not quote and ch == "(":
            depth += 1
        if not quote and ch == ")":
            depth -= 1
        if ch == "," and depth == 0 and not quote:
            out.append(cur)
            cur = ""
        else:
            cur += ch
    return out + [cur]


def convert_v1(sql: str) -> str:
    s = sql
    s = re.sub(r"\bNVL\(", "COALESCE(", s)
    s = re.sub(r"DECODE\(((?:[^()]|\([^()]*\))*)\)", _decode, s)
    s = re.sub(r"(\w+)\s*\+\s*(\d+)\s+AS\s+(\w+)", r"date(\1,'+\2 days') AS \3", s)
    m = re.match(r"SELECT \* FROM \((.*)\) WHERE ROWNUM <= (\d+)$", s, re.S)
    if m:
        s = f"{m.group(1)} LIMIT {m.group(2)}"
    return s


def convert_v2(sql: str) -> str:
    s = convert_v1(sql)
    # Oracle treats NULL as empty text in ||; make each column operand NULL-safe
    def concat(m):
        parts = [p.strip() for p in m.group(1).split("||")]
        fixed = [p if p.startswith("'") else f"COALESCE({p},'')" for p in parts]
        return "||".join(fixed) + m.group(2)
    s = re.sub(r"SELECT ([\w' |]+\|\|[\w' |]+?)( AS \w+)", lambda m: "SELECT " + concat(m), s)
    # Oracle division is not integer division
    s = re.sub(r"\b(\w+)/(\w+)", r"\1*1.0/\2", s)
    return s
