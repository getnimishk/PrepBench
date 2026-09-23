// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Drawer, Typography, Button, CircularProgress, Alert, IconButton,
} from '@mui/material';
import { X } from 'lucide-react';
import { Question, QuestionDifficulty } from '../../types/question';
import { Explanation } from '../common/Explanation';
import {
  Bar, BigFigure, Detail, Eyebrow, Good, Grid, Metric, MetricRow, Note, Panel, Pill, Sub, type Tone,
} from '../ui/primitives';
import { researchQuestion, QuestionResearchResponse, updateQuestion } from '../../services/api';
import { apiErrorMessage } from '../../services/apiError';

interface QuestionDetailPanelProps {
  open: boolean;
  question: Question | null;
  mode: 'bank' | 'staging';
  onClose: () => void;
  onEdit: (q: Question) => void;
  onDelete: (id: number) => void;
  onRefresh: () => void;
  onToggleReviewed?: (q: Question) => void;
}

const DIFFICULTY_TONE: Record<QuestionDifficulty, Tone> = {
  easy: 'success',
  medium: 'warning',
  hard: 'danger',
};

const TYPE_LABEL: Record<string, string> = {
  single_choice: 'Single choice',
  multiple_choice: 'Multiple choice',
  true_false: 'True or false',
};

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The question's own record, in the words the bank's Status column uses. */
const statusOf = (q: Question): { label: string; tone: Tone } | null => {
  const e = q.evidence;
  if (!e) return null;
  if (e.answered === 0) return { label: 'Not attempted', tone: 'neutral' };
  if (e.missed) return { label: 'Missed', tone: 'danger' };
  return { label: 'Answered correctly', tone: 'success' };
};

export const QuestionDetailPanel: React.FC<QuestionDetailPanelProps> = ({
  open,
  question,
  mode,
  onClose,
  onEdit,
  onDelete,
  onRefresh,
  onToggleReviewed,
}) => {
  const [researchData, setResearchData] = useState<QuestionResearchResponse | null>(null);
  const [researching, setResearching] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const researchCache = useRef<Map<number, QuestionResearchResponse>>(new Map());

  useEffect(() => {
    if (!open) return;
    setResearchData(null);
    setActionError(null);
  }, [open, question?.id]);

  if (!question) return null;

  const currentQ = question;

  const handleResearch = async () => {
    setActionError(null);
    if (researchCache.current.has(currentQ.id)) {
      setResearchData(researchCache.current.get(currentQ.id)!);
      return;
    }
    setResearching(true);
    try {
      const data = await researchQuestion(currentQ.id);
      researchCache.current.set(currentQ.id, data);
      setResearchData(data);
    } catch (err) {
      console.error('Failed to perform LLM research:', err);
      setActionError(apiErrorMessage(err, 'Failed to perform LLM research'));
    } finally {
      setResearching(false);
    }
  };

  const handleApplyAiExplanation = async () => {
    if (!researchData?.suggested_explanation) return;
    setActionError(null);
    try {
      await updateQuestion(currentQ.id, { explanation: researchData.suggested_explanation });
      onRefresh();
    } catch (err) {
      console.error('Failed to update explanation:', err);
      setActionError(apiErrorMessage(err, 'Failed to update explanation'));
    }
  };

  const handleApplyAiOptionSuggestions = async () => {
    if (!researchData?.distractor_analyses) return;
    setActionError(null);
    const updatedOptions = currentQ.options.map((opt, idx) => {
      const letter = String.fromCharCode(65 + idx);
      const analysis = researchData.distractor_analyses.find((d) => d.option_letter === letter);
      return {
        ...opt,
        option_text: analysis?.suggested_option_text || opt.option_text,
      };
    });

    try {
      await updateQuestion(currentQ.id, { options: updatedOptions });
      onRefresh();
    } catch (err) {
      console.error('Failed to update option text:', err);
      setActionError(apiErrorMessage(err, 'Failed to update option text'));
    }
  };

  const evidence = mode === 'bank' ? currentQ.evidence : undefined;
  const status = mode === 'bank' ? statusOf(currentQ) : null;
  const accuracy = evidence && evidence.answered > 0 ? Math.round((evidence.correct / evidence.answered) * 100) : null;
  const titleId = `question-review-${currentQ.id}`;

  // The prototype's question review: what the question is, then -- beside it --
  // what the learner has done with it.
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          role: 'dialog',
          'aria-modal': true,
          'aria-labelledby': titleId,
          sx: { width: { xs: '100%', md: '75vw' }, maxWidth: 1100, p: '28px 30px', bgcolor: 'background.default', '@media (max-width:760px)': { p: '18px 16px' } },
        } as object,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <Box sx={{ minWidth: 0, flex: '1 1 320px' }}>
          <Eyebrow>{currentQ.topic || currentQ.domain} · {capitalise(currentQ.difficulty)}</Eyebrow>
          <Typography id={titleId} variant="h4" component="h2" sx={{ mt: '7px' }}>Question review</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: '9px', flexWrap: 'wrap', alignItems: 'center', pt: '10px' }}>
          {mode === 'bank' && (
            <Button variant="outlined" onClick={() => onToggleReviewed?.(currentQ)} aria-pressed={currentQ.is_reviewed}>
              {currentQ.is_reviewed ? 'Reviewed' : 'Mark reviewed'}
            </Button>
          )}
          <Button variant="outlined" onClick={() => onEdit(currentQ)}>Edit</Button>
          <Button variant="outlined" color="error" onClick={() => { onDelete(currentQ.id); }}>Delete</Button>
          <IconButton onClick={onClose} aria-label="Close" sx={{ ml: '4px' }}>
            <X size={20} />
          </IconButton>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', mt: '10px', mb: '14px' }}>
        {status && <Pill tone={status.tone}>{status.label}</Pill>}
        {evidence?.due && <Pill tone="accent">Review due</Pill>}
        <Pill tone={DIFFICULTY_TONE[currentQ.difficulty]}>{currentQ.difficulty}</Pill>
        <Pill>{TYPE_LABEL[currentQ.question_type] ?? currentQ.question_type.replace(/_/g, ' ')}</Pill>
        {mode === 'bank' && (currentQ.is_reviewed ? <Pill tone="success">Reviewed</Pill> : <Pill>Not reviewed</Pill>)}
        <Detail component="span" sx={{ ml: '4px' }}>
          Question #{currentQ.id} · {currentQ.domain}{currentQ.certification ? ` · ${currentQ.certification}` : ''}
        </Detail>
      </Box>

      {actionError && <Alert severity="error" sx={{ mb: '14px' }}>{actionError}</Alert>}

      <Grid template={evidence ? '1.5fr 1fr' : '1fr'} sx={{ alignItems: 'start' }}>
        <Panel component="section" aria-label="The question">
          <Typography component="p" sx={{ fontSize: (t) => t.typography.pxToRem(17), fontWeight: 640, lineHeight: 1.5, m: 0 }}>
            {currentQ.text}
          </Typography>
          {currentQ.code_snippet && (
            <Box className="code-block" sx={{ mt: '12px' }}><pre style={{ margin: 0 }}><code>{currentQ.code_snippet}</code></pre></Box>
          )}
          <Box component="ul" sx={{ m: 0, mt: '6px', p: 0, listStyle: 'none' }}>
            {currentQ.options.map((opt, idx) => (
              <Box
                component="li"
                key={opt.id ? `opt-id-${opt.id}-${idx}` : `opt-idx-${idx}`}
                sx={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px',
                  mt: '8px', p: '13px', borderRadius: '10px', border: '1px solid',
                  borderColor: opt.is_correct ? 'success.main' : 'divider',
                  bgcolor: opt.is_correct ? 'pb.successSoft' : 'background.paper',
                }}
              >
                <Box component="span" sx={{ minWidth: 0 }}>
                  <Box component="b" sx={{ mr: '6px' }}>{String.fromCharCode(65 + idx)}.</Box>
                  {opt.option_text}
                </Box>
                {opt.is_correct && <Pill tone="success" sx={{ flex: '0 0 auto' }}>Correct</Pill>}
              </Box>
            ))}
          </Box>
          {currentQ.explanation ? (
            <Box sx={{ mt: '22px' }}>
              <Eyebrow>Explanation</Eyebrow>
              <Box sx={{ mt: '8px' }}><Explanation text={currentQ.explanation} variant="body1" /></Box>
            </Box>
          ) : (
            <Note sx={{ mt: '16px' }}>No explanation stored for this question.</Note>
          )}

          {mode === 'bank' ? (
            <Box sx={{ mt: '18px', pt: '14px', borderTop: '1px solid', borderColor: 'divider' }}>
              <Button
                variant="outlined"
                startIcon={researching ? <CircularProgress size={16} color="inherit" /> : undefined}
                onClick={handleResearch}
                disabled={researching}
              >
                {researching ? 'Checking with AI…' : 'Check it with AI'}
              </Button>
              <Detail sx={{ mt: '6px' }}>
                Asks your AI provider whether the answer and the options hold up. Nothing changes unless you apply a suggestion.
              </Detail>
            </Box>
          ) : (
            <Detail sx={{ mt: '18px' }}>
              Use "Auto-Refine Entire Batch" to run LLM research on staged questions.
            </Detail>
          )}
        </Panel>

        {evidence && (
          <Box sx={{ display: 'grid', gap: '15px' }}>
            <Panel soft component="section" aria-label="Your evidence">
              <Eyebrow>Your evidence</Eyebrow>
              {accuracy != null ? (
                <>
                  <BigFigure size={26} sx={{ mt: '6px' }}>{accuracy}%</BigFigure>
                  <Bar value={accuracy} label={`${accuracy}% correct`} sx={{ mt: '9px' }} />
                  <MetricRow sx={{ mt: '14px' }}>
                    <Metric value={evidence.answered} label={evidence.answered === 1 ? 'time answered' : 'times answered'} />
                    <Metric value={evidence.correct} label="correct" />
                  </MetricRow>
                </>
              ) : (
                <>
                  <Typography variant="h6" component="h3" sx={{ mt: '8px' }}>Never served to you</Typography>
                  <Sub sx={{ mb: 0 }}>This question has not appeared in a session yet.</Sub>
                </>
              )}
            </Panel>
            <Panel soft component="section" aria-label="Review">
              <Eyebrow>Review</Eyebrow>
              {evidence.due ? (
                <Note sx={{ mt: '10px' }}>Due for review: it is in today's queue.</Note>
              ) : evidence.answered > 0 ? (
                <Good sx={{ mt: '10px' }}>Not due. It comes back on its schedule.</Good>
              ) : (
                <Typography variant="h6" component="h3" sx={{ mt: '8px' }}>Not scheduled</Typography>
              )}
            </Panel>
          </Box>
        )}
      </Grid>

      {researchData && (
        <Panel component="section" aria-labelledby="research-heading" sx={{ mt: '15px' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <Box>
              <Eyebrow>AI check</Eyebrow>
              <Typography id="research-heading" variant="h6" component="h3" sx={{ mt: '4px' }}>What your provider found</Typography>
            </Box>
            <Pill tone={researchData.accuracy_status === 'compliant' ? 'success' : 'warning'}>
              {researchData.accuracy_status}
            </Pill>
          </Box>

          <Box sx={{ mt: '14px' }}>
            <Eyebrow>Source it cited</Eyebrow>
            <Box sx={{ mt: '6px', p: '10px 12px', borderRadius: '9px', bgcolor: 'surfaceContainerHigh.main', maxHeight: 140, overflowY: 'auto' }}>
              <Typography variant="caption" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                {researchData.scrum_guide_citation}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ mt: '14px' }}>
            <Eyebrow>Accuracy</Eyebrow>
            {researchData.accuracy_status === 'compliant'
              ? <Good sx={{ mt: '6px' }}>{researchData.accuracy_explanation}</Good>
              : <Note sx={{ mt: '6px' }}>{researchData.accuracy_explanation}</Note>}
          </Box>

          <Box sx={{ mt: '14px' }}>
            <Eyebrow>Each option</Eyebrow>
            <Box component="ul" sx={{ m: 0, mt: '6px', p: 0, listStyle: 'none' }}>
              {researchData.distractor_analyses.map((d) => (
                <Box component="li" key={d.option_letter} sx={{ py: '10px', borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Box component="b">Option {d.option_letter} · {d.is_correct ? 'the answer' : 'a distractor'}</Box>
                  <Detail sx={{ mt: '2px' }}>{d.critique}</Detail>
                  {d.suggested_option_text && d.suggested_option_text !== d.option_text && (
                    <Detail sx={{ mt: '4px', color: 'text.primary' }}>Suggested wording: “{d.suggested_option_text}”</Detail>
                  )}
                </Box>
              ))}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: '9px', flexWrap: 'wrap', mt: '16px' }}>
            {researchData.distractor_analyses.some((d) => d.suggested_option_text && d.suggested_option_text !== d.option_text) && (
              <Button variant="outlined" onClick={handleApplyAiOptionSuggestions}>Apply the suggested wording</Button>
            )}
            {researchData.suggested_explanation && (
              <Button variant="outlined" onClick={handleApplyAiExplanation}>Apply the suggested explanation</Button>
            )}
          </Box>
        </Panel>
      )}
    </Drawer>
  );
};
