# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
test_kafka_pack.py

The Kafka study guide (`backend/app/content/packs/kafka/`) is written as one
Markdown file per chapter under `src/` and built into `v1.json` by
`scripts/build_content_pack.py`. These tests hold the two together and hold the
guide to its sources:

  * the shipped JSON is exactly what the sources build to;
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
    pack = pack_store.get("kafka", 1)
    assert pack is not None, "the kafka pack failed to load"
    return pack


def test_the_shipped_json_is_what_the_sources_build_to():
    built = build_content_pack.render(build_content_pack.build("kafka"))
    shipped = (BACKEND / "app" / "content" / "packs" / "kafka" / "v1.json").read_text(encoding="utf-8")
    assert built == shipped, "v1.json is out of date: run scripts/build_content_pack.py kafka"


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
    alignments = get_pack_roadmap_alignments("kafka", 1)
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
    for mappings in get_pack_roadmap_alignments("kafka", 1).values():
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
