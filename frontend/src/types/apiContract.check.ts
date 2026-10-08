// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

/**
 * The API's real response shapes against the types the screens are written to.
 *
 * The frontend's types are written by hand; the backend's shapes are its
 * Pydantic schemas, exported to docs/api/openapi.json (which a backend test
 * keeps current) and generated into ./generated/api.ts (`npm run types:api`).
 * Nothing used to compare the two, so a field renamed or retyped on one side
 * failed at runtime -- a blank cell, an `undefined` on screen -- not here.
 *
 * Each line below is checked by `npm run typecheck` (and so by CI): it compiles
 * only if the API's shape fits the declared type -- every field a screen reads
 * is sent, with a type the screen can handle. A mismatch fails naming the type
 * and the field. Never executed; nothing imports this file.
 */

import type { components } from './generated/api';
import type { DomainDetail, DomainMasteryItem, ScoreTrendPoint } from './analytics';
import type { ContentPackDetail, ContentPackSummary } from './contentPack';
import type { DesignReviewAnalytics, DesignReviewAttempt, DesignReviewDetail, DesignReviewReveal } from './designReview';
import type { DomainPlanItem, ExamAnswer, ExamDetail, ExamPreview, ExamSession, MockHistoryItem } from './exam';
import type { InterviewQuestion } from './interviewQuestion';
import type { InterviewSession, InterviewSessionReport } from './interviewSession';
import type {
  EngineStatus, JournalEntry, LabOperationResult, LabPackDetail, LabPackSummary, LabResetResult, SourceIndexRow,
} from './lakehouse';
import type { LLMProvider, LLMTaskBinding, SystemInfo } from './llm';
import type { Profile } from './profile';
import type { Question, QuestionBankSummary, QuestionOption } from './question';
import type { PracticeRecording, RecordingAnalysis, RecordingAnalytics } from './recording';
import type { CheckResult, ReviewCounts, ReviewItem, ReviewQueue } from './review';
import type {
  RoadmapDetail, RoadmapPhase, RoadmapProgress, RoadmapResource, RoadmapSchedule, RoadmapSummary, RoadmapTopic,
  CourseLessonRelabelPreview, CourseLessonRelabelResult, TopicDemonstration, TopicDemonstrationResult, TopicGuide,
  TopicGuideSection, TopicTitleRepairPreview, TopicTitleRepairResult,
} from './roadmap';
import type { Role, RoleSummary } from './role';
import type { SearchResponse } from './search';
import type { EvidenceItem, EvidenceResponse, WorkspaceItem, WorkspaceResponse } from './portfolio';
import type { Readiness, Subject, SubjectContentPack } from './subject';

type Schemas = components['schemas'];

/**
 * A response as FastAPI actually sends it: every field present, `null` when
 * unset. Pydantic marks a field with a default (`Optional[str] = None`) as not
 * required, so the generator types it `field?: string | null`; but no response
 * excludes unset or None fields (exclude_unset is used only to apply updates),
 * so the field is always there. Without this every such field would read as
 * drift.
 */
type Sent<T> = T extends readonly (infer E)[]
  ? Sent<E>[]
  : T extends object
    ? { [K in keyof T]-?: Sent<Exclude<T[K], undefined>> }
    : T;

declare function api<N extends keyof Schemas>(name: N): Sent<Schemas[N]>;

/**
 * The declared type with its string unions widened to `string`. Where a screen
 * narrows a value to a set ('ai' | 'learner', a readiness state, a round type)
 * the backend's schema declares a plain `str`, so the API promises no set to
 * check against; comparing them would flag every such field. What is still
 * checked: every field a screen reads is sent, with the right kind of value,
 * and null where the screen says it can be. (Declaring those as Literal in the
 * backend would let this check the values too.)
 */
type Widen<T> = T extends string
  ? string
  : T extends readonly (infer E)[]
    ? Widen<E>[]
    : T extends object
      ? { [K in keyof T]: Widen<T[K]> }
      : T;

/** Compiles only when the API's response (the argument) fits the declared type. */
function fits<Declared>(response: Widen<Declared>): void { void response; }

export function apiContract(): void {
  fits<Subject>(api('SubjectWithReadiness'));
  fits<SubjectContentPack>(api('SubjectContentPackResponse'));
  fits<Readiness>(api('ReadinessResponse'));

  fits<Question>(api('QuestionResponse'));
  fits<QuestionOption>(api('QuestionOptionResponse'));
  fits<QuestionBankSummary>(api('QuestionBankSummary'));

  fits<ExamSession>(api('ExamSessionResponse'));
  fits<ExamDetail>(api('ExamDetailResponse'));
  fits<ExamAnswer>(api('ExamAnswerResponse'));
  fits<ExamPreview>(api('ExamPreviewResponse'));
  fits<MockHistoryItem>(api('MockHistoryItem'));
  fits<DomainPlanItem>(api('DomainPlanItem'));

  fits<RoadmapSummary>(api('RoadmapSummaryResponse'));
  fits<RoadmapDetail>(api('RoadmapDetailResponse'));
  fits<RoadmapPhase>(api('RoadmapPhaseResponse'));
  fits<RoadmapTopic>(api('RoadmapTopicResponse'));
  fits<RoadmapResource>(api('RoadmapResourceResponse'));
  fits<RoadmapSchedule>(api('RoadmapSchedule'));
  fits<RoadmapProgress>(api('RoadmapProgress'));
  fits<TopicGuide>(api('TopicGuideResponse'));
  fits<TopicGuideSection>(api('TopicGuideSectionResponse'));
  fits<TopicDemonstration>(api('TopicDemonstrationResponse'));
  fits<TopicDemonstrationResult>(api('TopicDemonstrationResult'));
  // Phase 7: the learner-triggered curriculum repairs.
  fits<TopicTitleRepairPreview>(api('TopicTitleRepairPreview'));
  fits<TopicTitleRepairResult>(api('TopicTitleRepairResult'));
  fits<CourseLessonRelabelPreview>(api('CourseLessonRelabelPreview'));
  fits<CourseLessonRelabelResult>(api('CourseLessonRelabelResult'));

  fits<ReviewQueue>(api('ReviewQueue'));
  fits<ReviewItem>(api('ReviewItem'));
  fits<ReviewCounts>(api('ReviewCounts'));
  fits<CheckResult>(api('CheckResult'));

  fits<SearchResponse>(api('SearchResponse'));

  fits<Role>(api('RoleResponse'));
  fits<RoleSummary>(api('RoleSummary'));

  fits<InterviewQuestion>(api('InterviewQuestionResponse'));
  fits<InterviewSession>(api('InterviewSessionResponse'));
  fits<InterviewSessionReport>(api('InterviewSessionReport'));
  fits<PracticeRecording>(api('PracticeRecordingResponse'));
  fits<RecordingAnalysis>(api('RecordingAnalysisResponse'));
  fits<RecordingAnalytics>(api('RecordingAnalytics'));

  fits<DesignReviewDetail>(api('DesignReviewDetail'));
  fits<DesignReviewAnalytics>(api('DesignReviewAnalytics'));
  fits<DesignReviewReveal>(api('DesignReviewReveal'));
  fits<DesignReviewAttempt>(api('DesignReviewAttemptResponse'));

  fits<ContentPackSummary>(api('ContentPackSummary'));
  // A scenario's `content` (inside scenario_levels) is an untyped dict on the
  // backend: the API promises no shape to compare the screen's ScenarioContent
  // with, so the levels are left out here rather than reported as drift.
  fits<Omit<ContentPackDetail, 'scenario_levels'>>(api('ContentPackDetail'));
  fits<DomainMasteryItem>(api('DomainMasteryItem'));
  fits<DomainDetail>(api('DomainDetail'));
  fits<ScoreTrendPoint>(api('ScoreTrendPoint'));

  fits<EngineStatus>(api('EngineStatus'));
  fits<LabPackSummary>(api('LabPackSummary'));
  fits<LabPackDetail>(api('LabPackDetail'));
  fits<LabOperationResult>(api('LabOperationResult'));
  fits<LabResetResult>(api('LabResetResult'));
  fits<JournalEntry>(api('JournalEntry'));
  fits<SourceIndexRow>(api('SourceIndexRow'));

  fits<Profile>(api('ProfileResponse'));
  fits<LLMProvider>(api('ProviderResponse'));
  fits<LLMTaskBinding>(api('TaskBindingInfo'));
  fits<SystemInfo>(api('SystemInfo'));

  fits<WorkspaceItem>(api('WorkspaceItem'));
  fits<WorkspaceResponse>(api('WorkspaceResponse'));
  fits<EvidenceItem>(api('EvidenceItem'));
  fits<EvidenceResponse>(api('EvidenceResponse'));
}
