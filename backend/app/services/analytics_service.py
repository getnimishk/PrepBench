# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import List
from sqlalchemy.orm import Session
from app.repositories.analytics_repository import AnalyticsRepository
from app.repositories.settings_repository import SettingsRepository
from app.repositories.spaced_repetition_repository import SpacedRepetitionRepository
from app.schemas.analytics import DashboardOverview, TopicMasteryItem, DomainMasteryItem, ScoreTrendPoint
from app.core.timeutils import utc_now_naive, to_local_date, local_today, local_day_start_as_naive_utc
from datetime import timedelta

# What the dashboard shows if the settings row has not been created yet. Matches
# the column default on AppSettings, which is the source of truth for it.
FALLBACK_DAILY_GOAL = 20


class AnalyticsService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = AnalyticsRepository(db)
        self.settings_repo = SettingsRepository(db)
        self.sr_repo = SpacedRepetitionRepository(db)

    # Below this many attempts, an accuracy percentage is mostly noise (e.g. a
    # single miss reads as a permanent "0%") rather than a real pattern worth
    # calling out on the dashboard.
    MIN_ATTEMPTS_FOR_CALLOUT = 3

    # The score-trend chart plots one point per completed exam. Past a few
    # hundred the line is unreadable anyway, so cap the query rather than
    # loading every session a long-running database has ever accumulated.
    MAX_TREND_POINTS = 200

    def get_dashboard_overview(self) -> DashboardOverview:
        overall = self.repo.get_overall_stats()

        # The dashboard's "weak/strong" callout groups by topic-group (see
        # AnalyticsRepository.get_topic_group_performance), a mid-level
        # grouping recovered from the raw `topic` field's leading phrase. This
        # sits between the raw `topic` (near-unique per question -- too noisy)
        # and `domain` (a handful of very broad categories -- accurate but not
        # actionable, e.g. "Understanding and Applying the Scrum Framework"
        # covers ~300 questions). Also require a minimum sample size so a
        # single missed question doesn't get reported as a confident weakness.
        groups = self.repo.get_topic_group_performance()
        eligible = [g for g in groups if g["total_attempted"] >= self.MIN_ATTEMPTS_FOR_CALLOUT]
        sorted_groups = sorted(eligible, key=lambda x: x["accuracy_percentage"])
        weak = [TopicMasteryItem(**g) for g in sorted_groups if g["accuracy_percentage"] < 70][:5]
        strong = [TopicMasteryItem(**g) for g in sorted_groups if g["accuracy_percentage"] >= 70][-5:]

        # Recent exams
        recent_db = self.repo.get_recent_completed_sessions(limit=5)

        recent_exams = [
            {
                "id": s.id,
                "title": s.title,
                "score_percentage": s.score_percentage,
                "is_passed": s.is_passed,
                "date": s.end_time.strftime("%Y-%m-%d %H:%M") if s.end_time else "",
                "duration_minutes": round(s.time_spent_seconds / 60, 1)
            } for s in recent_db
        ]

        # Streak calculation & today practice count
        settings = self.settings_repo.get()
        daily_goal = settings.daily_practice_goal if settings else FALLBACK_DAILY_GOAL

        # Day boundaries come from the machine's local timezone, not UTC.
        # Timestamps are stored as naive UTC (correct), but asking "did I
        # practice today?" against a UTC calendar day is wrong for anyone not
        # on UTC: at +05:30 the UTC day doesn't roll over until 05:30 local, so
        # studying at 01:00 wouldn't count toward today and a streak would
        # break on a day the user actually practiced.
        today_local = local_today()
        today_answers = self.repo.count_practice_answers_since(
            local_day_start_as_naive_utc(today_local)
        )

        # Streak over local calendar dates. The conversion happens in Python
        # rather than via SQL date(), because that would extract the UTC date
        # and reintroduce the same off-by-one for non-UTC users -- so the
        # repository hands back raw timestamps and the calendar logic lives
        # here, where the timezone rule is stated.
        completed_end_times = self.repo.get_completed_exam_end_times()
        completed_dates = sorted({to_local_date(t) for t in completed_end_times}, reverse=True)

        streak = 0
        if completed_dates:
            check_date = today_local
            # Yesterday still counts as an unbroken streak -- today just isn't
            # over yet.
            if completed_dates[0] != check_date:
                check_date = today_local - timedelta(days=1)

            for completed_on in completed_dates:
                if completed_on == check_date:
                    streak += 1
                    check_date -= timedelta(days=1)
                elif completed_on < check_date:
                    break

        sr_due_count = self.sr_repo.count_due(utc_now_naive())

        return DashboardOverview(
            total_exams=overall["total_exams"],
            total_questions_attempted=overall["total_questions_attempted"],
            overall_accuracy_percentage=overall["overall_accuracy_percentage"],
            average_time_per_question_seconds=overall["average_time_per_question_seconds"],
            weak_topics=weak,
            strong_topics=strong,
            study_streak_days=max(streak, 1 if today_answers > 0 else 0),
            daily_goal=daily_goal,
            today_practiced_count=today_answers,
            spaced_repetition_due_count=sr_due_count,
            recent_exams=recent_exams
        )

    def get_score_trends(self) -> List[ScoreTrendPoint]:
        sessions = self.repo.get_recent_completed_sessions_chronological(
            limit=self.MAX_TREND_POINTS
        )

        points = []
        scores = []
        for s in sessions:
            if s.score_percentage is not None and s.end_time:
                scores.append(s.score_percentage)
                rolling = sum(scores[-5:]) / len(scores[-5:])
                points.append(ScoreTrendPoint(
                    date=s.end_time.strftime("%b %d"),
                    score=s.score_percentage,
                    rolling_avg=round(rolling, 1),
                    exam_title=s.title
                ))
        return points

    def get_domain_performance(self) -> List[DomainMasteryItem]:
        domains = self.repo.get_domain_performance()
        return [DomainMasteryItem(**d) for d in domains]
