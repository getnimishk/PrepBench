"""Two chunkers. Both return dicts that keep the source document id and title, so every chunk can be cited."""
import re


def fixed_chunks(doc, size=40, overlap=10):
    """Split by words, ignoring structure. `size` and `overlap` are in words (a stand-in for tokens)."""
    words = doc["text"].split()
    step = size - overlap
    out = []
    for start in range(0, max(len(words) - overlap, 1), step):
        piece = words[start:start + size]
        out.append({"doc": doc["id"], "title": doc["title"], "text": " ".join(piece), "acl": doc["acl"], "updated": doc["updated"]})
    return out


def heading_chunks(doc):
    """Split at Markdown headings and prepend the document title and heading to each chunk (context in the chunk)."""
    parts = re.split(r"\n(?=## )", doc["text"])
    out = []
    for part in parts:
        lines = part.strip().splitlines()
        if len(lines) < 2:
            continue  # a title with nothing under it: no content to retrieve (it still matches queries, so it must go)
        heading = lines[0].lstrip("# ").strip()
        body = " ".join(l for l in lines[1:] if l.strip()) or heading
        text = f"{doc['title']} > {heading}. {body}" if heading != doc["title"] else f"{doc['title']}. {body}"
        out.append({"doc": doc["id"], "title": doc["title"], "text": text, "body": body, "acl": doc["acl"], "updated": doc["updated"]})
    return out


def chunk_all(docs, chunker, **kw):
    return [dict(c, id=f"{d['id']}#{i}") for d in docs for i, c in enumerate(chunker(d, **kw))]
