"""
Seeds the built-in interview-round question bank on first run. A small,
fixed, curated list per round -- safe to seed unconditionally-if-empty at
every startup, same pattern as seed_system_design_prompts.py.

Content grounded in research on standard interview loop structure (recruiter
screen -> technical/coding -> system design -> behavioral -> hiring manager)
and common questions per round.
"""
from sqlalchemy.orm import Session
from app.repositories.interview_question_repository import InterviewQuestionRepository
from app.schemas.interview_question import InterviewQuestionCreate, InterviewQuestionFilter
from app.models.interview_question import InterviewRoundType

SEED_INTERVIEW_QUESTIONS = [
    # HR Screening -- motivation, fit, logistics; not technical depth.
    {"round_type": InterviewRoundType.HR_SCREENING, "question_text": "Tell me about yourself.", "category": "Introduction"},
    {"round_type": InterviewRoundType.HR_SCREENING, "question_text": "Why are you interested in this role?", "category": "Motivation & Fit"},
    {"round_type": InterviewRoundType.HR_SCREENING, "question_text": "What do you know about our company?", "category": "Motivation & Fit"},
    {"round_type": InterviewRoundType.HR_SCREENING, "question_text": "What are your greatest strengths and weaknesses?", "category": "Self-Assessment"},
    {"round_type": InterviewRoundType.HR_SCREENING, "question_text": "Why are you leaving your current role?", "category": "Background"},
    {"round_type": InterviewRoundType.HR_SCREENING, "question_text": "What are your salary expectations for this position?", "category": "Logistics"},
    {"round_type": InterviewRoundType.HR_SCREENING, "question_text": "What is your availability or notice period?", "category": "Logistics"},
    {"round_type": InterviewRoundType.HR_SCREENING, "question_text": "Where do you see yourself in five years?", "category": "Motivation & Fit"},

    # Hiring Manager -- leadership, ownership, prioritization, team fit.
    {"round_type": InterviewRoundType.HIRING_MANAGER, "question_text": "Tell me about a time you had to lead a project you knew little about.", "category": "Leadership"},
    {"round_type": InterviewRoundType.HIRING_MANAGER, "question_text": "Describe a time you disagreed with a decision made by leadership and how you handled it.", "category": "Ownership"},
    {"round_type": InterviewRoundType.HIRING_MANAGER, "question_text": "How do you prioritize when you have multiple competing deadlines?", "category": "Prioritization"},
    {"round_type": InterviewRoundType.HIRING_MANAGER, "question_text": "Tell me about a time you had to give a teammate difficult feedback.", "category": "Leadership"},
    {"round_type": InterviewRoundType.HIRING_MANAGER, "question_text": "Why do you want to work on this specific team?", "category": "Team Fit"},
    {"round_type": InterviewRoundType.HIRING_MANAGER, "question_text": "How do you handle ambiguity when requirements aren't fully defined?", "category": "Ownership"},
    {"round_type": InterviewRoundType.HIRING_MANAGER, "question_text": "Tell me about a time you had to influence a decision without formal authority.", "category": "Leadership"},

    # Behavioral -- STAR-format "tell me about a time..." questions.
    {"round_type": InterviewRoundType.BEHAVIORAL, "question_text": "Tell me about a time you made a mistake at work and how you handled it.", "category": "Accountability"},
    {"round_type": InterviewRoundType.BEHAVIORAL, "question_text": "Describe a time you went above and beyond what was expected of you.", "category": "Initiative"},
    {"round_type": InterviewRoundType.BEHAVIORAL, "question_text": "Tell me about a conflict you had with a coworker and how you resolved it.", "category": "Conflict Resolution"},
    {"round_type": InterviewRoundType.BEHAVIORAL, "question_text": "Describe a time you had to learn a new skill or technology quickly.", "category": "Adaptability"},
    {"round_type": InterviewRoundType.BEHAVIORAL, "question_text": "Tell me about a time you failed at something and what you learned from it.", "category": "Self-Awareness"},
    {"round_type": InterviewRoundType.BEHAVIORAL, "question_text": "Describe a time you had to collaborate with someone whose working style was very different from yours.", "category": "Collaboration"},
    {"round_type": InterviewRoundType.BEHAVIORAL, "question_text": "Tell me about a time you received critical feedback and how you responded.", "category": "Self-Awareness"},

    # System Design (spoken round) -- independent paraphrased reuse of a
    # subset of the typed System Design Practice prompts, phrased for a
    # verbal answer rather than a written one.
    {"round_type": InterviewRoundType.SYSTEM_DESIGN, "question_text": "Walk me through how you'd design a URL shortener like bit.ly.", "category": "Distributed Systems"},
    {"round_type": InterviewRoundType.SYSTEM_DESIGN, "question_text": "Walk me through how you'd design a rate limiter for a public API.", "category": "Distributed Systems"},
    {"round_type": InterviewRoundType.SYSTEM_DESIGN, "question_text": "Walk me through how you'd design a real-time chat application like WhatsApp.", "category": "Real-Time Systems"},
    {"round_type": InterviewRoundType.SYSTEM_DESIGN, "question_text": "Walk me through how you'd design a notification system that supports push, email, and SMS.", "category": "Distributed Systems"},
    {"round_type": InterviewRoundType.SYSTEM_DESIGN, "question_text": "Walk me through how you'd design a distributed cache shared across many application servers.", "category": "Caching"},
    {"round_type": InterviewRoundType.SYSTEM_DESIGN, "question_text": "Walk me through how you'd design a web crawler that avoids crawling the same page twice.", "category": "Data Systems"},
    {"round_type": InterviewRoundType.SYSTEM_DESIGN, "question_text": "Walk me through how you'd design a real-time leaderboard for a game with millions of players.", "category": "Data Systems"},
    {"round_type": InterviewRoundType.SYSTEM_DESIGN, "question_text": "Walk me through how you'd design a search autocomplete feature.", "category": "Data Systems"},
]


def seed_interview_questions_if_empty(db: Session) -> int:
    """Seeds per round_type independently, not gated on whether the table has
    *any* row at all -- a global emptiness check would skip seeding entirely
    (leaving other rounds with zero questions) the moment even one row exists
    for any single round, e.g. a user-generated-and-saved question."""
    repo = InterviewQuestionRepository(db)
    seeded_round_types = {
        rt for rt in InterviewRoundType
        if repo.count(InterviewQuestionFilter(round_type=rt)) == 0
    }

    created = 0
    for q in SEED_INTERVIEW_QUESTIONS:
        if q["round_type"] not in seeded_round_types:
            continue
        repo.create(InterviewQuestionCreate(
            round_type=q["round_type"],
            question_text=q["question_text"],
            category=q["category"],
            is_ai_generated=False,
        ))
        created += 1
    return created
