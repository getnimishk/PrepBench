"""
verify_question_bank.py

Standalone, read-only integrity check: compares the live question bank database
against a reference source JSON file and reports any questions missing entirely
or with fewer options than the source has. Formalizes the ad-hoc diagnostic
scripts used to investigate the import option-loss bug into a reusable,
repeatable check that can be run after any import.

Usage (from the backend/ directory, with the venv active):
    python -m app.utils.verify_question_bank <path_to_source.json> [--json-out report.json]
"""
import sys
import json
import argparse
from pathlib import Path

from app.core.database import SessionLocal
from app.services.integrity_check_service import IntegrityCheckService


def main():
    parser = argparse.ArgumentParser(
        description="Verify the live question bank database against a reference source file."
    )
    parser.add_argument("source_file", help="Path to the reference question-bank JSON file")
    parser.add_argument("--json-out", help="Optional path to write a full JSON report", default=None)
    args = parser.parse_args()

    source_path = Path(args.source_file)
    if not source_path.exists():
        print(f"Source file not found: {source_path}")
        sys.exit(1)

    with open(source_path, encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict) and "questions" in data:
        data = data["questions"]

    db = SessionLocal()
    try:
        result = IntegrityCheckService(db).compare_against_source(data)
    finally:
        db.close()

    print(f"Source questions:        {result['source_total']}")
    print(f"Database questions:      {result['db_total']}")
    print(f"Missing questions:       {len(result['missing_questions'])} (in source, not in DB)")
    print(f"Extra questions:         {len(result['extra_questions'])} (in DB, not in source)")
    print(f"Questions missing options: {len(result['option_mismatches'])}")

    if result["option_mismatches"]:
        print("\nOption mismatches:")
        for m in result["option_mismatches"]:
            print(f"  #{m['db_id']} ({m['actual_option_count']}/{m['expected_option_count']} options): {m['text']}")
            for opt in m["missing_options"]:
                print(f"      missing: {opt[:80]}")

    if result["missing_questions"]:
        print("\nMissing questions:")
        for m in result["missing_questions"]:
            print(f"  source #{m['source_id']}: {m['text']}")

    if args.json_out:
        with open(args.json_out, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f"\nFull JSON report written to {args.json_out}")

    print()
    if result["is_clean"]:
        print("RESULT: CLEAN - no mismatches found.")
        sys.exit(0)
    else:
        print("RESULT: MISMATCHES FOUND.")
        sys.exit(1)


if __name__ == "__main__":
    main()
