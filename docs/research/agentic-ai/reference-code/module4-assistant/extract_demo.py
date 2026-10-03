"""Extract fields from messy text into a validated record, handling a malformed model reply."""
import json

from pydantic import BaseModel, Field, ValidationError


class Contact(BaseModel):
    name: str
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    wants_demo: bool


REPLIES = iter([
    '{"name": "John Smith", "email": "john at example dot com", "wants_demo": true}',   # wrong shape of value
    'Sure! Here is the JSON: {"name": "John Smith"',                                  # not JSON, cut off
    '{"name": "John Smith", "email": "john@example.com", "wants_demo": true}',         # good
])


def fake_model(prompt: str) -> str:
    return next(REPLIES)


def extract(text: str, max_attempts: int = 3) -> Contact:
    prompt = f"Extract name, email and wants_demo as JSON from: {text}"
    for attempt in range(1, max_attempts + 1):
        raw = fake_model(prompt)
        try:
            return Contact.model_validate_json(raw)
        except ValidationError as e:
            problem = e.errors()[0]
            print(f"attempt {attempt}: rejected ({problem['type']} at {'.'.join(map(str, problem['loc'])) or 'whole reply'})")
            prompt += f"\nYour last reply was invalid: {problem['msg']}. Reply with JSON only."
    raise ValueError("no valid reply after retries; send this one to a person")


print(extract("John Smith (john@example.com) wants a demo"))
