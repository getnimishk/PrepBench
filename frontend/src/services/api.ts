import axios from 'axios';
import { Question, QuestionType, QuestionDifficulty } from '../types/question';
import { ExamSession, ExamDetail, ExamCreateRequest, SaveAnswerRequest } from '../types/exam';
import { DashboardOverview, ScoreTrendPoint, DomainMasteryItem } from '../types/analytics';
import { AppSettings } from '../types/settings';

const API_BASE = '/api/v1';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Questions API
export const getQuestions = async (params?: {
  skip?: number;
  limit?: number;
  keyword?: string;
  domain?: string;
  topic?: string;
  certification?: string;
  difficulty?: QuestionDifficulty;
  is_reviewed?: boolean;
}) => {
  const res = await api.get<{ items: Question[]; total: number; skip: number; limit: number }>(`/questions`, { params });
  return res.data;
};

export const getQuestionFilters = async () => {
  const res = await api.get<{
    certifications: string[];
    domains: string[];
    topics: string[];
    difficulties: string[];
  }>(`/questions/filters`);
  return res.data;
};

export const getQuestion = async (id: number) => {
  const res = await api.get<Question>(`/questions/${id}`);
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

export const getExamList = async () => {
  const res = await api.get<ExamSession[]>(`/exams`);
  return res.data;
};

export const getExamDetails = async (sessionId: number) => {
  const res = await api.get<ExamDetail>(`/exams/${sessionId}`);
  return res.data;
};

export const saveExamAnswer = async (sessionId: number, req: SaveAnswerRequest) => {
  const res = await api.post<ExamSession>(`/exams/${sessionId}/answer`, req);
  return res.data;
};

export const finishExam = async (sessionId: number) => {
  const res = await api.post<ExamDetail>(`/exams/${sessionId}/finish`);
  return res.data;
};

// Analytics API
export const getDashboardOverview = async () => {
  const res = await api.get<DashboardOverview>(`/analytics/dashboard`);
  return res.data;
};

export const getScoreTrends = async () => {
  const res = await api.get<ScoreTrendPoint[]>(`/analytics/score-trends`);
  return res.data;
};

export const getDomainPerformance = async () => {
  const res = await api.get<DomainMasteryItem[]>(`/analytics/domain-performance`);
  return res.data;
};

// Imports API
export interface ValidationErrorItem {
  severity: 'error' | 'warning' | 'info';
  field: string;
  message: string;
}

export interface ValidatedQuestionItem {
  index: number;
  question: Question;
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

export const batchResearch = async (questions: Question[]) => {
  const res = await api.post<QuestionResearchResponse[]>(`/imports/batch-research`, questions);
  return res.data;
};

export const importFile = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post(`/imports/file`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
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

export const resetApplication = async () => {
  const res = await api.post<{ status: string; message: string }>(`/settings/reset-app`);
  return res.data;
};

