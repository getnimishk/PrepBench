import re
import os

def parse_study_guide_markdown(md_text: str):
    # 1. Separate Questions part and Answer Key part
    parts = re.split(r'(?i)##\s+Answer\s+Key', md_text, maxsplit=1)
    q_part = parts[0]
    ans_part = parts[1] if len(parts) > 1 else ""

    # Parse Answer Key
    answers_map = {}
    if ans_part:
        # Matches **1. C** — explanation... or **4. A, C, D** — explanation...
        ans_matches = re.finditer(r'\*\*(\d+)\.\s*([A-Za-z0-9,\s]+)\*\*\s*[\u2014\-:]\s*(.*)', ans_part)
        for m in ans_matches:
            q_num = int(m.group(1))
            ans_str = m.group(2).strip()
            expl = m.group(3).strip()
            
            # Split comma separated answers like A, C, D
            ans_keys = [k.strip().upper() for k in ans_str.split(',')]
            answers_map[q_num] = {
                "keys": ans_keys,
                "explanation": expl
            }

    # Parse Questions
    # Match questions like **1.** (MC) text...
    q_blocks = re.split(r'(?=\*\*\d+\.\*\*)', q_part)
    questions = []

    for block in q_blocks:
        block = block.strip()
        m_head = re.match(r'\*\*(\d+)\.\*\*\s*(?:\((MC|MA|T/F)\))?\s*(.*)', block, re.DOTALL)
        if not m_head:
            continue

        q_num = int(m_head.group(1))
        q_type_code = m_head.group(2) or "MC"
        content = m_head.group(3).strip()

        # Split question text and options lines (A), B), C)...)
        lines = [l.strip() for l in content.split('\n') if l.strip()]
        q_text_lines = []
        options = []

        for line in lines:
            m_opt = re.match(r'^([A-E])[\)\.]\s*(.*)', line)
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

        # Question Type
        if q_type_code == "T/F" or (not options and ("True" in block or "False" in block)):
            q_type = "true_false"
            if not options:
                options = [("TRUE", "True"), ("FALSE", "False")]
        elif q_type_code == "MA":
            q_type = "multiple_choice"
        else:
            q_type = "single_choice"

        ans_info = answers_map.get(q_num, {"keys": [], "explanation": ""})
        correct_keys = ans_info["keys"]

        parsed_options = []
        for idx, (opt_key, opt_val) in enumerate(options):
            is_corr = False
            if opt_key in correct_keys or opt_val.upper() in correct_keys:
                is_corr = True
            elif q_type == "true_false":
                if "TRUE" in correct_keys and opt_key == "TRUE": is_corr = True
                if "FALSE" in correct_keys and opt_key == "FALSE": is_corr = True

            parsed_options.append({
                "option_text": opt_val,
                "is_correct": is_corr,
                "order_index": idx
            })

        questions.append({
            "q_num": q_num,
            "text": q_text,
            "question_type": q_type,
            "explanation": ans_info["explanation"],
            "options": parsed_options
        })

    return questions

def test_md_parser_sample():
    sample_md = """# Sample Exam
**1.** (MC) What is Scrum?
A. Agile framework
B. Waterfall process

## Answer Key
**1. A** — Scrum is an agile framework.
"""
    res = parse_study_guide_markdown(sample_md)
    assert len(res) == 1
    assert res[0]["text"] == "What is Scrum?"
    assert res[0]["options"][0]["is_correct"] is True
