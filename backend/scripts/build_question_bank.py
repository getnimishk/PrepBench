# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Build a question bank's import file from its per-section sources.

A bank written this way keeps one readable file per exam section under
`backend/app/content/question_banks/<bank>/src/`, and this script turns them
into `<bank>_question_bank.json`, a list the Question Bank's JSON import reads
as it is. The committed JSON is what the learner imports; the bank's tests
rebuild it from the sources and fail if the two differ.

    cd backend && ./.venv/Scripts/python.exe scripts/build_question_bank.py ccdak

Source format:

- `src/bank.json`: `certification` (matched exactly to a preparation's
  certification on import), `source` (the line stored on every question) and
  `notes`: a map from a citation prefix (`notes`, `ccdak`) to the research file it
  cites, relative to the repository root.
- `src/NN-<slug>.json`, one per exam section: `section`, `domain` (the section's
  name, stored as the question's domain) and `questions`. A question is `id`,
  `topic`, `difficulty`, `sources` (citations such as `"notes §7"`), `q` (the
  question), `options` (each `t`, and either `"ok": true` or a `why` saying why it
  is wrong) and `explain` (why the right answer is right). One right option makes
  a single-choice question; more make a multiple-choice question, whose text gets
  "(Choose N.)" so the learner knows how many to pick.

The explanation stored is `explain`, then each wrong option's `why`, then the
sources by name. The question's reference link is the page of the first cited
section that names one, read from the research file's own source line.
"""
import json
import re
import sys
from pathlib import Path
from typing import Dict, List

ROOT = Path(__file__).resolve().parent.parent.parent
BANKS_DIR = ROOT / "backend" / "app" / "content" / "question_banks"

_WORDS = {2: "two", 3: "three", 4: "four"}
_SECTION = re.compile(r"^## (\d+)\. (.+)$")
_URL = re.compile(r"https://[^\s;)]+")


def research_sections(path: Path) -> Dict[str, Dict[str, str]]:
    """Each `## N. Title` section of a research file: its title and the first URL its source line names."""
    sections: Dict[str, Dict[str, str]] = {}
    current = None
    in_source = False  # the source paragraph: its "Source(s):" line and the lines that continue it
    for line in path.read_text(encoding="utf-8").splitlines():
        m = _SECTION.match(line)
        if m:
            current = m.group(1)
            sections[current] = {"title": m.group(2).strip(), "url": ""}
            in_source = False
            continue
        in_source = bool(line.strip()) and (in_source or line.startswith("Source"))
        if current and in_source and not sections[current]["url"]:
            url = _URL.search(line)
            if url:
                sections[current]["url"] = url.group(0)
    return sections


def _citation(source: str, notes: Dict[str, Dict[str, Dict[str, str]]]):
    prefix, _, number = source.partition(" §")
    if prefix not in notes or number not in notes[prefix]:
        raise ValueError(f"cites {source!r}, which is not a section of the research notes")
    return notes[prefix][number]


def build(bank: str, banks_dir: Path = BANKS_DIR) -> List[dict]:
    src = banks_dir / bank / "src"
    meta = json.loads((src / "bank.json").read_text(encoding="utf-8"))
    notes = {prefix: research_sections(ROOT / rel) for prefix, rel in meta["notes"].items()}
    out: List[dict] = []
    for path in sorted(src.glob("[0-9][0-9]-*.json")):
        section = json.loads(path.read_text(encoding="utf-8"))
        for q in section["questions"]:
            right = [o for o in q["options"] if o.get("ok")]
            wrong = [o for o in q["options"] if not o.get("ok")]
            if not right:
                raise ValueError(f"{q['id']}: no right option")
            if any(not o.get("why") for o in wrong):
                raise ValueError(f"{q['id']}: a wrong option has no 'why'")
            cited = [_citation(s, notes) for s in q["sources"]]
            text = q["q"] if len(right) == 1 else f"{q['q']} (Choose {_WORDS[len(right)]}.)"
            why = "\n".join(f"- **{o['t']}**: {o['why']}" for o in wrong)
            names = "; ".join(f"{s} ({c['title']})" for s, c in zip(q["sources"], cited))
            out.append({
                "text": text,
                "question_type": "single_choice" if len(right) == 1 else "multiple_choice",
                "difficulty": q["difficulty"],
                "domain": section["domain"],
                "topic": q["topic"],
                "certification": meta["certification"],
                "source": meta["source"],
                "tags": [bank, q["id"]],
                "explanation": f"{q['explain']}\n\n**Why the other options are wrong:**\n{why}\n\nSources: {names}.",
                "reference_url": next((c["url"] for c in cited if c["url"]), None),
                "options": [
                    {
                        "option_text": o["t"],
                        "is_correct": bool(o.get("ok")),
                        "explanation_why_incorrect": None if o.get("ok") else o["why"],
                        "order_index": i,
                    }
                    for i, o in enumerate(q["options"])
                ],
            })
    return out


def output_path(bank: str, banks_dir: Path = BANKS_DIR) -> Path:
    return banks_dir / bank / f"{bank}_question_bank.json"


def render(questions: List[dict]) -> str:
    return json.dumps(questions, indent=2, ensure_ascii=False) + "\n"


if __name__ == "__main__":
    name = sys.argv[1] if len(sys.argv) > 1 else "ccdak"
    built = build(name)
    output_path(name).write_text(render(built), encoding="utf-8", newline="\n")
    print(f"{name}: {len(built)} questions -> {output_path(name).relative_to(ROOT)}")
