// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { storedOrder } from '../../services/questionFormats';
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
  Checkbox,
  Alert
} from '@mui/material';
import { Plus, Trash2 } from 'lucide-react';
import { Detail, Eyebrow, Grid } from '../ui/primitives';
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
      // Ordering and matching are listed in their stored order: for ordering, that order is the answer.
      setOptions(question.options.length > 0 ? storedOrder(question).map(opt => ({...opt, _tempKey: opt.id?.toString() || Math.random().toString()})) : [{ option_text: '', is_correct: true, _tempKey: Math.random().toString() }]);
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

  const structured = questionType === 'ordering' || questionType === 'matching';
  const isOptionsValid = structured
    ? options.length >= 3 && options.every(opt => opt.option_text.trim().length > 0)
      && (questionType !== 'matching' || options.every(opt => (opt.match_target ?? '').trim().length > 0))
    : options.length >= 2 &&
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
        // Ordering: the list order is the answer. Matching: each item with its pair. Every item is part of the answer.
        options: options.map(({ _tempKey, ...opt }, i) => (structured
          ? { ...opt, is_correct: true, order_index: i, match_target: questionType === 'matching' ? opt.match_target : null }
          : opt)),
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
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth aria-labelledby="question-editor-title">
      {/* The prototype's question editor: the stem, the options with the right
          one marked, the explanation, then where the question belongs. */}
      <DialogTitle id="question-editor-title">
        {question ? `Edit question #${question.id}` : 'Create question'}
        <Detail sx={{ mt: '4px', fontWeight: 400 }}>Questions are written to your local bank and survive a reload.</Detail>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {saveError && <Alert severity="error">{saveError}</Alert>}
          <TextField
            label="Question stem"
            multiline
            minRows={4}
            fullWidth
            required
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <Box>
            <Eyebrow>
              {questionType === 'ordering' ? 'Items · list them in the right order, first to last'
                : questionType === 'matching' ? 'Pairs · each item and what it matches'
                  : 'Answer options · tick the correct one'}
            </Eyebrow>
            {!isOptionsValid && text.trim().length > 0 && (
              <Alert severity="info" sx={{ mt: '8px' }}>
                {structured
                  ? `Ensure at least 3 items exist and every item has text${questionType === 'matching' ? ' and a match' : ''}. Learners see them shuffled.`
                  : 'Ensure at least 2 options exist, all options have text, and at least one is marked correct.'}
              </Alert>
            )}
            {options.map((opt, idx) => {
              const letter = String.fromCharCode(65 + idx);
              return (
                <Box key={opt._tempKey || opt.id || idx} sx={{ display: 'flex', gap: '10px', alignItems: 'center', mt: '8px' }}>
                  {structured ? (
                    <Box component="span" sx={{ minWidth: '1.6em', fontWeight: 700 }}>{idx + 1}.</Box>
                  ) : (
                  <Checkbox
                    checked={opt.is_correct}
                    onChange={() => handleCorrectToggle(idx)}
                    color="success"
                    slotProps={{ input: { 'aria-label': `Option ${letter} is correct` } }}
                    sx={{ p: '6px' }}
                  />
                  )}
                  <TextField
                    fullWidth
                    placeholder={structured ? `Item ${idx + 1}` : `Option ${letter}`}
                    value={opt.option_text}
                    onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                    slotProps={{ htmlInput: { 'aria-label': structured ? `Item ${idx + 1}` : `Option ${letter}` } }}
                  />
                  {questionType === 'matching' && (
                    <TextField
                      fullWidth
                      placeholder={`Matches ${idx + 1}`}
                      value={opt.match_target ?? ''}
                      onChange={(e) => setOptions(options.map((o, i) => (i === idx ? { ...o, match_target: e.target.value } : o)))}
                      slotProps={{ htmlInput: { 'aria-label': `What item ${idx + 1} matches` } }}
                    />
                  )}
                  {options.length > 2 && (
                    <IconButton color="error" onClick={() => handleRemoveOption(idx)} aria-label={`Remove option ${letter}`}>
                      <Trash2 size={18} />
                    </IconButton>
                  )}
                </Box>
              );
            })}
            <Button variant="outlined" startIcon={<Plus size={16} />} onClick={handleAddOption} sx={{ mt: '10px' }}>
              Add option
            </Button>
          </Box>

          <TextField
            label="Explanation"
            multiline
            minRows={4}
            fullWidth
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
          />

          <Grid columns={2} gap="14px">
            <TextField label="Domain" fullWidth value={domain} onChange={(e) => setDomain(e.target.value)} />
            <TextField label="Topic" fullWidth value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Sprint Goal" />
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
            <TextField
              select
              label="Type"
              fullWidth
              value={questionType}
              onChange={(e) => setQuestionType(e.target.value)}
            >
              <MenuItem value="single_choice">Single choice</MenuItem>
              <MenuItem value="multiple_choice">Multiple choice</MenuItem>
              <MenuItem value="true_false">True or false</MenuItem>
              <MenuItem value="scenario">Scenario</MenuItem>
              <MenuItem value="case_study">Case study</MenuItem>
              <MenuItem value="code">Code</MenuItem>
              <MenuItem value="ordering">Ordering (build list)</MenuItem>
              <MenuItem value="matching">Matching</MenuItem>
            </TextField>
          </Grid>

          <Grid columns={2} gap="14px">
            <TextField label="Certification" fullWidth value={certification} onChange={(e) => setCertification(e.target.value)} />
            <TextField label="Reference URL" fullWidth value={referenceUrl} onChange={(e) => setReferenceUrl(e.target.value)} />
          </Grid>

          <TextField
            label="Case study (optional)"
            multiline
            minRows={2}
            fullWidth
            value={caseStudyText}
            onChange={(e) => setCaseStudyText(e.target.value)}
          />

          <TextField
            label="Code snippet (optional)"
            multiline
            minRows={3}
            fullWidth
            value={codeSnippet}
            onChange={(e) => setCodeSnippet(e.target.value)}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" color="ink" onClick={handleSubmit} disabled={saving || !isValid}>
          {saving ? 'Saving…' : question ? 'Save changes' : 'Create question'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
