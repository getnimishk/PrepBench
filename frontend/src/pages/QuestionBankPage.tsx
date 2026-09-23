// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useCallback, useEffect, useId, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Button, TextField, InputAdornment, MenuItem, LinearProgress, Alert, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions, FormControl, InputLabel, Select, TablePagination, CircularProgress,
} from '@mui/material';
import { Search, Sparkles, CheckCircle2, X } from 'lucide-react';
import {
  getQuestions, deleteQuestion, createQuestion, updateQuestion, clearAllQuestions,
  autoRefineBatch, confirmImportBatch, bulkDeleteQuestions, getQuestionFilters, getQuestion, getQuestionBankSummary,
} from '../services/api';
import { usePreparation } from '../context/PreparationContext';
import { Question, QuestionBankSummary, QuestionOutcome, QuestionType } from '../types/question';
import { QuestionEditorModal } from '../components/question_bank/QuestionEditorModal';
import { ImportModal } from '../components/question_bank/ImportModal';
import { QuestionTable } from '../components/question_bank/QuestionTable';
import { QuestionDetailPanel } from '../components/question_bank/QuestionDetailPanel';
import { QUESTIONS_IMPORTED, type StagedImportState } from '../context/importLauncherContext';
import { apiErrorMessage, loadFailed } from '../services/apiError';
import { NARROW_QUERY } from '../theme/tokens';
import {
  Actions, Bar, BigFigure, Detail, Eyebrow, Grid, Note, PageHead, Panel, Section,
} from '../components/ui/primitives';

const LEVELS: { value: '' | 'easy' | 'medium' | 'hard'; label: string }[] = [
  { value: '', label: 'Any level' }, { value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' },
];
const TYPES: { value: '' | QuestionType; label: string }[] = [
  { value: '', label: 'Any type' }, { value: 'single_choice', label: 'Single' },
  { value: 'multiple_choice', label: 'Multiple' }, { value: 'true_false', label: 'True/false' },
];
const OUTCOMES: { value: '' | QuestionOutcome; label: string }[] = [
  { value: '', label: 'All' }, { value: 'due', label: 'Review due' }, { value: 'missed', label: 'Missed' },
  { value: 'correct', label: 'Answered correctly' }, { value: 'unattempted', label: 'Not attempted' },
];

/** One row of pills that behave as a single choice. */
const ChoicePills = <T extends string>({ label, options, value, onChange }: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) => {
  const id = useId();
  // Labelled above, as every field on the page is, and as tall as the fields
  // beside it so the row reads as one line of controls.
  return (
    <Box role="group" aria-labelledby={id} sx={{ maxWidth: '100%', minWidth: 0 }}>
      <Box id={id} sx={{ fontSize: (t) => t.typography.pxToRem(11), fontWeight: 700, lineHeight: 1.48, color: 'text.secondary', mb: '5px' }}>
        {label}
      </Box>
      <Box sx={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', minHeight: 40, maxWidth: '100%', minWidth: 0 }}>
        {options.map((o) => (
          <Chip
            key={o.value || 'any'}
            label={o.label}
            clickable
            color={value === o.value ? 'primary' : 'default'}
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
          />
        ))}
      </Box>
    </Box>
  );
};

export const QuestionBankPage: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [summary, setSummary] = useState<QuestionBankSummary | null>(null);

  const location = useLocation();
  const navigate = useNavigate();
  // `?keyword=` fills the search box, so "see all in the Question Bank" from
  // global search lands on the same questions it counted.
  const [keyword, setKeyword] = useState(() => new URLSearchParams(location.search).get('keyword') ?? '');
  const [domain, setDomain] = useState('');
  const [difficulty, setDifficulty] = useState<'' | 'easy' | 'medium' | 'hard'>('');
  const [questionType, setQuestionType] = useState<'' | QuestionType>('');
  const [outcome, setOutcome] = useState<'' | QuestionOutcome>('');
  const [certification, setCertification] = useState('');
  // Which questions: the picked preparation's, or every question in the bank.
  //
  // Defaults to the preparation, because that is the isolation promise -- a
  // preparation owns its questions and nothing is shared. "All" stays one click
  // away for the jobs that genuinely span preparations: finding unowned questions
  // (the "General Prep" default carries none), checking what an import brought
  // in, and bulk clean-up.
  const { selected: selectedPreparation } = usePreparation();
  const [scope, setScope] = useState<'preparation' | 'all'>('preparation');
  const scopedSubjectId =
    scope === 'preparation' && selectedPreparation ? selectedPreparation.id : undefined;
  const [reviewedFilter, setReviewedFilter] = useState<'' | 'true' | 'false'>('');

  const [filterOptions, setFilterOptions] = useState<{
    certifications: string[];
    domains: string[];
    topics: string[];
    difficulties: string[];
  }>({ certifications: [], domains: [], topics: [], difficulties: [] });

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [detailQuestion, setDetailQuestion] = useState<Question | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [editingContext, setEditingContext] = useState<'bank' | 'staging'>('bank');
  const [importOpen, setImportOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const [debouncedKeyword, setDebouncedKeyword] = useState(keyword);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedKeyword(keyword), 300);
    return () => clearTimeout(handler);
  }, [keyword]);

  // The values offered follow the scope being shown. From every bank, a PSM I
  // view listed Databricks domains, and choosing one emptied the table.
  useEffect(() => {
    let cancelled = false;
    getQuestionFilters(scopedSubjectId)
      .then((filters) => {
        if (cancelled) return;
        const domains = filters.domains || [];
        const certifications = filters.certifications || [];
        setFilterOptions({
          certifications,
          domains,
          topics: filters.topics || [],
          difficulties: filters.difficulties || ['easy', 'medium', 'hard'],
        });
        // A value chosen in another scope is not a filter this one can apply.
        setDomain((current) => (current && !domains.includes(current) ? '' : current));
        setCertification((current) => (current && !certifications.includes(current) ? '' : current));
      })
      .catch(console.error);
    return () => { cancelled = true; };
  }, [scopedSubjectId]);

  // Reset to first page whenever a filter changes
  useEffect(() => {
    setPage(0);
  }, [debouncedKeyword, domain, difficulty, questionType, outcome, certification, reviewedFilter, scopedSubjectId]);

  const fetchSummary = useCallback(() => {
    // Supporting figures: a summary that cannot be read costs its panels, not the table.
    getQuestionBankSummary(scopedSubjectId)
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [scopedSubjectId]);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await getQuestions({
        keyword: debouncedKeyword || undefined,
        domain: domain || undefined,
        difficulty: difficulty || undefined,
        question_type: questionType || undefined,
        outcome: outcome || undefined,
        certification: certification || undefined,
        subject_id: scopedSubjectId,
        is_reviewed: reviewedFilter === '' ? undefined : reviewedFilter === 'true',
        include_evidence: true,
        skip: page * rowsPerPage,
        limit: rowsPerPage,
      });
      setQuestions(res.items);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
      setFetchError(loadFailed('Could not load the Question Bank', err));
    } finally {
      setLoading(false);
    }
  }, [debouncedKeyword, domain, difficulty, questionType, outcome, certification, reviewedFilter, scopedSubjectId, page, rowsPerPage]);

  const refresh = useCallback(() => {
    void fetchQuestions();
    fetchSummary();
  }, [fetchQuestions, fetchSummary]);

  // An import started from the header or Settings writes questions behind this
  // screen's back; reload when one finishes so the table is not stale.
  useEffect(() => {
    window.addEventListener(QUESTIONS_IMPORTED, refresh);
    return () => window.removeEventListener(QUESTIONS_IMPORTED, refresh);
  }, [refresh]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleSave = async (data: Partial<Question>) => {
    setActionError(null);
    try {
      if (editingContext === 'staging' && selectedQuestion) {
        setStagedQuestions((qs) => qs ? qs.map((q) => q.id === selectedQuestion.id ? { ...q, ...data } as Question : q) : qs);
      } else if (selectedQuestion) {
        await updateQuestion(selectedQuestion.id, data);
        refresh();
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await createQuestion(data as any);
        refresh();
      }
      setEditorOpen(false);
      setSelectedQuestion(null);
    } catch (err) {
      console.error('Failed to save question:', err);
      setActionError(apiErrorMessage(err, 'Failed to save question. Please verify input data.'));
    }
  };

  const handleDelete = async (id: number) => {
    setActionError(null);
    try {
      await deleteQuestion(id);
      setSelectedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (detailQuestion?.id === id) setDetailOpen(false);
      refresh();
    } catch (err) {
      console.error('Failed to delete question:', err);
      setActionError(apiErrorMessage(err, 'Failed to delete question.'));
    }
  };

  const handleClearAll = async () => {
    setClearing(true);
    setActionError(null);
    try {
      await clearAllQuestions();
      setClearConfirmOpen(false);
      setSelectedIds(new Set());
      setPage(0);
      refresh();
    } catch (err) {
      console.error(err);
      setActionError(apiErrorMessage(err, 'Failed to clear Question Bank.'));
    } finally {
      setClearing(false);
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    setActionError(null);
    try {
      await bulkDeleteQuestions(Array.from(selectedIds));
      setSelectedIds(new Set());
      setBulkDeleteConfirmOpen(false);
      refresh();
    } catch (err) {
      console.error('Failed to bulk delete questions:', err);
      setActionError(apiErrorMessage(err, 'Failed to delete selected questions.'));
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = questions.every((q) => next.has(q.id));
      questions.forEach((q) => (allSelected ? next.delete(q.id) : next.add(q.id)));
      return next;
    });
  };

  const handleToggleReviewed = async (q: Question) => {
    setActionError(null);
    try {
      const updated = await updateQuestion(q.id, { is_reviewed: !q.is_reviewed });
      // The update carries no evidence; the row keeps the evidence it had.
      setQuestions((qs) => qs.map((item) => (item.id === q.id ? { ...updated, evidence: item.evidence } : item)));
      setDetailQuestion((d) => (d?.id === q.id ? { ...updated, evidence: d.evidence } : d));
      fetchSummary();
    } catch (err) {
      console.error('Failed to update reviewed status:', err);
      setActionError(apiErrorMessage(err, 'Failed to update reviewed status.'));
    }
  };

  const [stagedQuestions, setStagedQuestions] = useState<Question[] | null>(null);
  const [autoRefining, setAutoRefining] = useState(false);
  const [committing, setCommitting] = useState(false);

  const handleOpenAuditStudio = (qs: Question[]) => {
    setStagedQuestions(qs);
  };

  // Staged rows handed over by an import opened elsewhere. Taken once, then
  // dropped from the history entry so going back and forward does not stage
  // them a second time.
  useEffect(() => {
    const staged = (location.state as StagedImportState | null)?.stagedQuestions;
    if (!staged) return;
    setStagedQuestions(staged);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const handleAutoRefineStagedBatch = async () => {
    if (!stagedQuestions) return;
    setAutoRefining(true);
    setActionError(null);
    try {
      const refined = await autoRefineBatch(stagedQuestions);
      setStagedQuestions(refined);
    } catch (err) {
      console.error('Failed to auto-refine batch:', err);
      setActionError(apiErrorMessage(err, 'Failed to auto-refine staged questions.'));
    } finally {
      setAutoRefining(false);
    }
  };

  const handleCommitStagedBatch = async () => {
    if (!stagedQuestions) return;
    setCommitting(true);
    setActionError(null);
    try {
      await confirmImportBatch(stagedQuestions);
      setStagedQuestions(null);
      refresh();
    } catch (err) {
      console.error('Failed to commit staged batch:', err);
      setActionError(apiErrorMessage(err, 'Failed to commit question batch.'));
    } finally {
      setCommitting(false);
    }
  };

  const openDetail = (q: Question) => {
    setDetailQuestion(q);
    setDetailOpen(true);
  };

  // A question can be linked to -- `?question=42` opens it -- so a page that
  // lists questions (an area in Insights) can offer "Open" without a copy of
  // this panel. Closing the panel drops the parameter, so a reload does not
  // open it again.
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedQuestion = Number(searchParams.get('question'));
  useEffect(() => {
    if (!Number.isInteger(linkedQuestion) || linkedQuestion <= 0) return;
    let cancelled = false;
    getQuestion(linkedQuestion)
      .then((q) => { if (!cancelled) openDetail(q); })
      .catch((err) => {
        if (!cancelled) setActionError(apiErrorMessage(err, `Question ${linkedQuestion} could not be opened.`));
      });
    return () => { cancelled = true; };
  }, [linkedQuestion]);

  const closeDetail = () => {
    setDetailOpen(false);
    if (searchParams.has('question')) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('question');
        return next;
      }, { replace: true });
    }
  };

  const openEdit = (q: Question, context: 'bank' | 'staging') => {
    setEditingContext(context);
    setSelectedQuestion(q);
    setEditorOpen(true);
  };

  const scopeName = scope === 'preparation' && selectedPreparation ? selectedPreparation.name : 'All questions';

  return (
    <Box>
      {actionError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>{actionError}</Alert>}

      <PageHead
        eyebrow={`Question Bank · ${scopeName}`}
        title="Question Bank"
        sub={fetchError
          ? 'Question count unavailable.'
          : summary
            ? `${summary.questions} questions ${scope === 'preparation' && selectedPreparation ? `in ${selectedPreparation.name}` : 'across every preparation'}. Search, filter, create and import without leaving this preparation.`
            // Not a zero while the first count is on its way.
            : 'Counting questions…'}
        actions={(
          <>
            <Button variant="outlined" onClick={() => setImportOpen(true)}>Import</Button>
            <Button
              variant="contained"
              color="ink"
              onClick={() => { setSelectedQuestion(null); setEditingContext('bank'); setEditorOpen(true); }}
            >
              Create question
            </Button>
            <Button variant="outlined" color="error" onClick={() => setClearConfirmOpen(true)}>Clear all</Button>
          </>
        )}
      />

      {summary && !stagedQuestions && (
        <Section>
          <Grid columns={4}>
            <Panel>
              <Eyebrow>Questions</Eyebrow>
              <BigFigure size={26}>{summary.questions}</BigFigure>
              <Detail>{summary.attempted} attempted · {summary.never_attempted} never served</Detail>
            </Panel>
            <Panel>
              <Eyebrow>Recorded answers</Eyebrow>
              <BigFigure size={26}>{summary.answers}</BigFigure>
              {summary.correct_percentage != null && (
                <Bar value={summary.correct_percentage} label={`${Math.round(summary.correct_percentage)}% of answers correct`} sx={{ mt: '6px' }} />
              )}
              <Detail sx={{ mt: '6px' }}>
                {summary.correct_percentage != null
                  ? `${summary.correct_answers} correct · ${Math.round(summary.correct_percentage)}%`
                  : 'Nothing answered yet'}
              </Detail>
            </Panel>
            <Panel>
              <Eyebrow>Review due</Eyebrow>
              <BigFigure size={26} color="warning.main">{summary.review_due}</BigFigure>
              <Detail>scheduled on or before today</Detail>
            </Panel>
            <Panel>
              <Eyebrow>Missed at least once</Eyebrow>
              <BigFigure size={26} color="error.main">{summary.missed_at_least_once}</BigFigure>
              <Detail>of {summary.attempted} attempted · {summary.flagged_reviewed} flagged reviewed</Detail>
            </Panel>
          </Grid>
        </Section>
      )}

      <Section>
        {stagedQuestions ? (
          <Note sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <span>Pre-import audit — reviewing {stagedQuestions.length} unsaved staged questions</span>
            <Actions>
              <Button variant="outlined" onClick={() => setStagedQuestions(null)}>Exit staging mode</Button>
              <Button
                variant="outlined"
                startIcon={autoRefining ? <CircularProgress size={16} color="inherit" /> : <Sparkles size={16} />}
                onClick={handleAutoRefineStagedBatch}
                disabled={autoRefining}
              >
                {autoRefining ? 'Auto-refining batch…' : 'Auto-refine entire batch'}
              </Button>
              <Button
                variant="contained"
                color="ink"
                startIcon={committing ? <CircularProgress size={16} color="inherit" /> : <CheckCircle2 size={16} />}
                onClick={handleCommitStagedBatch}
                disabled={committing}
              >
                {committing ? 'Saving batch…' : 'Approve & commit batch'}
              </Button>
            </Actions>
          </Note>
        ) : selectedIds.size > 0 ? (
          <Panel sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', borderColor: 'error.main' }}>
            <Typography variant="subtitle2" component="span">{selectedIds.size} selected</Typography>
            <Actions>
              <Button variant="outlined" onClick={() => setSelectedIds(new Set())}>Clear selection</Button>
              <Button variant="contained" color="error" startIcon={<X size={16} />} onClick={() => setBulkDeleteConfirmOpen(true)}>
                Delete selected
              </Button>
            </Actions>
          </Panel>
        ) : (
          <Panel component="section" aria-label="Filters" sx={{ maxWidth: '100%', minWidth: 0 }}>
            <TextField
              placeholder="Search question text, topic or explanation…"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={16} />
                    </InputAdornment>
                  ),
                },
                htmlInput: { 'aria-label': 'Search questions' },
              }}
            />
            <Box sx={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap', mt: '12px' }}>
              <FormControl sx={{ minWidth: 220, [NARROW_QUERY]: { minWidth: 0, width: '100%' } }}>
                <InputLabel id="domain-filter-label" shrink>Domain</InputLabel>
                <Select
                  labelId="domain-filter-label"
                  value={domain}
                  label="Domain"
                  displayEmpty
                  onChange={(e) => setDomain(e.target.value)}
                >
                  <MenuItem value="">All {filterOptions.domains.length} domains</MenuItem>
                  {filterOptions.domains.map((d) => (
                    <MenuItem key={d} value={d}>{d}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <ChoicePills label="Level" options={LEVELS} value={difficulty} onChange={setDifficulty} />
              <ChoicePills label="Type" options={TYPES} value={questionType} onChange={setQuestionType} />
            </Box>
            <Box sx={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap', mt: '10px' }}>
              <ChoicePills label="Status" options={OUTCOMES} value={outcome} onChange={setOutcome} />
              {selectedPreparation && (
                <FormControl sx={{ minWidth: 180, [NARROW_QUERY]: { minWidth: 0, width: '100%' } }}>
                  <InputLabel id="scope-filter-label">Showing</InputLabel>
                  <Select
                    labelId="scope-filter-label"
                    value={scope}
                    label="Showing"
                    onChange={(e) => setScope(e.target.value as 'preparation' | 'all')}
                  >
                    <MenuItem value="preparation">{selectedPreparation.name}</MenuItem>
                    <MenuItem value="all">All questions</MenuItem>
                  </Select>
                </FormControl>
              )}
              <FormControl sx={{ minWidth: 180, [NARROW_QUERY]: { minWidth: 0, width: '100%' } }}>
                <InputLabel id="certification-filter-label" shrink>Certification</InputLabel>
                <Select labelId="certification-filter-label" value={certification} label="Certification" displayEmpty onChange={(e) => setCertification(e.target.value)}>
                  <MenuItem value="">All certifications</MenuItem>
                  {filterOptions.certifications.map((c) => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl sx={{ minWidth: 140, [NARROW_QUERY]: { minWidth: 0, width: '100%' } }}>
                <InputLabel id="reviewed-filter-label" shrink>Reviewed</InputLabel>
                <Select labelId="reviewed-filter-label" value={reviewedFilter} label="Reviewed" displayEmpty onChange={(e) => setReviewedFilter(e.target.value as '' | 'true' | 'false')}>
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="true">Reviewed</MenuItem>
                  <MenuItem value="false">Not reviewed</MenuItem>
                </Select>
              </FormControl>
              <Detail component="span" sx={{ ml: 'auto' }}>
                {fetchError ? '' : `${total} of ${summary?.questions ?? total} questions`}
              </Detail>
            </Box>
          </Panel>
        )}
      </Section>

      <Section>
        {/* Main view: staging mode or the bank's table */}
        {stagedQuestions ? (
          <Panel sx={{ p: '8px 12px', overflow: 'hidden', maxWidth: '100%', minWidth: 0 }}>
            <QuestionTable
              questions={stagedQuestions}
              mode="staging"
              onRowClick={openDetail}
              onEdit={(q) => openEdit(q, 'staging')}
              onDelete={(id) => setStagedQuestions((qs) => (qs ? qs.filter((item) => item.id !== id) : null))}
            />
          </Panel>
        ) : loading ? (
          <LinearProgress aria-label="Loading questions" />
        ) : fetchError ? (
          <Alert severity="error" action={<Button color="inherit" size="small" onClick={refresh}>Retry</Button>}>
            {fetchError}
          </Alert>
        ) : questions.length === 0 ? (
          <Panel>
            <Detail>
              No questions match the current filters. Use <strong>Import</strong> to upload a JSON, CSV, Excel or
              Markdown file.
            </Detail>
          </Panel>
        ) : (
          <Panel sx={{ p: '8px 12px', overflow: 'hidden', maxWidth: '100%', minWidth: 0 }}>
            <QuestionTable
              questions={questions}
              mode="bank"
              selectedIds={selectedIds}
              onToggleSelect={toggleSelectOne}
              onToggleSelectAll={toggleSelectAllOnPage}
              onRowClick={openDetail}
              onEdit={(q) => openEdit(q, 'bank')}
              onDelete={handleDelete}
            />
            <TablePagination
              component="div"
              count={total}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={[10, 25, 50, 100]}
              sx={{
                maxWidth: '100%',
                overflowX: 'hidden',
                '& .MuiTablePagination-toolbar': {
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  px: 0,
                  gap: 0.5,
                  minHeight: 48,
                },
                '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                  m: 0,
                  fontSize: (t) => t.typography.pxToRem(12),
                },
                '& .MuiTablePagination-actions': {
                  ml: 1,
                },
              }}
            />
          </Panel>
        )}
      </Section>

      <QuestionDetailPanel
        open={detailOpen}
        question={detailQuestion}
        mode={stagedQuestions ? 'staging' : 'bank'}
        onClose={closeDetail}
        onEdit={(q) => openEdit(q, stagedQuestions ? 'staging' : 'bank')}
        onDelete={(id) => {
          if (stagedQuestions) {
            setStagedQuestions((qs) => (qs ? qs.filter((item) => item.id !== id) : null));
            setDetailOpen(false);
          } else {
            handleDelete(id);
          }
        }}
        onRefresh={refresh}
        onToggleReviewed={handleToggleReviewed}
      />

      <QuestionEditorModal
        open={editorOpen}
        question={selectedQuestion}
        onClose={() => { setEditorOpen(false); setSelectedQuestion(null); }}
        onSave={handleSave}
      />

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={refresh}
        onOpenAuditStudio={handleOpenAuditStudio}
      />

      {/* Clear Question Bank confirmation */}
      <Dialog open={clearConfirmOpen} onClose={() => setClearConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Clear the Question Bank?</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Are you sure you want to delete all <strong>{total} questions</strong> from your local question bank? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setClearConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleClearAll} disabled={clearing}>
            {clearing ? 'Deleting…' : 'Yes, delete all'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk delete confirmation */}
      <Dialog open={bulkDeleteConfirmOpen} onClose={() => setBulkDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete the selected questions?</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Are you sure you want to delete <strong>{selectedIds.size} selected question{selectedIds.size === 1 ? '' : 's'}</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setBulkDeleteConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleBulkDelete} disabled={bulkDeleting}>
            {bulkDeleting ? 'Deleting…' : 'Yes, delete selected'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
