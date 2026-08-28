# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
build_scrum_guide_index.py

Utility to build a cached, pre-embedded vector index of the official Scrum Guide.

Features:
1. Auto-scrapes https://scrumguides.org/scrum-guide.html directly if local file is absent.
2. Chunks the guide text by paragraph windows of ~700-1000 characters.
3. Generates vector embeddings via whichever AI provider is configured.
4. Caches the index to backend/data/scrum_guide_index.json for sub-millisecond retrieval.
"""

import json
import re
import time
from pathlib import Path
import httpx
from app.core.config import DATA_DIR
from app.core.database import SessionLocal
from app.core.logging_config import logger
from app.llm.gateway import LLMGateway
from app.llm.types import LLMTask

SOURCE_PATH = DATA_DIR / "scrum_guide_2020.txt"
CACHE_PATH = DATA_DIR / "scrum_guide_index.json"
SCRUM_GUIDE_URL = "https://scrumguides.org/scrum-guide.html"

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
    """
    Embed every chunk using whichever provider is configured.

    Goes through the gateway rather than calling a vendor directly, so the
    index is built by the same provider that will later embed queries against
    it. Vectors from two different embedding models are not comparable, and an
    index built by one and queried by another silently degrades retrieval --
    ContentValidator guards against that by dimension, but building it right
    is better than detecting it later.
    """
    db = SessionLocal()
    try:
        gateway = LLMGateway(db)

        if not gateway.is_available(LLMTask.EMBEDDING):
            raise EnvironmentError(
                "No AI provider with embedding support is configured. Set GEMINI_API_KEY "
                "in backend/.env, or configure a provider that offers embeddings."
            )

        provider_name = gateway.provider_name_for(LLMTask.EMBEDDING)
        print(f"Embedding {len(chunks)} chunks via {provider_name}")

        indexed = []
        for i, chunk_text in enumerate(chunks):
            for attempt in range(3):
                result = gateway.embed(chunk_text)
                if result.ok:
                    indexed.append({"id": i, "text": chunk_text, "embedding": result.vector})
                    print(f"Successfully embedded chunk {i + 1}/{len(chunks)}")
                    break

                # Rate limiting is the one failure worth waiting out; the
                # gateway reports it in the HTTP status text it passes through.
                if result.error and "429" in result.error:
                    print(f"Rate limited on chunk {i + 1}, waiting 3s before retry...")
                    time.sleep(3)
                    continue

                raise RuntimeError(f"Embedding failed: {result.error}")
            else:
                raise RuntimeError(f"Embedding chunk {i + 1} failed after 3 attempts (rate limited).")

        return indexed
    finally:
        db.close()

def main():
    chunks = load_and_chunk(SOURCE_PATH)
    print(f"Loaded {len(chunks)} chunks from Scrum Guide source")

    indexed = embed_chunks(chunks)

    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(indexed, indent=2), encoding="utf-8")
    print(f"Wrote vector index with {len(indexed)} chunks to {CACHE_PATH}")

if __name__ == "__main__":
    main()
