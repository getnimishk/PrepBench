// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Box, Link } from '@mui/material';
import { Question } from '../../types/question';
import { Detail, Eyebrow, Good } from '../ui/primitives';
import { Explanation } from '../common/Explanation';
import { gradeSelection } from '../../services/questionFormats';

interface Props {
  question: Question;
  selectedOptionIds: number[];
}

/**
 * After a practice answer: whether it was right, why, and why each wrong option
 * is wrong. The options themselves are already marked above -- the right ones
 * green, a wrong pick red -- so this does not list them all a second time.
 */
export const ExplanationDrawer: React.FC<Props> = ({ question, selectedOptionIds }) => {
  // One rule for every type (services/questionFormats.ts): nothing to explain until there is an answer.
  const graded = gradeSelection(question, selectedOptionIds);
  if (graded === null) return null;
  const isCorrect = graded;

  const whyWrong = question.options
    .map((opt, idx) => ({ opt, letter: String.fromCharCode(65 + idx) }))
    .filter(({ opt }) => !opt.is_correct && opt.explanation_why_incorrect);

  return (
    <Box component="section" aria-label="Explanation" sx={{ mt: '18px', pt: '16px', borderTop: '1px solid', borderColor: 'divider' }}>
      {isCorrect ? (
        <Good role="status">Correct.</Good>
      ) : (
        <Box
          role="status"
          sx={{
            p: '12px 13px', borderRadius: '9px', border: '1px solid', borderColor: 'error.main',
            bgcolor: 'pb.dangerSoft', color: 'error.main',
          }}
        >
          Not this time. The right answer is marked above.
        </Box>
      )}

      {question.explanation && (
        <Box sx={{ mt: '16px' }}>
          <Eyebrow>Explanation</Eyebrow>
          <Box sx={{ mt: '8px' }}><Explanation text={question.explanation} variant="body1" /></Box>
        </Box>
      )}

      {whyWrong.length > 0 && (
        <Box sx={{ mt: '16px' }}>
          <Eyebrow>Why the others are wrong</Eyebrow>
          <Box component="ul" sx={{ m: 0, mt: '8px', pl: 0, listStyle: 'none' }}>
            {whyWrong.map(({ opt, letter }) => (
              <Box component="li" key={opt.id ?? letter} sx={{ py: '8px', borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box component="b" sx={{ fontWeight: 650 }}>{letter}. {opt.option_text}</Box>
                <Detail sx={{ mt: '2px' }}>{opt.explanation_why_incorrect}</Detail>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {question.reference_url && (
        <Detail sx={{ mt: '14px' }}>
          Reference:{' '}
          <Link href={question.reference_url} target="_blank" rel="noopener noreferrer" underline="hover">
            {question.reference_url}
          </Link>
        </Detail>
      )}
    </Box>
  );
};
