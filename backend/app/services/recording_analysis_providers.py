"""
Pluggable analysis-provider architecture for practice recordings.

Recording/playback works with zero AI dependency (see api/v1/recordings.py --
upload, list, stream, delete never touch any provider). Analysis is a
separate, user-triggered step.

This registry now sits *above* the vendor-agnostic LLM layer rather than
beside it. The built-in provider no longer speaks to any particular vendor --
it builds the recording-specific prompt and hands the work to the gateway,
which resolves whichever provider the user configured. The registry remains
because a future provider may need a fundamentally different pipeline rather
than a different vendor: transcribe-then-grade for text-only local models is
the obvious one, and it is not expressible as a swapped base URL.
"""
import os
from typing import Dict, Optional, Protocol, Tuple, TypedDict

from sqlalchemy.orm import Session

from app.llm.gateway import LLMGateway
from app.llm.types import LLMTask

# The built-in provider's registry name. Deliberately not a vendor name: which
# vendor actually answers is resolved per call from user configuration, so
# labelling this "gemini" would have been inaccurate the moment a second
# provider became configurable.
DEFAULT_PROVIDER_NAME = "default"

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


class GatewayAudioProvider:
    """
    The built-in provider: recording-specific prompt, vendor-agnostic delivery.

    Availability now means "some configured provider can do audio analysis",
    not "a particular API key exists" -- so a user running a text-only local
    model correctly sees this as unavailable rather than getting an obscure
    failure partway through.
    """

    name = DEFAULT_PROVIDER_NAME

    def __init__(self, db: Optional[Session] = None):
        self.gateway = LLMGateway(db)

    def is_available(self) -> bool:
        return self.gateway.is_available(LLMTask.RECORDING_ANALYSIS)

    def analyze(
        self, audio_bytes: bytes, mime_type: str, question_context: Optional[QuestionContext] = None
    ) -> Tuple[Optional[dict], Optional[str]]:
        prompt = self._build_prompt(question_context)
        return self.gateway.run(
            LLMTask.RECORDING_ANALYSIS,
            prompt,
            media_bytes=audio_bytes,
            media_mime=mime_type,
        ).as_tuple()

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
        register_provider(GatewayAudioProvider())


def register_provider(provider: RecordingAnalysisProvider) -> None:
    _PROVIDERS[provider.name] = provider


def get_analysis_provider(
    name: Optional[str] = None, db: Optional[Session] = None
) -> RecordingAnalysisProvider:
    _ensure_registered()

    if name:
        if name not in _PROVIDERS:
            raise ValueError(f"Unknown analysis provider: {name!r}. Available: {list(_PROVIDERS.keys())}")
        provider = _PROVIDERS[name]
    else:
        default_name = os.environ.get("RECORDING_ANALYSIS_PROVIDER", DEFAULT_PROVIDER_NAME)
        if default_name not in _PROVIDERS:
            default_name = next(iter(_PROVIDERS))
        provider = _PROVIDERS[default_name]

    # The registry is process-global and built at import time, so its built-in
    # entry holds a gateway with no database session and would only ever see
    # environment configuration. Rebind it to the caller's session so stored
    # provider settings actually apply. Externally registered providers are
    # returned untouched -- they own their own configuration.
    if isinstance(provider, GatewayAudioProvider) and db is not None:
        return GatewayAudioProvider(db)
    return provider


def list_providers(db: Optional[Session] = None) -> list:
    _ensure_registered()
    # Same rebinding as get_analysis_provider: without the caller's session the
    # built-in provider would report availability based only on environment
    # configuration, so a provider the user configured in the app would show as
    # unavailable in the very UI they configured it from.
    providers = [
        GatewayAudioProvider(db) if isinstance(p, GatewayAudioProvider) and db is not None else p
        for p in _PROVIDERS.values()
    ]
    return [{"name": p.name, "is_available": p.is_available()} for p in providers]
