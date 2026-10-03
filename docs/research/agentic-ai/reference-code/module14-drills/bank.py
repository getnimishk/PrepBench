"""Question banks for the interview drills. Every question points back to the lesson that answers it and lists the key points a strong answer covers.

key points are (label, words) pairs: the words are what to listen for in your transcript. `coverage()` checks a transcript against them. It is an aid for
self-scoring, not a judge: it finds words, not understanding. Time limits are in seconds.
"""
FUNDAMENTALS = [   # id, question, lesson, limit seconds, key points
    ("F01", "What does a large language model do, and what does it not do?", 1, 90, [("predicts next token", ["next token", "predict"]), ("not a database or search engine", ["database", "search engine", "not a"]), ("can be wrong fluently", ["wrong", "hallucin", "confident"])]),
    ("F02", "What is a token and why does it matter to a manager?", 3, 90, [("piece of text", ["piece", "word", "chunk"]), ("priced per token", ["price", "cost", "bill"]), ("limits context and latency", ["context", "window", "latency", "limit"])]),
    ("F03", "What is an embedding?", 4, 90, [("list of numbers for meaning", ["numbers", "vector"]), ("similar meaning is close", ["close", "similar", "distance", "cosine"]), ("used for search", ["search", "retriev"])]),
    ("F04", "What is a context window and what happens when you exceed it?", 5, 90, [("max input plus output", ["limit", "maximum", "window"]), ("truncation or error", ["truncat", "error", "reject", "overflow"]), ("quality drops in the middle", ["middle", "lost", "degrad"])]),
    ("F05", "Prompting, RAG or fine-tuning: how do you choose?", 26, 120, [("start with prompting", ["prompt"]), ("RAG for changing or private knowledge with citations", ["rag", "retriev", "cite", "citation"]), ("fine-tune for behaviour", ["behaviour", "behavior", "format", "tone", "style"]), ("measure first", ["measure", "test set", "evaluat"])]),
    ("F06", "What is the difference between a workflow and an agent?", 19, 90, [("who decides the next step", ["decides", "who"]), ("code versus model", ["code", "predefined", "model chooses"]), ("start simple", ["simple", "simplest", "start"])]),
    ("F07", "How does tool calling work?", 22, 120, [("model requests, code runs", ["request", "your code", "never execute", "does not run"]), ("schema", ["schema", "json"]), ("validate and return errors", ["validat", "error"])]),
    ("F08", "Why can an agent loop forever and how do you stop it?", 21, 90, [("limits on turns tokens repeats", ["limit", "turns", "budget", "max"]), ("repeated call detection", ["repeat", "same call", "stuck"]), ("escalate", ["escalat", "person", "human"])]),
    ("F09", "How do you make a write safe to retry?", 25, 90, [("idempotency key", ["idempoten", "key"]), ("stored first result", ["store", "same result", "first result"]), ("timeouts and bounded retries", ["timeout", "bounded", "backoff"])]),
    ("F10", "What is structured output and why use it?", 14, 90, [("schema-constrained", ["schema", "json"]), ("validate", ["validat", "pydantic"]), ("handle refusal or truncation", ["refus", "truncat", "max_tokens", "fail"])]),
    ("F11", "How would you evaluate an agent before release?", 46, 120, [("fixed cases from real failures", ["cases", "real failure", "test set"]), ("outcome and invariants", ["outcome", "invariant", "must"]), ("repeat trials", ["repeat", "trials", "consisten", "pass^"]), ("gate in CI", ["ci", "gate", "block"])]),
    ("F12", "What is RAG and where does it fail?", 27, 120, [("retrieve then generate with sources", ["retriev", "generate", "source"]), ("failure points", ["chunk", "retriev", "rank", "generation", "citation"]), ("access control before ranking", ["access", "permission", "filter"])]),
    ("F13", "Why use hybrid search?", 29, 90, [("meaning plus exact terms", ["meaning", "exact", "keyword", "code"]), ("rank fusion", ["rank", "fusion", "rrf"]), ("test on your questions", ["test", "measure", "your own"])]),
    ("F14", "What is prompt injection and how do you defend?", 48, 120, [("untrusted text becomes instructions", ["untrusted", "instruction", "hidden"]), ("controls in code", ["code", "gate", "schema", "least privilege", "tools"]), ("assume it can be fooled", ["assume", "fooled", "blast radius", "limit"])]),
    ("F15", "Explain least privilege for an agent.", 51, 90, [("minimum permissions", ["minimum", "least", "only what"]), ("delegated over application", ["delegated", "on behalf"]), ("revocation", ["revok", "short-lived", "expire"])]),
    ("F16", "What is MCP and how is it different from A2A?", 41, 120, [("tools and data versus agents", ["tool", "agent"]), ("trust boundary", ["trust", "untrusted", "consent"]), ("tasks and states in A2A", ["task", "state"])]),
    ("F17", "When would you use more than one agent?", 43, 120, [("single agent first", ["single", "one agent", "simplest"]), ("security boundary or overload", ["security", "boundary", "overload", "permission"]), ("cost and failure modes", ["cost", "latency", "failure"])]),
    ("F18", "How do you estimate cost for an agent?", 49, 120, [("per successful task", ["successful", "per task"]), ("people cost of failures", ["people", "takeover", "escalat", "human"]), ("ranges and assumptions", ["range", "assumption", "sensitiv"])]),
    ("F19", "What do you log and what do you not?", 47, 90, [("steps tokens timings", ["step", "token", "span", "trace"]), ("audit separate from debug", ["audit", "debug"]), ("content is sensitive", ["sensitive", "redact", "content", "pii"])]),
    ("F20", "How do you handle a model provider outage?", 50, 120, [("retry with backoff and breaker", ["backoff", "breaker", "retry"]), ("queue and idempotency", ["queue", "idempoten"]), ("degrade and stop writing", ["degrad", "read-only", "stop", "writes"])]),
]

PLATFORM = [   # id, question, lesson
    ("P01", "Which Azure service hosts a managed agent, and what is the tradeoff against hosting your own code?", 57),
    ("P02", "How does an agent authenticate to an Azure resource without a stored secret?", 51),
    ("P03", "What is the difference between delegated and application permissions?", 51),
    ("P04", "Where do traces go on Azure and what would you look at first?", 47),
    ("P05", "How does Azure AI Search help with access control in RAG?", 27),
    ("P06", "What does a budget alert on Azure do and not do?", 56),
    ("P07", "What is Unity Catalog's role for agent tools on Databricks?", 58),
    ("P08", "What permission runs a Unity Catalog function as a tool?", 58),
    ("P09", "What limit does a Databricks vector index have for per-user access?", 32),
    ("P10", "How would you evaluate an agent on Databricks?", 58),
    ("P11", "Delta Sync index: what does it need from the source table?", 32),
    ("P12", "Service principal versus on-behalf-of: when each?", 58),
    ("P13", "How do you keep an Azure or Databricks agent project from surprising you on cost?", 56),
    ("P14", "Managed agent versus custom agent: how do you choose?", 59),
    ("P15", "What would you not claim about a platform feature you only read about?", 57),
]

DESIGN = [   # id, prompt, checklist (each must be addressed in 30 minutes)
    ("D1", "Design an agent that triages failed data pipelines and proposes fixes.", ["state", "tools", "approvals", "failure handling", "evaluation", "cost", "governance"]),
    ("D2", "Design a governed Q&A assistant over confidential policy documents.", ["state", "tools", "approvals", "failure handling", "evaluation", "cost", "governance"]),
    ("D3", "Design a SQL migration assistant that converts legacy queries and proves the result.", ["state", "tools", "approvals", "failure handling", "evaluation", "cost", "governance"]),
    ("D4", "Design a support system with a triage agent and specialists that can issue refunds.", ["state", "tools", "approvals", "failure handling", "evaluation", "cost", "governance"]),
]


def coverage(transcript: str, points) -> dict:
    t = transcript.lower()
    return {label: any(w in t for w in words) for label, words in points}
