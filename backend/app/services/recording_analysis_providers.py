"""
Pluggable analysis-provider architecture for practice recordings.

Recording/playback works with zero AI dependency (see api/v1/recordings.py --
upload, list, stream, delete never touch any provider). Analysis is a
separate, user-triggered step, and which AI handles it is not hardcoded to
one vendor: any provider need only implement RecordingAnalysisProvider and
register itself here. Only GeminiAudioProvider ships working code today --
the seam is what's being built, not multiple working backends.
"""
import os
from typing import Dict, Optional, Protocol, Tuple, TypedDict

import httpx

from app.core.config import settings
from app.services import llm_client

GRADING_MODEL = "models/gemini-flash-latest"

# Delivery ("how you said it") -- always graded, question or no question.
COMMUNICATION_CATEGORIES = [
    "Clarity",
    "Pacing",
    "Structure & Organization",
    "Filler-Word Usage",
    "Confidence",
    "Conciseness",
]

# Content ("what you said") -- only graded when a specific interview question
# is attached, since grading content requires knowing what was actually asked.
# Category set is tailored per round type, mirroring how System Design
# Practice's typed rubric is domain-specific rather than generic.
CONTENT_CATEGORIES_BY_ROUND: Dict[str, list] = {
    "hr_screening": ["Relevance to Question", "Professionalism", "Motivation & Fit", "Conciseness"],
    "hiring_manager": ["STAR Structure", "Leadership/Ownership Signal", "Specificity of Example", "Outcome/Impact"],
    "behavioral": ["STAR Structure", "Specificity of Example", "Self-Awareness/Reflection", "Outcome/Impact"],
    "system_design": ["Requirements Clarification", "Architecture Soundness", "Trade-off Reasoning", "Scalability Awareness"],
}


class QuestionContext(TypedDict):
    round_type: str
    question_text: str


class RecordingAnalysisProvider(Protocol):
    name: str

    def is_available(self) -> bool:
        ...

    def analyze(
        self, audio_bytes: bytes, mime_type: str, question_context: Optional[QuestionContext] = None
    ) -> Tuple[Optional[dict], Optional[str]]:
        """Returns (parsed_result, error_msg). parsed_result, when present, has
        keys: transcript (str), communication_scores (list), filler_word_count
        (int|None), summary (str), content_scores (list, empty if no
        question_context was given), content_summary (str|None). Never raises."""
        ...


class GeminiAudioProvider:
    name = "gemini"

    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
        self._client = llm_client.get_shared_client()

    def is_available(self) -> bool:
        return bool(self.api_key)

    def analyze(
        self, audio_bytes: bytes, mime_type: str, question_context: Optional[QuestionContext] = None
    ) -> Tuple[Optional[dict], Optional[str]]:
        if not self.api_key:
            return None, "Gemini API key not configured"

        prompt = self._build_prompt(question_context)
        return llm_client.call_gemini_multimodal(
            self._client, self.api_key, GRADING_MODEL, prompt, audio_bytes, mime_type, timeout=45.0
        )

    def _build_prompt(self, question_context: Optional[QuestionContext]) -> str:
        communication_block = "\n".join(
            f'    {{"category": "{c}", "score": <0-10>, "max_score": 10, "feedback": "<specific>"}},'
            for c in COMMUNICATION_CATEGORIES
        )

        if question_context:
            round_type = question_context["round_type"]
            question_text = question_context["question_text"]
            content_categories = CONTENT_CATEGORIES_BY_ROUND.get(round_type, CONTENT_CATEGORIES_BY_ROUND["behavioral"])
            content_block = "\n".join(
                f'    {{"category": "{c}", "score": <0-10>, "max_score": 10, "feedback": "<specific>"}},'
                for c in content_categories
            )
            content_instructions = f"""
This recording is a spoken answer to the following interview question (round: {round_type}):

INTERVIEW QUESTION:
{question_text}

In addition to delivery, also grade the CONTENT of the answer -- whether it
actually addresses the question well, using the categories below. Grade
honestly: if the answer doesn't actually address the question, or is thin/
generic, score it low and say so directly, don't be diplomatically vague.
"""
            content_json_field = f""",
  "content_scores": [
{content_block}
  ],
  "content_summary": "<2-4 sentence honest assessment of the answer's content/substance>\""""
        else:
            content_instructions = ""
            content_json_field = ""

        return f"""You are an expert interview coach. Listen to this recording of
someone practicing a spoken interview answer, then transcribe it and grade
their DELIVERY -- clarity, pacing, structure, filler-word usage, confidence,
and conciseness (HOW they communicated, not what they said).
{content_instructions}
Grade honestly and specifically -- reference concrete moments in the
recording, do not give generic praise. If the delivery is rambling, unclear,
or full of filler words, say so directly.

Respond ONLY in this exact JSON format, no other text:
{{
  "transcript": "<full verbatim transcript of what was said>",
  "communication_scores": [
{communication_block}
  ],
  "filler_word_count": <integer count of "um", "uh", "like", "you know", etc.>,
  "summary": "<2-4 sentence honest overall assessment of the delivery>"{content_json_field}
}}
"""


_PROVIDERS: Dict[str, RecordingAnalysisProvider] = {}


def _ensure_registered():
    if not _PROVIDERS:
        register_provider(GeminiAudioProvider())


def register_provider(provider: RecordingAnalysisProvider) -> None:
    _PROVIDERS[provider.name] = provider


def get_analysis_provider(name: Optional[str] = None) -> RecordingAnalysisProvider:
    _ensure_registered()
    if name:
        if name not in _PROVIDERS:
            raise ValueError(f"Unknown analysis provider: {name!r}. Available: {list(_PROVIDERS.keys())}")
        return _PROVIDERS[name]

    default_name = os.environ.get("RECORDING_ANALYSIS_PROVIDER", "gemini")
    if default_name not in _PROVIDERS:
        default_name = next(iter(_PROVIDERS))
    return _PROVIDERS[default_name]


def list_providers() -> list:
    _ensure_registered()
    return [{"name": p.name, "is_available": p.is_available()} for p in _PROVIDERS.values()]
