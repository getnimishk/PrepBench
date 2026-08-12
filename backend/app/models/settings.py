from sqlalchemy import Column, Integer, String, Float, Boolean
from app.core.database import Base

class AppSettings(Base):
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, default=1)
    theme = Column(String(20), default="light") # dark, light, system
    timer_sound_enabled = Column(Boolean, default=True)
    default_exam_mode = Column(String(50), default="timed")
    default_questions_count = Column(Integer, default=80)
    default_passing_percentage = Column(Float, default=95.0)
    shuffle_questions = Column(Boolean, default=True)
    shuffle_options = Column(Boolean, default=True)
    daily_practice_goal = Column(Integer, default=20)
    initial_seed_completed = Column(Boolean, default=False)
    default_target_role = Column(String(200), nullable=True)
