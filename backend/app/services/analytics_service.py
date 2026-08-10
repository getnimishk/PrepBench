from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.repositories.analytics_repository import AnalyticsRepository
from app.schemas.analytics import DashboardOverview, TopicMasteryItem, DomainMasteryItem, ScoreTrendPoint
from app.models.exam_session import ExamSession, ExamStatus
from app.models.exam_answer import ExamAnswer
from app.models.settings import AppSettings
from app.models.spaced_repetition import SpacedRepetition
from datetime import datetime, date, UTC

class AnalyticsService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = AnalyticsRepository(db)

    # Below this many attempts, an accuracy percentage is mostly noise (e.g. a
    # single miss reads as a permanent "0%") rather than a real pattern worth
    # calling out on the dashboard.
    MIN_ATTEMPTS_FOR_CALLOUT = 3

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
        recent_db = self.db.query(ExamSession)\
            .filter(ExamSession.status == ExamStatus.COMPLETED)\
            .order_by(ExamSession.end_time.desc())\
            .limit(5).all()
        
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
        settings = self.db.query(AppSettings).filter(AppSettings.id == 1).first()
        daily_goal = settings.daily_practice_goal if settings else 20

        today_utc = datetime.now(UTC).replace(tzinfo=None).date()
        today_answers = self.db.query(ExamAnswer)\
            .filter(ExamAnswer.answered_at >= datetime.combine(today_utc, datetime.min.time()))\
            .count()

        # Dynamic streak calculation based on completed exam dates
        completed_dates = [
            d[0] for d in self.db.query(func.date(ExamSession.end_time))
            .filter(ExamSession.status == ExamStatus.COMPLETED, ExamSession.end_time != None)
            .distinct().order_by(func.date(ExamSession.end_time).desc()).all()
        ]

        streak = 0
        if completed_dates:
            check_date = today_utc
            # If no exam completed today, check if active yesterday
            if completed_dates[0] != check_date.isoformat() and len(completed_dates) > 0:
                from datetime import timedelta
                check_date = today_utc - timedelta(days=1)

            for d_str in completed_dates:
                if d_str == check_date.isoformat():
                    streak += 1
                    from datetime import timedelta
                    check_date -= timedelta(days=1)
                else:
                    break

        now = datetime.now(UTC).replace(tzinfo=None)
        sr_due_count = self.db.query(func.count(SpacedRepetition.id))\
            .filter(SpacedRepetition.next_review_date <= now)\
            .scalar() or 0

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
        sessions = self.db.query(ExamSession)\
            .filter(ExamSession.status == ExamStatus.COMPLETED)\
            .order_by(ExamSession.end_time.asc()).all()

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
