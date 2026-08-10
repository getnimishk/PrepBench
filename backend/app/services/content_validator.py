import os
import json
import math
import re
from pathlib import Path
from typing import List, Optional, Tuple
import httpx
from app.core.config import DATA_DIR, settings
from app.core.logging_config import logger
from app.schemas.question_validation import ContentJudgment, ValidationErrorItem

DEFAULT_CACHE_PATH = DATA_DIR / "scrum_guide_index.json"
EMBEDDING_MODEL = "models/gemini-embedding-001"
JUDGE_MODEL = "models/gemini-2.0-flash"
TOP_K_CHUNKS = 4

# Shared client, lazily created. ContentValidator is instantiated per-request
# (see QuestionValidator.__init__), so each instance must NOT own its own
# httpx.Client — that would leak sockets/connections with no owner to close
# them. A single process-wide client with its own connection pool is reused
# across every ContentValidator instance instead.
_shared_client: Optional[httpx.Client] = None


def _get_client() -> httpx.Client:
    global _shared_client
    if _shared_client is None or _shared_client.is_closed:
        _shared_client = httpx.Client(timeout=15.0)
    return _shared_client


class ScrumGuideRetriever:
    def __init__(self, cache_path: Path = DEFAULT_CACHE_PATH):
        if not cache_path.exists():
            raise FileNotFoundError(f"Scrum Guide vector index not found at {cache_path}.")
        self._chunks = json.loads(cache_path.read_text(encoding="utf-8"))

    @staticmethod
    def _cosine_similarity(a: List[float], b: List[float]) -> float:
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(y * y for y in b))
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    def top_k(self, query_embedding: List[float], k: int = TOP_K_CHUNKS) -> List[dict]:
        if not query_embedding:
            return self._chunks[:k]
        scored = [
            (self._cosine_similarity(query_embedding, c["embedding"]), c)
            for c in self._chunks
        ]
        scored.sort(key=lambda pair: pair[0], reverse=True)
        return [c for _, c in scored[:k]]

    def top_k_keyword(self, query_text: str, k: int = TOP_K_CHUNKS) -> List[dict]:
        words = set(re.findall(r'\w+', query_text.lower()))
        scored = []
        for c in self._chunks:
            chunk_words = set(re.findall(r'\w+', c["text"].lower()))
            overlap = len(words.intersection(chunk_words))
            scored.append((overlap, c))
        scored.sort(key=lambda pair: pair[0], reverse=True)
        return [c for _, c in scored[:k]]


class ContentValidator:
    def __init__(self, api_key: Optional[str] = None, cache_path: Path = DEFAULT_CACHE_PATH):
        self.api_key = api_key or settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
        self.model_name = JUDGE_MODEL
        self._client = _get_client()

        # This is the part that was silently dropped in the previous revision:
        # without actually constructing the retriever, is_available() could
        # never return True and the entire content-validation feature was
        # permanently dead regardless of API key / cache file state.
        self.retriever: Optional[ScrumGuideRetriever] = None
        self._available = False
        try:
            self.retriever = ScrumGuideRetriever(cache_path=cache_path)
            self._available = True
        except Exception as e:
            logger.warning(f"ContentValidator initialization skipped: {str(e)}")

    def is_available(self) -> bool:
        return self._available

    def _post_json(self, url: str, payload: dict, timeout: float) -> Tuple[Optional[dict], Optional[str]]:
        """Low-level POST + status/parse handling shared by every Gemini call."""
        try:
            res = self._client.post(url, json=payload, timeout=timeout)
        except Exception as e:
            return None, f"Network/HTTP Exception: {str(e)}"
        if res.status_code != 200:
            return None, f"HTTP {res.status_code}: {res.text[:150]}"
        try:
            return res.json(), None
        except Exception as e:
            return None, f"Response was not valid JSON: {str(e)}"

    def _call_gemini(self, model: str, prompt: str, timeout: float = 15.0) -> Tuple[Optional[dict], Optional[str]]:
        if not self.api_key:
            return None, "Gemini API key not configured"
        url = f"https://generativelanguage.googleapis.com/v1beta/{model}:generateContent?key={self.api_key}"
        payload = {"contents": [{"parts": [{"text": prompt}]}]}

        data, error_msg = self._post_json(url, payload, timeout)
        if error_msg:
            return None, error_msg

        if "candidates" not in data or not data["candidates"]:
            return None, "LLM response contained no candidate parts"

        raw = data["candidates"][0]["content"]["parts"][0]["text"].strip()
        raw = raw.replace("```json", "").replace("```", "").strip()
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as err:
            return None, f"LLM returned malformed JSON: {str(err)}"

        if not isinstance(parsed, dict):
            return None, f"LLM returned non-dictionary JSON structure ({type(parsed).__name__})"

        return parsed, None

    def _embed_query(self, text: str) -> List[float]:
        if not self.api_key:
            return []
        url = f"https://generativelanguage.googleapis.com/v1beta/{EMBEDDING_MODEL}:embedContent?key={self.api_key}"
        payload = {
            "model": EMBEDDING_MODEL,
            "content": {"parts": [{"text": text}]}
        }
        data, error_msg = self._post_json(url, payload, timeout=10.0)
        if error_msg:
            logger.warning(f"Embedding query failed: {error_msg}")
            return []
        try:
            return data["embedding"]["values"]
        except (KeyError, TypeError):
            logger.warning("Embedding response missing expected 'embedding.values' field")
            return []

    def _build_blind_prompt(self, question_text: str, options: List[str], grounding_chunks: List[dict]) -> str:
        options_block = "\n".join(f"{chr(65 + i)}. {opt}" for i, opt in enumerate(options))
        context_block = "\n\n---\n\n".join(c["text"] for c in grounding_chunks)

        return f"""You are an expert Scrum.org Professional Scrum Master (PSM I) assessor.

Below are relevant excerpts from the Scrum Guide 2020 (for grounding — base your judgment on these, not on general assumptions):

{context_block}

---

Judge the following exam question independently. Do not assume any particular answer is correct going in — reason from the Scrum Guide excerpts above.

QUESTION:
{question_text}

OPTIONS:
{options_block}

Respond ONLY in this exact JSON format, no other text:
{{
  "correct_options": ["<letter>", ...],
  "reasoning": "<2-4 sentences, grounded in the excerpts above>"
}}

If the question or options are ambiguous, or the excerpts don't clearly settle it, still give your best judgment but note the ambiguity in your reasoning.
"""

    def judge_question(
        self,
        question_text: str,
        options: List[str],
        stated_correct_options: List[str],
    ) -> ContentJudgment:
        stated_sorted = sorted(o.upper() for o in stated_correct_options)

        if not self.is_available():
            return ContentJudgment(
                judged_correct_options=[],
                stated_correct_options=stated_sorted,
                agrees_with_stated_key=False,
                judge_reasoning="Content validator unavailable (missing Scrum Guide vector index).",
                grounding_chunk_ids=[],
                error_category="content",
                human_review_required=True,
                validation_status="skipped",
                validation_skipped=True
            )

        try:
            query_embedding = self._embed_query(question_text)
            if query_embedding:
                grounding_chunks = self.retriever.top_k(query_embedding, k=TOP_K_CHUNKS) if self.retriever else []
            else:
                grounding_chunks = self.retriever.top_k_keyword(question_text, k=TOP_K_CHUNKS) if self.retriever else []

            if not self.api_key:
                return ContentJudgment(
                    judged_correct_options=[],
                    stated_correct_options=stated_sorted,
                    agrees_with_stated_key=False,
                    judge_reasoning=f"Grounding passages retrieved ({len(grounding_chunks)} chunks); LLM evaluation skipped (missing GEMINI_API_KEY).",
                    grounding_chunk_ids=[c["id"] for c in grounding_chunks],
                    error_category="content",
                    human_review_required=True,
                    validation_status="skipped",
                    validation_skipped=True
                )

            prompt = self._build_blind_prompt(question_text, options, grounding_chunks)
            parsed, error_msg = self._call_gemini(model=self.model_name, prompt=prompt, timeout=15.0)

            if not parsed or error_msg:
                return ContentJudgment(
                    judged_correct_options=[],
                    stated_correct_options=stated_sorted,
                    agrees_with_stated_key=False,
                    judge_reasoning=f"Grounding passages retrieved ({len(grounding_chunks)} chunks); LLM judge failed: {error_msg}",
                    grounding_chunk_ids=[c["id"] for c in grounding_chunks],
                    error_category="content",
                    human_review_required=True,
                    validation_status="unverified",
                    validation_skipped=True
                )

            judged_options = sorted(o.strip().upper() for o in parsed.get("correct_options", []))
            reasoning = parsed.get("reasoning", "")

            agrees = (judged_options == stated_sorted)

            return ContentJudgment(
                judged_correct_options=judged_options,
                stated_correct_options=stated_sorted,
                agrees_with_stated_key=agrees,
                judge_reasoning=reasoning,
                grounding_chunk_ids=[c["id"] for c in grounding_chunks],
                error_category="content",
                human_review_required=not agrees,
                validation_status="verified",
                validation_skipped=False
            )
        except Exception as e:
            logger.warning(f"ContentValidator judgment skipped/error: {str(e)}")
            return ContentJudgment(
                judged_correct_options=[],
                stated_correct_options=stated_sorted,
                agrees_with_stated_key=False,
                judge_reasoning=f"LLM judge evaluation exception: {str(e)}",
                grounding_chunk_ids=[],
                error_category="content",
                human_review_required=True,
                validation_status="unverified",
                validation_skipped=True
            )

    def research_question(
        self,
        question_id: int,
        question_text: str,
        options: List[dict],
    ) -> dict:
        correct_indices = [i for i, opt in enumerate(options) if opt.get("is_correct")]
        correct_letters = [chr(65 + i) for i in correct_indices]

        grounding_chunks = []
        if self.retriever:
            query_embedding = self._embed_query(question_text)
            if query_embedding:
                grounding_chunks = self.retriever.top_k(query_embedding, k=TOP_K_CHUNKS)
            else:
                grounding_chunks = self.retriever.top_k_keyword(question_text, k=TOP_K_CHUNKS)

        citation_text = "\n\n".join([f"• [Scrum Guide Chunk #{c['id']}] {c['text'][:250]}..." for c in grounding_chunks]) if grounding_chunks else "Scrum Guide 2020 - General Framework Principles"

        if self.api_key:
            options_block = "\n".join([f"{chr(65+i)}. {opt['option_text']} {'(Stated Correct)' if opt.get('is_correct') else ''}" for i, opt in enumerate(options)])
            context_block = "\n\n".join([c["text"] for c in grounding_chunks])

            prompt = f"""You are a Senior Professional Scrum Trainer (PST) and Scrum.org assessment author.
Perform a thorough technical research and quality audit on the following PSM I practice question using the 2020 Scrum Guide.

SCRUM GUIDE EXCERPTS FOR GROUNDING:
{context_block}

QUESTION STEM:
{question_text}

OPTIONS:
{options_block}

Respond ONLY in valid JSON format matching this schema:
{{
  "scrum_guide_citation": "<Primary Scrum Guide 2020 section title and excerpt>",
  "accuracy_status": "<compliant OR needs_review>",
  "accuracy_explanation": "<Detailed 2-3 sentence technical justification based on Scrum Guide 2020>",
  "distractor_analyses": [
    {{
      "option_letter": "A",
      "option_text": "<original_text>",
      "is_correct": false,
      "critique": "<Why option A is an anti-pattern or correct according to Scrum Guide>",
      "suggested_option_text": "<Clearer, more realistic, or improved wording for option A, or original text if already good>"
    }}
  ],
  "suggested_explanation": "<Comprehensive explanation suitable for student review>",
  "suggested_stem": null
}}
"""
            parsed, error_msg = self._call_gemini(model=self.model_name, prompt=prompt, timeout=15.0)
            if parsed:
                parsed["question_id"] = question_id
                return parsed
            else:
                logger.warning(f"LLM research call failed: {error_msg}")

        distractors = []
        for i, opt in enumerate(options):
            let = chr(65 + i)
            is_corr = bool(opt.get("is_correct"))
            critique = "Aligns directly with empirical Scrum principles." if is_corr else "Represents a common workplace anti-pattern or non-Scrum role assumption."
            distractors.append({
                "option_letter": let,
                "option_text": opt["option_text"],
                "is_correct": is_corr,
                "critique": critique,
                "suggested_option_text": opt["option_text"]
            })

        return {
            "question_id": question_id,
            "scrum_guide_citation": citation_text,
            "accuracy_status": "unverified",
            "accuracy_explanation": f"Grounded in 2020 Scrum Guide excerpts ({len(grounding_chunks)} passages); LLM research unverified due to missing API key or network error.",
            "distractor_analyses": distractors,
            "suggested_explanation": f"Scrum process control relies on empirical adaptation. The correct answer is {', '.join(correct_letters)}.",
            "suggested_stem": None
        }

    def judgment_to_validation_issue(self, judgment: ContentJudgment) -> Optional[ValidationErrorItem]:
        if judgment.validation_skipped:
            return ValidationErrorItem(
                severity="warning",
                field="is_correct",
                error_category="content",
                message=f"Content check skipped/unverified: {judgment.judge_reasoning}"
            )
        if not judgment.agrees_with_stated_key:
            return ValidationErrorItem(
                severity="error",
                field="is_correct",
                error_category="content",
                message=(
                    f"Content check disagrees with stated answer key. "
                    f"Stated: {judgment.stated_correct_options}, "
                    f"LLM judge picked: {judgment.judged_correct_options}. "
                    f"Reasoning: {judgment.judge_reasoning}"
                ),
            )
        return None
