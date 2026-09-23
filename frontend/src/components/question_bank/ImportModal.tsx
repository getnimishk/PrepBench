// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { UploadCloud, ChevronDown, Download } from 'lucide-react';
import { BigFigure, Detail, Eyebrow, Grid, Panel, Pill } from '../ui/primitives';
import { validateImportFile, confirmImportBatch, repairImportFile, QuestionValidationReport } from '../../services/api';
import { apiErrorMessage } from '../../services/apiError';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onOpenAuditStudio?: (questions: any[]) => void;
}

/** Report rows drawn at a time; problems first, so the first page is the one to read. */
const REPORT_PAGE = 100;
const STATUS_RANK: Record<string, number> = { error: 0, warning: 1, valid: 2 };

export const ImportModal: React.FC<Props> = ({ open, onClose, onSuccess, onOpenAuditStudio }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<QuestionValidationReport | null>(null);
  // How many rows of the report are drawn. A 2,000-row file drew 2,000
  // expandable panels at once and froze the dialog for over a minute on the
  // server's half-second answer; the rows worth reading are the ones with
  // problems, and those come first.
  const [rowsShown, setRowsShown] = useState(REPORT_PAGE);
  const orderedItems = useMemo(
    () => (report ? [...report.items].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.index - b.index) : []),
    [report],
  );
  useEffect(() => { setRowsShown(REPORT_PAGE); }, [report]);
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
    <Dialog open={open} onClose={handleCloseModal} maxWidth="md" fullWidth aria-labelledby="import-questions-title">
      {/* The prototype's import audit: every row read and checked before
          anything is written, then one button that writes what passed. */}
      <DialogTitle id="import-questions-title">
        Pre-Import Inspector
        <Detail sx={{ mt: '4px', fontWeight: 400 }}>
          Every row is checked first. Nothing is written to your bank until you import it.
        </Detail>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Upload Area */}
          {!report && (
            <Box
              component="label"
              sx={{
                display: 'block', p: '32px', textAlign: 'center', cursor: 'pointer', borderRadius: '13px',
                border: '1px dashed', borderColor: 'primary.main', bgcolor: 'pb.accentSoft',
                '&:focus-within': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
              }}
            >
              <input type="file" accept=".md,.markdown,.json,.csv,.xlsx,.xls" hidden onChange={handleFileChange} ref={fileInputRef} />
              <Box sx={{ color: 'primary.main', mb: '8px' }}><UploadCloud size={40} /></Box>
              <Box component="b" sx={{ display: 'block', fontSize: (t) => t.typography.pxToRem(16) }}>Choose a file to check</Box>
              <Detail sx={{ mt: '4px' }}>Markdown (.md), JSON, CSV or Excel (.xlsx)</Detail>
              {validating && (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 2 }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2">Checking every row…</Typography>
                </Box>
              )}
            </Box>
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

          {report && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', mb: '12px' }}>
                <Eyebrow>{report.total_processed} rows read</Eyebrow>
                <Box sx={{ display: 'flex', gap: '8px' }}>
                  <Button size="small" variant="outlined" startIcon={<Download size={14} />} onClick={handleDownloadReport}>Export report</Button>
                  <Button size="small" variant="outlined" onClick={handleReset}>Choose another file</Button>
                </Box>
              </Box>

              <Grid columns={3} gap="12px">
                <Panel sx={{ p: '14px 16px' }}>
                  <Eyebrow>Valid</Eyebrow>
                  <BigFigure size={26} color="pb.success" sx={{ mt: '4px' }}>{report.valid_count}</BigFigure>
                  <Detail>ready to import</Detail>
                </Panel>
                <Panel sx={{ p: '14px 16px' }}>
                  <Eyebrow>Warnings</Eyebrow>
                  <BigFigure size={26} color="pb.warning" sx={{ mt: '4px' }}>{report.warning_count}</BigFigure>
                  <Detail>importable, worth a look</Detail>
                </Panel>
                <Panel sx={{ p: '14px 16px' }}>
                  <Eyebrow>Blocking</Eyebrow>
                  <BigFigure size={26} color="pb.danger" sx={{ mt: '4px' }}>{report.error_count}</BigFigure>
                  <Detail>cannot be imported</Detail>
                </Panel>
              </Grid>

          {/* Accordion List of Items */}
              <Eyebrow sx={{ mt: '16px', mb: '8px' }}>Every row</Eyebrow>

              <Box sx={{ maxHeight: 280, overflowY: 'auto' }}>
                {orderedItems.slice(0, rowsShown).map((item) => (
                  <Accordion key={item.index} disableGutters slotProps={{ transition: { unmountOnExit: true } }}>
                    <AccordionSummary expandIcon={<ChevronDown size={18} />}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.source_row != null ? `Row ${item.source_row}` : `#${item.index}`}. {item.question?.text || 'No question could be read from this row'}
                        </Typography>
                        <Pill tone={item.status === 'valid' ? 'success' : item.status === 'warning' ? 'warning' : 'danger'} sx={{ flex: '0 0 auto' }}>
                          {item.status === 'valid' ? 'Valid' : item.status === 'warning' ? 'Warning' : 'Blocking'}
                        </Pill>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      {item.issues.length === 0 ? (
                        <Typography variant="caption" sx={{ color: 'pb.success' }}>
                          No problems found in this row.
                        </Typography>
                      ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          {item.issues.map((issue, i) => (
                            <Alert
                              key={i}
                              severity={issue.severity === 'error' ? 'error' : issue.severity === 'warning' ? 'warning' : 'info'}
                              sx={{ py: 0, px: 1, '& .MuiAlert-message': { fontSize: (t) => t.typography.pxToRem(12.8) } }}
                            >
                              <strong>{issue.field}:</strong> {issue.message}
                              {issue.action && (
                                <Box component="span" sx={{ display: 'block', mt: 0.25, opacity: 0.9 }}>
                                  → {issue.action}
                                </Box>
                              )}
                            </Alert>
                          ))}
                        </Box>
                      )}
                    </AccordionDetails>
                  </Accordion>
                ))}
                {orderedItems.length > rowsShown && (
                  <Button size="small" onClick={() => setRowsShown((n) => n + REPORT_PAGE)} sx={{ mt: 1 }}>
                    Show {Math.min(REPORT_PAGE, orderedItems.length - rowsShown)} more of the {orderedItems.length - rowsShown} not shown
                  </Button>
                )}
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={handleCloseModal}>Cancel</Button>
        {report && (
          <Box sx={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {onOpenAuditStudio && (
              <Button variant="outlined" onClick={handleOpenAuditStudioClick}>
                Open in the audit studio
              </Button>
            )}
            <Button
              variant="outlined"
              disabled={repairing || validating}
              onClick={handleAutoRepair}
              startIcon={repairing ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {repairing ? 'Repairing…' : 'Repair the file'}
            </Button>
            <Button
              variant="contained"
              color="ink"
              disabled={importing || actualImportCount === 0}
              onClick={handleConfirmImport}
              startIcon={importing ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {importing ? 'Importing…' : `Import ${actualImportCount} question${actualImportCount === 1 ? '' : 's'}`}
            </Button>
          </Box>
        )}
      </DialogActions>
    </Dialog>
  );
};
