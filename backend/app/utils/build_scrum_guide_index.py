"""
build_scrum_guide_index.py

Utility to build a cached, pre-embedded vector index of the official Scrum Guide.

Features:
1. Auto-scrapes https://scrumguides.org/scrum-guide.html directly if local file is absent.
2. Chunks the guide text by paragraph windows of ~700-1000 characters.
3. Generates vector embeddings via Gemini REST API (gemini-embedding-001).
4. Caches the index to backend/data/scrum_guide_index.json for sub-millisecond retrieval.
"""

import os
import json
import re
import time
from pathlib import Path
import httpx
from app.core.config import DATA_DIR, settings
from app.core.logging_config import logger

SOURCE_PATH = DATA_DIR / "scrum_guide_2020.txt"
CACHE_PATH = DATA_DIR / "scrum_guide_index.json"
SCRUM_GUIDE_URL = "https://scrumguides.org/scrum-guide.html"
EMBEDDING_MODEL = "models/gemini-embedding-001"

def fetch_scrum_guide_from_web() -> str:
    """Fetches and cleans the Scrum Guide directly from scrumguides.org."""
    logger.info(f"Fetching Scrum Guide directly from URL: {SCRUM_GUIDE_URL}")
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    with httpx.Client(follow_redirects=True, timeout=15.0) as client:
        response = client.get(SCRUM_GUIDE_URL, headers=headers)
        response.raise_for_status()
        raw_html = response.text

    cleaned = re.sub(r'<script.*?</script>|<style.*.*?/style>|<[^>]+>', ' ', raw_html, flags=re.DOTALL)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned

def load_and_chunk(path: Path = SOURCE_PATH, target_chunk_chars: int = 800):
    raw_text = ""
    if path.exists():
        logger.info(f"Loading Scrum Guide from local file: {path}")
        raw_text = path.read_text(encoding="utf-8")
    else:
        raw_text = fetch_scrum_guide_from_web()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(raw_text, encoding="utf-8")
        logger.info(f"Saved scraped Scrum Guide text to {path}")

    # Split into sentences
    sentences = [s.strip() + "." for s in re.split(r'\.\s+', raw_text) if len(s.strip()) > 10]

    chunks = []
    current_chunk = ""

    for sentence in sentences:
        if len(current_chunk) + len(sentence) > target_chunk_chars and len(current_chunk) > 200:
            chunks.append(current_chunk.strip())
            current_chunk = sentence
        else:
            current_chunk = (current_chunk + " " + sentence).strip()

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    return chunks

def embed_chunks(chunks):
    api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise EnvironmentError("Set GEMINI_API_KEY in backend/.env or environment variable before running this script.")

    url = f"https://generativelanguage.googleapis.com/v1beta/{EMBEDDING_MODEL}:embedContent?key={api_key}"
    indexed = []

    with httpx.Client(timeout=30.0) as client:
        for i, chunk_text in enumerate(chunks):
            payload = {
                "model": EMBEDDING_MODEL,
                "content": {
                    "parts": [{"text": chunk_text}]
                }
            }
            
            for attempt in range(3):
                res = client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    vec = data["embedding"]["values"]
                    indexed.append({
                        "id": i,
                        "text": chunk_text,
                        "embedding": vec,
                    })
                    print(f"Successfully embedded chunk {i + 1}/{len(chunks)}")
                    break
                elif res.status_code == 429:
                    print(f"Rate limited on chunk {i + 1}, waiting 3s before retry...")
                    time.sleep(3)
                else:
                    raise RuntimeError(f"Embedding failed (status {res.status_code}): {res.text}")

    return indexed

def main():
    chunks = load_and_chunk(SOURCE_PATH)
    print(f"Loaded {len(chunks)} chunks from Scrum Guide source")

    indexed = embed_chunks(chunks)

    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(indexed, indent=2), encoding="utf-8")
    print(f"Wrote vector index with {len(indexed)} chunks to {CACHE_PATH}")

if __name__ == "__main__":
    main()
