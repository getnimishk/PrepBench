// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Button, TextField, InputAdornment,
  MenuItem, LinearProgress, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions, FormControl, InputLabel, Select, TablePagination,
  CircularProgress
} from '@mui/material';
import { Search, Plus, Upload, BookOpen, RefreshCcw, AlertTriangle, Sparkles, CheckCircle2, X } from 'lucide-react';
import {
  getQuestions, deleteQuestion, createQuestion, updateQuestion, clearAllQuestions,
  autoRefineBatch, confirmImportBatch, bulkDeleteQuestions, getQuestionFilters
} from '../services/api';
import { Question } from '../types/question';
import { QuestionEditorModal } from '../components/question_bank/QuestionEditorModal';
import { ImportModal } from '../components/question_bank/ImportModal';
import { QuestionTable } from '../components/question_bank/QuestionTable';
import { QuestionDetailPanel } from '../components/question_bank/QuestionDetailPanel';

import { apiErrorMessage } from '../services/apiError';

export const QuestionBankPage: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [keyword, setKeyword] = useState('');
  const [domain, setDomain] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [certification, setCertification] = useState('');
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

  useEffect(() => {
    getQuestionFilters()
      .then((filters) => {
        setFilterOptions({
          certifications: filters.certifications || [],
          domains: filters.domains || [],
          topics: filters.topics || [],
          difficulties: filters.difficulties || ['easy', 'medium', 'hard'],
        });
      })
      .catch(console.error);
  }, []);

  // Reset to first page whenever a filter changes
  useEffect(() => {
    setPage(0);
  }, [debouncedKeyword, domain, difficulty, certification, reviewedFilter]);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await getQuestions({
        keyword: debouncedKeyword || undefined,
        domain: domain || undefined,
        difficulty: (difficulty as Question['difficulty']) || undefined,
        certification: certification || undefined,
        is_reviewed: reviewedFilter === '' ? undefined : reviewedFilter === 'true',
        skip: page * rowsPerPage,
        limit: rowsPerPage,
      });
      setQuestions(res.items);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
      setFetchError('Failed to load questions from Question Bank. Please check backend connection.');
    } finally {
      setLoading(false);
    }
  }, [debouncedKeyword, domain, difficulty, certification, reviewedFilter, page, rowsPerPage]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleSave = async (data: Partial<Question>) => {
    setActionError(null);
    try {
      if (editingContext === 'staging' && selectedQuestion) {
        setStagedQuestions((qs) => qs ? qs.map((q) => q.id === selectedQuestion.id ? { ...q, ...data } as Question : q) : qs);
      } else if (selectedQuestion) {
        await updateQuestion(selectedQuestion.id, data);
        fetchQuestions();
      } else {
        await createQuestion(data as any);
        fetchQuestions();
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
      fetchQuestions();
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
      fetchQuestions();
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
      fetchQuestions();
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
      setQuestions((qs) => qs.map((item) => (item.id === q.id ? updated : item)));
      setDetailQuestion((d) => (d?.id === q.id ? updated : d));
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
      fetchQuestions();
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

  const openEdit = (q: Question, context: 'bank' | 'staging') => {
    setEditingContext(context);
    setSelectedQuestion(q);
    setEditorOpen(true);
  };

  return (
    <Box>
      {actionError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>{actionError}</Alert>}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Question Bank</Typography>
          <Typography variant="body2" color="text.secondary">{total} questions total</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Plus size={18} />}
            onClick={() => { setSelectedQuestion(null); setEditingContext('bank'); setEditorOpen(true); }}
          >
            Create Question
          </Button>

          <Button
            variant="outlined"
            color="primary"
            startIcon={<Upload size={18} />}
            onClick={() => setImportOpen(true)}
          >
            Bulk Import
          </Button>

          <Button
            variant="outlined"
            color="error"
            startIcon={<AlertTriangle size={18} />}
            onClick={() => setClearConfirmOpen(true)}
          >
            Clear All
          </Button>
        </Box>
      </Box>

      {stagedQuestions ? (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 }, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              Pre-Import Audit Studio — reviewing {stagedQuestions.length} unsaved staged questions
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button variant="outlined" color="warning" size="small" onClick={() => setStagedQuestions(null)}>
                Exit Staging Mode
              </Button>
              <Button
                variant="contained"
                color="secondary"
                size="small"
                startIcon={autoRefining ? <CircularProgress size={16} color="inherit" /> : <Sparkles size={16} />}
                onClick={handleAutoRefineStagedBatch}
                disabled={autoRefining}
              >
                {autoRefining ? 'Auto-Refining Batch…' : 'Auto-Refine Entire Batch'}
              </Button>
              <Button
                variant="contained"
                color="success"
                size="small"
                startIcon={committing ? <CircularProgress size={16} color="inherit" /> : <CheckCircle2 size={16} />}
                onClick={handleCommitStagedBatch}
                disabled={committing}
              >
                {committing ? 'Saving Batch…' : 'Approve & Commit Batch'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      ) : selectedIds.size > 0 ? (
        <Card sx={{ mb: 3, borderColor: 'error.main' }} variant="outlined">
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 }, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{selectedIds.size} selected</Typography>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button size="small" onClick={() => setSelectedIds(new Set())}>Clear selection</Button>
              <Button
                variant="contained"
                color="error"
                size="small"
                startIcon={<X size={16} />}
                onClick={() => setBulkDeleteConfirmOpen(true)}
              >
                Delete Selected
              </Button>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                placeholder="Search questions or options..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                size="small"
                sx={{ flexGrow: 1, minWidth: 240 }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search size={18} />
                      </InputAdornment>
                    ),
                  }
                }}
              />
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel id="domain-filter-label">Domain</InputLabel>
                <Select labelId="domain-filter-label" value={domain} label="Domain" onChange={(e) => setDomain(e.target.value)}>
                  <MenuItem value="">All Domains</MenuItem>
                  {filterOptions.domains.map((d) => (
                    <MenuItem key={d} value={d}>{d}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel id="difficulty-filter-label">Difficulty</InputLabel>
                <Select
                  labelId="difficulty-filter-label"
                  value={difficulty}
                  label="Difficulty"
                  onChange={(e) => setDifficulty(e.target.value)}
                >
                  <MenuItem value="">All Difficulties</MenuItem>
                  <MenuItem value="easy">Easy</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="hard">Hard</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel id="certification-filter-label">Certification</InputLabel>
                <Select labelId="certification-filter-label" value={certification} label="Certification" onChange={(e) => setCertification(e.target.value)}>
                  <MenuItem value="">All Certifications</MenuItem>
                  {filterOptions.certifications.map((c) => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel id="reviewed-filter-label">Reviewed</InputLabel>
                <Select labelId="reviewed-filter-label" value={reviewedFilter} label="Reviewed" onChange={(e) => setReviewedFilter(e.target.value as '' | 'true' | 'false')}>
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="true">Reviewed</MenuItem>
                  <MenuItem value="false">Not Reviewed</MenuItem>
                </Select>
              </FormControl>
              <Button size="small" onClick={fetchQuestions} startIcon={<RefreshCcw size={16} />}>
                Refresh
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Main View: Staging Mode or Bank Table */}
      {stagedQuestions ? (
        <QuestionTable
          questions={stagedQuestions}
          mode="staging"
          onRowClick={openDetail}
          onEdit={(q) => openEdit(q, 'staging')}
          onDelete={(id) => setStagedQuestions((qs) => (qs ? qs.filter((item) => item.id !== id) : null))}
        />
      ) : loading ? (
        <LinearProgress />
      ) : fetchError ? (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={fetchQuestions}>Retry</Button>}>
          {fetchError}
        </Alert>
      ) : questions.length === 0 ? (
        <Alert severity="info" icon={<BookOpen size={20} />}>
          No questions match the current filters. Click <strong>Bulk Import</strong> to upload a JSON, CSV, or Markdown file.
        </Alert>
      ) : (
        <>
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
          />
        </>
      )}

      <QuestionDetailPanel
        open={detailOpen}
        question={detailQuestion}
        mode={stagedQuestions ? 'staging' : 'bank'}
        onClose={() => setDetailOpen(false)}
        onEdit={(q) => openEdit(q, stagedQuestions ? 'staging' : 'bank')}
        onDelete={(id) => {
          if (stagedQuestions) {
            setStagedQuestions((qs) => (qs ? qs.filter((item) => item.id !== id) : null));
            setDetailOpen(false);
          } else {
            handleDelete(id);
          }
        }}
        onRefresh={fetchQuestions}
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
        onSuccess={fetchQuestions}
        onOpenAuditStudio={handleOpenAuditStudio}
      />

      {/* Clear Question Bank Confirmation Modal */}
      <Dialog open={clearConfirmOpen} onClose={() => setClearConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AlertTriangle color="#FB7185" size={24} /> Clear Question Bank?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to delete all <strong>{total} questions</strong> from your local question bank? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearConfirmOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleClearAll}
            disabled={clearing}
          >
            {clearing ? 'Deleting…' : 'Yes, Delete All'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Delete Confirmation Modal */}
      <Dialog open={bulkDeleteConfirmOpen} onClose={() => setBulkDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AlertTriangle color="#FB7185" size={24} /> Delete Selected Questions?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to delete <strong>{selectedIds.size} selected question{selectedIds.size === 1 ? '' : 's'}</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeleteConfirmOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
          >
            {bulkDeleting ? 'Deleting…' : 'Yes, Delete Selected'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
