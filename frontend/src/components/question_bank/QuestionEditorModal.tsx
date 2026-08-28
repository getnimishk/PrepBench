// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  IconButton,
  Typography,
  Checkbox,
  FormControlLabel,
  Alert
} from '@mui/material';
import { Plus, Trash2 } from 'lucide-react';
import { Question, QuestionOption } from '../../types/question';
import { apiErrorMessage } from '../../services/apiError';

interface Props {
  open: boolean;
  question?: Question | null;
  onClose: () => void;
  onSave: (data: Partial<Question>) => Promise<void>;
}

type QuestionOptionWithKey = QuestionOption & { _tempKey?: string };

export const QuestionEditorModal: React.FC<Props> = ({ open, question, onClose, onSave }) => {
  const [text, setText] = useState('');
  const [domain, setDomain] = useState('General');
  const [topic, setTopic] = useState('General');
  const [certification, setCertification] = useState('General Prep');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [questionType, setQuestionType] = useState('single_choice');
  const [explanation, setExplanation] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [codeSnippet, setCodeSnippet] = useState('');
  const [caseStudyText, setCaseStudyText] = useState('');
  const [options, setOptions] = useState<QuestionOptionWithKey[]>([
    { option_text: '', is_correct: true, _tempKey: Math.random().toString() },
    { option_text: '', is_correct: false, _tempKey: Math.random().toString() },
  ]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!open) return;
    
    setSaving(false);
    setSaveError('');
    
    if (question) {
      setText(question.text);
      setDomain(question.domain);
      setTopic(question.topic);
      setCertification(question.certification);
      setDifficulty(question.difficulty);
      setQuestionType(question.question_type);
      setExplanation(question.explanation || '');
      setReferenceUrl(question.reference_url || '');
      setCodeSnippet(question.code_snippet || '');
      setCaseStudyText(question.case_study_text || '');
      setOptions(question.options.length > 0 ? question.options.map(opt => ({...opt, _tempKey: opt.id?.toString() || Math.random().toString()})) : [{ option_text: '', is_correct: true, _tempKey: Math.random().toString() }]);
    } else {
      setText('');
      setDomain('General');
      setTopic('General');
      setCertification('General Prep');
      setDifficulty('medium');
      setQuestionType('single_choice');
      setExplanation('');
      setReferenceUrl('');
      setCodeSnippet('');
      setCaseStudyText('');
      setOptions([
        { option_text: '', is_correct: true, _tempKey: Math.random().toString() },
        { option_text: '', is_correct: false, _tempKey: Math.random().toString() },
      ]);
    }
  }, [question, open]);

  const handleAddOption = () => {
    setOptions([...options, { option_text: '', is_correct: false, _tempKey: Date.now().toString() }]);
  };

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionTextChange = (index: number, val: string) => {
    setOptions(options.map((opt, i) => i === index ? { ...opt, option_text: val } : opt));
  };

  const handleCorrectToggle = (index: number) => {
    if (questionType === 'single_choice' || questionType === 'true_false') {
      const updated = options.map((opt, i) => ({
        ...opt,
        is_correct: i === index,
      }));
      setOptions(updated);
    } else {
      setOptions(options.map((opt, i) => i === index ? { ...opt, is_correct: !opt.is_correct } : opt));
    }
  };

  const isOptionsValid = options.length >= 2 && 
                         options.every(opt => opt.option_text.trim().length > 0) &&
                         options.some(opt => opt.is_correct);
  const isValid = text.trim().length > 0 && isOptionsValid;

  const handleSubmit = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await onSave({
        text,
        domain,
        topic,
        certification,
        difficulty,
        question_type: questionType as any,
        explanation,
        reference_url: referenceUrl || undefined,
        code_snippet: codeSnippet || undefined,
        case_study_text: caseStudyText || undefined,
        options: options.map(({ _tempKey, ...opt }) => opt),
      });
      onClose();
    } catch (err) {
      // Was err.message, which is axios's own "Request failed with status code
      // 400" -- never the reason the server gave for rejecting it.
      setSaveError(apiErrorMessage(err, 'Failed to save question'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {question ? 'Edit Question' : 'Add New Question'}
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {saveError && <Alert severity="error">{saveError}</Alert>}
          <TextField
            label="Question Text"
            multiline
            rows={3}
            fullWidth
            required
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              select
              label="Question Type"
              fullWidth
              value={questionType}
              onChange={(e) => setQuestionType(e.target.value)}
            >
              <MenuItem value="single_choice">Single Choice</MenuItem>
              <MenuItem value="multiple_choice">Multiple Choice</MenuItem>
              <MenuItem value="true_false">True / False</MenuItem>
              <MenuItem value="scenario">Scenario Based</MenuItem>
              <MenuItem value="case_study">Case Study</MenuItem>
              <MenuItem value="code">Code Question</MenuItem>
            </TextField>

            <TextField
              select
              label="Difficulty"
              fullWidth
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as any)}
            >
              <MenuItem value="easy">Easy</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="hard">Hard</MenuItem>
            </TextField>
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="Certification" fullWidth value={certification} onChange={(e) => setCertification(e.target.value)} />
            <TextField label="Domain" fullWidth value={domain} onChange={(e) => setDomain(e.target.value)} />
            <TextField label="Topic" fullWidth value={topic} onChange={(e) => setTopic(e.target.value)} />
          </Box>

          <TextField
            label="Case Study Context (Optional)"
            multiline
            rows={2}
            fullWidth
            value={caseStudyText}
            onChange={(e) => setCaseStudyText(e.target.value)}
          />

          <TextField
            label="Code Snippet (Optional)"
            multiline
            rows={3}
            fullWidth
            value={codeSnippet}
            onChange={(e) => setCodeSnippet(e.target.value)}
          />

          {/* Options list */}
          <Typography variant="h6" sx={{ fontWeight: 700, mt: 1 }}>
            Answer Options
          </Typography>

          {!isOptionsValid && text.trim().length > 0 && (
            <Alert severity="info" sx={{ mt: -1 }}>
              Ensure at least 2 options exist, all options have text, and at least one is marked correct.
            </Alert>
          )}

          {options.map((opt, idx) => (
            <Box key={opt._tempKey || opt.id || idx} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <FormControlLabel
                control={<Checkbox checked={opt.is_correct} onChange={() => handleCorrectToggle(idx)} color="success" />}
                label="Correct?"
              />
              <TextField
                label={`Option ${String.fromCharCode(65 + idx)}`}
                fullWidth
                value={opt.option_text}
                onChange={(e) => handleOptionTextChange(idx, e.target.value)}
              />
              {options.length > 2 && (
                <IconButton color="error" onClick={() => handleRemoveOption(idx)}>
                  <Trash2 size={18} />
                </IconButton>
              )}
            </Box>
          ))}

          <Button startIcon={<Plus size={16} />} onClick={handleAddOption} sx={{ width: 'fit-content' }}>
            Add Option
          </Button>

          <TextField
            label="Explanation & Reference Notes"
            multiline
            rows={3}
            fullWidth
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
          />
          
          <TextField
            label="Reference URL"
            fullWidth
            value={referenceUrl}
            onChange={(e) => setReferenceUrl(e.target.value)}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={saving || !isValid}>
          {saving ? 'Saving...' : 'Save Question'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
