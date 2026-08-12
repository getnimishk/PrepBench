# PrepBench — Local Offline Interview & Exam Prep Platform

> A production-quality, **100% offline** certification and interview preparation platform.  
> **No cloud. No internet. No accounts.** Everything runs on your local machine.

---

## ✨ Features at a Glance

| Feature | Details |
|---|---|
| **Exam Modes** | Practice, Timed, Custom, Weak Topic Focus, Spaced Repetition (SM-2) |
| **Question Types** | Single Choice, Multiple Choice, True/False, Scenario, Case Study, Code, Image |
| **System Design Practice** | Typed answers to system design prompts, AI-graded (Gemini) against a 6-category rubric |
| **Interview Practice** | Round-based audio practice (HR Screening, Hiring Manager, System Design, Behavioral) with AI-graded content + delivery scoring |
| **Analytics** | Per-mode tabs (Exams / System Design / Interview Practice) — score trends, rolling averages, domain & category breakdowns |
| **Question Bank** | CRUD editor, Bulk import (JSON/CSV/Excel), Advanced search/filter |
| **Interview Question Bank** | Curated per-round question sets, plus your own import (text/JSON/CSV) and edit/delete |
| **Export** | PDF & Excel exam reports per session |
| **Spaced Repetition** | SM-2 algorithm schedules question reviews at optimal intervals |
| **Certifications** | Pre-seeded with Scrum (PSM I), Kafka, System Design, AWS question packs |

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

## 🛣 Roadmap (Future Ready Architecture)

- [ ] AI-powered explanation generation (local LLM via Ollama)
- [ ] PDF/image question import with OCR
- [ ] Flashcard mode from missed questions
- [ ] Mobile-responsive PWA
- [ ] Multi-user support with local authentication
- [ ] Tauri desktop executable (native Windows/macOS app)

---

## 📄 License

MIT License — Use freely for personal certification preparation.
