# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

import re
import bisect
import difflib
from typing import List, Set, Dict, Optional
from sqlalchemy.orm import Session
from app.models.question import QuestionType
from app.schemas.question import QuestionCreate
from app.schemas.question_validation import (
    ValidationErrorItem, ValidatedQuestionItem, QuestionValidationReport, ContentJudgment
)
from app.services.content_validator import ContentValidator
from app.repositories.question_repository import QuestionRepository

NUMBER_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "1": 1, "2": 2,
    "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8
}

# What to do about an issue, by the field it is on.
#
# Each message already says what is wrong; this says how to fix it. Keyed by field
# rather than written at each of the thirty-odd call sites, so every issue --
# including ones added later -- gets an action, and one issue on the same field
# never tells the learner something contradictory to another.
DEFAULT_ACTIONS: Dict[str, str] = {
    "text": "Rewrite the question text as a complete question, and remove any leftover placeholders or unclosed code blocks.",
    "options": "Give the question at least two distinct, non-blank choices, and remove letter or position labels such as 'A)' or 'all of the above'.",
    "is_correct": "Mark which choice is correct.",
    "question_type": "Set the question type to match how many choices are marked correct: single choice for one, multiple choice for several.",
    "explanation": "Add an explanation of why the answer is right, and make sure it names the same correct option as the answer key.",
    "duplicate": "Remove this row if it is the same question, or reword it if it is a genuinely different one.",
    "difficulty": "Use easy, medium or hard.",
    "row": "Fix the row in your file and validate it again.",
}


class QuestionValidator:
    def __init__(self, db: Optional[Session] = None, enable_content_validator: bool = True):
        self.db = db
        # Pre-fetch existing question texts for exact and fuzzy duplicate detection
        if db:
            self.existing_texts: List[str] = [
                t for t in QuestionRepository(db).all_question_texts() if t
            ]
        else:
            self.existing_texts = []
        self.index_existing(self.existing_texts)
        
        # Instantiate ContentValidator (LLM + RAG Grounding Engine)
        self.content_validator: Optional[ContentValidator] = None
        if enable_content_validator:
            try:
                cv = ContentValidator()
                if cv.is_available():
                    self.content_validator = cv
            except Exception:
                self.content_validator = None

    def index_existing(self, texts: List[str]) -> None:
        """Normalise the bank once, and order it by length.

        The near-duplicate check used to normalise every question in the bank
        again for every row being imported -- ten million regex passes for a
        2,000-row file against a 5,000-question bank, close to a minute. The
        normalised texts do not change during a validation, and the length
        pre-filter below can be answered by a binary search over sorted lengths.
        """
        self.existing_texts = list(texts)
        norms = [self._normalize(t) for t in self.existing_texts]
        self.existing_hashes: Set[str] = {n for n in norms if n}
        # (length, position in the bank, normalised text). Position is kept so the
        # comparisons still run in bank order and the first match is the same one.
        self._by_length = sorted((len(n), position, n) for position, n in enumerate(norms) if n)
        self._lengths = [entry[0] for entry in self._by_length]

    @staticmethod
    def _normalize(text: str) -> str:
        return re.sub(r'\W+', '', text.lower()) if text else ""

    @staticmethod
    def _parse_number_word(word: str) -> Optional[int]:
        return NUMBER_WORDS.get(word.lower())

    def validate_question(
        self,
        q: QuestionCreate,
        index: int,
        seen_batch_hashes: Optional[Dict[str, int]] = None,
        validate_content: bool = False
    ) -> ValidatedQuestionItem:
        issues: List[ValidationErrorItem] = []
        text_clean = q.text.strip() if q.text else ""

        # 1. Question Text Quality & Placeholder Checks
        if not text_clean or len(text_clean) < 10:
            issues.append(ValidationErrorItem(
                severity="error",
                field="text",
                error_category="structural",
                message="Question text is too short or empty (minimum 10 characters required)."
            ))
        else:
            # Check unclosed code block backticks
            triple_backtick_count = text_clean.count("```")
            if triple_backtick_count % 2 != 0:
                issues.append(ValidationErrorItem(
                    severity="warning",
                    field="text",
                    error_category="structural",
                    message="Possible unclosed Markdown code block (```) detected in question text."
                ))

            # Placeholder detection
            placeholder_match = re.search(r'\b(TODO|FIXME|TBD|Lorem Ipsum|\[INSERT\])\b', text_clean, re.IGNORECASE)
            if placeholder_match:
                issues.append(ValidationErrorItem(
                    severity="warning",
                    field="text",
                    error_category="structural",
                    message=f"Placeholder string '{placeholder_match.group(1)}' found in question text."
                ))

        # 2. Option Count & Choice Hygiene
        options = q.options or []
        if len(options) < 2:
            issues.append(ValidationErrorItem(
                severity="error",
                field="options",
                error_category="structural",
                message=f"Question must have at least 2 answer choices (found {len(options)})."
            ))
        elif len(options) > 8:
            issues.append(ValidationErrorItem(
                severity="warning",
                field="options",
                error_category="structural",
                message=f"Question has {len(options)} choices, which is higher than standard certification tests."
            ))

        seen_opts: Set[str] = set()
        for idx, o in enumerate(options):
            opt_text = o.option_text.strip() if o.option_text else ""
            opt_clean = self._normalize(opt_text)
            
            if not opt_clean:
                issues.append(ValidationErrorItem(
                    severity="error",
                    field="options",
                    error_category="structural",
                    message=f"Choice #{idx + 1} has blank or empty option text."
                ))
            elif opt_clean in seen_opts:
                issues.append(ValidationErrorItem(
                    severity="error",
                    field="options",
                    error_category="structural",
                    message=f"Duplicate choice text found: '{opt_text}'."
                ))
            else:
                seen_opts.add(opt_clean)

            # Option prefix leak detection (e.g. "A. Option Text" or "[x] Option Text")
            prefix_match = re.match(r'^([A-H][\)\.]\s*|\[[ xX]\]\s*)', opt_text)
            if prefix_match:
                issues.append(ValidationErrorItem(
                    severity="warning",
                    field="options",
                    error_category="structural",
                    message=f"Choice #{idx + 1} contains redundant label prefix ('{prefix_match.group(1).strip()}')."
                ))

            # Positional choice flaw ("All of the above" placed before the last option)
            if re.search(r'\b(all|none)\s+of\s+the\s+above\b', opt_text, re.IGNORECASE):
                if idx < len(options) - 1:
                    issues.append(ValidationErrorItem(
                        severity="warning",
                        field="options",
                        error_category="structural",
                        message=f"Positional choice ('{opt_text}') at position #{idx + 1} will break if option shuffling is enabled."
                    ))

        # 3. Correct Answer & Prompt Intent Alignment Checks
        correct_count = sum(1 for o in options if o.is_correct)
        
        if correct_count == 0:
            issues.append(ValidationErrorItem(
                severity="error",
                field="is_correct",
                error_category="structural",
                message="No correct answer marked for this question."
            ))
        elif q.question_type in [QuestionType.SINGLE_CHOICE, QuestionType.TRUE_FALSE] and correct_count > 1:
            issues.append(ValidationErrorItem(
                severity="error",
                field="question_type",
                error_category="structural",
                message=f"{q.question_type.value} question cannot have {correct_count} correct answers. Must have exactly 1."
            ))
        elif q.question_type == QuestionType.MULTIPLE_CHOICE and correct_count == 1:
            issues.append(ValidationErrorItem(
                severity="warning",
                field="question_type",
                error_category="structural",
                message="Multiple choice question has only 1 correct answer marked."
            ))

        # Prompt vs Correct Count Intent Alignment
        prompt_count = None
        match_intent = re.search(
            r'(?:choose|select|pick)\s+(\d+|one|two|three|four|five)\s+(?:answers?|options?|choices?)|'
            r'\((?:choose|select|pick)\s+(\d+|one|two|three|four|five)\)',
            text_clean,
            re.IGNORECASE
        )
        if match_intent:
            num_str = match_intent.group(1) or match_intent.group(2)
            prompt_count = self._parse_number_word(num_str)

        if prompt_count:
            if prompt_count > 1 and q.question_type == QuestionType.SINGLE_CHOICE:
                issues.append(ValidationErrorItem(
                    severity="error",
                    field="question_type",
                    error_category="structural",
                    message=f"Prompt explicitly requests '{num_str}' answers, but question type is set to single_choice."
                ))
            if prompt_count != correct_count and correct_count > 0:
                issues.append(ValidationErrorItem(
                    severity="error",
                    field="is_correct",
                    error_category="structural",
                    message=f"Prompt explicitly requests '{num_str}' answers (found {prompt_count}), but {correct_count} choice(s) marked correct."
                ))

        # 4. Explanation Cross-Reference Integrity Check
        if q.explanation:
            expl_match = re.search(
                r'(?:(?:correct answer|correct choice|the correct response is)[:\s]*([A-H])\b|option\s+([A-H])\s+is\s+(?:the\s+)?correct)',
                q.explanation,
                re.IGNORECASE
            )
            if expl_match:
                ref_letter = (expl_match.group(1) or expl_match.group(2)).upper()
                ref_idx = ord(ref_letter) - ord('A')
                if 0 <= ref_idx < len(options):
                    if not options[ref_idx].is_correct:
                        issues.append(ValidationErrorItem(
                            severity="error",
                            field="explanation",
                            error_category="structural",
                            message=f"Explanation claims Option {ref_letter} is correct, but Option {ref_letter} is marked incorrect in the answer key."
                        ))

        # A question with no explanation still imports -- plenty of banks arrive
        # without them -- but it is worth saying, because the review loop depends on
        # it: a miss is only worth reviewing if there is something to read about why
        # the answer is right.
        if not (q.explanation and q.explanation.strip()):
            issues.append(ValidationErrorItem(
                severity="warning",
                field="explanation",
                error_category="content",
                message="No explanation. If this question is missed, the review will have nothing to show about why the answer is right.",
            ))

        # 5. Intra-Batch & Database Deduplication & Fuzzy Similarity
        norm_q = self._normalize(text_clean)
        if norm_q:
            # Check intra-batch duplicate
            if seen_batch_hashes is not None and norm_q in seen_batch_hashes:
                prev_idx = seen_batch_hashes[norm_q]
                issues.append(ValidationErrorItem(
                    severity="warning",
                    field="duplicate",
                    error_category="duplication",
                    message=f"Duplicate question text found (identical to question #{prev_idx} in this batch)."
                ))
            elif seen_batch_hashes is not None:
                seen_batch_hashes[norm_q] = index

            # Check database exact match
            if norm_q in self.existing_hashes:
                issues.append(ValidationErrorItem(
                    severity="warning",
                    field="duplicate",
                    error_category="duplication",
                    message="A question with identical text already exists in your Question Bank."
                ))
            else:
                # Check fuzzy similarity against database questions with length ratio pre-filter
                len_norm_q = len(norm_q)
                # Only lengths the pre-filter could pass, widened by one each way
                # so rounding never drops a candidate; the exact test still runs.
                lo = bisect.bisect_left(self._lengths, int(len_norm_q * 0.85) - 1)
                hi = bisect.bisect_right(self._lengths, int(len_norm_q / 0.85) + 1)
                matcher = difflib.SequenceMatcher(None, norm_q, "")
                for _, _, existing_norm in sorted(self._by_length[lo:hi], key=lambda entry: entry[1]):
                    len_ext = len(existing_norm)
                    if abs(len_norm_q - len_ext) / max(len_norm_q, len_ext, 1) > 0.15:
                        continue

                    matcher.set_seq2(existing_norm)
                    # Both are upper bounds on ratio(), so skipping on them never
                    # changes which question is found or the similarity reported.
                    if matcher.real_quick_ratio() < 0.85 or matcher.quick_ratio() < 0.85:
                        continue
                    ratio = matcher.ratio()
                    if ratio >= 0.85:
                        issues.append(ValidationErrorItem(
                            severity="warning",
                            field="duplicate",
                            error_category="duplication",
                            message=f"Near-duplicate question ({int(ratio * 100)}% similarity) detected in your Question Bank."
                        ))
                        break

        # Determine structural validation status
        has_structural_error = any(i.severity == "error" for i in issues)
        has_warning = any(i.severity == "warning" for i in issues)

        content_judgment: Optional[ContentJudgment] = None
        human_review_required = False

        # 6. Deep Content & Correctness Validation (LLM Blind Judging + RAG)
        if validate_content and not has_structural_error and self.content_validator:
            options_text = [o.option_text for o in options]
            stated_correct = [chr(65 + i) for i, o in enumerate(options) if o.is_correct]

            content_judgment = self.content_validator.judge_question(
                question_text=text_clean,
                options=options_text,
                stated_correct_options=stated_correct
            )

            if content_judgment:
                human_review_required = content_judgment.human_review_required
                content_issue = self.content_validator.judgment_to_validation_issue(content_judgment)
                if content_issue:
                    issues.append(content_issue)

        for issue in issues:
            if issue.action is None:
                issue.action = DEFAULT_ACTIONS.get(issue.field)

        has_error = any(i.severity == "error" for i in issues)
        has_warning = has_warning or any(i.severity == "warning" for i in issues)
        status = "error" if has_error else ("warning" if (has_warning or human_review_required) else "valid")

        return ValidatedQuestionItem(
            index=index,
            question=q,
            status=status,
            issues=issues,
            content_judgment=content_judgment,
            human_review_required=human_review_required
        )

    def validate_batch(self, questions: List[QuestionCreate], validate_content: bool = False) -> QuestionValidationReport:
        items: List[ValidatedQuestionItem] = []
        valid_count = 0
        warning_count = 0
        error_count = 0
        seen_batch_hashes: Dict[str, int] = {}

        for idx, q in enumerate(questions):
            item = self.validate_question(
                q, idx + 1,
                seen_batch_hashes=seen_batch_hashes,
                validate_content=validate_content
            )
            items.append(item)

            if item.status == "valid":
                valid_count += 1
            elif item.status == "warning":
                warning_count += 1
            elif item.status == "error":
                error_count += 1

        return QuestionValidationReport(
            total_processed=len(questions),
            valid_count=valid_count,
            warning_count=warning_count,
            error_count=error_count,
            items=items
        )
