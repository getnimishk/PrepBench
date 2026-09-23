# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from sqlalchemy import Column, Integer, String, Float, Boolean, JSON
from app.core.database import Base

class AppSettings(Base):
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, default=1)
    theme = Column(String(20), default="light") # light, dark, or system (follows the OS)
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
    # The most due reviews a single day's goal will ask for.
    #
    # Not `daily_practice_goal` returning: that one is in the dead list above and
    # stays there, because nothing ever read it. This one is read on every Home
    # visit by HomeService.daily_goals and bounds GET /review/queue, so changing
    # it changes what the learner is asked to do.
    #
    # It is also a different idea. The dropped column went with a streak and a
    # goal ring. This is a ceiling on a queue the schedule already decided: the
    # day's goal is min(cap, what is actually due), so it can make a day smaller
    # but can never invent work to fill a quota.
    #
    # 20, not the prototype's 40, because 20 is the value the review queue was
    # already built around and it came with a reason: twenty wrong answers read
    # properly is a real evening, and past that people stop reading and start
    # clicking.
    review_daily_cap = Column(Integer, nullable=False, default=20, server_default="20")

    # Display preferences. Visual only: nothing here changes what is measured
    # or recommended. `standard` / `large`, and `system` (follow the OS) /
    # `always`.
    text_size = Column(String(10), nullable=False, default="standard", server_default="standard")
    reduce_motion = Column(String(10), nullable=False, default="system", server_default="system")

    # Keyboard shortcuts in the exam runner and spaced review. Off for anyone
    # whose screen reader or browser extensions want those keys.
    shortcuts_enabled = Column(Boolean, nullable=False, default=True, server_default="1")

    # Which derived notifications are shown, as {trigger: on}. A trigger missing
    # from the map takes its default (schemas/settings.NOTIFICATION_TRIGGERS),
    # so one added later is not silently off for everyone who saved their
    # preferences before it existed.
    notification_triggers = Column(JSON, nullable=True)

    # Who is using this copy, for the profile and the avatar in the header.
    #
    # There is no account: PrepBench runs on one machine for one person, nothing
    # signs in and nothing is sent anywhere. These are what the profile shows and
    # what the header's initials are drawn from, and nothing else reads them.
    # NULL until the learner writes one -- no name is invented for them.
    display_name = Column(String(100), nullable=True)
    email = Column(String(254), nullable=True)
