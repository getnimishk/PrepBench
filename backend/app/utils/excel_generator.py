# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
excel_generator.py

Utility for generating Excel breakdown reports for completed exam sessions.
"""

import io
from typing import Dict, Any, List
import pandas as pd
from app.models.exam_session import ExamSession


def generate_exam_excel_report(session: ExamSession) -> bytes:
    """
    Generate an Excel binary report for a given exam session.

    Parameters:
        session (ExamSession): Completed exam session ORM object.

    Returns:
        bytes: Raw byte contents of the generated Excel workbook.
    """
    buffer = io.BytesIO()

    # Metadata sheet
    metadata_records: List[Dict[str, Any]] = [
        {"Metric": "Title", "Value": session.title},
        {"Metric": "Mode", "Value": session.exam_mode},
        {"Metric": "Score %", "Value": session.score_percentage},
        {"Metric": "Result", "Value": session.is_passed},
        {"Metric": "Total Questions", "Value": session.total_questions},
        {"Metric": "Correct Count", "Value": session.correct_count},
        {"Metric": "Time Spent (s)", "Value": session.time_spent_seconds},
        {
            "Metric": "Date",
            "Value": session.start_time.isoformat() if session.start_time else "",
        },
    ]
    meta_df = pd.DataFrame(metadata_records)

    # Answers sheet (optimized with list comprehension)
    answers_data: List[Dict[str, Any]] = [
        {
            "Question ID": ans.question_id,
            "Is Correct": ans.is_correct,
            "Time Spent (s)": ans.time_spent_seconds,
            "Confidence": ans.confidence_level,
            "Flagged": ans.is_flagged,
            "Bookmarked": ans.is_bookmarked,
            "User Notes": ans.user_notes,
        }
        for ans in session.answers
    ]
    ans_df = pd.DataFrame(answers_data)

    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        meta_df.to_excel(writer, sheet_name="Summary", index=False)
        if not ans_df.empty:
            ans_df.to_excel(writer, sheet_name="Answers Breakdown", index=False)

    buffer.seek(0)
    return buffer.getvalue()
