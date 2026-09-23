// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import axios from 'axios';
import { connection } from './connection';
import { isUnreachable } from './apiError';
import { Question, QuestionDifficulty, QuestionType, QuestionOutcome, QuestionBankSummary } from '../types/question';
import { ExamSession, ExamDetail, ExamCreateRequest, SaveAnswerRequest, ExamPreview, MockHistoryItem } from '../types/exam';
import type { SpacedDeck, SpacedGrade, SpacedGradeResult } from '../types/spaced';
import type { WireLearningAttempt } from '../types/learning';
import { ScoreTrendPoint, DomainMasteryItem, DomainDetail } from '../types/analytics';
import { AppSettings } from '../types/settings';
import type { AboutReport, AppNotification, ReviewScheduleRules, StorageReport } from '../types/system';
import {
  LLMProfile,
  LLMProvider,
  LLMProviderCreate,
  LLMProviderUpdate,
  LLMVerifyResult,
  LLMTaskBinding,
  LLMModelList,
  DetectedRunner,
  SystemInfo,
  LocalModelOption,
  RunnerInfo,
  LauncherRequest,
  LauncherScript,
  CatalogRefreshResponse,
} from '../types/llm';
import {
  SystemDesignPrompt,
  GeneratePromptRequest,
  SubmitAttemptRequest,
  SystemDesignAttempt,
  SystemDesignAnalytics,
} from '../types/systemDesign';
import {
  DesignReviewSummary,
  DesignReviewDetail,
  DesignReviewAttempt,
  DesignReviewAnalytics,
  SubmitDesignReviewAttemptRequest,
} from '../types/designReview';
import {
  Subject,
  SubjectCreate,
  SubjectUpdate,
  SubjectDeleteResult,
  DailyGoals,
  HomeSummary,
  ActivityItem,
  FormatCoverage,
  OtherPreparation,
  FocusTopic,
} from '../types/subject';
import { CheckResult, ReviewCounts, ReviewQueue } from '../types/review';
import type { SearchResponse } from '../types/search';
import type { Profile, ProfileUpdate } from '../types/profile';
import { PracticeRecording, RecordingAnalysis, ProviderInfo, RecordingAnalytics } from '../types/recording';
import type {
  InterviewSession, InterviewSessionCreate, InterviewSessionReport, PlannedQuestion,
} from '../types/interviewSession';
import {
  InterviewQuestion,
  GenerateInterviewQuestionRequest,
  RoundTypeInfo,
  InterviewRoundType,
  InterviewQuestionUpdate,
  InterviewQuestionImportResult,
  ImportInterviewQuestionsRequest,
} from '../types/interviewQuestion';
import {
  RoadmapSummary,
  RoadmapDetail,
  RoadmapSchedule,
  RoadmapCreateRequest,
  RoadmapUpdateRequest,
  RoadmapPlanRequest,
  RoadmapTopic,
  RoadmapTopicUpdateRequest,
  RoadmapImportPreview,
  RoadmapImportConfirm,
  RoadmapImportResult,
  TopicDemonstration,
  TopicDemonstrationResult,
  DemonstrationGrade,
  TopicGuide,
  TopicGuideDraftResult,
  TopicGuideSection,
  TopicGuideSectionWrite,
} from '../types/roadmap';

const API_BASE = '/api/v1';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Every answer from the server says it is there; a request with no answer at
// all says it is not. See services/connection.
api.interceptors.response.use(
  (response) => {
    connection.report('online');
    return response;
  },
  (error) => {
    connection.report(isUnreachable(error) ? 'unreachable' : 'online');
    return Promise.reject(error);
  },
);

/** Whether the server answers now. Resolves either way; never throws. */
export const pingServer = async (): Promise<boolean> => {
  try {
    await api.get('/system/health', { timeout: 4000 });
    return true;
  } catch {
    return false;
  }
};

// Questions API
export const getQuestions = async (params?: {
  skip?: number;
  limit?: number;
  keyword?: string;
  domain?: string;
  topic?: string;
  certification?: string;
  /** Only this preparation's questions. Omit for the whole bank. */
  subject_id?: number;
  difficulty?: QuestionDifficulty;
  question_type?: QuestionType;
  is_reviewed?: boolean;
  outcome?: QuestionOutcome;
  /** Adds each question's evidence: answers, correct, missed, due. */
  include_evidence?: boolean;
}) => {
  const res = await api.get<{ items: Question[]; total: number; skip: number; limit: number }>(`/questions`, { params });
  return res.data;
};

export const getQuestionBankSummary = async (subjectId?: number | null) => {
  const res = await api.get<QuestionBankSummary>('/questions/summary', {
    params: subjectId ? { subject_id: subjectId } : undefined,
  });
  return res.data;
};

/** The values each question filter can take. Pass a preparation for its own. */
export const getQuestion = async (id: number) => {
  const res = await api.get<Question>(`/questions/${id}`);
  return res.data;
};

export const getQuestionFilters = async (subjectId?: number | null) => {
  const res = await api.get<{
    certifications: string[];
    domains: string[];
    topics: string[];
    difficulties: string[];
  }>(`/questions/filters`, { params: subjectId ? { subject_id: subjectId } : undefined });
  return res.data;
};


export const createQuestion = async (data: Partial<Question>) => {
  const res = await api.post<Question>(`/questions`, data);
  return res.data;
};

export const updateQuestion = async (id: number, data: Partial<Question>) => {
  const res = await api.put<Question>(`/questions/${id}`, data);
  return res.data;
};

export interface DistractorAnalysis {
  option_letter: string;
  option_text: string;
  is_correct: boolean;
  critique: string;
  suggested_option_text?: string;
}

export interface QuestionResearchResponse {
  question_id: number;
  scrum_guide_citation: string;
  accuracy_status: 'compliant' | 'needs_review';
  accuracy_explanation: string;
  distractor_analyses: DistractorAnalysis[];
  suggested_explanation?: string;
  suggested_stem?: string;
}

export const researchQuestion = async (id: number) => {
  const res = await api.post<QuestionResearchResponse>(`/questions/${id}/research`);
  return res.data;
};

export const deleteQuestion = async (id: number) => {
  await api.delete(`/questions/${id}`);
};

export const clearAllQuestions = async () => {
  const res = await api.delete<{ message: string; deleted_count: number }>(`/questions/clear-all`);
  return res.data;
};

export const bulkDeleteQuestions = async (ids: number[]) => {
  const res = await api.delete<{ message: string; deleted_count: number }>(`/questions/bulk`, {
    data: { ids },
  });
  return res.data;
};

// Exams API
export const startExam = async (req: ExamCreateRequest) => {
  const res = await api.post<ExamSession>(`/exams`, req);
  return res.data;
};

/** Due spaced-repetition cards, most overdue first. Pass the picked preparation. */
export const getSpacedDeck = async (subjectId?: number | null, limit?: number, domain?: string | null) => {
  const params: Record<string, number | string> = {};
  if (subjectId) params.subject_id = subjectId;
  if (limit) params.limit = limit;
  if (domain) params.domain = domain;
  const res = await api.get<SpacedDeck>('/spaced/deck', { params });
  return res.data;
};

/** How well a due card came back. Refused (409) if the card is no longer due. */
export const gradeSpacedCard = async (questionId: number, grade: SpacedGrade) => {
  const res = await api.post<SpacedGradeResult>('/spaced/grades', { question_id: questionId, grade });
  return res.data;
};

/** What `startExam(req)` would draw from, without starting it -- or the refusal. */
export const previewExam = async (req: ExamCreateRequest) => {
  const res = await api.post<ExamPreview>(`/exams/preview`, req);
  return res.data;
};


/** Throw away an unfinished session. A submitted one is refused (409). */
export const discardExam = async (sessionId: number) => {
  await api.delete(`/exams/${sessionId}`);
};

/** The mocks sat for a preparation, newest first. */
export const getMockHistory = async (subjectId: number, limit = 20) => {
  const res = await api.get<MockHistoryItem[]>(`/subjects/${subjectId}/mocks`, { params: { limit } });
  return res.data;
};

export const getExamDetails = async (sessionId: number) => {
  const res = await api.get<ExamDetail>(`/exams/${sessionId}`);
  return res.data;
};

export const saveExamAnswer = async (sessionId: number, req: SaveAnswerRequest) => {
  // A save with no answer after this long is treated like one that never
  // arrived: the runner keeps the answer and sends it again, which is safe
  // because the server replaces a question's answer rather than adding one.
  // Longer than the backend's 10s lock wait, so a busy database is not mistaken
  // for a missing server.
  const res = await api.post<ExamSession>(`/exams/${sessionId}/answer`, req, { timeout: 15000 });
  return res.data;
};

export const finishExam = async (sessionId: number) => {
  const res = await api.post<ExamDetail>(`/exams/${sessionId}/finish`);
  return res.data;
};

// Analytics API
// getDashboardOverview() was here. Home was its last caller, and Home no
// longer needs it: the weak-topic list it fetched was a second opinion from
// a different population than the readiness rule's, which is how two pages
// came to disagree about the same domain. The endpoint stays -- it is still
// the aggregate the analytics service exposes -- but nothing in the client
// asks for it.

/** Scored sessions over time. One preparation's when `subjectId` is given. */
export const getScoreTrends = async (subjectId?: number | null) => {
  const res = await api.get<ScoreTrendPoint[]>(`/analytics/score-trends`, {
    params: subjectId ? { subject_id: subjectId } : undefined,
  });
  return res.data;
};

/** Accuracy by area over every answer. One preparation's when `subjectId` is given. */
export const getDomainPerformance = async (subjectId?: number | null) => {
  const res = await api.get<DomainMasteryItem[]>(`/analytics/domain-performance`, {
    params: subjectId ? { subject_id: subjectId } : undefined,
  });
  return res.data;
};

/** One area of one preparation. 404 when the preparation has nothing in it. */
export const getDomainDetail = async (subjectId: number, domain: string) => {
  const res = await api.get<DomainDetail>(`/analytics/domain-detail`, {
    params: { subject_id: subjectId, domain },
  });
  return res.data;
};

// Imports API
export interface ValidationErrorItem {
  severity: 'error' | 'warning' | 'info';
  field: string;
  /** What is wrong. */
  message: string;
  /** What to do about it. */
  action?: string | null;
}

export interface ValidatedQuestionItem {
  index: number;
  /** The row in a CSV/Excel file, counting the header as row 1, so it matches
   *  what a spreadsheet shows. Null for formats with no rows. */
  source_row?: number | null;
  /** Null for a row that produced no question at all -- it is still reported,
   *  so a skipped row is seen rather than silently missing from the count. */
  question: Question | null;
  status: 'valid' | 'warning' | 'error';
  issues: ValidationErrorItem[];
}

export interface QuestionValidationReport {
  total_processed: number;
  valid_count: number;
  warning_count: number;
  error_count: number;
  items: ValidatedQuestionItem[];
}

export const validateImportFile = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post<QuestionValidationReport>(`/imports/validate`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data;
};

export const confirmImportBatch = async (questions: Question[]) => {
  // Explicit timeout: large batches can take a while, but the backend's own
  // busy_timeout (10s per lock wait) means a genuinely stuck request shouldn't
  // hang the UI forever with no feedback.
  const res = await api.post<{ success_count: number; failed_count: number; errors: string[] }>(
    `/imports/confirm`,
    questions,
    { timeout: 60000 }
  );
  return res.data;
};

export const autoRefineBatch = async (questions: Question[]) => {
  const res = await api.post<Question[]>(`/imports/auto-refine-batch`, questions);
  return res.data;
};



export const repairImportFile = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post(`/imports/repair`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    responseType: 'blob'
  });
  return res.data;
};

// Settings API
export const getSettings = async () => {
  const res = await api.get<AppSettings>(`/settings`);
  return res.data;
};

export const updateSettings = async (data: Partial<AppSettings>) => {
  const res = await api.put<AppSettings>(`/settings`, data);
  return res.data;
};

// ---- system: where the data is, and what this build does with it ----

export const getStorageReport = async () => {
  const res = await api.get<StorageReport>('/system/storage');
  return res.data;
};

/** Where the browser downloads a consistent copy of the database from. */
export const backupDownloadUrl = () => `${api.defaults.baseURL ?? ''}/system/backup`;

export const getAboutReport = async () => {
  const res = await api.get<AboutReport>('/system/about');
  return res.data;
};

export const getReviewScheduleRules = async () => {
  const res = await api.get<ReviewScheduleRules>('/system/review-schedule');
  return res.data;
};

/** Alerts derived from the evidence right now, filtered by the triggers turned on. */
export const getNotifications = async () => {
  const res = await api.get<{ items: AppNotification[] }>('/notifications');
  return res.data.items;
};

export const resetApplication = async () => {
  const res = await api.post<{ status: string; message: string }>(`/settings/reset-app`);
  return res.data;
};

// ---------------------------------------------------------------------------
// AI Providers (LLM) API
// ---------------------------------------------------------------------------
export const getLLMProfiles = async () => {
  const res = await api.get<LLMProfile[]>(`/llm/profiles`);
  return res.data;
};

export const getLLMProviders = async () => {
  const res = await api.get<LLMProvider[]>(`/llm/providers`);
  return res.data;
};

export const createLLMProvider = async (data: LLMProviderCreate) => {
  const res = await api.post<LLMProvider>(`/llm/providers`, data);
  return res.data;
};

export const updateLLMProvider = async (id: number, data: LLMProviderUpdate) => {
  const res = await api.patch<LLMProvider>(`/llm/providers/${id}`, data);
  return res.data;
};

export const deleteLLMProvider = async (id: number) => {
  const res = await api.delete<{ status: string; deleted_id: number }>(`/llm/providers/${id}`);
  return res.data;
};

export const verifyLLMProvider = async (id: number) => {
  const res = await api.post<LLMVerifyResult>(`/llm/providers/${id}/verify`);
  return res.data;
};

export const getLLMProviderModels = async (id: number) => {
  const res = await api.get<LLMModelList>(`/llm/providers/${id}/models`);
  return res.data;
};

export const getLLMTasks = async () => {
  const res = await api.get<LLMTaskBinding[]>(`/llm/tasks`);
  return res.data;
};

export const setLLMTaskBinding = async (
  task: string,
  data: { provider_id: number | null; model?: string | null }
) => {
  const res = await api.put<LLMTaskBinding>(`/llm/tasks/${task}`, data);
  return res.data;
};

export const detectLocalRunners = async () => {
  const res = await api.get<DetectedRunner[]>(`/llm/local/detect`);
  return res.data;
};

export const getSystemInfo = async () => {
  const res = await api.get<SystemInfo>(`/llm/system-info`);
  return res.data;
};

export const getLocalModelOptions = async (ramGb?: number) => {
  const res = await api.get<LocalModelOption[]>(`/llm/local/models`, {
    params: ramGb != null ? { ram_gb: ramGb } : undefined,
  });
  return res.data;
};

export const refreshLocalModels = async () => {
  const res = await api.post<CatalogRefreshResponse>(`/llm/local/models/refresh`);
  return res.data;
};

export const getLocalRunners = async () => {
  const res = await api.get<RunnerInfo[]>(`/llm/local/runners`);
  return res.data;
};

export const buildLauncherScript = async (data: LauncherRequest) => {
  const res = await api.post<LauncherScript>(`/llm/local/launcher`, data);
  return res.data;
};

// System Design API
export const getSystemDesignPrompts = async (params?: {
  skip?: number;
  limit?: number;
  category?: string;
  difficulty?: QuestionDifficulty;
  keyword?: string;
}) => {
  const res = await api.get<{ items: SystemDesignPrompt[]; total: number; skip: number; limit: number }>(
    `/system-design/prompts`,
    { params }
  );
  return res.data;
};

export const getSystemDesignPromptCategories = async () => {
  const res = await api.get<string[]>(`/system-design/prompts/categories`);
  return res.data;
};

export const getSystemDesignPrompt = async (id: number) => {
  const res = await api.get<SystemDesignPrompt>(`/system-design/prompts/${id}`);
  return res.data;
};

export const generateSystemDesignPrompt = async (req: GeneratePromptRequest) => {
  const res = await api.post<SystemDesignPrompt>(`/system-design/prompts/generate`, req, { timeout: 30000 });
  return res.data;
};

export const submitSystemDesignAttempt = async (req: SubmitAttemptRequest) => {
  // Real synchronous LLM grading call -- give it real headroom, matching the
  // reasoning behind confirmImportBatch's explicit timeout above.
  const res = await api.post<SystemDesignAttempt>(`/system-design/attempts`, req, { timeout: 30000 });
  return res.data;
};

export const getSystemDesignAttempt = async (id: number) => {
  const res = await api.get<SystemDesignAttempt>(`/system-design/attempts/${id}`);
  return res.data;
};

export const getSystemDesignAttempts = async (params?: { skip?: number; limit?: number }) => {
  const res = await api.get<{ items: SystemDesignAttempt[]; total: number; skip: number; limit: number }>(
    `/system-design/attempts`,
    { params }
  );
  return res.data;
};

export const getSystemDesignAnalytics = async () => {
  const res = await api.get<SystemDesignAnalytics>(`/system-design/analytics`);
  return res.data;
};

// Recordings API
export const uploadRecording = async (
  blob: Blob,
  title: string,
  durationSeconds: number,
  interviewQuestionId?: number,
  extra?: { sessionId?: number; planNote?: string },
) => {
  const formData = new FormData();
  formData.append('file', blob, 'recording.webm');
  formData.append('title', title);
  formData.append('duration_seconds', String(durationSeconds));
  if (interviewQuestionId !== undefined) {
    formData.append('interview_question_id', String(interviewQuestionId));
  }
  if (extra?.sessionId !== undefined) formData.append('session_id', String(extra.sessionId));
  if (extra?.planNote) formData.append('plan_note', extra.planNote);
  const res = await api.post<PracticeRecording>(`/recordings`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  });
  return res.data;
};

export const getRecordings = async (params?: { skip?: number; limit?: number; interview_question_id?: number }) => {
  const res = await api.get<{ items: PracticeRecording[]; skip: number; limit: number }>(`/recordings`, { params });
  return res.data;
};

export const getRecording = async (id: number) => {
  const res = await api.get<PracticeRecording>(`/recordings/${id}`);
  return res.data;
};

export const deleteRecording = async (id: number) => {
  const res = await api.delete<{ status: string; deleted_id: number }>(`/recordings/${id}`);
  return res.data;
};

export const getRecordingAudioUrl = (id: number) => `${API_BASE}/recordings/${id}/audio`;

export const getRecordingProviders = async () => {
  const res = await api.get<ProviderInfo[]>(`/recordings/providers`);
  return res.data;
};

export const analyzeRecording = async (id: number, provider?: string) => {
  // Real synchronous LLM audio-analysis call -- give it real headroom.
  const res = await api.post<RecordingAnalysis>(`/recordings/${id}/analyze`, { provider }, { timeout: 60000 });
  return res.data;
};

export const getRecordingAnalysis = async (id: number) => {
  const res = await api.get<RecordingAnalysis>(`/recordings/${id}/analysis`);
  return res.data;
};

export const getRecordingAnalytics = async () => {
  const res = await api.get<RecordingAnalytics>(`/recordings/analytics`);
  return res.data;
};

// Interview Questions API
export const getInterviewRoundTypes = async () => {
  const res = await api.get<RoundTypeInfo[]>(`/interview-questions/round-types`);
  return res.data;
};

export const getInterviewQuestionCategories = async (roundType?: InterviewRoundType) => {
  const res = await api.get<string[]>(`/interview-questions/categories`, { params: { round_type: roundType } });
  return res.data;
};

export const getInterviewQuestions = async (params?: {
  skip?: number;
  limit?: number;
  round_type?: InterviewRoundType;
  category?: string;
  keyword?: string;
}) => {
  const res = await api.get<{ items: InterviewQuestion[]; total: number; skip: number; limit: number }>(`/interview-questions`, { params });
  return res.data;
};

// ---- learning attempts: the Chart Sandbox's evidence ----

export const getLearningAttempts = async () => {
  const res = await api.get<WireLearningAttempt[]>('/learning/attempts');
  return res.data;
};

/** Open an attempt. Idempotent on attempt_uid: a retry returns the one that exists. */
export const startLearningAttempt = async (body: {
  attempt_uid: string; challenge_id: string; concept_id: string;
  scenario_fingerprint: string; mode: string; started_at?: string; hint_count: number;
}) => {
  const res = await api.post<WireLearningAttempt>('/learning/attempts', body);
  return res.data;
};

/** One transition at a time. A second prediction is refused by the server. */
export const patchLearningAttempt = async (attemptUid: string, body: Record<string, unknown>) => {
  const res = await api.patch<WireLearningAttempt>(`/learning/attempts/${encodeURIComponent(attemptUid)}`, body);
  return res.data;
};

// ---- interview sessions ----

/** The questions a session with these settings would ask, without starting it. */
export const planInterviewSession = async (params: {
  round_type: InterviewRoundType; category?: string; question_count: number;
}) => {
  const res = await api.get<PlannedQuestion[]>('/interview-sessions/plan', { params });
  return res.data;
};

export const createInterviewSession = async (body: InterviewSessionCreate) => {
  const res = await api.post<InterviewSession>('/interview-sessions', body);
  return res.data;
};

export const getInterviewSession = async (id: number) => {
  const res = await api.get<InterviewSession>(`/interview-sessions/${id}`);
  return res.data;
};

export const finishInterviewSession = async (id: number) => {
  const res = await api.post<InterviewSession>(`/interview-sessions/${id}/finish`);
  return res.data;
};

export const getInterviewSessionReport = async (id: number) => {
  const res = await api.get<InterviewSessionReport>(`/interview-sessions/${id}/report`);
  return res.data;
};

export const getInterviewQuestion = async (id: number) => {
  const res = await api.get<InterviewQuestion>(`/interview-questions/${id}`);
  return res.data;
};

export const generateInterviewQuestion = async (req: GenerateInterviewQuestionRequest) => {
  const res = await api.post<InterviewQuestion>(`/interview-questions/generate`, req, { timeout: 30000 });
  return res.data;
};

export const updateInterviewQuestion = async (id: number, data: InterviewQuestionUpdate) => {
  const res = await api.put<InterviewQuestion>(`/interview-questions/${id}`, data);
  return res.data;
};

export const deleteInterviewQuestion = async (id: number) => {
  const res = await api.delete<{ status: string; deleted_id: number }>(`/interview-questions/${id}`);
  return res.data;
};

export const importInterviewQuestions = async (req: ImportInterviewQuestionsRequest) => {
  const formData = new FormData();
  formData.append('default_round_type', req.defaultRoundType);
  if (req.defaultCategory) formData.append('default_category', req.defaultCategory);
  if (req.file) formData.append('file', req.file);
  if (req.text) formData.append('text', req.text);
  const res = await api.post<InterviewQuestionImportResult>(`/interview-questions/import`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  });
  return res.data;
};


// ------------------------------------------------------------- Roadmaps

export const getRoadmaps = async (includeArchived = false) => {
  const res = await api.get<RoadmapSummary[]>(`/roadmaps`, {
    params: { include_archived: includeArchived },
  });
  return res.data;
};

export const getRoadmap = async (roadmapId: number) => {
  const res = await api.get<RoadmapDetail>(`/roadmaps/${roadmapId}`);
  return res.data;
};

export const createRoadmap = async (data: RoadmapCreateRequest) => {
  const res = await api.post<RoadmapDetail>(`/roadmaps`, data);
  return res.data;
};

export const updateRoadmap = async (roadmapId: number, data: RoadmapUpdateRequest) => {
  const res = await api.put<RoadmapDetail>(`/roadmaps/${roadmapId}`, data);
  return res.data;
};

export const deleteRoadmap = async (roadmapId: number) => {
  await api.delete(`/roadmaps/${roadmapId}`);
};

export const getRoadmapSchedule = async (roadmapId: number) => {
  const res = await api.get<RoadmapSchedule>(`/roadmaps/${roadmapId}/schedule`);
  return res.data;
};

/**
 * The schedule a start date and weekly budget would give, without saving them.
 *
 * The plan editor's preview. The server projects it with the same calculation as
 * the saved schedule, so what the editor promises is what the roadmap then says.
 * A null value counts as not set.
 */
export const getDraftRoadmapSchedule = async (
  roadmapId: number,
  draft: { start_date: string | null; weekly_hours_budget: number | null },
) => {
  const params: Record<string, string | number | boolean> = { draft: true };
  if (draft.start_date) params.start_date = draft.start_date;
  if (draft.weekly_hours_budget != null) params.weekly_hours_budget = draft.weekly_hours_budget;
  const res = await api.get<RoadmapSchedule>(`/roadmaps/${roadmapId}/schedule`, { params });
  return res.data;
};

/** Title, budget, start date and phases in one write, or none of it. */
export const saveRoadmapPlan = async (roadmapId: number, plan: RoadmapPlanRequest) => {
  const res = await api.put<RoadmapDetail>(`/roadmaps/${roadmapId}/plan`, plan);
  return res.data;
};




// PATCH, not PUT -- callers send one field (usually just `status`), and a
// full-representation contract would make them round-trip the whole topic and
// risk clobbering evidence_notes.
/** Every demonstration of a topic, newest first. */
export const getTopicDemonstrations = async (roadmapId: number, topicId: number) => {
  const res = await api.get<TopicDemonstration[]>(
    `/roadmaps/${roadmapId}/topics/${topicId}/demonstrations`,
  );
  return res.data;
};

/**
 * Demonstrate a topic against its success criterion -- the only way a topic
 * becomes completed. "yes" completes it; "partial" and "not_yet" leave it in
 * progress, and "not_yet" on a completed topic moves it back.
 */
export const demonstrateTopic = async (
  roadmapId: number,
  topicId: number,
  responseText: string,
  selfGrade: DemonstrationGrade,
) => {
  const res = await api.post<TopicDemonstrationResult>(
    `/roadmaps/${roadmapId}/topics/${topicId}/demonstrations`,
    { response_text: responseText, self_grade: selfGrade },
  );
  return res.data;
};

const guideBase = (roadmapId: number, topicId: number) =>
  `/roadmaps/${roadmapId}/topics/${topicId}/guide`;

export const getTopicGuide = async (roadmapId: number, topicId: number) =>
  (await api.get<TopicGuide>(guideBase(roadmapId, topicId))).data;

/** Ask the configured AI to draft sections. Never throws for "no AI" or an
 *  unusable answer -- those come back as a status, with nothing saved. The AI
 *  call can take a while, so the timeout is generous. */
export const draftTopicGuide = async (roadmapId: number, topicId: number) =>
  (await api.post<TopicGuideDraftResult>(`${guideBase(roadmapId, topicId)}/draft`, undefined, { timeout: 120000 })).data;

export const addTopicGuideSection = async (roadmapId: number, topicId: number, data: TopicGuideSectionWrite) =>
  (await api.post<TopicGuideSection>(`${guideBase(roadmapId, topicId)}/sections`, data)).data;

export const updateTopicGuideSection = async (
  roadmapId: number, topicId: number, sectionId: number, data: TopicGuideSectionWrite,
) => (await api.put<TopicGuideSection>(`${guideBase(roadmapId, topicId)}/sections/${sectionId}`, data)).data;

export const deleteTopicGuideSection = async (roadmapId: number, topicId: number, sectionId: number) => {
  await api.delete(`${guideBase(roadmapId, topicId)}/sections/${sectionId}`);
};

export const setTopicGuideSectionRead = async (
  roadmapId: number, topicId: number, sectionId: number, read: boolean,
) => (await api.put<TopicGuideSection>(
  `${guideBase(roadmapId, topicId)}/sections/${sectionId}/read`, undefined, { params: { read } },
)).data;

export const updateRoadmapTopic = async (
  roadmapId: number,
  topicId: number,
  data: RoadmapTopicUpdateRequest
) => {
  const res = await api.patch<RoadmapTopic>(`/roadmaps/${roadmapId}/topics/${topicId}`, data);
  return res.data;
};


export const validateRoadmapImport = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post<RoadmapImportPreview>(`/roadmaps/import/validate`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  });
  return res.data;
};

export const confirmRoadmapImport = async (data: RoadmapImportConfirm) => {
  const res = await api.post<RoadmapImportResult>(`/roadmaps/import/confirm`, data, {
    timeout: 30000,
  });
  return res.data;
};

// ==================== Design Review ====================

export const getDesignReviews = async (params?: {
  skip?: number;
  limit?: number;
  domain?: string;
  axis_label?: string;
  difficulty?: QuestionDifficulty;
  keyword?: string;
}) => {
  const res = await api.get<{ items: DesignReviewSummary[]; total: number }>(
    '/design-reviews',
    { params }
  );
  return res.data;
};

export const getDesignReview = async (reviewId: number) => {
  const res = await api.get<DesignReviewDetail>(`/design-reviews/${reviewId}`);
  return res.data;
};

export const getDesignReviewDomains = async () => {
  const res = await api.get<string[]>('/design-reviews/domains');
  return res.data;
};

export const getDesignReviewAxes = async () => {
  const res = await api.get<string[]>('/design-reviews/axes');
  return res.data;
};

export const getDesignReviewAnalytics = async () => {
  const res = await api.get<DesignReviewAnalytics>('/design-reviews/analytics');
  return res.data;
};

export const submitDesignReviewAttempt = async (
  req: SubmitDesignReviewAttemptRequest
) => {
  const res = await api.post<DesignReviewAttempt>('/design-reviews/attempts', req);
  return res.data;
};

/** Seek a verdict for an attempt committed without one. Refused (409) once it has one. */
export const regradeDesignReviewAttempt = async (attemptId: number) => {
  const res = await api.post<DesignReviewAttempt>(`/design-reviews/attempts/${attemptId}/grade`, undefined, { timeout: 60000 });
  return res.data;
};

export const getLatestDesignReviewAttempt = async (reviewId: number) => {
  const res = await api.get<DesignReviewAttempt | null>(
    `/design-reviews/${reviewId}/latest-attempt`
  );
  return res.data;
};

// ==================== Subjects, Home, Readiness ====================

export const getSubjects = async (options?: { includeArchived?: boolean }) => {
  // The server includes archived preparations by default, and that default is
  // relied on: Home, the Practice hub, Analytics, Exam Setup and the subject page
  // all call this with no arguments. Only the picker asks to hide them.
  const params =
    options?.includeArchived === undefined
      ? undefined
      : { include_archived: options.includeArchived };
  const res = await api.get<Subject[]>('/subjects', { params });
  return res.data;
};

export const getSubject = async (subjectId: number) => {
  const res = await api.get<Subject>(`/subjects/${subjectId}`);
  return res.data;
};

export const createSubject = async (data: SubjectCreate) => {
  const res = await api.post<Subject>('/subjects', data);
  return res.data;
};

export const updateSubject = async (subjectId: number, data: SubjectUpdate) => {
  const res = await api.put<Subject>(`/subjects/${subjectId}`, data);
  return res.data;
};

/** Hide from the picker, keep everything. The reversible half of the danger zone. */
export const archiveSubject = async (subjectId: number, archived: boolean) =>
  updateSubject(subjectId, { is_archived: archived });

/**
 * Destroy a preparation, its questions and its exam evidence.
 *
 * `confirmName` must equal the preparation's name exactly -- a mismatch deletes
 * nothing and throws. Irreversible, and the app has no backup mechanism, so the
 * caller must have collected the typed name before calling this.
 *
 * The result reports what was destroyed and what was merely unlinked, so the
 * surface can state the outcome rather than repeat the warning.
 */
export const deleteSubject = async (subjectId: number, confirmName: string) => {
  const res = await api.delete<SubjectDeleteResult>(`/subjects/${subjectId}`, {
    data: { confirm_name: confirmName },
  });
  return res.data;
};

export const getHomeSummary = async () => {
  const res = await api.get<HomeSummary>('/home');
  return res.data;
};

/** The timeline. With a preparation, only that preparation's exam sessions. */
export const getActivity = async (limit = 40, subjectId?: number | null) => {
  const res = await api.get<ActivityItem[]>('/home/activity', {
    params: subjectId ? { limit, subject_id: subjectId } : { limit },
  });
  return res.data;
};

export const getOtherPreparation = async () => {
  const res = await api.get<OtherPreparation[]>('/home/other-preparation');
  return res.data;
};

/** The two standing daily goals. Pass the selected preparation for its
 *  certification goal; without one, `certification` comes back null. */
export const getDailyGoals = async (subjectId?: number | null) => {
  const res = await api.get<DailyGoals>('/home/daily-goals', {
    params: subjectId ? { subject_id: subjectId } : undefined,
  });
  return res.data;
};

/**
 * The weak topics, worst first, with the counts behind them.
 *
 * Same query as the weak-topic drill, so the list Home shows and the
 * questions Practice draws can never disagree. Pass the preparation the list is
 * shown under: topic names repeat across banks.
 */
export const getFocusTopics = async (subjectId?: number | null) => {
  const res = await api.get<FocusTopic[]>('/home/focus-topics', {
    params: subjectId ? { subject_id: subjectId } : undefined,
  });
  return res.data;
};

/**
 * Today's review: the newest unreviewed misses, with their explanations.
 *
 * No limit is sent. The server sizes the queue from the daily review cap in
 * Settings; a fixed 20 here used to make any cap above 20 do nothing.
 */
/** How much review is waiting, without building the queue. */
export const getReviewCounts = async (subjectId?: number | null) => {
  const res = await api.get<ReviewCounts>('/review/counts', {
    params: subjectId ? { subject_id: subjectId } : undefined,
  });
  return res.data;
};

export const getReviewQueue = async (subjectId?: number | null) => {
  const res = await api.get<ReviewQueue>('/review/queue', {
    params: subjectId ? { subject_id: subjectId } : undefined,
  });
  return res.data;
};

/**
 * Answer the check, and find out whether the explanation landed.
 *
 * Also marks the miss read: reaching the check means the explanation was
 * worked through, which is a stronger claim than the old one -- that the page
 * had been open.
 */
export const submitReviewCheck = async (body: {
  answer_id: number;
  question_id: number;
  selected_option_ids: number[];
  confidence_level?: 'low' | 'medium' | 'high' | 'not_set';
}) => {
  const res = await api.post<CheckResult>('/review/checks', {
    confidence_level: 'not_set',
    ...body,
  });
  return res.data;
};

export interface SystemDesignAttemptHistoryItem {
  attempt_id: number;
  created_at: string;
  grading_status: string;
  overall_score: number | null;
  /** Only between two graded attempts. Absent where a comparison would be invented. */
  change_vs_previous: number | null;
}

/** Every attempt at one prompt, so "am I improving at this" has an answer. */
export const getSystemDesignPromptAttempts = async (promptId: number) => {
  const res = await api.get<{
    prompt_id: number;
    prompt_title: string;
    items: SystemDesignAttemptHistoryItem[];
    graded_count: number;
  }>(`/system-design/prompts/${promptId}/attempts`);
  return res.data;
};

/** What is saved for this design prompt, or the last answer submitted for it. */
export const getSystemDesignDraft = async (promptId: number) => {
  const res = await api.get<{
    prompt_id: number;
    answer_text: string;
    sections?: Record<string, string> | null;
    target_role?: string | null;
    updated_at?: string | null;
    exists: boolean;
  }>(`/system-design/prompts/${promptId}/draft`);
  return res.data;
};

/** Keep what is in the box. */
export const saveSystemDesignDraft = async (
  promptId: number,
  body: { answer_text?: string; sections?: Record<string, string>; target_role?: string | null }
) => {
  const res = await api.put(`/system-design/prompts/${promptId}/draft`, body);
  return res.data;
};

/** Grade an attempt that was saved without a grade. Refused (409) once graded. */
export const regradeSystemDesignAttempt = async (attemptId: number) => {
  const res = await api.post<SystemDesignAttempt>(`/system-design/attempts/${attemptId}/grade`, undefined, { timeout: 60000 });
  return res.data;
};

export const getSubjectCoverage = async (subjectId: number) => {
  const res = await api.get<FormatCoverage[]>(`/home/subjects/${subjectId}/coverage`);
  return res.data;
};

export const getUnreviewedAnswers = async (sessionId: number) => {
  const res = await api.get<{ session_id: number; count: number; question_ids: number[] }>(
    `/exams/${sessionId}/unreviewed`
  );
  return res.data;
};

export const markAnswerReviewed = async (sessionId: number, questionId: number) => {
  const res = await api.post(`/exams/${sessionId}/answers/${questionId}/reviewed`);
  return res.data;
};

// ------------------------------------------------------------- Search

/**
 * Questions, study guide sections, roadmaps, topics and recordings matching
 * `query`. Scoped to the preparation when one is given; recordings belong to no
 * preparation and come from all of them.
 */
export const searchEverything = async (query: string, subjectId?: number | null, limit = 6) => {
  const params: Record<string, string | number> = { q: query, limit };
  if (subjectId) params.subject_id = subjectId;
  const res = await api.get<SearchResponse>('/search', { params });
  return res.data;
};

// ------------------------------------------------------------- Profile

export const getProfile = async () => {
  const res = await api.get<Profile>('/profile');
  return res.data;
};

export const updateProfile = async (update: ProfileUpdate) => {
  const res = await api.put<Profile>('/profile', update);
  return res.data;
};
