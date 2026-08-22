import json
import io
import re
import pandas as pd
from typing import List, Tuple
from sqlalchemy.orm import Session
from app.schemas.question import QuestionCreate, QuestionOptionCreate
from app.services.question_service import QuestionService
from app.repositories.question_repository import QuestionRepository
from app.services.question_validator import QuestionValidator
from app.schemas.question_validation import QuestionValidationReport
from app.schemas.import_export import ImportResult
from app.models.question import QuestionType, QuestionDifficulty
from app.core.logging_config import logger

# Diagnostic toggle for the post-write option-count verification in
# import_validated_batch: False = log a warning only; True = treat a mismatch as
# a hard failure for that question / a loud exception for the aggregate check.
# Verified against both a deliberately-induced fault (correctly detected and
# logged in soft mode) and multiple clean real-server import runs (zero false
# positives) before flipping to hard-fail.
VERIFY_OPTION_COUNTS_HARD_FAIL = True

# Commit every N questions instead of holding the entire batch as one long
# transaction. Shrinks the blast radius of any single failure and narrows the
# diagnostic window (the per-chunk aggregate check below reports which ~N-sized
# window an issue occurred in, not just "somewhere in 500 questions").
IMPORT_CHUNK_SIZE = 25

class ImportService:
    def __init__(self, db: Session):
        self.db = db
        self.question_service = QuestionService(db)
        self.question_repo = QuestionRepository(db)
        self.validator = QuestionValidator(db)

    def validate_file(self, filename: str, content_bytes: bytes, validate_content: bool = False) -> QuestionValidationReport:
        fname = filename.lower()
        questions: List[QuestionCreate] = []

        if fname.endswith(".json"):
            json_str = content_bytes.decode("utf-8")
            data = json.loads(json_str)
            if isinstance(data, dict) and "questions" in data:
                data = data["questions"]
            questions = self._normalize_json_items(data)

        elif fname.endswith(".md") or fname.endswith(".markdown"):
            md_str = content_bytes.decode("utf-8")
            questions = self.parse_questions_from_markdown(md_str)

        elif fname.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content_bytes))
            questions = self.parse_questions_from_dataframe(df)

        elif fname.endswith(".xlsx") or fname.endswith(".xls"):
            df = pd.read_excel(io.BytesIO(content_bytes))
            questions = self.parse_questions_from_dataframe(df)

        else:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file format '{filename}'. Supported formats: .json, .md, .markdown, .csv, .xlsx, .xls"
            )

        return self.validator.validate_batch(questions, validate_content=validate_content)

    def _check_aggregate_option_counts(self, ids_and_counts: List[Tuple[int, int]], QuestionOption) -> None:
        """Post-commit aggregate check for a just-committed chunk: catches corruption
        introduced during/after the commit itself, which a per-question check inside
        a savepoint can't see. Raising here (hard-fail mode) can't roll back an
        already-committed transaction — it exists to fail loudly, not to undo damage.
        """
        if not ids_and_counts:
            return
        ids = [qid for qid, _ in ids_and_counts]
        expected_total = sum(count for _, count in ids_and_counts)
        actual_total = self.question_repo.count_options_for_questions(ids)
        if actual_total != expected_total:
            msg = (
                f"Aggregate post-commit option count mismatch: expected "
                f"{expected_total} options across {len(ids)} newly-imported "
                f"questions in this chunk, found {actual_total}."
            )
            if VERIFY_OPTION_COUNTS_HARD_FAIL:
                raise RuntimeError(msg)
            logger.warning(msg)

    def import_validated_batch(self, questions: List[QuestionCreate], skip_errors: bool = True) -> ImportResult:
        success = 0
        failed = 0
        errors = []
        chunk_ids_and_counts: List[Tuple[int, int]] = []

        from app.models.question import Question as QuestionModel
        from app.models.option import QuestionOption

        for idx, q in enumerate(questions):
            try:
                with self.db.begin_nested():  # SAVEPOINT — rollback only affects this question
                    db_obj = QuestionModel(
                        text=q.text,
                        question_type=q.question_type,
                        difficulty=q.difficulty,
                        domain=q.domain,
                        topic=q.topic,
                        subtopic=q.subtopic,
                        certification=q.certification,
                        source=q.source,
                        tags=q.tags,
                        code_snippet=q.code_snippet,
                        case_study_text=q.case_study_text,
                        image_url=q.image_url,
                        explanation=q.explanation,
                        reference_url=q.reference_url,
                    )
                    self.db.add(db_obj)
                    self.db.flush()  # resolve db_obj.id within the savepoint

                    expected_option_count = len(q.options or [])
                    for opt_idx, opt in enumerate(q.options or []):
                        self.db.add(QuestionOption(
                            question_id=db_obj.id,
                            option_text=opt.option_text,
                            is_correct=opt.is_correct,
                            explanation_why_incorrect=opt.explanation_why_incorrect,
                            order_index=opt.order_index if opt.order_index is not None else opt_idx,
                        ))

                    # Verify what actually landed, not what Python thinks it added.
                    # A real COUNT query (not len(db_obj.options), which only reflects
                    # SQLAlchemy's in-memory identity map) catches silent option loss
                    # that has occurred twice during real imports on this app.
                    if expected_option_count:
                        self.db.flush()
                        actual_option_count = self.question_repo.count_options_for_questions([db_obj.id])
                        if actual_option_count != expected_option_count:
                            msg = (
                                f"Option count mismatch for question {idx + 1} "
                                f"('{q.text[:60]}...'): expected {expected_option_count}, "
                                f"found {actual_option_count} after flush."
                            )
                            if VERIFY_OPTION_COUNTS_HARD_FAIL:
                                raise RuntimeError(msg)
                            logger.warning(msg)

                    chunk_ids_and_counts.append((db_obj.id, expected_option_count))
                success += 1
            except Exception as e:
                # SAVEPOINT was rolled back automatically by the context manager;
                # every previously-successful question in this batch is unaffected.
                if not skip_errors:
                    raise
                failed += 1
                errors.append(f"Question {idx + 1}: {str(e)}")

            # Commit every IMPORT_CHUNK_SIZE questions (and always on the last one),
            # instead of holding the whole batch as one long transaction. A failure
            # committing a chunk is a different, more serious kind of failure than a
            # single question's validation error — it means something is wrong at
            # the connection/transaction level, so it aborts the whole import rather
            # than being swallowed like a per-question error.
            is_last_question = idx == len(questions) - 1
            if chunk_ids_and_counts and (len(chunk_ids_and_counts) >= IMPORT_CHUNK_SIZE or is_last_question):
                self.db.commit()
                self._check_aggregate_option_counts(chunk_ids_and_counts, QuestionOption)
                chunk_ids_and_counts = []

        return ImportResult(
            success_count=success,
            failed_count=failed,
            total_processed=success + failed,
            errors=errors
        )

    def parse_questions_from_markdown(self, md_text: str) -> List[QuestionCreate]:
        if re.search(r'(?i)##\s+Answer\s+Key', md_text):
            return self._parse_study_guide_markdown_objects(md_text)
        elif re.search(r'-\s+\[[ xX]\]', md_text):
            return self._parse_structured_markdown_objects(md_text)
        else:
            return self._parse_inline_question_markdown_objects(md_text)

    def _parse_inline_question_markdown_objects(self, md_text: str) -> List[QuestionCreate]:
        questions: List[QuestionCreate] = []

        cert_title = "PSM I - Professional Scrum Master"
        title_match = re.search(r'(?m)^#\s+(.*)', md_text)
        if title_match:
            cert_title = title_match.group(1).strip()
            cert_title = re.sub(r'\s*[\-\u2014]\s*Part.*', '', cert_title).strip()

        blocks = re.split(r'(?m)^(?=##\s+Question\s+\d+)', md_text)

        for block in blocks:
            block = block.strip()
            if not block or not re.match(r'^##\s+Question\s+\d+', block, re.IGNORECASE):
                continue

            # Extract Topic
            topic = "General"
            topic_match = re.search(r'(?i)(?:\*\*Topic:\*\*|Topic:)\s*(.*)', block)
            if topic_match:
                topic = topic_match.group(1).strip()

            # Extract Question Type
            q_type = QuestionType.SINGLE_CHOICE
            type_match = re.search(r'(?i)(?:\*\*Type:\*\*|Type:)\s*(.*)', block)
            if type_match:
                t_raw = type_match.group(1).strip().lower()
                if "true" in t_raw or "false" in t_raw:
                    q_type = QuestionType.TRUE_FALSE
                elif ("choose" in t_raw or "multiple" in t_raw or "select" in t_raw) and "single" not in t_raw:
                    q_type = QuestionType.MULTIPLE_CHOICE
                else:
                    q_type = QuestionType.SINGLE_CHOICE

            # Extract Difficulty
            difficulty = QuestionDifficulty.MEDIUM
            diff_match = re.search(r'(?i)(?:\*\*Difficulty:\*\*|Difficulty:)\s*(.*)', block)
            if diff_match:
                d_raw = diff_match.group(1).strip().lower()
                if "hard" in d_raw: difficulty = QuestionDifficulty.HARD
                elif "expert" in d_raw: difficulty = QuestionDifficulty.HARD
                elif "easy" in d_raw or "moderate" in d_raw: difficulty = QuestionDifficulty.EASY

            # Extract Correct Answer keys
            correct_keys = []
            ans_match = re.search(r'(?i)(?:\*\*Correct Answer:\*\*|###\s*Correct Answer)\s*([A-Za-z0-9,\s]+)', block)
            if ans_match:
                raw_keys = ans_match.group(1).strip()
                correct_keys = [k.strip().upper() for k in raw_keys.split(',')]

            # Extract Explanation
            explanation = ""
            expl_match = re.search(r'(?i)(?:\*\*Explanation:\*\*|###\s*Explanation)\s*(.*?)(?=\*\*Why the others are wrong:\*\*|###\s*Why the|###\s*Common Misconception|\n---\n|$)', block, re.DOTALL)
            if expl_match:
                explanation = expl_match.group(1).strip()

            wrong_match = re.search(r'(?i)(?:\*\*Why the others are wrong:\*\*|###\s*Why the Other Options Are Incorrect)\s*(.*?)(?=\n---\n|###\s*Common Misconception|$)', block, re.DOTALL)
            if wrong_match:
                wrong_text = wrong_match.group(1).strip()
                explanation += f"\n\n**Why the others are wrong:**\n{wrong_text}"

            lines = [l.strip() for l in block.split('\n') if l.strip()]
            stem_lines = []
            options = []
            in_stem = True
            in_options = False

            for line in lines:
                if line.startswith("## Question"):
                    continue
                if line.lower().startswith("difficulty:") or line.lower().startswith("learning objective:") or line.lower().startswith("topic:") or line.lower().startswith("bloom level:") or line.lower().startswith("type:") or line.lower().startswith("estimated solve time:"):
                    continue
                if line.lower().startswith("**topic:**") or line.lower().startswith("**type:**") or line.lower().startswith("**difficulty:**"):
                    continue
                if line.startswith("Question") and len(line) <= 10:
                    continue
                if line.startswith("### Options") or line.startswith("Options"):
                    in_stem = False
                    in_options = True
                    continue
                if line.startswith("### Correct Answer") or line.startswith("**Correct Answer:**") or line.startswith("### Explanation") or line.startswith("**Explanation:**") or line.startswith("### Why") or line.startswith("Why the") or line.startswith("### Common") or line.startswith("### Key") or line.startswith("---"):
                    in_stem = False
                    in_options = False
                    continue

                m_opt = re.match(r'^\s*([A-E])[\.\)]\s*(.*)', line)
                if m_opt and (in_options or in_stem):
                    in_stem = False
                    in_options = True
                    opt_key = m_opt.group(1).upper()
                    opt_val = m_opt.group(2).strip()
                    options.append((opt_key, opt_val))
                elif in_stem and not line.startswith("#") and not line.startswith("-") and not line.startswith("**"):
                    stem_lines.append(line)

            q_text = " ".join(stem_lines).strip()

            if q_type == QuestionType.TRUE_FALSE and not options:
                options = [("A", "True"), ("B", "False")]

            if q_text and options:
                parsed_options: List[QuestionOptionCreate] = []
                for idx, (opt_key, opt_val) in enumerate(options):
                    is_corr = opt_key in correct_keys or opt_val.upper() in correct_keys
                    if q_type == QuestionType.TRUE_FALSE:
                        if "TRUE" in correct_keys and opt_val.lower() == "true": is_corr = True
                        if "FALSE" in correct_keys and opt_val.lower() == "false": is_corr = True
                        if "A" in correct_keys and opt_key == "A": is_corr = True
                        if "B" in correct_keys and opt_key == "B": is_corr = True

                    parsed_options.append(QuestionOptionCreate(
                        option_text=opt_val,
                        is_correct=is_corr,
                        order_index=idx
                    ))

                questions.append(QuestionCreate(
                    text=q_text,
                    question_type=q_type,
                    difficulty=difficulty,
                    domain="Agile & Scrum" if "scrum" in cert_title.lower() or "psm" in cert_title.lower() else "General",
                    topic=topic,
                    certification=cert_title,
                    explanation=explanation.strip() or None,
                    options=parsed_options
                ))

        return questions

    def _parse_study_guide_markdown_objects(self, md_text: str) -> List[QuestionCreate]:
        questions: List[QuestionCreate] = []

        parts = re.split(r'(?i)##\s+Answer\s+Key', md_text, maxsplit=1)
        q_part = parts[0]
        ans_part = parts[1] if len(parts) > 1 else ""

        cert_title = "General Prep"
        title_match = re.search(r'(?m)^#\s+(.*)', q_part)
        if title_match:
            cert_title = title_match.group(1).strip()

        answers_map = {}
        if ans_part:
            ans_matches = re.finditer(r'\*\*(\d+)\.\s*([A-Za-z0-9,\s]+)\*\*\s*[\u2014\-:]\s*(.*)', ans_part)
            for m in ans_matches:
                q_num = int(m.group(1))
                ans_str = m.group(2).strip()
                expl = m.group(3).strip()
                ans_keys = [k.strip().upper() for k in ans_str.split(',')]
                answers_map[q_num] = {
                    "keys": ans_keys,
                    "explanation": expl
                }

        q_blocks = re.split(r'(?=\*\*\d+\.\*\*)', q_part)

        for idx, block in enumerate(q_blocks):
            block = block.strip()
            m_head = re.match(r'\*\*(\d+)\.\*\*\s*(?:\((MC|MA|T/F)\))?\s*(.*)', block, re.DOTALL)
            if not m_head:
                continue

            q_num = int(m_head.group(1))
            q_type_code = m_head.group(2) or "MC"
            content = m_head.group(3).strip()

            lines = [l.strip() for l in content.split('\n') if l.strip()]
            q_text_lines = []
            options = []

            for line in lines:
                m_opt = re.match(r'^\s*([A-E])[\)\.]\s*(.*)', line)
                if m_opt:
                    opt_key = m_opt.group(1).upper()
                    opt_val = m_opt.group(2).strip()
                    options.append((opt_key, opt_val))
                else:
                    if not options:
                        q_text_lines.append(line)

            q_text = " ".join(q_text_lines).strip()
            if not q_text:
                continue

            if q_type_code == "T/F" or (not options and ("True" in block or "False" in block)):
                q_type = QuestionType.TRUE_FALSE
                if not options:
                    options = [("TRUE", "True"), ("FALSE", "False")]
            elif q_type_code == "MA":
                q_type = QuestionType.MULTIPLE_CHOICE
            else:
                q_type = QuestionType.SINGLE_CHOICE

            ans_info = answers_map.get(q_num, {"keys": [], "explanation": ""})
            correct_keys = ans_info["keys"]

            parsed_options = []
            for o_idx, (opt_key, opt_val) in enumerate(options):
                is_corr = False
                if opt_key in correct_keys or opt_val.upper() in correct_keys:
                    is_corr = True
                elif q_type == QuestionType.TRUE_FALSE:
                    if "TRUE" in correct_keys and opt_key == "TRUE": is_corr = True
                    if "FALSE" in correct_keys and opt_key == "FALSE": is_corr = True

                parsed_options.append(QuestionOptionCreate(
                    option_text=opt_val,
                    is_correct=is_corr,
                    order_index=o_idx
                ))

            questions.append(QuestionCreate(
                text=q_text,
                question_type=q_type,
                difficulty=QuestionDifficulty.HARD if "hard" in cert_title.lower() else QuestionDifficulty.MEDIUM,
                domain="Agile & Scrum" if "scrum" in cert_title.lower() else "General",
                topic="Practice Exam",
                certification=cert_title,
                explanation=ans_info["explanation"] or None,
                options=parsed_options
            ))

        return questions

    def _parse_structured_markdown_objects(self, md_text: str) -> List[QuestionCreate]:
        questions: List[QuestionCreate] = []

        blocks = re.split(r'(?m)^(?=##\s+|\n---+\n)', md_text)

        for idx, block in enumerate(blocks):
            block = block.strip()
            if not block or block.startswith("# ") and "## " not in block:
                continue

            lines = block.split('\n')
            question_text = ""
            q_type = QuestionType.SINGLE_CHOICE
            difficulty = QuestionDifficulty.MEDIUM
            domain = "General"
            topic = "General"
            certification = "General Prep"
            explanation = ""
            options: List[QuestionOptionCreate] = []

            in_explanation = False

            for line in lines:
                line_str = line.strip()
                if not line_str:
                    continue

                clean_line = line_str.strip("[]")

                if line_str.startswith("## ") or line_str.startswith("### "):
                    continue

                if clean_line.startswith("- Domain:") or clean_line.startswith("Domain:"):
                    domain = clean_line.split(":", 1)[1].strip()
                elif clean_line.startswith("- Topic:") or clean_line.startswith("Topic:"):
                    topic = clean_line.split(":", 1)[1].strip()
                elif clean_line.startswith("- Certification:") or clean_line.startswith("Certification:"):
                    certification = clean_line.split(":", 1)[1].strip()
                elif clean_line.startswith("- Difficulty:") or clean_line.startswith("Difficulty:"):
                    diff_val = clean_line.split(":", 1)[1].strip().lower()
                    if diff_val in {e.value for e in QuestionDifficulty}:
                        difficulty = QuestionDifficulty(diff_val)
                elif clean_line.startswith("- Type:") or clean_line.startswith("- Question Type:") or clean_line.startswith("Type:"):
                    type_val = clean_line.split(":", 1)[1].strip().lower().replace(" ", "_")
                    if type_val in {e.value for e in QuestionType}:
                        q_type = QuestionType(type_val)
                elif line_str.startswith("### Explanation") or line_str.startswith("**Explanation:**") or line_str.startswith("Explanation:"):
                    in_explanation = True
                    if ":" in line_str and not line_str.startswith("###"):
                        explanation += line_str.split(":", 1)[1].strip() + "\n"
                elif in_explanation:
                    explanation += line_str + "\n"
                elif line_str.startswith("- [x]") or line_str.startswith("- [X]"):
                    opt_text = line_str[5:].strip()
                    options.append(QuestionOptionCreate(option_text=opt_text, is_correct=True, order_index=len(options)))
                elif line_str.startswith("- [ ]"):
                    opt_text = line_str[5:].strip()
                    options.append(QuestionOptionCreate(option_text=opt_text, is_correct=False, order_index=len(options)))
                elif not question_text and not line_str.startswith("###") and not line_str.startswith("-") and not line_str.startswith("["):
                    question_text = line_str

            if question_text and options:
                questions.append(QuestionCreate(
                    text=question_text,
                    question_type=q_type,
                    difficulty=difficulty,
                    domain=domain,
                    topic=topic,
                    certification=certification,
                    explanation=explanation.strip() or None,
                    options=options
                ))

        return questions

    def parse_questions_from_dataframe(self, df: pd.DataFrame) -> List[QuestionCreate]:
        questions: List[QuestionCreate] = []

        df.columns = [str(c).strip().lower() for c in df.columns]

        for idx, row in df.iterrows():
            try:
                text = str(row.get("text", "")).strip()
                if not text or text == "nan":
                    continue

                q_type = str(row.get("question_type", "single_choice")).lower()
                difficulty = str(row.get("difficulty", "medium")).lower()
                domain = str(row.get("domain", "General"))
                topic = str(row.get("topic", "General"))
                certification = str(row.get("certification", "General Prep"))
                explanation = str(row.get("explanation", "")) if pd.notna(row.get("explanation")) else None

                options: List[QuestionOptionCreate] = []
                for i in range(1, 10):
                    opt_col = f"option_{i}"
                    if opt_col in row and pd.notna(row[opt_col]):
                        opt_str = str(row[opt_col]).strip()
                        is_corr_col = f"option_{i}_correct"
                        is_corr = False
                        if is_corr_col in row:
                            is_corr = str(row[is_corr_col]).lower() in ["true", "1", "yes"]
                        elif "correct_option" in row:
                            is_corr = (str(row["correct_option"]).strip() == str(i) or str(row["correct_option"]).strip() == opt_str)

                        options.append(QuestionOptionCreate(
                            option_text=opt_str,
                            is_correct=is_corr,
                            order_index=i-1
                        ))

                if not options:
                    continue

                valid_types = {e.value for e in QuestionType}
                valid_diffs = {e.value for e in QuestionDifficulty}
                questions.append(QuestionCreate(
                    text=text,
                    question_type=QuestionType(q_type) if q_type in valid_types else QuestionType.SINGLE_CHOICE,
                    difficulty=QuestionDifficulty(difficulty) if difficulty in valid_diffs else QuestionDifficulty.MEDIUM,
                    domain=domain,
                    topic=topic,
                    certification=certification,
                    explanation=explanation,
                    options=options
                ))
            except Exception as e:
                from app.core.logging_config import logger
                logger.warning(f"Skipping dataframe row {idx + 1} due to parsing error: {str(e)}")
                continue

        return questions

    def _normalize_json_items(self, data: list) -> List[QuestionCreate]:
        question_fields = set(QuestionCreate.model_fields.keys()) if hasattr(QuestionCreate, "model_fields") else set(QuestionCreate.__fields__.keys())
        option_fields = set(QuestionOptionCreate.model_fields.keys()) if hasattr(QuestionOptionCreate, "model_fields") else set(QuestionOptionCreate.__fields__.keys())

        questions: List[QuestionCreate] = []
        for item in data:
            if not isinstance(item, dict):
                continue
            item_copy = {k: v for k, v in item.items() if k in question_fields}

            if isinstance(item.get("options"), list):
                normalized_options = []
                for idx, opt in enumerate(item["options"]):
                    if not isinstance(opt, dict):
                        normalized_options.append(opt)
                        continue
                    opt_copy = {k: v for k, v in opt.items() if k in option_fields}
                    if "is_correct" not in opt_copy and "isCorrect" in opt:
                        opt_copy["is_correct"] = opt["isCorrect"]
                    if "option_text" not in opt_copy:
                        opt_copy["option_text"] = opt.get("text") or opt.get("value") or opt.get("content") or ""
                    opt_copy.setdefault("order_index", idx)
                    normalized_options.append(opt_copy)

                # Ensure TRUE_FALSE questions always have both True and False options
                q_type_val = str(item_copy.get("question_type", "")).lower()
                if ("true_false" in q_type_val or "t/f" in q_type_val) and len(normalized_options) == 1:
                    opt0 = normalized_options[0]
                    # Use startswith rather than exact match so trailing punctuation/
                    # whitespace ("True.", "true ") doesn't silently defeat the fix.
                    text0 = str(opt0.get("option_text", "")).strip().lower()
                    is_corr0 = bool(opt0.get("is_correct", False))
                    if text0.startswith("true"):
                        normalized_options.append({
                            "option_text": "False",
                            "is_correct": not is_corr0,
                        })
                    elif text0.startswith("false"):
                        normalized_options.insert(0, {
                            "option_text": "True",
                            "is_correct": not is_corr0,
                        })
                    # If the single option is neither "true"- nor "false"-worded, we
                    # deliberately leave it as-is: validate_batch will surface a clear
                    # "must have at least 2 answer choices" error on this question rather
                    # than this function guessing at unrecognized wording.

                # Always derive order_index from final list position instead of trusting
                # values set earlier in the loop or hardcoded above — this is what
                # guarantees no two options in the same question ever share an index,
                # regardless of which code path (append/insert/source data) put them there.
                for i, opt in enumerate(normalized_options):
                    opt["order_index"] = i

                item_copy["options"] = normalized_options

            questions.append(QuestionCreate(**item_copy))
        return questions

    def import_from_json(self, json_data: str) -> ImportResult:
        data = json.loads(json_data)
        if isinstance(data, dict) and "questions" in data:
            data = data["questions"]
        questions = self._normalize_json_items(data)
        return self.import_validated_batch(questions)

    def import_from_markdown(self, md_text: str) -> ImportResult:
        questions = self.parse_questions_from_markdown(md_text)
        return self.import_validated_batch(questions)

    def import_from_csv(self, csv_bytes: bytes) -> ImportResult:
        df = pd.read_csv(io.BytesIO(csv_bytes))
        questions = self.parse_questions_from_dataframe(df)
        return self.import_validated_batch(questions)

    def import_from_excel(self, excel_bytes: bytes) -> ImportResult:
        df = pd.read_excel(io.BytesIO(excel_bytes))
        questions = self.parse_questions_from_dataframe(df)
        return self.import_validated_batch(questions)

    def refine_question_batch(self, questions: List[QuestionCreate]) -> List[QuestionCreate]:
        refined: List[QuestionCreate] = []
        for q in questions:
            cleaned_options = []
            if q.options:
                for opt in q.options:
                    text_clean = re.sub(r'^[A-Ea-e][\)\.]\s*', '', opt.option_text.strip())
                    opt_copy = opt.model_copy()
                    opt_copy.option_text = text_clean
                    cleaned_options.append(opt_copy)

            correct_count = sum(1 for o in cleaned_options if o.is_correct)
            new_type = q.question_type
            if correct_count > 1 and q.question_type == QuestionType.SINGLE_CHOICE:
                new_type = QuestionType.MULTIPLE_CHOICE
            elif correct_count == 1 and q.question_type == QuestionType.MULTIPLE_CHOICE:
                new_type = QuestionType.SINGLE_CHOICE

            q_copy = q.model_copy()
            q_copy.options = cleaned_options
            q_copy.question_type = new_type
            refined.append(q_copy)
        return refined

    def repair_markdown_content(self, md_text: str) -> str:
        """
        Auto-repairs markdown question banks:
        1. Corrects [Type: single_choice] vs [Type: multiple_choice] mismatches based on [x] count.
        2. Strips redundant option letter prefixes (A., B., C., D., E.).
        """
        question_blocks = re.split(r'(?=\n###\s+Question\s+\d+)', md_text)
        fixed_blocks = []

        for block in question_blocks:
            if not block.strip().startswith("### Question"):
                fixed_blocks.append(block)
                continue

            lines = block.splitlines()
            new_lines = []
            option_checked_count = 0
            option_lines_indices = []

            for idx, line in enumerate(lines):
                match = re.match(r'^\s*-\s*\[([ xX])\]\s*(.*)$', line)
                if match:
                    if match.group(1).lower() == 'x':
                        option_checked_count += 1
                    option_lines_indices.append(idx)

            correct_type = "multiple_choice" if option_checked_count > 1 else "single_choice"

            for idx, line in enumerate(lines):
                clean_line = line.strip("[]")
                if clean_line.startswith("Type:") or clean_line.startswith("- Type:"):
                    prefix = "[" if line.strip().startswith("[") else ""
                    suffix = "]" if line.strip().endswith("]") else ""
                    new_lines.append(f"{prefix}Type: {correct_type}{suffix}")
                    continue

                match_opt = re.match(r'^\s*-\s*\[([ xX])\]\s*(?:[A-E][\.\)]\s*)?(.*)$', line)
                if match_opt:
                    mark = match_opt.group(1)
                    text = match_opt.group(2).strip()
                    new_lines.append(f"- [{mark}] {text}")
                    continue

                new_lines.append(line)

            fixed_blocks.append("\n".join(new_lines))

        return "".join(fixed_blocks)
