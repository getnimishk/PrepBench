# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from sqlalchemy import Column, Integer, String, Float, Boolean
from app.core.database import Base

class AppSettings(Base):
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, default=1)
    theme = Column(String(20), default="light") # dark, light, system
    timer_sound_enabled = Column(Boolean, default=True)
    # Six columns stood here and every one of them was a control whose only
    # effect was to be saved:
    #
    #   shuffle_options          the engine never applied it
    #   daily_practice_goal      went with the streak and the goal ring
    #   default_exam_mode        nothing read it
    #   default_questions_count  nothing read it
    #   default_passing_percentage  nothing read it; worse, the value it did
    #                            hold (95%) was stamped onto six real papers
    #                            and made an 87.5% pass look like a failure
    #   shuffle_questions        nothing read it
    #
    # They are dropped from existing databases by the migration rather than
    # left as furniture. A mock takes its shape from the subject's exam
    # profile because the real exam does not let you choose; a drill takes
    # its shape from the screen you start it on.
    initial_seed_completed = Column(Boolean, default=False)
    default_target_role = Column(String(200), nullable=True)
