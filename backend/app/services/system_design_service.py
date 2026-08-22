from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.core.exceptions import ResourceNotFoundException
from app.core.logging_config import logger
from app.llm.gateway import LLMGateway
from app.llm.types import LLMTask
from app.repositories.system_design_repository import (
    SystemDesignPromptRepository,
    SystemDesignAttemptRepository,
)
from app.models.system_design_attempt import SystemDesignAttempt
from app.models.question import QuestionDifficulty
from app.schemas.system_design import (
    SystemDesignPromptCreate,
    SystemDesignPromptFilter,
    SystemDesignPromptResponse,
    GeneratePromptRequest,
    SubmitAttemptRequest,
    SystemDesignAttemptResponse,
    CategoryScore,
    SystemDesignAnalytics,
    RecentAttemptItem,
)
from app.schemas.analytics import ScoreTrendPoint

CATEGORIES = [
    "Requirements Clarification",
    "High-Level Architecture",
    "Data Modeling & Storage",
    "Scalability & Performance",
    "Reliability & Fault Tolerance",
    "Trade-off Reasoning & Communication",
]


class SystemDesignService:
    def __init__(self, db: Session):
        self.db = db
        self.prompt_repo = SystemDesignPromptRepository(db)
        self.attempt_repo = SystemDesignAttemptRepository(db)
        # Which provider and model answer these tasks is resolved per call from
        # user configuration -- this service names the task and nothing else.
        self.gateway = LLMGateway(db)

    # ---- Prompts -----------------------------------------------------

    def list_prompts(self, skip: int = 0, limit: int = 100, filter_params: Optional[SystemDesignPromptFilter] = None) -> dict:
        prompts = self.prompt_repo.get_all(skip=skip, limit=limit, filter_params=filter_params)
        total = self.prompt_repo.count(filter_params=filter_params)
        return {
            "items": [SystemDesignPromptResponse.model_validate(p) for p in prompts],
            "total": total,
            "skip": skip,
            "limit": limit,
        }

    def get_prompt(self, prompt_id: int) -> SystemDesignPromptResponse:
        p = self.prompt_repo.get_by_id(prompt_id)
        if not p:
            raise ResourceNotFoundException("SystemDesignPrompt", prompt_id)
        return SystemDesignPromptResponse.model_validate(p)

    def generate_prompt(self, req: GeneratePromptRequest) -> SystemDesignPromptResponse:
        """
        Never silently substitutes an existing bank prompt when no API key is
        configured -- the user explicitly wants a clear error here instead of
        a fake "AI-generated" result, so they always know whether they got a
        real generation or not.
        """
        if not self.gateway.is_available(LLMTask.SYSTEM_DESIGN_PROMPT_GEN):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="No AI provider is set up yet. Add one in Settings -> AI Providers "
                       "-- a local model is free and keeps your answers on this machine. "
                       "Meanwhile, the built-in prompt bank works without any AI.",
            )

        prompt = self._build_generation_prompt(req.topic, req.difficulty)
        parsed, error_msg = self.gateway.run(LLMTask.SYSTEM_DESIGN_PROMPT_GEN, prompt).as_tuple()

        if not parsed or error_msg:
            logger.warning(f"System design prompt generation failed: {error_msg}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"AI prompt generation failed: {error_msg}",
            )

        title = str(parsed.get("title") or "Untitled System Design Prompt")
        prompt_text = str(parsed.get("prompt_text") or "")
        category = str(parsed.get("category") or (req.topic or "General"))
        difficulty_raw = str(parsed.get("difficulty") or (req.difficulty.value if req.difficulty else "medium")).lower()
        try:
            difficulty = QuestionDifficulty(difficulty_raw)
        except ValueError:
            difficulty = QuestionDifficulty.MEDIUM

        if not prompt_text:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="AI prompt generation returned an empty prompt_text.",
            )

        if req.save_to_bank:
            created = self.prompt_repo.create(SystemDesignPromptCreate(
                title=title,
                prompt_text=prompt_text,
                category=category,
                difficulty=difficulty,
                is_ai_generated=True,
                source_topic=req.topic,
            ))
            return SystemDesignPromptResponse.model_validate(created)

        # Not persisted -- return an ephemeral response shaped the same way,
        # with id=0 as a clear "not a real bank row" sentinel.
        from datetime import datetime, UTC
        return SystemDesignPromptResponse(
            id=0,
            title=title,
            prompt_text=prompt_text,
            category=category,
            difficulty=difficulty,
            is_ai_generated=True,
            created_at=datetime.now(UTC).replace(tzinfo=None),
        )

    def _build_generation_prompt(self, topic: Optional[str], difficulty: Optional[QuestionDifficulty]) -> str:
        topic_clause = f' for the topic "{topic}"' if topic else ""
        difficulty_clause = f' at "{difficulty.value}" difficulty' if difficulty else ""
        return f"""Generate one realistic system design interview question{topic_clause}{difficulty_clause}.

The prompt_text should frame a realistic scenario with functional and
non-functional requirements context, 3-6 sentences, similar to how a real
interviewer would open a system design interview (e.g. "Design a URL
shortener that handles millions of requests per day...").

Respond ONLY in this exact JSON format, no other text:
{{
  "title": "<short title, e.g. 'Design a URL Shortener'>",
  "prompt_text": "<the full scenario/requirements text>",
  "category": "<e.g. 'Distributed Systems', 'Caching', 'Messaging'>",
  "difficulty": "easy|medium|hard"
}}
"""

    # ---- Attempts ------------------------------------------------------

    def submit_attempt(self, req: SubmitAttemptRequest) -> SystemDesignAttemptResponse:
        prompt = self.prompt_repo.get_by_id(req.prompt_id)
        if not prompt:
            raise ResourceNotFoundException("SystemDesignPrompt", req.prompt_id)

        attempt = SystemDesignAttempt(
            prompt_id=req.prompt_id,
            answer_text=req.answer_text,
            target_role=req.target_role,
            time_spent_seconds=req.time_spent_seconds,
        )

        if not self.gateway.is_available(LLMTask.SYSTEM_DESIGN_GRADING):
            attempt.grading_status = "unavailable"
            attempt.grading_error = (
                "No AI provider is set up, so this answer was saved but not graded. "
                "Add one in Settings -> AI Providers to get feedback."
            )
            attempt.overall_score = None
            attempt.category_scores = []
            attempt.strengths = []
            attempt.improvements = []
            attempt.summary = None
            saved = self.attempt_repo.create(attempt)
            return SystemDesignAttemptResponse.model_validate(saved)

        grading_prompt = self._build_grading_prompt(prompt.prompt_text, req.answer_text, req.target_role)
        parsed, error_msg = self.gateway.run(LLMTask.SYSTEM_DESIGN_GRADING, grading_prompt).as_tuple()

        if not parsed or error_msg:
            logger.warning(f"System design grading failed: {error_msg}")
            attempt.grading_status = "error"
            attempt.grading_error = error_msg or "Unknown grading error"
            attempt.overall_score = None
            attempt.category_scores = []
            attempt.strengths = []
            attempt.improvements = []
            attempt.summary = None
            saved = self.attempt_repo.create(attempt)
            return SystemDesignAttemptResponse.model_validate(saved)

        category_scores = self._parse_category_scores(parsed.get("category_scores"))
        overall_score = parsed.get("overall_score")
        try:
            overall_score = max(0.0, min(100.0, float(overall_score)))
        except (TypeError, ValueError):
            overall_score = None

        attempt.grading_status = "graded"
        attempt.grading_error = None
        attempt.overall_score = overall_score
        attempt.category_scores = [c.model_dump() for c in category_scores]
        attempt.strengths = [str(s) for s in (parsed.get("strengths") or [])]
        attempt.improvements = [str(s) for s in (parsed.get("improvements") or [])]
        attempt.summary = str(parsed.get("summary") or "")

        saved = self.attempt_repo.create(attempt)
        return SystemDesignAttemptResponse.model_validate(saved)

    def _parse_category_scores(self, raw) -> List[CategoryScore]:
        if not isinstance(raw, list):
            return []
        out = []
        for item in raw:
            if not isinstance(item, dict):
                continue
            try:
                max_score = float(item.get("max_score", 10.0))
                score = max(0.0, min(max_score, float(item.get("score", 0.0))))
                out.append(CategoryScore(
                    category=str(item.get("category", "Unknown")),
                    score=score,
                    max_score=max_score,
                    feedback=str(item.get("feedback", "")),
                ))
            except (TypeError, ValueError):
                continue
        return out

    def _build_grading_prompt(self, prompt_text: str, answer_text: str, target_role: Optional[str]) -> str:
        if target_role:
            role_calibration = (
                f'You are grading this for the specific role: "{target_role}". Calibrate your '
                f"expectations and feedback to what a strong candidate for *this specific role* "
                f"would be expected to demonstrate (e.g. domain-specific trade-offs, relevant "
                f"technologies, seniority-appropriate depth). Still use the same six categories "
                f"below, but let target-role expectations raise or lower the bar within each "
                f"category and shape the specific feedback text."
            )
        else:
            role_calibration = (
                "Grade against general system design interview expectations for a "
                "mid-to-senior generalist software engineer."
            )

        categories_block = "\n".join(f'    {{"category": "{c}", "score": <0-10>, "max_score": 10, "feedback": "<specific>"}},' for c in CATEGORIES)

        return f"""You are a Staff/Principal Software Engineer conducting a system design interview.
{role_calibration}

INTERVIEW PROMPT GIVEN TO THE CANDIDATE:
{prompt_text}

CANDIDATE'S WRITTEN ANSWER:
{answer_text}

Grade honestly and specifically -- reference concrete details from their answer,
do not give generic praise, and call out real gaps a hiring interviewer would flag.
If the answer is very short, superficial, or off-topic, score it low and say so
directly rather than being diplomatically vague.

Respond ONLY in this exact JSON format, no other text:
{{
  "category_scores": [
{categories_block}
  ],
  "overall_score": <0-100, your own weighted/averaged result of the category scores above, scaled to 0-100>,
  "strengths": ["<specific strength>", ...],
  "improvements": ["<specific improvement>", ...],
  "summary": "<2-4 sentence honest overall assessment>"
}}
"""

    def get_attempt(self, attempt_id: int) -> SystemDesignAttemptResponse:
        a = self.attempt_repo.get_by_id(attempt_id)
        if not a:
            raise ResourceNotFoundException("SystemDesignAttempt", attempt_id)
        return SystemDesignAttemptResponse.model_validate(a)

    def list_attempts(self, skip: int = 0, limit: int = 100) -> dict:
        attempts = self.attempt_repo.get_all(skip=skip, limit=limit)
        total = self.attempt_repo.count()
        return {
            "items": [SystemDesignAttemptResponse.model_validate(a) for a in attempts],
            "total": total,
            "skip": skip,
            "limit": limit,
        }

    # ---- Analytics -------------------------------------------------------

    def get_analytics(self) -> SystemDesignAnalytics:
        total_attempts = self.attempt_repo.count()
        graded = self.attempt_repo.get_graded_ordered_by_date()  # oldest-first

        if not graded:
            # No fabricated average/trend/categories -- matches this app's
            # established "None/empty on no data" convention everywhere else.
            return SystemDesignAnalytics(
                total_attempts=total_attempts,
                graded_count=0,
                average_score=None,
                score_trend=[],
                category_averages=[],
                recent_attempts=[],
            )

        scores = [a.overall_score for a in graded if a.overall_score is not None]
        average_score = round(sum(scores) / len(scores), 1) if scores else None

        # Rolling 5-attempt average, chronological -- identical windowing to
        # AnalyticsService.get_score_trends() so the frontend chart component
        # can be reused verbatim.
        trend: List[ScoreTrendPoint] = []
        running_scores: List[float] = []
        for a in graded:
            if a.overall_score is None:
                continue
            running_scores.append(a.overall_score)
            rolling = sum(running_scores[-5:]) / len(running_scores[-5:])
            trend.append(ScoreTrendPoint(
                date=a.created_at.strftime("%b %d"),
                score=a.overall_score,
                rolling_avg=round(rolling, 1),
                exam_title=a.prompt.title if a.prompt else "System Design Attempt",
            ))

        # Average each rubric category across every graded attempt that
        # reported it -- category sets are fixed (the 6 CATEGORIES above) but
        # this reads whatever's actually stored, not the constant, so it
        # stays correct even if the rubric changes later.
        category_sums: dict = {}
        category_counts: dict = {}
        category_max: dict = {}
        for a in graded:
            for c in (a.category_scores or []):
                name = c.get("category")
                if not name:
                    continue
                category_sums[name] = category_sums.get(name, 0.0) + float(c.get("score", 0))
                category_counts[name] = category_counts.get(name, 0) + 1
                category_max[name] = float(c.get("max_score", 10.0))

        category_averages = [
            CategoryScore(
                category=name,
                score=round(category_sums[name] / category_counts[name], 1),
                max_score=category_max[name],
                feedback=f"Averaged across {category_counts[name]} graded attempt{'s' if category_counts[name] != 1 else ''}.",
            )
            for name in category_sums
        ]

        recent = list(reversed(graded))[:5]
        recent_attempts = [
            RecentAttemptItem(
                id=a.id,
                prompt_title=a.prompt.title if a.prompt else "Untitled Prompt",
                overall_score=a.overall_score,
                created_at=a.created_at,
            )
            for a in recent
        ]

        return SystemDesignAnalytics(
            total_attempts=total_attempts,
            graded_count=len(graded),
            average_score=average_score,
            score_trend=trend,
            category_averages=category_averages,
            recent_attempts=recent_attempts,
        )
