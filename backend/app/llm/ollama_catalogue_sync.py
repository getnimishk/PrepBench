# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Sync and curate models from the Ollama library into PrepBench's local catalogue.

This module implements the "Do the Needful" pipeline:
1. Fetches top/popular models from https://ollama.com/library.
2. Filters for instruction/chat models suited for PrepBench tasks.
3. Computes parameter sizes, required RAM, download size, and task suitability.
4. Non-destructively merges them into backend/data/local_models.custom.json.
5. In-memory catalogue cache is refreshed so UI instantly sees the new options.
"""
import json
import re
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

from app.core.config import DATA_DIR
from app.core.logging_config import logger
from app.llm import local_setup
from app.llm.transport import get_shared_client, get_text

OLLAMA_LIBRARY_URL = "https://ollama.com/library"

# Known license heuristics by model family
FAMILY_LICENSES = {
    "llama": ("Llama Community License", True),
    "qwen": ("Apache-2.0", True),
    "mistral": ("Apache-2.0", True),
    "deepseek": ("MIT", True),
    "phi": ("MIT", True),
    "gemma": ("Gemma Terms of Use", True),
    "starcoder": ("OpenRAIL-M", True),
}

# Standard parameter sizes when not explicitly tagged
COMMON_FAMILY_SIZES = {
    "llama3.3": [70.0],
    "llama3.2": [1.0, 3.0],
    "llama3.1": [8.0, 70.0],
    "qwen2.5": [1.5, 3.0, 7.0, 14.0, 32.0],
    "deepseek-r1": [1.5, 7.0, 8.0, 14.0, 32.0, 70.0],
    "mistral": [7.0],
    "mistral-small": [24.0],
    "phi4": [14.0],
    "gemma2": [2.0, 9.0, 27.0],
}


def _infer_license(model_name: str) -> Tuple[str, bool]:
    name_lower = model_name.lower()
    for key, (lic, comm_ok) in FAMILY_LICENSES.items():
        if key in name_lower:
            if key == "qwen" and "3b" in name_lower:
                return "Qwen Research Licence", False
            return lic, comm_ok
    return "Open Model License", True


def _calculate_specs(param_b: float) -> Tuple[float, float]:
    """Returns (download_gb, ram_required_gb) for 4-bit quantization + 4K context."""
    download_gb = max(0.5, round(param_b * 0.6 + 0.2, 1))
    ram_gb = max(1.5, round(param_b * 0.85 + 1.2, 1))
    return download_gb, ram_gb


def _determine_task_suitability(param_b: float, is_coder: bool = False) -> Tuple[List[str], List[str], bool]:
    """Returns (good_for, weak_at, sweet_spot)."""
    sweet_spot = 7.0 <= param_b <= 14.0 and not is_coder
    if param_b < 4.0:
        good_for = ["interview_question_gen", "system_design_prompt_gen"]
        weak_at = ["system_design_grading"]
    else:
        good_for = [
            "interview_question_gen",
            "system_design_prompt_gen",
            "system_design_grading",
            "content_validation",
        ]
        weak_at = []
    return good_for, weak_at, sweet_spot


def _parse_models_from_html(html: str) -> List[dict]:
    """Extracts model metadata cards from ollama.com/library HTML."""
    results = []
    # Match <a> blocks under /library/<model>
    pattern = re.compile(
        r'<a\s+href="/library/([a-zA-Z0-9._-]+)"[^>]*>([\s\S]*?)</a>',
        re.IGNORECASE,
    )
    for match in pattern.finditer(html):
        slug = match.group(1).strip()
        card_content = match.group(2)

        # Skip non-LLM or specialized embedding models
        if slug in ("nomic-embed-text", "bge-m3", "all-minilm", "mxbai-embed-large"):
            continue

        # Extract description text
        desc_match = re.search(r'<p[^>]*class="[^"]*break-words[^"]*"[^>]*>([\s\S]*?)</p>', card_content)
        description = re.sub(r'<[^>]+>', '', desc_match.group(1)).strip() if desc_match else ""

        # Extract parameter tags like 8b, 70b, 1.5b
        tags = set(re.findall(r'>\s*([0-9.]+[bmBM])\s*<', card_content))
        param_sizes: List[float] = []
        for t in tags:
            t_lower = t.lower()
            if t_lower.endswith("b"):
                try:
                    val = float(t_lower[:-1])
                    if 0.5 <= val <= 100.0:
                        param_sizes.append(val)
                except ValueError:
                    pass

        # Fallback to known family sizes if none matched
        if not param_sizes:
            param_sizes = COMMON_FAMILY_SIZES.get(slug, [7.0])

        param_sizes.sort()

        is_coder = "code" in slug.lower()
        licence, licence_ok = _infer_license(slug)

        for param in param_sizes:
            download_gb, ram_req = _calculate_specs(param)
            good_for, weak_at, sweet_spot = _determine_task_suitability(param, is_coder)

            param_label = f"{int(param) if param.is_integer() else param}B"
            model_id = f"{slug}-{param_label.lower()}-instruct-q4"
            pretty_name = f"{slug.capitalize()} {param_label} (Q4_K_M)"

            summary = description or f"{slug.capitalize()} {param_label} instruction-tuned model from the Ollama library."
            if sweet_spot:
                summary = f"{summary} Recommended balance of speed and grading quality."

            results.append({
                "id": model_id,
                "label": pretty_name,
                "parameters_b": param,
                "quantisation": "Q4_K_M",
                "download_gb": download_gb,
                "ram_required_gb": ram_req,
                "licence": licence,
                "licence_commercial_ok": licence_ok,
                "sweet_spot": sweet_spot,
                "good_for": good_for,
                "weak_at": weak_at,
                "summary": summary,
                "download_url": f"https://ollama.com/library/{slug}",
            })

    return results


def sync_ollama_catalogue(timeout: float = 12.0) -> Tuple[bool, int, int, str]:
    """
    Fetches the latest models from Ollama library, merges with local_models.custom.json,
    and refreshes the in-memory catalogue.

    Returns:
        (ok, total_models_count, new_models_added, message)
    """
    client = get_shared_client()
    html, error = get_text(client, OLLAMA_LIBRARY_URL, timeout=timeout)
    if error:
        logger.warning(f"Could not fetch Ollama library: {error}")
        total = len(local_setup.load_catalogue().get("models", []))
        return False, total, 0, f"Could not connect to Ollama library: {error}"

    discovered_models = _parse_models_from_html(html)
    if not discovered_models:
        total = len(local_setup.load_catalogue().get("models", []))
        return False, total, 0, "No compatible models could be parsed from the Ollama library."

    custom_path = local_setup.CUSTOM_CATALOGUE_PATH
    custom_data = {}
    if custom_path.exists():
        try:
            custom_data = json.loads(custom_path.read_text(encoding="utf-8"))
        except Exception as e:
            logger.error(f"Error reading existing custom catalogue {custom_path}: {e}")
            custom_data = {}

    existing_models = custom_data.get("models", [])
    existing_ids: Set[str] = {m.get("id") for m in existing_models if "id" in m}

    # Also check built-in model IDs to avoid redundant overrides if identical
    builtin_models = local_setup._read(local_setup.BUILTIN_CATALOGUE_PATH).get("models", [])
    builtin_ids: Set[str] = {m.get("id") for m in builtin_models if "id" in m}

    new_added = 0
    for m in discovered_models:
        if m["id"] not in existing_ids and m["id"] not in builtin_ids:
            existing_models.append(m)
            existing_ids.add(m["id"])
            new_added += 1

    custom_data["models"] = existing_models
    try:
        custom_path.parent.mkdir(parents=True, exist_ok=True)
        custom_path.write_text(json.dumps(custom_data, indent=2), encoding="utf-8")
    except Exception as e:
        logger.error(f"Failed to write updated catalogue to {custom_path}: {e}")
        return False, len(builtin_models), 0, f"Failed to save catalogue to disk: {e}"

    # Reload in-memory cache
    fresh_catalogue = local_setup.load_catalogue(refresh=True)
    total_count = len(fresh_catalogue.get("models", []))

    msg = (
        f"Catalogue updated: {new_added} new model(s) discovered from Ollama library. "
        f"Total available: {total_count} models."
    )
    return True, total_count, new_added, msg
