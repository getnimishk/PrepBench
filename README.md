# PrepBench — Offline Exam Simulator, Interview Practice & Learning Roadmap Tracker

**Free, open-source, 100% offline certification exam prep and technical interview practice.** Run realistic mock exams, get AI-graded feedback on system design answers and recorded interview responses, and track any curriculum as a visual learning roadmap — with every byte of your study data staying on your own machine.

**No cloud. No accounts. No subscription. No telemetry.**

`offline exam simulator` · `practice test software` · `technical interview preparation` · `spaced repetition study app` · `system design interview practice` · `self-hosted learning tracker`

---

## ✨ Features at a Glance

Everything below is built and working today — not a roadmap of intentions.

| Feature | What it does for you |
|---|---|
| 🎯 **5 Exam Modes** | **Practice** (instant explanations), **Timed** (real exam conditions), **Custom** (pick topics, difficulty, count), **Weak Topic Focus** (auto-targets domains you keep failing), **Spaced Repetition** (only what's due today) |
| 🧠 **Spaced Repetition (SM-2)** | The same proven algorithm behind Anki. Every answer updates that question's interval and ease factor, so you review right before you'd forget — not sooner, not later |
| 🗺️ **Learning Roadmaps** | Import any syllabus (`.xlsx` / `.json` / `.md` / `.csv`) and track it end to end in **three views**: a **table** for editing status, a **journey map** for "where am I", and a **Gantt schedule** that projects your finish date from estimated hours ÷ your weekly study budget |
| 🏗️ **System Design Practice** | Write answers to real system design prompts and get AI-graded feedback across a 6-category rubric — scores, strengths, and specific improvements, calibrated to your target role |
| 🎤 **Interview Practice (Audio)** | Record spoken answers across 4 interview rounds (HR Screening, Hiring Manager, System Design, Behavioral). AI scores both **what you said** (content) and **how you said it** (delivery: pacing, filler words, clarity) |
| 📊 **Analytics That Explain Themselves** | Separate tabs per practice mode — score trends with rolling averages, domain mastery radar, per-category breakdowns, and your single weakest area called out by name |
| 📚 **Question Bank** | Full CRUD editor, bulk import from JSON/CSV/Excel/Markdown, advanced search and filtering, and a pre-import audit studio that validates and auto-refines a batch before it touches your database |
| 📄 **PDF & Excel Reports** | Export any exam session as a formatted PDF report or a multi-sheet Excel workbook — for your records, your manager, or your study group |
| 🔒 **Genuinely Private** | A single local SQLite file. Nothing is uploaded, no account is created, and the app works with your Wi-Fi switched off |
| 🚫 **Never Fabricates a Score** | If AI grading is unavailable, you see "Not Graded" — never an invented number. Percentages that can't be computed show as `—`, not a misleading `0%` |

### Who PrepBench is for

- **Certification candidates** — PSM I, PSPO I, AWS Solutions Architect, Kafka, and any exam you can supply questions for
- **Engineers preparing for technical interviews** — system design rounds and behavioral rounds, with feedback instead of guesswork
- **Self-directed learners** — anyone working through a syllabus who wants to see real progress and a realistic finish date
- **Privacy-conscious studiers** — if you won't paste your weak spots into someone else's cloud, this runs entirely on your laptop

### Why offline matters

| | PrepBench | Typical SaaS prep platform |
|---|---|---|
| Works on a plane, train, or bad hotel Wi-Fi | ✅ | ❌ |
| Your performance data leaves your machine | Never | Always |
| Cost | Free, MIT-licensed | Monthly subscription |
| Bring your own questions | ✅ Unlimited import | Usually locked to their bank |
| Survives the vendor shutting down | ✅ It's your file | ❌ |

---

## 🛠 Tech Stack

```
Backend:   Python 3.12 · FastAPI · SQLAlchemy 2 · SQLite (WAL mode) · Pydantic v2
Frontend:  React 18 · TypeScript · Vite · Material UI v5 · Chart.js
Storage:   Local SQLite database at backend/data/exam_simulator.db
```

---

## 🚀 Quick Start (Windows)

### Prerequisites
- **Python 3.12+** — https://python.org/downloads  
- **Node.js 20+** — https://nodejs.org

### One-Click Launch

```bat
# Double-click or run from terminal:
start_app.bat
```

This will:
1. Create a Python virtual environment in `backend/.venv`
2. Install all Python dependencies
3. Start the FastAPI server on **http://localhost:8000**
4. Install npm packages (first run only)
5. Start the Vite dev server on **http://localhost:5173**
6. Open your browser automatically

---

## 🛠 Manual Setup (step-by-step)

### Backend

```powershell
cd backend

# Create venv
python -m venv .venv
.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend

```powershell
cd frontend

# Install packages
npm install

# Run dev server
npm run dev
```

---

## ⚙️ Configuration Setup (.env)

The application includes template `.env.example` configuration files at both the root and backend levels.

1. **Create your `.env` file**:
   ```powershell
   # Copy template to .env
   cp .env.example .env
   ```

2. **Configuration Variables**:

| Variable | Description | Default | Required? |
|---|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key for LLM RAG Grounding & AI Option Refinements | `None` | Optional |
| `LOG_LEVEL` | Application logging verbosity (`DEBUG`, `INFO`, `WARNING`, `ERROR`) | `DEBUG` | No |
| `DATABASE_PATH` | Path to local SQLite database file | `data/exam_simulator.db` | No |
| `DEFAULT_PASSING_PERCENTAGE` | Default passing score percentage for exams | `70.0` | No |
| `DEFAULT_EXAM_DURATION_MINUTES` | Default duration for generated exam sessions | `60` | No |

> 💡 **LLM Features**: If `GEMINI_API_KEY` is provided, the application enables 1-click AI option refinements, Scrum Guide 2020 RAG grounding, blind LLM answer key auditing, System Design attempt grading, and Interview Practice recording analysis. Without a key, these features report as "unavailable" rather than fabricating a score — the rest of the app still runs 100% offline.

---

## 📁 Project Structure

```
PrepBench/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # FastAPI routers
│   │   ├── core/            # Config, DB setup, exceptions, logging
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── repositories/    # Data access layer
│   │   ├── schemas/         # Pydantic request/response models
│   │   ├── services/        # Business logic
│   │   └── utils/           # PDF/Excel generators, seed data
│   └── tests/               # Pytest test suite
├── frontend/
│   └── src/
│       ├── components/      # Reusable UI components
│       ├── pages/           # Route-level page components
│       ├── services/        # Axios API client
│       ├── types/           # TypeScript interfaces
│       └── context/         # React context (Theme)
├── data/                    # Sample question packs (JSON/CSV)
├── start_app.bat            # Windows one-click launcher
└── start_app.sh             # Linux/macOS launcher
```

---

## 📥 Importing Questions

The app supports three import formats. Drop your file in **Question Bank → Bulk Import**.

### JSON Format
```json
[
  {
    "text": "What is the Sprint Goal?",
    "question_type": "single_choice",
    "difficulty": "medium",
    "domain": "Agile & Scrum",
    "topic": "Sprint",
    "certification": "PSM I",
    "explanation": "The Sprint Goal is the single objective for the Sprint.",
    "options": [
      { "option_text": "A commitment by the Developers", "is_correct": true },
      { "option_text": "A list of Product Backlog items", "is_correct": false }
    ]
  }
]
```

### CSV Format
See `data/template_import.csv` for the column structure. Key columns:

```
text, question_type, difficulty, domain, topic, certification, explanation,
option_1, option_1_correct, option_2, option_2_correct, ...
```

---

## 🗺️ Learning Roadmaps — track any curriculum end to end

Go to **Roadmaps → Import Roadmap** and drop in a syllabus. PrepBench reads `.xlsx`, `.json`, `.md`, and `.csv`.

**Spreadsheets are detected by column shape, not by sheet name**, so any workbook with a Phase/Topic-style table imports — you don't have to rename anything or match a template.

| Column (any of these names work) | Becomes |
|---|---|
| Phase / Module / Section | The phase a topic belongs to |
| Topic / Title / Skill | The topic itself |
| Learning Objective / Goal | What you're aiming to understand |
| Success Criteria / Outcome | How you'll know you've got it |
| Est. Hours / Effort | Feeds the projected schedule |
| Status / Progress % | Existing progress, if you've been tracking already |

Narrow two-to-four column sheets (CLI cheat sheets, glossaries, mental models) are preserved as **Reference** tabs instead of being discarded, and trailing `TOTAL` rows are recognised as summaries rather than imported as a phantom topic.

### The three views

- **Table** — the work surface. Change status inline, add evidence notes per topic.
- **Journey** — phase-level orientation with a "You are here" marker, so you can see progress without reading 45 rows.
- **Schedule** — a Gantt projected from estimated hours ÷ your weekly study budget. Set both in **Schedule settings** and you get a realistic finish date; leave them unset and it tells you exactly what's missing rather than drawing an empty chart.

> The schedule forecasts remaining work from **today**, not from your original start date — so when you fall behind, it shows where you'll actually land instead of a plan you've already missed.

### Markdown roadmaps

```markdown
# Kubernetes Mastery
## Fundamentals
- [x] Pods and Deployments (3h)
- [ ] Services and Ingress (4h)
## Operations
- [ ] Observability (5h)
```

---

## 🔬 Running Tests

```powershell
cd backend
.venv\Scripts\activate
pytest -v
```

---

## 🌐 API Reference

Interactive Swagger docs: **http://localhost:8000/docs**

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/questions` | GET | List/search questions |
| `/api/v1/questions` | POST | Create question |
| `/api/v1/questions/{id}` | PUT/DELETE | Edit/delete question |
| `/api/v1/exams` | POST | Start new exam session |
| `/api/v1/exams/{id}/answer` | POST | Save answer (autosave) |
| `/api/v1/exams/{id}/finish` | POST | Submit and score exam |
| `/api/v1/analytics/dashboard` | GET | Dashboard KPIs |
| `/api/v1/analytics/score-trends` | GET | Score history data |
| `/api/v1/analytics/domain-performance` | GET | Domain accuracy breakdown |
| `/api/v1/imports/file` | POST | Bulk upload JSON/CSV/Excel |
| `/api/v1/export/pdf/{id}` | GET | Download PDF exam report |
| `/api/v1/export/excel/{id}` | GET | Download Excel exam report |
| `/api/v1/settings` | GET/PUT | App settings |
| `/api/v1/roadmaps` | GET/POST | List or create learning roadmaps |
| `/api/v1/roadmaps/{id}` | GET/PUT/DELETE | Roadmap detail with phases, topics, resources |
| `/api/v1/roadmaps/{id}/topics/{tid}` | PATCH | Update a topic's status, progress, or notes |
| `/api/v1/roadmaps/{id}/schedule` | GET | Derived Gantt schedule + projected finish date |
| `/api/v1/roadmaps/import/validate` | POST | Preview a roadmap file before importing |
| `/api/v1/roadmaps/import/confirm` | POST | Commit the reviewed roadmap |
| `/api/v1/system-design/attempts` | GET | System design attempt history |
| `/api/v1/recordings` | GET | Interview practice recordings + analyses |

---

## 🧠 Spaced Repetition (SM-2 Algorithm)

When answering questions, the app tracks your **repetition count**, **interval**, and **ease factor** per question.

After each answer, the SM-2 formula calculates when you should see that question again:
- Correct + High confidence → longer interval, increased ease factor
- Incorrect → reset to 1-day interval

Use **"Spaced Repetition"** exam mode to always practice questions that are due for review today.

---

## 🎯 Supported Certifications (Pre-seeded)

- PSM I — Professional Scrum Master
- PSPO I — Professional Scrum Product Owner  
- AWS Solutions Architect
- Kafka Certified Developer
- System Design Architecture

Import your own question packs from the Question Bank to add any certification.

---

## ❓ Frequently Asked Questions

### Is PrepBench really free?
Yes. MIT-licensed, no paid tier, no account, no usage limits. Clone it and run it.

### Does PrepBench work without an internet connection?
Yes — that's the point. Exams, the question bank, roadmaps, analytics, and PDF/Excel export all run with your Wi-Fi off. Only the optional AI grading features need a network, and the app stays fully usable without them.

### Is my study data sent anywhere?
No. Everything lives in one SQLite file at `backend/data/exam_simulator.db` on your machine. There is no telemetry, no analytics SDK, and no account system. If you delete that file, the data is gone — nobody else has a copy.

### Do I need an API key?
Only for the AI features (system design grading, interview recording analysis, question refinement). Set `GEMINI_API_KEY` in `.env` to enable them. Without it, those features honestly report "unavailable" rather than inventing a score, and everything else works normally.

### Which certifications does it support?
It ships with PSM I, PSPO I, AWS Solutions Architect, Kafka, and System Design question packs — but it's certification-agnostic. Import your own questions from JSON, CSV, Excel, or Markdown and you can prepare for anything.

### Can I use my own questions and study material?
Yes, and that's the intended workflow. Bulk-import questions in four formats, and import any syllabus as a learning roadmap. Nothing is locked to a vendor's content library.

### How is this different from Anki?
Anki is a general-purpose flashcard tool. PrepBench uses the same SM-2 spaced repetition algorithm but is built around exam preparation specifically — timed mock exams with pass/fail scoring, weak-domain detection, PDF score reports, AI-graded system design and interview answers, and curriculum roadmaps with projected finish dates.

### Does it run on macOS and Linux?
Yes. Use `start_app.sh` instead of `start_app.bat`. The stack is Python + Node, both cross-platform.

### Can I self-host it for my team?
It's designed as a single-user local app — there's no authentication or multi-tenancy. You can run it on a machine your team shares, but everyone would see the same study data.

---

## 🛣 What's Next

- [ ] AI-powered explanation generation (local LLM via Ollama)
- [ ] PDF/image question import with OCR
- [ ] Flashcard mode from missed questions
- [ ] Mobile-responsive PWA
- [ ] Multi-user support with local authentication
- [ ] Tauri desktop executable (native Windows/macOS app)

---

## 📄 License

MIT License — use freely for personal certification preparation.

---

<sub>**Keywords:** offline exam simulator · free practice test software · certification exam prep app · technical interview preparation tool · system design interview practice · mock interview recording analysis · spaced repetition SM-2 study app · learning roadmap tracker · self-hosted study planner · privacy-first exam prep · open source exam simulator · PSM I practice exam · AWS Solutions Architect practice questions · Kafka learning path · Gantt study schedule · question bank manager</sub>
