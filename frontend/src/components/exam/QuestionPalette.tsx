import React, { useMemo } from 'react';
import { Box, Typography, Button, Paper, Grid } from '@mui/material';

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
}

export const QuestionPalette: React.FC<Props> = ({
  totalQuestions,
  currentIndex,
  questionIdsOrder,
  answers,
  onSelectIndex,
}) => {
  const answerMap = useMemo(() => {
    const map = new Map<number, PaletteAnswer>();
    answers.forEach((a) => map.set(a.question_id, a));
    return map;
  }, [answers]);

  const getStatusColor = (idx: number) => {
    const qid = questionIdsOrder[idx];
    const ans = answerMap.get(qid);
    if (!ans) return { bgcolor: 'transparent', borderColor: 'divider', color: 'text.primary', isFlagged: false, isAnswered: false };
    
    const isAnswered = ans.selected_option_ids && ans.selected_option_ids.length > 0;
    const isFlagged = Boolean(ans.is_flagged);

    if (isAnswered) {
      return { bgcolor: 'action.selected', borderColor: 'primary.main', color: 'primary.main', isFlagged, isAnswered: true };
    }
    return { bgcolor: 'transparent', borderColor: 'divider', color: 'text.primary', isFlagged, isAnswered: false };
  };

  return (
    <Paper sx={{ p: 2, height: 'max-content', position: 'sticky', top: 80, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
        Question Navigator
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '2px', borderLeft: '2px solid #6366F1', bgcolor: 'rgba(99,102,241,0.16)' }} />
          <Typography variant="caption">Answered</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'error.main' }} />
          <Typography variant="caption">Flagged</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '2px', border: '1px solid', borderColor: 'divider' }} />
          <Typography variant="caption">Unanswered</Typography>
        </Box>
      </Box>

      <Grid container spacing={1}>
        {Array.from({ length: totalQuestions }).map((_, idx) => {
          const status = getStatusColor(idx);
          const isCurrent = idx === currentIndex;
          return (
            <Grid item key={idx} xs={3} sm={2.4}>
              <Button
                disableElevation
                onClick={() => onSelectIndex(idx)}
                aria-label={`Question ${idx + 1}, ${status.isAnswered ? 'answered' : 'unanswered'}${status.isFlagged ? ', flagged' : ''}${isCurrent ? ', current' : ''}`}
                  sx={{
                  minWidth: 0,
                  width: '100%',
                  height: 40,
                  fontWeight: isCurrent ? 800 : 600,
                  position: 'relative',
                  borderRadius: 2,
                  bgcolor: status.bgcolor,
                  color: status.color,
                  border: '1px solid',
                  borderColor: isCurrent ? 'primary.main' : status.borderColor,
                  borderWidth: isCurrent ? '2px' : '1px',
                  boxShadow: 'none',
                  '&:hover': { opacity: 0.9, borderColor: 'primary.light' }
                }}
              >
                {idx + 1}
                {status.isFlagged && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: 'error.main',
                      boxShadow: 'none'
                    }}
                  />
                )}
              </Button>
            </Grid>
          );
        })}
      </Grid>
    </Paper>
  );
};
