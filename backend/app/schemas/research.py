from typing import Optional, List
from pydantic import BaseModel, Field

class DistractorAnalysis(BaseModel):
    option_letter: str
    option_text: str
    is_correct: bool
    critique: str
    suggested_option_text: Optional[str] = None

class QuestionResearchResponse(BaseModel):
    question_id: int
    scrum_guide_citation: str = Field(..., description="Relevant section from Scrum Guide 2020")
    accuracy_status: str = Field(..., description="Verification status e.g. compliant, needs_review")
    accuracy_explanation: str = Field(..., description="Detailed technical reasoning from Scrum Guide")
    distractor_analyses: List[DistractorAnalysis] = Field(default_factory=list)
    suggested_explanation: Optional[str] = None
    suggested_stem: Optional[str] = None
