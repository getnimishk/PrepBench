import React, { useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  Alert, CircularProgress, Chip, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, TextField, Grid,
} from '@mui/material';
import { UploadCloud, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { validateRoadmapImport, confirmRoadmapImport } from '../../services/api';
import { RoadmapImportPreview } from '../../types/roadmap';
import { apiErrorMessage } from '../../services/apiError';

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: (roadmapId: number) => void;
}

export const RoadmapImportModal: React.FC<Props> = ({ open, onClose, onImported }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<RoadmapImportPreview | null>(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [weeklyHours, setWeeklyHours] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    setStartDate('');
    setWeeklyHours('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreview(null);
    setError(null);
    setValidating(true);
    try {
      setPreview(await validateRoadmapImport(selected));
    } catch (err) {
      setError(
        apiErrorMessage(err, 'Could not read this file. Supported formats are .xlsx, .json, .md, and .csv.')
      );
    } finally {
      setValidating(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setImporting(true);
    setError(null);
    try {
      const result = await confirmRoadmapImport({
        title: preview.title,
        description: preview.description,
        source_filename: preview.source_filename,
        topics: preview.topics,
        resources: preview.resources,
        start_date: startDate || null,
        weekly_hours_budget: weeklyHours ? Number(weeklyHours) : null,
      });
      reset();
      onImported(result.roadmap_id);
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to import this roadmap.'));
    } finally {
      setImporting(false);
    }
  };

  const totalHours = preview
    ? preview.topics.reduce((sum, t) => sum + (t.estimated_hours || 0), 0)
    : 0;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
        <UploadCloud size={22} /> Import Roadmap
      </DialogTitle>

      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box sx={{ mb: 2 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xlsm,.json,.md,.markdown,.csv"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            data-testid="roadmap-file-input"
          />
          <Button variant="outlined" onClick={() => fileInputRef.current?.click()} disabled={validating}>
            {file ? 'Choose a different file' : 'Choose file'}
          </Button>
          {file && <Typography variant="body2" sx={{ mt: 1 }}>{file.name}</Typography>}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Accepts .xlsx, .json, .md, and .csv. A spreadsheet needs a table with Phase and Topic
            columns; extra reference sheets are kept alongside the roadmap.
          </Typography>
        </Box>

        {validating && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
            <CircularProgress size={18} /> <Typography variant="body2">Reading file…</Typography>
          </Box>
        )}

        {preview && (
          <>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              <Chip icon={<CheckCircle2 size={14} />} color="success"
                    label={`${preview.topics.length} topics`} />
              <Chip label={`${preview.phases.length} phases`} variant="outlined" />
              {preview.resources.length > 0 && (
                <Chip label={`${preview.resources.length} reference sheets`} variant="outlined" />
              )}
              {totalHours > 0 && <Chip label={`${totalHours}h estimated`} variant="outlined" />}
            </Box>

            {/* Warnings are shown, never swallowed -- they are how the user
                finds out a summary row was dropped or a progress sheet could
                not be read. */}
            {preview.warnings.map((warning, index) => (
              <Alert key={index} severity="warning" icon={<AlertTriangle size={18} />} sx={{ mb: 1 }}>
                {warning}
              </Alert>
            ))}
            {preview.ignored_sheets.length > 0 && (
              <Alert severity="info" sx={{ mb: 1 }}>
                Ignored sheet(s): {preview.ignored_sheets.join(', ')}
              </Alert>
            )}

            <Grid container spacing={2} sx={{ mt: 0.5, mb: 2 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth type="date" label="Start date (optional)"
                  InputLabelProps={{ shrink: true }}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  helperText="Needed for the schedule view"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth type="number" label="Study hours per week (optional)"
                  value={weeklyHours}
                  onChange={(e) => setWeeklyHours(e.target.value)}
                  inputProps={{ min: 1, step: 1 }}
                  helperText="Used to project the timeline"
                />
              </Grid>
            </Grid>

            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Preview
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Phase</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Topic</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Hours</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {preview.topics.map((topic, index) => (
                    <TableRow key={index}>
                      <TableCell>{topic.phase_name}</TableCell>
                      <TableCell>{topic.title}</TableCell>
                      <TableCell>{topic.estimated_hours ?? '—'}</TableCell>
                      <TableCell>{topic.status.replace('_', ' ')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={importing}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={!preview || preview.topics.length === 0 || importing}
          startIcon={importing ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {importing ? 'Importing…' : 'Import Roadmap'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
