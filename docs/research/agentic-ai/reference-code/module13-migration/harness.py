"""Run converted queries against the golden results, classify defects, and gate every change behind a human decision.

For each legacy query: convert, run on fresh data, compare with the golden result, and label the defect (or pass).
Then the approval gate: a query with a defect can never be applied; a clean query that used a risky rewrite (concatenation, division, date arithmetic,
ROWNUM) or any write needs a named person's approval. The harness never runs a write on anything but a throwaway copy.
"""
import json
import time

import data

RISKY = ("||", "/", "date(", "LIMIT", "UPDATE")


def run(sql, q):
    db = data.fresh_db()
    try:
        if q in data.WRITES:
            db.execute(sql)
            return db.execute("select order_id, status from orders order by order_id").fetchall()
        return db.execute(sql).fetchall()
    except Exception as e:
        return e


def classify(actual, expected):
    """Returns None for a pass, or a defect category."""
    if isinstance(actual, Exception):
        return "error"
    if len(actual) != len(expected):
        return "wrong_rows"
    if actual == expected:
        return None
    if sorted(map(repr, actual)) == sorted(map(repr, expected)):
        return "ordering"
    for a, e in zip(actual, expected):
        for x, y in zip(a, e):
            if x is None and y is not None:
                return "null_semantics"
            if isinstance(x, (int, float)) and isinstance(y, (int, float)):
                if abs(x - y) > 1e-6:
                    return "numeric"
            elif x != y:
                return "wrong_values"
    return None


def evaluate(converter):
    gold = data.golden()
    rows = []
    for q, legacy in data.LEGACY.items():
        sql = converter(legacy)
        defect = classify(run(sql, q), gold[q])
        rows.append(dict(query=q, converted=sql, defect=defect, passed=defect is None,
                         needs_approval=defect is None and (q in data.WRITES or any(t in sql for t in RISKY))))
    return rows


def gate(rows, approvals: dict, log, strict=False):
    """approvals: {query: person}. Returns the queries that may be applied. Everything else stays blocked, with a reason in the log.

    Default: a clean query with no risky rewrite is applied without a named approver; risky rewrites and writes need one.
    strict=True: EVERY applied query needs a named approver (use this to match "a human gate blocks any unapproved change" literally).
    A query with a defect is never applied in either mode."""
    applied = []
    for r in rows:
        q = r["query"]
        if not r["passed"]:
            decision = f"blocked: defect {r['defect']}"
        elif (r["needs_approval"] or strict) and q not in approvals:
            decision = "blocked: needs a named approver"
        else:
            decision = f"applied (approved by {approvals[q]})" if q in approvals else "applied (clean, no risky rewrite)"
            applied.append(q)
        log.append({"time": time.strftime("%Y-%m-%dT%H:%M:%S"), "query": q, "decision": decision})
    return applied


def report(rows):
    print(f"{'query':6}{'result':8}{'defect':16}converted SQL")
    for r in rows:
        print(f"{r['query']:6}{'PASS' if r['passed'] else 'FAIL':8}{(r['defect'] or '-'):16}{r['converted'][:90]}")
    print(f"{sum(r['passed'] for r in rows)} of {len(rows)} pass")


if __name__ == "__main__":
    import converter
    for name, fn in (("v1 (naive)", converter.convert_v1), ("v2 (after the harness findings)", converter.convert_v2)):
        print(f"\n== converter {name}")
        rows = evaluate(fn)
        report(rows)
    log = []
    print("\n== gate on v2: no approvals given")
    applied = gate(rows, {}, log)
    print("applied:", applied)
    print("== gate on v2: sam.reviewer approves Q3, Q4, Q5, Q6")
    log2 = []
    print("applied:", gate(rows, {q: "sam.reviewer" for q in ("Q3", "Q4", "Q5", "Q6")}, log2))
    for e in log2[:6]:
        print(" ", json.dumps(e))
