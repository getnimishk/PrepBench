// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper
} from '@mui/material';
import { UploadCloud, CheckCircle2, AlertTriangle, XCircle, ChevronDown, ShieldCheck, Download, Wrench } from 'lucide-react';
import { validateImportFile, confirmImportBatch, repairImportFile, QuestionValidationReport } from '../../services/api';
import { apiErrorMessage } from '../../services/apiError';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onOpenAuditStudio?: (questions: any[]) => void;
}

export const ImportModal: React.FC<Props> = ({ open, onClose, onSuccess, onOpenAuditStudio }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<QuestionValidationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const [importFailures, setImportFailures] = useState<string[] | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleReset = () => {
    setSelectedFile(null);
    setReport(null);
    setError(null);
    setImportSuccessMsg(null);
    setImportFailures(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCloseModal = () => {
    handleReset();
    onClose();
  };

  const handleOpenAuditStudioClick = () => {
    if (!report || !onOpenAuditStudio) return;
    const validQuestions = report.items
      .filter((item) => item.status !== 'error' && item.question)
      .map((item) => item.question!);

    if (validQuestions.length === 0) {
      setError('No valid questions available to inspect in Audit Studio.');
      return;
    }
    onOpenAuditStudio(validQuestions);
    handleCloseModal();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setError(null);
      setReport(null);
      setImportSuccessMsg(null);

      // Run dry-run validation
      setValidating(true);
      try {
        const valReport = await validateImportFile(file);
        setReport(valReport);
      } catch (err) {
        setError(apiErrorMessage(err, 'Failed to validate file format.'));
      } finally {
        setValidating(false);
      }
    }
  };

  const handleAutoRepair = async () => {
    if (!selectedFile) return;
    setRepairing(true);
    setError(null);
    try {
      const blob = await repairImportFile(selectedFile);
      const repairedFile = new File([blob], `repaired_${selectedFile.name}`, { type: selectedFile.type });
      setSelectedFile(repairedFile);

      setValidating(true);
      const valReport = await validateImportFile(repairedFile);
      setReport(valReport);
      setImportSuccessMsg('Auto-repair completed! File updated and re-validated cleanly.');
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to auto-repair file.'));
    } finally {
      setRepairing(false);
      setValidating(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!report) return;
    setImporting(true);
    setError(null);
    try {
      // Collect valid & warning questions to import
      const validQuestions = report.items
        .filter((item) => item.status !== 'error' && item.question)
        .map((item) => item.question!);

      if (validQuestions.length === 0) {
        setError('No valid questions to import.');
        return;
      }

      const result = await confirmImportBatch(validQuestions);
      onSuccess();

      if (result.failed_count > 0) {
        // Some questions failed to import cleanly — keep the modal open and show
        // exactly what failed instead of a blanket success message, so a partial
        // failure is visible immediately rather than discovered later.
        setImportSuccessMsg(
          `Imported ${result.success_count} of ${validQuestions.length} questions. ` +
          `${result.failed_count} failed — see details below.`
        );
        setImportFailures(result.errors);
      } else {
        setImportSuccessMsg(`Successfully imported ${result.success_count} questions into your Question Bank!`);
        // Auto-clear & close after 1.5 seconds — only when everything succeeded.
        timeoutRef.current = setTimeout(() => {
          handleCloseModal();
        }, 1500);
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to commit import to database.'));
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadReport = () => {
    if (!report || !selectedFile) return;
    const reportData = {
      filename: selectedFile.name,
      timestamp: new Date().toISOString(),
      summary: {
        total: report.total_processed,
        valid: report.valid_count,
        warnings: report.warning_count,
        errors: report.error_count
      },
      items: report.items
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `validation_report_${selectedFile.name}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const actualImportCount = report ? report.items.filter(item => item.status !== 'error' && item.question).length : 0;

  return (
    <Dialog open={open} onClose={handleCloseModal} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
        <ShieldCheck color="#34D399" size={24} /> Question Bank Pre-Import Inspector & Auto-Repair
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Upload Area */}
          {!report && (
            <Paper
              variant="outlined"
              sx={{
                p: 4,
                borderStyle: 'dashed',
                borderColor: 'primary.main',
                textAlign: 'center',
                backgroundColor: 'action.hover',
                cursor: 'pointer'
              }}
              component="label"
            >
              <input type="file" accept=".md,.markdown,.json,.csv,.xlsx,.xls" hidden onChange={handleFileChange} ref={fileInputRef} />
              <UploadCloud size={48} color="#6366F1" style={{ marginBottom: 8 }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Click or Drag File to Inspect & Validate</Typography>
              <Typography variant="body2" color="text.secondary">Supports Markdown (.md), JSON, CSV, and Excel (.xlsx)</Typography>
              {validating && (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 2 }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2">Running Schema, Hygiene & Uniqueness Audit…</Typography>
                </Box>
              )}
            </Paper>
          )}

          {error && <Alert severity="error">{error}</Alert>}
          {importSuccessMsg && (
            <Alert severity={importFailures && importFailures.length > 0 ? 'warning' : 'success'}>
              {importSuccessMsg}
            </Alert>
          )}
          {importFailures && importFailures.length > 0 && (
            <Alert severity="error">
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                Questions that failed to import:
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.5, maxHeight: 200, overflowY: 'auto' }}>
                {importFailures.map((msg, i) => (
                  <li key={i}><Typography variant="caption">{msg}</Typography></li>
                ))}
              </Box>
            </Alert>
          )}

          {/* Validation Summary Report Cards */}
          {report && (
            <Box sx={{ mt: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Pre-Import Dry-Run Inspection Results ({report.total_processed} questions analyzed):
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" variant="outlined" startIcon={<Download size={14} />} onClick={handleDownloadReport}>Export Report</Button>
                  <Button size="small" onClick={handleReset}>Choose Another File</Button>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Paper sx={{ flex: 1, p: 1.5, textAlign: 'center', bgcolor: 'rgba(6,78,59,0.15)', border: 1, borderColor: '#34D399' }}>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#34D399' }}>{report.valid_count}</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#34D399' }}>Valid Questions</Typography>
                </Paper>
                <Paper sx={{ flex: 1, p: 1.5, textAlign: 'center', bgcolor: 'rgba(120,53,15,0.18)', border: 1, borderColor: '#FBBF24' }}>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#FBBF24' }}>{report.warning_count}</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#FBBF24' }}>Warnings / Duplicates</Typography>
                </Paper>
                <Paper sx={{ flex: 1, p: 1.5, textAlign: 'center', bgcolor: 'rgba(127,29,29,0.18)', border: 1, borderColor: '#FB7185' }}>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#FB7185' }}>{report.error_count}</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#FB7185' }}>Rejected (Errors)</Typography>
                </Paper>
              </Box>

              {/* Accordion List of Items */}
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Detailed Question Validation Breakdown:
              </Typography>

              <Box sx={{ maxHeight: 280, overflowY: 'auto' }}>
                {report.items.map((item) => (
                  <Accordion key={item.index} disableGutters>
                    <AccordionSummary expandIcon={<ChevronDown size={18} />}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                        {item.status === 'valid' && <CheckCircle2 size={18} color="#34D399" />}
                        {item.status === 'warning' && <AlertTriangle size={18} color="#FBBF24" />}
                        {item.status === 'error' && <XCircle size={18} color="#FB7185" />}
                        <Typography variant="body2" sx={{ fontWeight: 600, flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          #{item.index}. {item.question?.text || 'Invalid question format'}
                        </Typography>
                        <Chip
                          label={item.status.toUpperCase()}
                          size="small"
                          color={item.status === 'valid' ? 'success' : item.status === 'warning' ? 'warning' : 'error'}
                        />
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      {item.issues.length === 0 ? (
                        <Typography variant="caption" color="success.main">
                          ✓ No structural, logical, or duplicate issues detected.
                        </Typography>
                      ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          {item.issues.map((issue, i) => (
                            <Alert
                              key={i}
                              severity={issue.severity === 'error' ? 'error' : issue.severity === 'warning' ? 'warning' : 'info'}
                              sx={{ py: 0, px: 1, '& .MuiAlert-message': { fontSize: '0.8rem' } }}
                            >
                              <strong>[{issue.field.toUpperCase()}]</strong> {issue.message}
                            </Alert>
                          ))}
                        </Box>
                      )}
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCloseModal}>Cancel</Button>
        {report && (
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            {onOpenAuditStudio && (
              <Button
                variant="contained"
                color="secondary"
                onClick={handleOpenAuditStudioClick}
                startIcon={<ShieldCheck size={18} />}
              >
                Open in Pre-Import Audit Studio
              </Button>
            )}
            <Button
              variant="outlined"
              color="warning"
              disabled={repairing || validating}
              onClick={handleAutoRepair}
              startIcon={repairing ? <CircularProgress size={18} color="inherit" /> : <Wrench size={18} />}
            >
              {repairing ? 'Auto-Repairing…' : 'Auto-Repair File'}
            </Button>
            <Button
              variant="contained"
              color="success"
              disabled={importing || actualImportCount === 0}
              onClick={handleConfirmImport}
              startIcon={importing ? <CircularProgress size={18} color="inherit" /> : <CheckCircle2 size={18} />}
            >
              {importing ? 'Importing…' : `Confirm & Import (${actualImportCount})`}
            </Button>
          </Box>
        )}
      </DialogActions>
    </Dialog>
  );
};
