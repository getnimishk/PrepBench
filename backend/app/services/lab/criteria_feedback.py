# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Acceptance criteria AI feedback service (P1-6).

Provides qualitative advice and constructive points on written acceptance criteria
for Lakehouse Lab decisions. Never stores attempts or grades correctness.
"""
from sqlalchemy.orm import Session

from app.core.logging_config import logger
from app.llm.gateway import LLMGateway
from app.llm.types import LLMTask
from app.schemas.lab import CriteriaFeedbackResponse


def build_criteria_feedback_prompt(criteria: str) -> str:
    return f"""You are an experienced data engineering lead reviewing a team member's proposed acceptance criteria for a Lakehouse data platform pipeline or operation.

ACCEPTANCE CRITERIA SUBMITTED BY LEARNER:
\"\"\"{criteria.strip()}\"\"\"

Review the acceptance criteria for clarity, testability, precision, and operational completeness.
Consider:
1. Are conditions, actions, and expected outcomes specific and measurable (e.g. row counts, schemas, thresholds)?
2. Are edge cases or data quality issues addressed (e.g. unexpected schema changes, nulls, duplicates)?
3. Is failure handling, rollback, or alerting mentioned where appropriate?

Provide 2 to 4 concise, constructive feedback points as actionable advice.
Do NOT assign a score, percentage, grade, or pass/fail verdict.
Your response MUST be valid JSON matching this schema:
{{
  "points": [
    "Feedback point 1...",
    "Feedback point 2..."
  ]
}}
"""


def get_criteria_feedback(db: Session, criteria: str) -> CriteriaFeedbackResponse:
    """
    Get AI advice on written acceptance criteria. Never raises 500; never invents feedback.
    Returns status 'feedback' with points on success, or status 'not_graded' with a reason.
    Stores nothing.
    """
    cleaned = criteria.strip()
    if not cleaned:
        return CriteriaFeedbackResponse(
            status="not_graded",
            points=[],
            reason="Acceptance criteria text is required.",
        )

    gateway = LLMGateway(db)
    conn, model, reason = gateway.resolve(LLMTask.ACCEPTANCE_CRITERIA_FEEDBACK)
    if conn is None or model is None:
        return CriteriaFeedbackResponse(
            status="not_graded",
            points=[],
            reason=reason or "No AI provider is configured for acceptance criteria feedback.",
        )

    prompt = build_criteria_feedback_prompt(cleaned)
    try:
        result = gateway.run(LLMTask.ACCEPTANCE_CRITERIA_FEEDBACK, prompt)
    except Exception as exc:
        logger.warning(f"Criteria feedback gateway execution error: {exc}")
        return CriteriaFeedbackResponse(
            status="not_graded",
            points=[],
            reason=f"AI provider execution error: {exc}",
        )

    if result.status == "unavailable":
        return CriteriaFeedbackResponse(
            status="not_graded",
            points=[],
            reason=result.error or "AI provider is unavailable.",
        )

    parsed, error_msg = result.as_tuple()
    if error_msg or not parsed:
        logger.warning(f"Criteria feedback failed or unparseable: {error_msg}")
        return CriteriaFeedbackResponse(
            status="not_graded",
            points=[],
            reason=error_msg or "AI provider response could not be parsed.",
        )

    raw_points = parsed.get("points")
    if not isinstance(raw_points, list):
        return CriteriaFeedbackResponse(
            status="not_graded",
            points=[],
            reason="AI provider response did not contain a feedback points list.",
        )

    points = [str(p).strip() for p in raw_points if isinstance(p, str) and str(p).strip()]
    if not points:
        return CriteriaFeedbackResponse(
            status="not_graded",
            points=[],
            reason="AI provider did not produce any feedback points.",
        )

    return CriteriaFeedbackResponse(
        status="feedback",
        points=points,
        reason=None,
    )
