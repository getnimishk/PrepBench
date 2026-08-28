// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Paper, Typography, Box, Divider, Link } from '@mui/material';
import { CheckCircle2, XCircle, Info, Link as LinkIcon } from 'lucide-react';
import { Question } from '../../types/question';

interface Props {
  question: Question;
  selectedOptionIds: number[];
}

export const ExplanationDrawer: React.FC<Props> = ({ question, selectedOptionIds }) => {
  if (selectedOptionIds.length === 0) return null;

  const correctOptionIds = question.options.filter((o) => o.is_correct && o.id !== undefined).map((o) => o.id as number);
  const isCorrect =
    correctOptionIds.length === selectedOptionIds.length &&
    new Set(selectedOptionIds).size === selectedOptionIds.length &&
    correctOptionIds.every((id) => selectedOptionIds.includes(id));

  return (
    <Paper sx={{ p: 2.5, mt: 3, borderLeft: 6, borderColor: isCorrect ? 'success.main' : 'error.main' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        {isCorrect ? (
          <CheckCircle2 color="#34D399" size={24} />
        ) : (
          <XCircle color="#FB7185" size={24} />
        )}
        <Typography variant="h6" color={isCorrect ? 'success.main' : 'error.main'} sx={{ fontWeight: 800 }}>
          {isCorrect ? 'Correct Answer!' : 'Incorrect Answer'}
        </Typography>
      </Box>

      {/* Main Explanation */}
      {question.explanation && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Info size={16} /> Detailed Explanation
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-line', color: 'text.secondary' }}>
            {question.explanation}
          </Typography>
        </Box>
      )}

      <Divider sx={{ my: 1.5 }} />

      {/* Option Distractor Analysis */}
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
        Distractor Analysis & Option Breakdown:
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {question.options.map((opt, idx) => (
          <Box key={opt.id !== undefined ? `opt-id-${opt.id}-${idx}` : `opt-idx-${idx}`} sx={{ p: 1.5, borderRadius: 1.5, bgcolor: opt.is_correct ? 'rgba(16,185,129,0.15)' : 'action.hover', opacity: opt.is_correct ? 0.9 : 0.85 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {String.fromCharCode(65 + idx)}. {opt.option_text} {opt.is_correct ? '✓ [Correct]' : '✗ [Incorrect]'}
            </Typography>
            {opt.explanation_why_incorrect && !opt.is_correct && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Why incorrect: {opt.explanation_why_incorrect}
              </Typography>
            )}
          </Box>
        ))}
      </Box>

      {/* Official Reference Link */}
      {question.reference_url && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <LinkIcon size={14} /> Official Reference:{' '}
            <Link href={question.reference_url} target="_blank" rel="noopener noreferrer" underline="hover">
              {question.reference_url}
            </Link>
          </Typography>
        </Box>
      )}
    </Paper>
  );
};
