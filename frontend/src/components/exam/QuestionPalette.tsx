// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useMemo } from 'react';
import { Box, ButtonBase } from '@mui/material';
import { Detail, Eyebrow, Panel } from '../ui/primitives';

interface PaletteAnswer {
  question_id: number;
  selected_option_ids: number[];
  is_flagged: boolean;
}

interface Props {
  totalQuestions: number;
  currentIndex: number;
  questionIdsOrder: number[];
  answers: PaletteAnswer[];
  onSelectIndex: (index: number) => void;
  id?: string;
}

/**
 * The prototype's question palette: one square a question, green once
 * answered, amber while flagged, the current one ringed in the accent. Each
 * square says all of that in words as well, for a screen reader and for anyone
 * who cannot tell the colours apart.
 */
export const QuestionPalette: React.FC<Props> = ({
  totalQuestions,
  currentIndex,
  questionIdsOrder,
  answers,
  onSelectIndex,
  id,
}) => {
  const answerMap = useMemo(() => {
    const map = new Map<number, PaletteAnswer>();
    answers.forEach((a) => map.set(a.question_id, a));
    return map;
  }, [answers]);

  return (
    <Panel id={id} component="section" aria-label="Question palette" sx={{ mt: '14px' }}>
      <Eyebrow component="h2">Question palette</Eyebrow>
      <Detail sx={{ mt: '4px' }}>Green is answered, amber is flagged. Pick one to go to it.</Detail>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(38px, 1fr))', gap: '5px', mt: '10px' }}>
        {Array.from({ length: totalQuestions }).map((_, idx) => {
          const ans = answerMap.get(questionIdsOrder[idx]);
          const answered = !!ans && ans.selected_option_ids?.length > 0;
          const flagged = !!ans?.is_flagged;
          const current = idx === currentIndex;
          const tone = flagged ? 'warning' : answered ? 'success' : null;
          return (
            <ButtonBase
              key={idx}
              onClick={() => onSelectIndex(idx)}
              aria-label={`Question ${idx + 1}, ${answered ? 'answered' : 'unanswered'}${flagged ? ', flagged' : ''}${current ? ', current' : ''}`}
              aria-current={current ? 'step' : undefined}
              sx={{
                aspectRatio: '1', minWidth: 0, borderRadius: '6px', fontSize: (t) => t.typography.pxToRem(10), fontWeight: 750,
                border: current ? '2px solid' : '1px solid',
                borderColor: current ? 'primary.main' : 'divider',
                bgcolor: tone ? `pb.${tone}Soft` : 'background.paper',
                color: tone ? `pb.${tone}` : 'text.secondary',
                '&:hover': { borderColor: 'primary.main' },
                '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '1px' },
              }}
            >
              {idx + 1}
            </ButtonBase>
          );
        })}
      </Box>
    </Panel>
  );
};
