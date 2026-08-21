import re
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
        self.existing_hashes: Set[str] = {self._normalize(t) for t in self.existing_texts if t}
        
        # Instantiate ContentValidator (LLM + RAG Grounding Engine)
        self.content_validator: Optional[ContentValidator] = None
        if enable_content_validator:
            try:
                cv = ContentValidator()
                if cv.is_available():
                    self.content_validator = cv
            except Exception:
                self.content_validator = None

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
                for existing_text in self.existing_texts:
                    existing_norm = self._normalize(existing_text)
                    if not existing_norm:
                        continue
                    len_ext = len(existing_norm)
                    if abs(len_norm_q - len_ext) / max(len_norm_q, len_ext, 1) > 0.15:
                        continue

                    ratio = difflib.SequenceMatcher(None, norm_q, existing_norm).ratio()
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

        has_error = any(i.severity == "error" for i in issues)
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
