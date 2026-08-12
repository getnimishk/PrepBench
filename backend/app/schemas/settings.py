from typing import Optional
from pydantic import BaseModel, ConfigDict

class AppSettingsSchema(BaseModel):
    theme: str = "light"
    timer_sound_enabled: bool = True
    default_exam_mode: str = "timed"
    default_questions_count: int = 80
    default_passing_percentage: float = 95.0
    shuffle_questions: bool = True
    shuffle_options: bool = True
    daily_practice_goal: int = 20
    default_target_role: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
