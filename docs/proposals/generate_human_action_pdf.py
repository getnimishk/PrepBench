import os
import sys
import shutil
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable, Preformatted
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

def create_human_action_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=0.54 * inch,
        rightMargin=0.54 * inch,
        topMargin=0.54 * inch,
        bottomMargin=0.54 * inch
    )

    styles = getSampleStyleSheet()

    # Custom Color Palette
    PRIMARY_COLOR = colors.HexColor("#0F172A")    # Slate 900
    SECONDARY_COLOR = colors.HexColor("#2563EB")  # Blue 600
    ACCENT_COLOR = colors.HexColor("#059669")     # Emerald 600
    TEXT_DARK = colors.HexColor("#1E293B")        # Slate 800
    TEXT_MUTED = colors.HexColor("#64748B")       # Slate 500
    BG_LIGHT = colors.HexColor("#F8FAFC")         # Slate 50
    BG_CODE = colors.HexColor("#1E1F22")          # Dark Code Surface
    BORDER_COLOR = colors.HexColor("#CBD5E1")     # Slate 300

    # Typography Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=PRIMARY_COLOR,
        spaceAfter=4
    )

    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=SECONDARY_COLOR,
        spaceAfter=10
    )

    h1_style = ParagraphStyle(
        'H1',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=17,
        textColor=PRIMARY_COLOR,
        spaceBefore=12,
        spaceAfter=6
    )

    h2_style = ParagraphStyle(
        'H2',
        parent=styles['Heading3'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=SECONDARY_COLOR,
        spaceBefore=8,
        spaceAfter=4
    )

    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=TEXT_DARK,
        spaceAfter=6
    )

    wireframe_style = ParagraphStyle(
        'WireframeText',
        fontName='Courier',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#E3E3E3")
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        textColor=TEXT_DARK
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.white
    )

    story = []

    # --- HEADER ---
    story.append(Paragraph("PREPBENCH / PRODUCT SPECIFICATION", subtitle_style))
    story.append(Paragraph("Human-Action Driven UI Architecture Proposal", title_style))
    story.append(Paragraph("<b>Product Direction</b>: Human-Action Organization &nbsp;|&nbsp; <b>Date</b>: September 2, 2026", ParagraphStyle('Meta', parent=body_style, textColor=TEXT_MUTED, fontSize=9)))
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1.5, color=SECONDARY_COLOR, spaceBefore=0, spaceAfter=10))

    # --- 1. EXECUTIVE PRODUCT DECISION ---
    story.append(Paragraph("1. Executive Product Decision: Human-Action Centric UI", h1_style))
    p1 = ("<b>Decision:</b> The 'Search-First' / Command-Palette model has been rejected. Instead, PrepBench will be structured strictly around "
          "<b>Clear Human Actions</b> (verbs describing what a user wants to do: <i>Practice</i>, <i>Learn</i>, <i>Review</i>, <i>Configure</i>).")
    story.append(Paragraph(p1, body_style))

    p2 = ("<b>Why Human Actions Win:</b><br/>"
          "1. <b>Zero Cognitive Friction:</b> Users do not need to memorize search terms or suffer from empty text box paralysis.<br/>"
          "2. <b>Predictable Navigation:</b> Every feature has an intuitive home based on human intent.<br/>"
          "3. <b>Unlimited Subject Scaling:</b> Subjects (Scrum, Databricks, System Design, AI) operate as clean options inside each action hub, preventing sidebar menu bloat forever.")
    story.append(Paragraph(p2, body_style))

    # --- 2. THE 4 HUMAN ACTION HUBS ---
    story.append(Paragraph("2. The 4 Human Action Navigation Hubs", h1_style))

    hubs_data = [
        [Paragraph("Human Action Hub", table_header_style), Paragraph("User Intent (What the user wants to do)", table_header_style), Paragraph("Included Features & Modules", table_header_style)],
        [
            Paragraph("<b>🏋️ 1. PRACTICE</b>", table_cell_style),
            Paragraph("<i>'I want to test myself & do active exercises.'</i>", table_cell_style),
            Paragraph("• Multiple-Choice Exams<br/>• System Design Reviews<br/>• Interview Audio Practice<br/>• Sandboxes & Interactive Labs", table_cell_style)
        ],
        [
            Paragraph("<b>📖 2. LEARN</b>", table_cell_style),
            Paragraph("<i>'I want to study material & acquire knowledge.'</i>", table_cell_style),
            Paragraph("• Sequential Learning Roadmaps<br/>• Question & Flashcard Bank<br/>• Scrum Guide & Concept Reference Docs", table_cell_style)
        ],
        [
            Paragraph("<b>📊 3. REVIEW</b>", table_cell_style),
            Paragraph("<i>'I want to evaluate outputs & review memory.'</i>", table_cell_style),
            Paragraph("• Spaced Repetition Queue (SM-2 Engine)<br/>• Unified Mastery Analytics<br/>• Saved Interview Audio Recordings", table_cell_style)
        ],
        [
            Paragraph("<b>⚙️ 4. CONFIGURE</b>", table_cell_style),
            Paragraph("<i>'I want to manage settings & platform options.'</i>", table_cell_style),
            Paragraph("• App Preferences & Themes<br/>• AI Key Management (Gemini)<br/>• Database Reset & Backup", table_cell_style)
        ]
    ]

    t_hubs = Table(hubs_data, colWidths=[1.4*inch, 2.7*inch, 2.9*inch])
    t_hubs.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY_COLOR),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_hubs)
    story.append(Spacer(1, 10))

    # --- 3. UI NAVIGATION WIREFRAME ---
    story.append(Paragraph("3. Human-Action Navigation Wireframe", h1_style))

    story.append(Paragraph("A. Clean Sidebar Structure (Grouped by Human Actions)", h2_style))
    wf_nav = (
        "┌────────────────────────────────────────────────────────┐\n"
        "│  ✦ PrepBench                                           │\n"
        "├────────────────────────────────────────────────────────┤\n"
        "│  🏋️ PRACTICE (Test Myself)                              │\n"
        "│  ├─ 📝 Exams & Quizzes                                 │\n"
        "│  ├─ 📐 System Design Reviews                           │\n"
        "│  ├─ 🎙️ Interview Practice                              │\n"
        "│  └─ 🧪 Sandboxes & Metrics                             │\n"
        "│                                                        │\n"
        "│  📖 LEARN (Study Material)                             │\n"
        "│  ├─ 🗺️ Learning Roadmaps                               │\n"
        "│  ├─ 📚 Question Bank                                   │\n"
        "│  └─ 📖 Scrum Guide & References                        │\n"
        "│                                                        │\n"
        "│  📊 REVIEW (Evaluate Performance)                      │\n"
        "│  ├─ 🧠 Spaced Repetition Queue (SM-2 Engine)           │\n"
        "│  ├─ 📈 Mastery Analytics                               │\n"
        "│  └─ 🎙️ Saved Audio Recordings                          │\n"
        "├────────────────────────────────────────────────────────┤\n"
        "│  ⚙️ Configure & Settings  (Pinned to Bottom)           │\n"
        "└────────────────────────────────────────────────────────┘"
    )
    t_wf1 = Table([[Preformatted(wf_nav, wireframe_style)]], colWidths=[7.0*inch])
    t_wf1.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BG_CODE),
        ('PADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_wf1)
    story.append(Spacer(1, 10))

    story.append(Paragraph("B. Practice Hub Dashboard Surface", h2_style))
    wf_dash = (
        "┌────────────────────────────────────────────────────────────────────────────────────────┐\n"
        "│  🏋️ PRACTICE HUB                                 Subject Selector: [ 🛢️ Databricks ▼ ]  │\n"
        "├────────────────────────────────────────────────────────────────────────────────────────┤\n"
        "│  CHOOSE A PRACTICE MODE FOR DATABRICKS:                                                │\n"
        "│                                                                                        │\n"
        "│  ┌──────────────────────────────┐  ┌──────────────────────────────┐                   │\n"
        "│  │ 📝 EXAM SIMULATOR            │  │ 📐 SYSTEM DESIGN REVIEW      │                   │\n"
        "│  │ • 50 Questions Available     │  │ • 4 Architectural Case Studies│                   │\n"
        "│  │ • Best Score: 82%            │  │ • Latest Grade: B+           │                   │\n"
        "│  │ [ ⚡ Start Exam Practice ]    │  │ [ 📐 Practice Design Case ]  │                   │\n"
        "│  └──────────────────────────────┘  └──────────────────────────────┘                   │\n"
        "│  ┌──────────────────────────────┐  ┌──────────────────────────────┐                   │\n"
        "│  │ 🎙️ INTERVIEW PRACTICE        │  │ 🧪 DATA & SQL SANDBOX        │                   │\n"
        "│  │ • 3 Technical Rounds         │  │ • Interactive Query Lab      │                   │\n"
        "│  │ • AI Delivery Analysis       │  │ • Performance Metrics        │                   │\n"
        "│  │ [ 🎙️ Start Audio Round ]     │  │ [ 🧪 Open Sandbox ]          │                   │\n"
        "│  └──────────────────────────────┘  └──────────────────────────────┘                   │\n"
        "└────────────────────────────────────────────────────────────────────────────────────────┘"
    )
    t_wf2 = Table([[Preformatted(wf_dash, wireframe_style)]], colWidths=[7.0*inch])
    t_wf2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BG_CODE),
        ('PADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_wf2)
    story.append(Spacer(1, 10))

    # --- 4. BACKEND SM-2 INTEGRATION PLAN ---
    story.append(Paragraph("4. Surfacing the Backend SM-2 Spaced Repetition Engine", h1_style))
    p3 = ("The backend already contains <code>sm2_service.py</code> and the <code>SpacedRepetition</code> database model. "
          "Under the Human-Action architecture, this engine gets a dedicated home under <b>REVIEW → Spaced Repetition Queue</b>.")
    story.append(Paragraph(p3, body_style))

    p4 = ("<b>How Spaced Repetition Works for the User:</b><br/>"
          "1. As the user completes practice exams and quizzes, <code>sm2_service.py</code> tracks question difficulty and calculate next review intervals.<br/>"
          "2. Under <b>REVIEW → Spaced Repetition Queue</b>, the user sees: <i>'14 Questions Due for Memory Review Today'</i>.<br/>"
          "3. One click launches a 5-minute review session targeting only items scheduled by the memory decay algorithm.")
    story.append(Paragraph(p4, body_style))

    doc.build(story)
    print(f"Human-Action Proposal PDF generated at: {filename}")

if __name__ == "__main__":
    out_path = r"E:\workspace\PrepBench\PrepBench_HumanAction_Architecture_Proposal.pdf"
    downloads_path = r"C:\Users\Nimish Kanungo\Downloads\PrepBench_HumanAction_Architecture_Proposal.pdf"
    
    create_human_action_pdf(out_path)
    try:
        shutil.copyfile(out_path, downloads_path)
        print(f"PDF successfully copied to Downloads: {downloads_path}")
    except Exception as e:
        print(f"Could not copy to downloads: {e}")
