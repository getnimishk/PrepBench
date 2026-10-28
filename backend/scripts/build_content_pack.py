# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Build a content pack's JSON from its Markdown sources.

A pack written this way keeps one readable file per chapter under
`backend/app/content/packs/<pack_id>/src/`, which is what a reviewer reads in a
PR, and this script turns them into the `v<version>.json` the app loads. The
committed JSON is the shipped artifact; tests/test_content_packs.py rebuilds it
from the sources and fails if the two differ, so neither can drift.

    cd backend && ./.venv/Scripts/python.exe scripts/build_content_pack.py kafka

Source format:

- `src/pack.json`: the pack's own fields (pack_id, version, title, summary,
  docs_url, source_notes), and optionally `diagnostic_questions` and
  `scenario_levels`, each level a name, an about line and the numbers of its
  scenarios.
- `src/scenarios/NN-<slug>.json`, one per written scenario: the scenario as the
  app reads it (id, number, title, outcome, sources, chapter, content). A
  chapter's `practice_links` are built from the scenarios that name it, so the
  two can't disagree.
- `src/NN-<id>.md`, one per chapter, in order: a front-matter block of
  `key: value` lines (id, title, summary, sources) between `---` lines, then
  sections, each starting `## Heading`. A section's Markdown becomes the block's
  `md`; a pipe table at the very end of a section becomes its `table`. Lines
  inside ``` fences are never read as headings or tables.
"""
import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional

PACKS_DIR = Path(__file__).resolve().parent.parent / "app" / "content" / "packs"

_FENCE = re.compile(r"^\s*```")


def _split_sections(body: str) -> List[Dict[str, str]]:
    sections: List[Dict[str, str]] = []
    current: Optional[Dict[str, object]] = None
    in_fence = False
    for line in body.split("\n"):
        if _FENCE.match(line):
            in_fence = not in_fence
        if not in_fence and line.startswith("## "):
            current = {"heading": line[3:].strip(), "lines": []}
            sections.append(current)  # type: ignore[arg-type]
            continue
        if current is None:
            if line.strip():
                raise ValueError(f"text before the first '## ' heading: {line!r}")
            continue
        current["lines"].append(line)  # type: ignore[union-attr]
    return sections  # type: ignore[return-value]


def _cells(line: str) -> List[str]:
    return [c.strip() for c in line.strip().strip("|").split("|")]


def _block(heading: str, lines: List[str]) -> dict:
    # Trailing pipe table, if any: the run of '|' lines at the end of the section.
    while lines and not lines[-1].strip():
        lines.pop()
    end = len(lines)
    start = end
    while start > 0 and lines[start - 1].lstrip().startswith("|"):
        start -= 1
    block: dict = {"heading": heading}
    table = None
    if end - start >= 3 and re.fullmatch(r"\|?(\s*:?-{3,}:?\s*\|)+\s*:?-*:?\s*\|?", lines[start + 1].strip()):
        head = _cells(lines[start])
        rows = [_cells(l) for l in lines[start + 2:end]]
        for row in rows:
            if len(row) != len(head):
                raise ValueError(f"{heading!r}: table row has {len(row)} cells, header has {len(head)}: {row}")
        table = {"head": head, "rows": rows}
        lines = lines[:start]
    # The page draws a block's Markdown, then its table; a table anywhere else would
    # show as raw pipes, so refuse it here rather than ship it.
    in_fence = False
    for line in lines:
        if _FENCE.match(line):
            in_fence = not in_fence
        elif not in_fence and line.lstrip().startswith("|"):
            raise ValueError(f"{heading!r}: a table must come last in its section: {line.strip()[:60]!r}")
    md = "\n".join(lines).strip("\n")
    if md:
        block["md"] = md
    if table:
        block["table"] = table
    return block


def _chapter(path: Path) -> dict:
    text = path.read_text(encoding="utf-8").replace("\r\n", "\n")
    m = re.match(r"---\n(.*?)\n---\n", text, re.S)
    if not m:
        raise ValueError(f"{path.name}: missing front matter")
    meta = {}
    for line in m.group(1).split("\n"):
        key, _, value = line.partition(":")
        meta[key.strip()] = value.strip()
    for key in ("id", "title", "summary", "sources"):
        if not meta.get(key):
            raise ValueError(f"{path.name}: front matter needs {key!r}")
    blocks = [_block(s["heading"], s["lines"]) for s in _split_sections(text[m.end():])]
    return {
        "id": meta["id"],
        "title": meta["title"],
        "summary": meta["summary"],
        "sources": meta["sources"],
        "blocks": blocks,
    }


def _scenarios(src: Path, levels: List[dict]) -> List[dict]:
    by_number: Dict[int, dict] = {}
    for path in sorted((src / "scenarios").glob("[0-9][0-9]-*.json")):
        scenario = json.loads(path.read_text(encoding="utf-8"))
        if scenario.get("number") != int(path.name[:2]):
            raise ValueError(f"{path.name}: number {scenario.get('number')!r} doesn't match the file name")
        by_number[scenario["number"]] = scenario
    placed = [n for level in levels for n in level["scenarios"]]
    if sorted(placed) != sorted(by_number):
        raise ValueError(f"scenario_levels place {sorted(placed)}, files are {sorted(by_number)}")
    return [
        {"name": level["name"], "about": level["about"], "scenarios": [by_number[n] for n in level["scenarios"]]}
        for level in levels
    ]


def build(pack_id: str, packs_dir: Path = PACKS_DIR) -> dict:
    src = packs_dir / pack_id / "src"
    pack = json.loads((src / "pack.json").read_text(encoding="utf-8"))
    diagnostics = pack.pop("diagnostic_questions", [])
    levels = _scenarios(src, pack.pop("scenario_levels", []))
    chapters = [_chapter(p) for p in sorted(src.glob("[0-9][0-9]-*.md"))]
    for chapter in chapters:
        links = [
            {"scenario_id": s["id"], "label": f"Scenario {s['number']}: {s['title']}"}
            for level in levels for s in level["scenarios"] if s["chapter"] == chapter["id"]
        ]
        if links:
            chapter["practice_links"] = links
    pack["chapters"] = chapters
    pack["scenario_levels"] = levels
    pack["diagnostic_questions"] = diagnostics
    return pack


def render(pack: dict) -> str:
    return json.dumps(pack, ensure_ascii=False, indent=2) + "\n"


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("usage: build_content_pack.py <pack_id>")
    pack = build(sys.argv[1])
    out = PACKS_DIR / pack["pack_id"] / f"v{pack['version']}.json"
    out.write_text(render(pack), encoding="utf-8")
    scenarios = sum(len(level["scenarios"]) for level in pack["scenario_levels"])
    print(f"wrote {out} ({len(pack['chapters'])} chapters, {scenarios} scenarios)")


if __name__ == "__main__":
    main()
