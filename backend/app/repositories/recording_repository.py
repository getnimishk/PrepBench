# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.models.practice_recording import PracticeRecording
from app.models.recording_analysis import RecordingAnalysis


class PracticeRecordingRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        title: str,
        file_path: str,
        mime_type: str,
        duration_seconds: Optional[int],
        file_size_bytes: int,
        interview_question_id: Optional[int] = None,
    ) -> PracticeRecording:
        obj = PracticeRecording(
            title=title,
            file_path=file_path,
            mime_type=mime_type,
            duration_seconds=duration_seconds,
            file_size_bytes=file_size_bytes,
            interview_question_id=interview_question_id,
        )
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def get_by_id(self, recording_id: int) -> Optional[PracticeRecording]:
        return self.db.query(PracticeRecording).filter(PracticeRecording.id == recording_id).first()

    def get_all(self, skip: int = 0, limit: int = 100) -> List[PracticeRecording]:
        return (
            self.db.query(PracticeRecording)
            .order_by(PracticeRecording.id.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def delete(self, recording_id: int) -> Optional[PracticeRecording]:
        obj = self.get_by_id(recording_id)
        if not obj:
            return None
        self.db.delete(obj)
        self.db.commit()
        return obj

    def count(self) -> int:
        return self.db.query(func.count(PracticeRecording.id)).scalar() or 0


class RecordingAnalysisRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_recording_id(self, recording_id: int) -> Optional[RecordingAnalysis]:
        return self.db.query(RecordingAnalysis).filter(RecordingAnalysis.recording_id == recording_id).first()

    def upsert(self, recording_id: int, **fields) -> RecordingAnalysis:
        existing = self.get_by_recording_id(recording_id)
        if existing:
            for k, v in fields.items():
                setattr(existing, k, v)
            self.db.commit()
            self.db.refresh(existing)
            return existing

        obj = RecordingAnalysis(recording_id=recording_id, **fields)
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def get_all_analyzed_ordered_by_date(self) -> List[RecordingAnalysis]:
        """Chronological (oldest-first) list of successfully-analyzed
        recordings, with the recording (and its interview_question, for
        round_type) eager-loaded for analytics aggregation."""
        return (
            self.db.query(RecordingAnalysis)
            .join(PracticeRecording, RecordingAnalysis.recording_id == PracticeRecording.id)
            .options(
                joinedload(RecordingAnalysis.recording).joinedload(PracticeRecording.interview_question)
            )
            .filter(RecordingAnalysis.analysis_status == "analyzed")
            .order_by(RecordingAnalysis.created_at.asc())
            .all()
        )
