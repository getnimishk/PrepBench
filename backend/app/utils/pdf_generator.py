# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
pdf_generator.py

Utility for generating styled PDF summary reports for completed exam sessions.
"""

import io
from typing import Any, List
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from app.models.exam_session import ExamSession


def generate_exam_pdf_report(session: ExamSession) -> bytes:
    """
    Generate a styled PDF summary report for a given exam session.

    Parameters:
        session (ExamSession): Completed exam session ORM object.

    Returns:
        bytes: Raw byte contents of the generated PDF document.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )
    story: List[Any] = []

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontSize=20,
        textColor=colors.HexColor("#1E293B"),
        spaceAfter=12,
    )

    story.append(Paragraph(f"Exam Report: {session.title}", title_style))
    story.append(Spacer(1, 10))

    # Metric Table
    table_data: List[List[str]] = [
        ["Metric", "Value"],
        ["Exam Mode", session.exam_mode.capitalize()],
        ["Certification", session.certification or "N/A"],
        ["Status", session.status.capitalize()],
        ["Score Percentage", f"{session.score_percentage or 0.0}%"],
        ["Result", (session.is_passed or "N/A").upper()],
        ["Total Questions", str(session.total_questions)],
        ["Correct Answers", str(session.correct_count)],
        ["Time Spent", f"{round(session.time_spent_seconds / 60, 1)} minutes"],
    ]

    t = Table(table_data, colWidths=[200, 300])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (1, 0), colors.HexColor("#3B82F6")),
                ("TEXTCOLOR", (0, 0), (1, 0), colors.whitesmoke),
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
                ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#F8FAFC")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ]
        )
    )

    story.append(t)
    doc.build(story)

    buffer.seek(0)
    return buffer.getvalue()
