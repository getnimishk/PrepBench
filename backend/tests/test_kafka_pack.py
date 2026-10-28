# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
test_kafka_pack.py

The Kafka study guide (`backend/app/content/packs/kafka/`) is written as one
Markdown file per chapter and one JSON file per scenario under `src/`, and built
into the newest `v<N>.json` by `scripts/build_content_pack.py`. These tests hold
the two together and hold the guide to its sources:

  * the shipped JSON is exactly what the sources build to, and v1, the guide as
    first published, never changes;
  * every scenario has the full shape the scenario page reads, cites real notes
    sections, and ends each role with a Say-it question;
  * every topic of the 45-topic Apache Kafka Mastery Roadmap maps to a chapter,
    by number and by its exact title (the learner's roadmap matches by title);
  * every chapter cites sections that exist in
    docs/research/kafka-documentation-notes.md, where each fact is traced to the
    Apache Kafka 4.3 or Confluent documentation;
  * the hands-on commands use the 4.3 tool options, not the ones 4.3 deprecated.
"""
import re
import sys
from pathlib import Path

from app.content import packs as pack_store
from app.services.content_pack_service import get_pack_roadmap_alignments, normalize_topic_title

BACKEND = Path(__file__).resolve().parents[1]
REPO = BACKEND.parent
sys.path.insert(0, str(BACKEND / "scripts"))

import build_content_pack  # noqa: E402

NOTES = REPO / "docs" / "research" / "kafka-documentation-notes.md"

# The version the sources build. Earlier versions are published files that never change.
LATEST = 2

# The learner's Apache Kafka Mastery Roadmap, in roadmap order. A topic maps to a
# chapter by the title its alignment block names, so these must match exactly.
ROADMAP_TOPICS = [
    "Event Streaming Fundamentals",
    "Kafka Record Structure",
    "Topics, Partitions, Offsets",
    "Broker & Cluster Architecture",
    "ZooKeeper vs. KRaft",
    "Local Install & First Cluster",
    "Topic Design",
    "Producer Internals",
    "Consumer Internals",
    "Consumer Groups & Assignment",
    "Offset Commit Strategies",
    "Delivery Semantics",
    "Producer Acknowledgements",
    "Idempotent Producer",
    "Transactions & EOS",
    "Rebalancing Protocols",
    "Consumer Lag",
    "Partition Key Design",
    "Ordering Guarantees",
    "Throughput Tuning",
    "Hot Partitions & Skew",
    "Replication & ISR",
    "Log Retention & Compaction",
    "Poison Pill Messages & DLQ",
    "Resilience Patterns",
    "Key Metrics & Monitoring",
    "JSON",
    "Avro",
    "Protobuf",
    "Parquet",
    "Schema Registry",
    "Kafka Connect",
    "Kafka Streams",
    "ksqlDB",
    "Tiered Storage",
    "Authentication (SASL/mTLS)",
    "Authorization (ACLs)",
    "Encryption in Transit",
    "Audit & Compliance Logging",
    "MirrorMaker 2 / Cluster Linking",
    "Multi-Region Architectures",
    "Backup & Disaster Recovery",
    "Event-Driven Architecture Design",
    "Capacity Planning",
    "Mock System Design Practice",
]

# Options the 4.3 tools mark DEPRECATED, and what replaced them.
DEPRECATED_OPTIONS = {
    "--producer-props": "--command-property",
    "--producer-property": "--command-property",
    "--consumer-property": "--command-property",
    "--producer.config": "--command-config",
    "--consumer.config": "--command-config",
    "--messages": "--num-records",
}


def _kafka():
    pack = pack_store.get("kafka", LATEST)
    assert pack is not None, "the kafka pack failed to load"
    return pack


def test_the_shipped_json_is_what_the_sources_build_to():
    built = build_content_pack.render(build_content_pack.build("kafka"))
    shipped = (BACKEND / "app" / "content" / "packs" / "kafka" / f"v{LATEST}.json").read_text(encoding="utf-8")
    assert built == shipped, "the newest kafka pack is out of date: run scripts/build_content_pack.py kafka"


def test_the_builder_refuses_a_table_that_is_not_last_in_its_section(tmp_path):
    """The page draws a block's text, then its table: a table followed by text would show as raw pipes."""
    import pytest

    src = tmp_path / "demo" / "src"
    src.mkdir(parents=True)
    (src / "pack.json").write_text('{"pack_id": "demo", "version": 1, "title": "D", "summary": "s", '
                                   '"docs_url": "https://example.org", "source_notes": "n"}', encoding="utf-8")
    front = "---\nid: one\ntitle: One\nsummary: s\nsources: §1\n---\n"
    (src / "01-one.md").write_text(front + "## Ok\nText.\n\n| a | b |\n|---|---|\n| 1 | 2 |\n", encoding="utf-8")
    built = build_content_pack.build("demo", packs_dir=tmp_path)
    assert built["chapters"][0]["blocks"][0] == {"heading": "Ok", "md": "Text.", "table": {"head": ["a", "b"], "rows": [["1", "2"]]}}

    (src / "01-one.md").write_text(front + "## Bad\n| a | b |\n|---|---|\n| 1 | 2 |\n\nMore text.\n", encoding="utf-8")
    with pytest.raises(ValueError, match="must come last"):
        build_content_pack.build("demo", packs_dir=tmp_path)


def test_every_roadmap_topic_maps_to_a_chapter_by_number_and_title():
    alignments = get_pack_roadmap_alignments("kafka", LATEST)
    for number, title in enumerate(ROADMAP_TOPICS, start=1):
        by_title = alignments.get(normalize_topic_title(title))
        assert by_title, f"Topic {number} {title!r} has no chapter"
        by_number = alignments[str(number)]
        assert {normalize_topic_title(m.topic_title) for m in by_number} == {normalize_topic_title(title)}, (
            f"Topic {number} is aligned under another title: {[m.topic_title for m in by_number]}"
        )
    numbers = {m.topic_number for ms in alignments.values() for m in ms}
    assert numbers == set(range(1, len(ROADMAP_TOPICS) + 1))


def test_coverage_is_stated_for_every_mapping():
    for mappings in get_pack_roadmap_alignments("kafka", LATEST).values():
        for m in mappings:
            assert m.coverage in {"Full", "Partial"}
            assert m.relevant_sections and m.learning_evidence


def test_each_chapter_opens_with_its_alignment_and_cites_real_notes_sections():
    notes = NOTES.read_text(encoding="utf-8")
    sections = {int(n) for n in re.findall(r"^## (\d+)\. ", notes, re.M)}
    for chapter in _kafka().chapters:
        assert chapter.blocks[0].heading == "Roadmap alignment", chapter.id
        cited = {int(n) for n in re.findall(r"§(\d+)", chapter.sources)}
        assert cited, f"{chapter.id} cites no notes section"
        assert cited <= sections, f"{chapter.id} cites missing sections {sorted(cited - sections)}"


def test_relevant_sections_name_headings_that_exist():
    """A relevant section is a heading in the chapter, or a 'Ch N (Title)' pointer to another chapter."""
    pack = _kafka()
    titles = {c.title for c in pack.chapters}
    for chapter in pack.chapters:
        headings = {b.heading for b in chapter.blocks if b.heading}
        alignment = chapter.blocks[0].md or ""
        for line in re.findall(r"\*Relevant sections:\*\s*(.+)", alignment):
            for part in (p.strip() for p in line.split(";")):
                pointer = re.fullmatch(r"Ch (\d+) \((.+)\)", part)
                if pointer:
                    n, title = int(pointer.group(1)), pointer.group(2)
                    assert pack.chapters[n - 1].title == title, f"{chapter.id}: {part!r}"
                    assert title in titles
                else:
                    assert part in headings, f"{chapter.id}: no heading {part!r}"


def test_every_table_header_cell_has_text():
    """An empty header cell fails axe's empty-table-header rule on the chapter page."""
    for chapter in _kafka().chapters:
        for block in chapter.blocks:
            if block.table:
                assert all(cell.strip() for cell in block.table.head), f"{chapter.id}/{block.heading}"


def test_every_figure_the_guide_shows_exists():
    public = REPO / "frontend" / "public"
    figures = []
    for chapter in _kafka().chapters:
        for block in chapter.blocks:
            figures += re.findall(r"^!\[[^\]]+\]\((/assets/[^)\s]+)\)$", block.md or "", re.M)
    assert len(figures) == 5
    for path in figures:
        assert (public / path.lstrip("/")).is_file(), path


def test_hands_on_commands_use_the_current_tool_options():
    for chapter in _kafka().chapters:
        for block in chapter.blocks:
            text = block.md or ""
            for old, new in DEPRECATED_OPTIONS.items():
                assert not re.search(re.escape(old) + r"(?![\w.-])", text), (
                    f"{chapter.id} uses {old}, deprecated in Kafka 4.3: use {new}"
                )


def test_the_guide_never_teaches_zookeeper_as_current():
    """Kafka 4.0 removed ZooKeeper; it may only appear as history."""
    for chapter in _kafka().chapters:
        for block in chapter.blocks:
            if block.heading == "Roadmap alignment":
                continue  # names the roadmap topic "ZooKeeper vs. KRaft", nothing more
            for sentence in re.split(r"(?<!vs\.)(?<=[.!?])\s+", block.md or ""):
                if "ZooKeeper" in sentence:
                    assert re.search(r"removed|is gone|Before KRaft|went away|migrate|still on ZooKeeper|vs\. KRaft|instead of", sentence), (
                        f"{chapter.id}: {sentence!r}"
                    )


# ---- published versions and scenarios ---------------------------------------

# Kafka v1, the guide without scenarios as first published (PR #109). A skill pinned at v1 keeps reading it until the
# learner upgrades, so the file must not change: publish a new version instead.
KAFKA_V1_FINGERPRINT = "1fffc901c4c00ded433853e0dd231c4ef09fa0c3aeb1628d139c1ad4fc09f67a"

ROLES = {"po", "pm", "dm", "em"}


def _canonical_hash(pack) -> str:
    import hashlib
    import json

    payload = json.dumps(pack.model_dump(mode="json"), sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _scenarios():
    return [s for level in _kafka().scenario_levels for s in level.scenarios]


def test_the_first_published_kafka_guide_is_kept_unchanged():
    v1 = pack_store.get("kafka", 1)
    assert v1 is not None and v1.scenario_levels == []
    assert _canonical_hash(v1) == KAFKA_V1_FINGERPRINT
    # The newest version keeps every chapter, in order, so links and pinned progress still resolve.
    assert [c.id for c in v1.chapters] == [c.id for c in _kafka().chapters]
    assert pack_store.latest("kafka").version == LATEST


def test_eighteen_written_scenarios_numbered_in_order():
    scenarios = _scenarios()
    assert [s.number for s in scenarios] == list(range(1, 19))
    assert [s.id for s in scenarios] == [str(n) for n in range(1, 19)]
    assert all(s.content for s in scenarios)


def test_each_scenario_cites_real_notes_sections():
    notes = NOTES.read_text(encoding="utf-8")
    sections = {int(n) for n in re.findall(r"^## (\d+)\. ", notes, re.M)}
    for s in _scenarios():
        cited = {int(n) for n in re.findall(r"§(\d+)", s.sources)}
        assert cited and cited <= sections, f"scenario {s.id} cites {sorted(cited - sections) or 'nothing'}"


def test_each_scenario_has_the_shape_the_scenario_page_reads():
    """The page keys lists by their text, so repeated lines in one list would collide."""
    for s in _scenarios():
        c = s.content
        where = f"scenario {s.id}"
        assert c["bookmark"].strip() and c["honesty"].strip(), where
        assert len(c["check"]) == 4, where
        for q in c["check"]:
            assert len(q["options"]) == len(set(q["options"])) >= 3, where
            assert 0 <= q["answer"] < len(q["options"]) and q["why"].strip(), where
        case = c["caseStudy"]
        assert case["setting"].strip() and case["tasks"] and case["pipeline"], where
        for key_list in ([e["when"] for e in case["events"]], case["pipeline"], case["tasks"], c["takeaway"]):
            assert len(key_list) == len(set(key_list)), where
        assert len(c["debrief"]) >= 2, where
        assert set(c["lenses"]) == ROLES, where
        for role, lens in c["lenses"].items():
            assert lens["tasks"] and len(lens["tasks"]) == len(set(lens["tasks"])), f"{where}/{role}"
            assert lens["debrief"], f"{where}/{role}"
            assert lens["sayIt"]["question"].strip() and len(lens["sayIt"]["points"]) >= 3, f"{where}/{role}"
        for block in c["debrief"] + [b for lens in c["lenses"].values() for b in lens["debrief"]]:
            assert block["title"].strip() and len(block["text"]) == len(set(block["text"])), where


def test_chapters_link_to_the_scenarios_that_practise_them():
    by_chapter = {}
    for s in _scenarios():
        by_chapter.setdefault(s.chapter, []).append(s.id)
    for chapter in _kafka().chapters:
        assert [link.scenario_id for link in chapter.practice_links] == by_chapter.get(chapter.id, []), chapter.id


def test_scenarios_use_current_tool_options_and_never_teach_zookeeper():
    import json

    for s in _scenarios():
        text = json.dumps(s.content, ensure_ascii=False)
        assert "ZooKeeper" not in text, s.id
        for old, new in DEPRECATED_OPTIONS.items():
            assert not re.search(re.escape(old) + r"(?![\w.-])", text), f"scenario {s.id} uses {old}: use {new}"


def test_correct_answers_are_spread_over_the_option_positions():
    """If the right answer is nearly always in one place, the check tests guessing, not understanding."""
    from collections import Counter

    positions = Counter(q["answer"] for s in _scenarios() for q in s.content["check"])
    assert max(positions.values()) <= sum(positions.values()) / 2, positions
