"""Run the same questions through the LangChain chain as a caller with no groups and as a finance caller, and show the tool schema."""
import json

import lc_rag as lc

for label, groups in (("no groups", ()), ("finance group", ("finance",))):
    chain = lc.build_chain(groups)
    for q in ("How many days of paid annual leave do full-time staff get?", "How big is the annual bonus pool for the finance team?"):
        print(f"[{label}] {q}\n   -> {chain.invoke(q)}")
print("\ntool schema:", json.dumps(lc.make_search_tool().args))
