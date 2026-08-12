import React, { useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  Alert, CircularProgress, TextField, MenuItem, Tabs, Tab, List, ListItem, ListItemText
} from '@mui/material';
import { UploadCloud } from 'lucide-react';
import { importInterviewQuestions } from '../../services/api';
import { InterviewRoundType, InterviewQuestionImportResult, RoundTypeInfo } from '../../types/interviewQuestion';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  roundTypes: RoundTypeInfo[];
  defaultRoundType: InterviewRoundType;
}

export const InterviewQuestionImportModal: React.FC<Props> = ({ open, onClose, onSuccess, roundTypes, defaultRoundType }) => {
  const [roundType, setRoundType] = useState<InterviewRoundType>(defaultRoundType);
  const [category, setCategory] = useState('');
  const [mode, setMode] = useState<'paste' | 'file'>('paste');
  const [pastedText, setPastedText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InterviewQuestionImportResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleReset = () => {
    setPastedText('');
    setSelectedFile(null);
    setError(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleImport = async () => {
    setError(null);
    setImporting(true);
    try {
      const res = await importInterviewQuestions({
        defaultRoundType: roundType,
        defaultCategory: category || undefined,
        file: mode === 'file' ? selectedFile || undefined : undefined,
        text: mode === 'paste' ? pastedText : undefined,
      });
      setResult(res);
      if (res.imported_count > 0) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to import questions. Please check backend connection.');
    } finally {
      setImporting(false);
    }
  };

  const canImport = mode === 'paste' ? pastedText.trim().length > 0 : !!selectedFile;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Import Interview Questions</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Bring in your own questions from a plain text list, JSON, or CSV file. Rows without a round specified use the round you pick below.
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <TextField
            select
            label="Default Round"
            value={roundType}
            onChange={(e) => setRoundType(e.target.value as InterviewRoundType)}
            sx={{ flex: 1 }}
          >
            {roundTypes.map((rt) => (
              <MenuItem key={rt.value} value={rt.value}>{rt.label}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="Default Category (optional)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            sx={{ flex: 1 }}
          />
        </Box>

        <Tabs value={mode} onChange={(_, v) => setMode(v)} sx={{ mb: 2 }}>
          <Tab label="Paste Text" value="paste" />
          <Tab label="Upload File (JSON/CSV)" value="file" />
        </Tabs>

        {mode === 'paste' ? (
          <TextField
            fullWidth
            multiline
            rows={8}
            placeholder={'One question per line, e.g.:\nTell me about yourself.\nWhy do you want this role?'}
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
          />
        ) : (
          <Box sx={{ textAlign: 'center', py: 3, border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv"
              hidden
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            />
            <Button startIcon={<UploadCloud size={18} />} onClick={() => fileInputRef.current?.click()}>
              {selectedFile ? selectedFile.name : 'Choose a .json or .csv file'}
            </Button>
          </Box>
        )}

        {error && <Alert severity="error" sx={{ mt: 3 }}>{error}</Alert>}

        {result && (
          <Box sx={{ mt: 3 }}>
            <Alert severity={result.imported_count > 0 ? 'success' : 'warning'}>
              Imported {result.imported_count} question{result.imported_count === 1 ? '' : 's'}
              {result.skipped_count > 0 ? `, skipped ${result.skipped_count}` : ''}.
            </Alert>
            {result.errors.length > 0 && (
              <List dense sx={{ maxHeight: 200, overflowY: 'auto', mt: 1 }}>
                {result.errors.map((e, i) => (
                  <ListItem key={i} disablePadding>
                    <ListItemText primary={e} primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }} />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{result ? 'Close' : 'Cancel'}</Button>
        {!result && (
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={!canImport || importing}
            startIcon={importing ? <CircularProgress size={16} color="inherit" /> : undefined}
            sx={{ borderRadius: '100px', boxShadow: 'none' }}
          >
            {importing ? 'Importing…' : 'Import'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
