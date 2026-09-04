import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable, Preformatted
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

def create_proposal_pdf(filename):
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
    SECONDARY_COLOR = colors.HexColor("#4F46E5")  # Indigo 600
    ACCENT_COLOR = colors.HexColor("#059669")     # Emerald 600
    WARN_COLOR = colors.HexColor("#D97706")       # Amber 600
    TEXT_DARK = colors.HexColor("#1E293B")        # Slate 800
    TEXT_MUTED = colors.HexColor("#64748B")       # Slate 500
    BG_LIGHT = colors.HexColor("#F8FAFC")         # Slate 50
    BG_CODE = colors.HexColor("#1E1F22")          # Dark Code Surface
    BORDER_COLOR = colors.HexColor("#E2E8F0")     # Slate 200

    # Typography Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
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
        spaceAfter=12
    )

    h1_style = ParagraphStyle(
        'H1',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=18,
        textColor=PRIMARY_COLOR,
        spaceBefore=14,
        spaceAfter=6
    )

    h2_style = ParagraphStyle(
        'H2',
        parent=styles['Heading3'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        textColor=SECONDARY_COLOR,
        spaceBefore=10,
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

    bold_body_style = ParagraphStyle(
        'BoldBody',
        parent=body_style,
        fontName='Helvetica-Bold'
    )

    callout_style = ParagraphStyle(
        'CalloutText',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=9.5,
        leading=13.5,
        textColor=PRIMARY_COLOR
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

    # --- HEADER / METADATA ---
    story.append(Paragraph("PREPBENCH / PRODUCT ARCHITECTURE PROPOSAL", subtitle_style))
    story.append(Paragraph("The Search-First & Action-Ranked UI Architecture", title_style))
    story.append(Paragraph("<b>Author</b>: Antigravity PM Team &nbsp;|&nbsp; <b>Date</b>: September 2, 2026 &nbsp;|&nbsp; <b>Target</b>: PrepBench Next-Gen UI", ParagraphStyle('Meta', parent=body_style, textColor=TEXT_MUTED, fontSize=9)))
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1.5, color=SECONDARY_COLOR, spaceBefore=0, spaceAfter=12))

    # --- 1. EXECUTIVE THESIS ---
    story.append(Paragraph("1. Executive Thesis: Dissolving the Taxonomy Trap", h1_style))
    p1 = ("For four sessions, the product debate centered on whether PrepBench should organize its interface by <b>Formats</b> "
          "(Exams, Interviews, System Design) or by <b>Subjects</b> (Scrum, Databricks, AI). This proposal asserts that <b>the two-axis debate is a false dilemma</b> created entirely by trying to build a traditional navigation tree.")
    story.append(Paragraph(p1, body_style))

    p2 = ("<b>The Real Google Move:</b> Google’s core architectural signature is not hierarchical taxonomies—it is <i>refusing to make the user navigate</i>. "
          "Gmail killed folders with search + labels. Drive is a search box with a filesystem attached. Power users live in command palettes. "
          "By establishing a single global Search / Command Input (<code>Cmd + K</code>) as the front door, the subject-vs-format debate completely dissolves: "
          "searching <code>'cost'</code> or <code>'scrum events'</code> instantaneously returns exams, design reviews, guide passages, and personal accuracy in one surface.")
    story.append(Paragraph(p2, body_style))

    # --- 2. CONCRETE ASSUMPTIONS & RISKS FOR COUNTER-DEBATE ---
    story.append(Paragraph("2. Explicit Assumptions & Risks (For Counter-Argument)", h1_style))
    p3 = "To enable rigorous counter-debate, the core assumptions underlying this design proposal are explicitly stated below alongside their vulnerabilities:"
    story.append(Paragraph(p3, body_style))

    assumptions_data = [
        [
            Paragraph("Assumption", table_header_style),
            Paragraph("Stated Rationale", table_header_style),
            Paragraph("Counter-Argument / Vulnerability", table_header_style)
        ],
        [
            Paragraph("<b>1. Session Intent</b>", table_cell_style),
            Paragraph("Users open the app with a specific topic or keyword in mind (e.g. <i>'I want to study Delta Lake'</i>).", table_cell_style),
            Paragraph("<b>Vulnerability:</b> Novice users or passive learners may suffer from 'empty text box paralysis' when they don't know what keyword to type.", table_cell_style)
        ],
        [
            Paragraph("<b>2. Command Palette Preference</b>", table_cell_style),
            Paragraph("Target users are technical engineers who prefer keyboard shortcuts (<code>Cmd+K</code>) over clicking sidebar links.", table_cell_style),
            Paragraph("<b>Vulnerability:</b> Mouse-driven users may ignore keyboard shortcuts entirely if visual affordances aren't prominent.", table_cell_style)
        ],
        [
            Paragraph("<b>3. Action-Ranked Home</b>", table_cell_style),
            Paragraph("Users prefer 3 ranked actionable recommendations (Resume, SM-2 Review, Weak Spot) over passive KPI charts.", table_cell_style),
            Paragraph("<b>Vulnerability:</b> Users who want a birds-eye summary of overall certification readiness may feel deprived of visual progress gauges.", table_cell_style)
        ],
        [
            Paragraph("<b>4. SM-2 Spaced Repetition Wiring</b>", table_cell_style),
            Paragraph("Surfacing the existing <code>sm2_service.py</code> backend engine on Home will drive daily short reviews.", table_cell_style),
            Paragraph("<b>Vulnerability:</b> If a user misses 2 weeks, a 150-item SM-2 backlog could create overwhelming study debt.", table_cell_style)
        ],
        [
            Paragraph("<b>5. Inline AI vs Drawer AI</b>", table_cell_style),
            Paragraph("Placing the <code>[Why?]</code> button directly inline on incorrect questions reduces friction compared to a side-drawer.", table_cell_style),
            Paragraph("<b>Vulnerability:</b> Inline AI expansions can clutter the quiz card layout if detailed multi-paragraph explanations are generated.", table_cell_style)
        ]
    ]

    t_assumptions = Table(assumptions_data, colWidths=[1.3*inch, 2.8*inch, 2.9*inch])
    t_assumptions.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY_COLOR),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_assumptions)
    story.append(Spacer(1, 10))

    # --- 3. SYSTEM ARCHITECTURE & HOME WIREFRAME ---
    story.append(Paragraph("3. UI Architecture & Wireframes", h1_style))

    story.append(Paragraph("A. Home Screen: Search-First & Action-Ranked (3 Action Cards)", h2_style))
    wf_home = (
        "┌────────────────────────────────────────────────────────────────────────────────────────┐\n"
        "│  🔍  Search anything or press Cmd + K (e.g. 'scrum events', 'delta lake', 'cost')...   │\n"
        "├────────────────────────────────────────────────────────────────────────────────────────┤\n"
        "│                                                                                        │\n"
        "│  1. ⏯️ RESUME SESSION                                                                   │\n"
        "│  Databricks Design Review #3 ── Step 4 of 6 (Last active 18h ago)                      │\n"
        "│  [ ▶️ Continue Design Review ]                                                          │\n"
        "│                                                                                        │\n"
        "│  2. 🧠 DUE FOR SPACED REPETITION REVIEW (Powered by sm2_service.py)                     │\n"
        "│  14 questions queued based on your memory decay curve (Scrum Events & Delta Lake)      │\n"
        "│  [ ⚡ Start 5-Minute Spaced Review ]                                                    │\n"
        "│                                                                                        │\n"
        "│  3. 🎯 WEAKEST TOPIC DRILL                                                             │\n"
        "│  Storage vs Compute Cost Optimization (38% accuracy across 3 attempts)                 │\n"
        "│  [ 🎯 Target This Weakness ]                                                           │\n"
        "│                                                                                        │\n"
        "└────────────────────────────────────────────────────────────────────────────────────────┘"
    )
    t_wf1 = Table([[Preformatted(wf_home, wireframe_style)]], colWidths=[7.0*inch])
    t_wf1.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BG_CODE),
        ('PADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_wf1)
    story.append(Spacer(1, 10))

    story.append(Paragraph("B. Command Palette Search Overlay (`Cmd + K`)", h2_style))
    wf_cmd = (
        "┌────────────────────────────────────────────────────────────────────────────────────────┐\n"
        "│ 🔍 Query: 'cost'                                                                       │\n"
        "├────────────────────────────────────────────────────────────────────────────────────────┤\n"
        "│  📐 DESIGN REVIEW : Databricks FinOps & DBU Cost Optimization (Case Study #4)          │\n"
        "│  📝 EXAM QUESTIONS: 5 Questions on DBU Pricing & Cluster Autoscaling                    │\n"
        "│  🗺️ ROADMAP TOPIC : Databricks Governance & Cost Management (Phase 3)                  │\n"
        "│  📊 YOUR ACCURACY  : 38% Accuracy on Cost Questions (3 Missed)                          │\n"
        "└────────────────────────────────────────────────────────────────────────────────────────┘"
    )
    t_wf2 = Table([[Preformatted(wf_cmd, wireframe_style)]], colWidths=[7.0*inch])
    t_wf2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BG_CODE),
        ('PADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_wf2)
    story.append(Spacer(1, 10))

    story.append(Paragraph("C. Practice Surface with Inline AI at Failure Point", h2_style))
    wf_practice = (
        "┌────────────────────────────────────────────────────────────────────────────────────────┐\n"
        "│ Question 3 of 10  •  Databricks FinOps                                                │\n"
        "│ What is the primary advantage of Auto-terminating single-node clusters?                │\n"
        "├────────────────────────────────────────────────────────────────────────────────────────┤\n"
        "│  [ ] A. It increases Spark driver memory allocation.                                   │\n"
        "│  [X] B. It prevents idle DBU consumption when developer notebooks are inactive. (YOUR)  │\n"
        "│  [✓] C. It eliminates control plane management overhead. (CORRECT)                     │\n"
        "├────────────────────────────────────────────────────────────────────────────────────────┤\n"
        "│  💡 INLINE AI EXPLANATION (One-Click Inline Expansion)                                 │\n"
        "│  Auto-termination stops compute charges, but control plane management remains managed │\n"
        "│  by Databricks. Option C accurately reflects architectural boundaries under DBU rules. │\n"
        "└────────────────────────────────────────────────────────────────────────────────────────┘"
    )
    t_wf3 = Table([[Preformatted(wf_practice, wireframe_style)]], colWidths=[7.0*inch])
    t_wf3.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BG_CODE),
        ('PADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_wf3)
    story.append(Spacer(1, 10))

    # --- 4. WIRING THE UNWIRED BACKEND ENGINES ---
    story.append(Paragraph("4. Backend Engine Integration Plan", h1_style))
    p4 = ("A critical finding during this audit: <b><code>sm2_service.py</code> and the <code>SpacedRepetition</code> model exist in the backend codebase, "
          "but have zero API router endpoints or frontend connections.</b> The mathematical engine is already built—it simply requires wiring.")
    story.append(Paragraph(p4, body_style))

    engine_data = [
        [Paragraph("Engine Component", table_header_style), Paragraph("Current Backend State", table_header_style), Paragraph("Proposed Surfacing", table_header_style)],
        [
            Paragraph("<b>SM-2 Spaced Repetition</b>", table_cell_style),
            Paragraph("Fully implemented in <code>app/services/sm2_service.py</code> with ease factor floors (1.3) and interval math.", table_cell_style),
            Paragraph("Wire to <code>/api/v1/spaced-repetition/due</code> and surface directly as Card #2 on the Home screen.", table_cell_style)
        ],
        [
            Paragraph("<b>Weak Spot Detection</b>", table_cell_style),
            Paragraph("Calculated inside <code>analytics_repository.py</code> and <code>system_design_service.py</code>.", table_cell_style),
            Paragraph("Surface as Card #3 on Home: 1-click targeted drill for the user's lowest accuracy topic.", table_cell_style)
        ],
        [
            Paragraph("<b>LLM Gateway</b>", table_cell_style),
            Paragraph("Abstracted in <code>app/llm/gateway.py</code> with fallback to local env / Gemini.", table_cell_style),
            Paragraph("Wire directly to inline <code>[Why?]</code> feedback buttons on quiz failure cards.", table_cell_style)
        ]
    ]

    t_engine = Table(engine_data, colWidths=[1.5*inch, 2.7*inch, 2.8*inch])
    t_engine.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY_COLOR),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_engine)
    story.append(Spacer(1, 10))

    # --- 5. EMPIRICAL TELEMETRY VERIFICATION PLAN ---
    story.append(Paragraph("5. Empirical Telemetry Plan (2-Week Usage Query)", h1_style))
    p5 = ("Rather than debating taxonomy theoretically, PrepBench can settle the Subject vs. Format question empirically. "
          "Every practice attempt is logged in SQLite (<code>exam_simulator.db</code>) with timestamps, domains, and session modes. "
          "Running the following SQL query after 2 weeks of natural usage will provide definitive evidence:")
    story.append(Paragraph(p5, body_style))

    sql_code = (
        "SELECT \n"
        "    q.domain,\n"
        "    s.exam_mode,\n"
        "    COUNT(*) as total_attempts\n"
        "FROM exam_answers a\n"
        "JOIN questions q ON a.question_id = q.id\n"
        "JOIN exam_sessions s ON a.session_id = s.id\n"
        "GROUP BY q.domain, s.exam_mode;"
    )
    t_sql = Table([[Preformatted(sql_code, wireframe_style)]], colWidths=[7.0*inch])
    t_sql.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BG_CODE),
        ('PADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_sql)
    story.append(Spacer(1, 6))

    p6 = ("<b>Decision Metric:</b> If usage clusters heavily by domain across multiple modes in a single sitting, subject-first scoping is empirically validated. "
          "If usage clusters by exam mode across multiple domains, format-first navigation is validated.")
    story.append(Paragraph(p6, body_style))

    doc.build(story)
    print(f"PDF successfully generated at: {filename}")

if __name__ == "__main__":
    out_path = r"E:\workspace\PrepBench\PrepBench_SearchFirst_Architecture_Proposal.pdf"
    downloads_path = r"C:\Users\Nimish Kanungo\Downloads\PrepBench_SearchFirst_Architecture_Proposal.pdf"
    
    create_proposal_pdf(out_path)
    try:
        import shutil
        shutil.copyfile(out_path, downloads_path)
        print(f"PDF successfully copied to Downloads: {downloads_path}")
    except Exception as e:
        print(f"Could not copy to downloads: {e}")
