// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';
import type { Attempt } from '../../types/learning';
import { CHALLENGE_BY_ID } from '../../services/learning/challenges';
import { describeOutcome, moved } from '../../services/learning/experiment';

// The learner's own record, read back.
//
// Every attempt keeps its prediction, what the model showed and the learner's
// explanation. Without somewhere to see them again, saving the explanation
// would be a box that swallows text. Nothing here is a score: right or wrong is
// the challenge's own answer key, and the explanation is shown as written.

interface Props {
  attempts: Attempt[];
  limit?: number;
}

export const RecentExperiments: React.FC<Props> = ({ attempts, limit = 5 }) => {
  const recent = attempts
    .filter((a) => a.committedAt)
    .sort((a, b) => Date.parse(b.committedAt!) - Date.parse(a.committedAt!))
    .slice(0, limit);

  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }} component="section" aria-label="Your recent experiments">
      <Typography variant="subtitle2" component="h2" sx={{ fontWeight: 700, mb: 1 }}>
        Your recent experiments
      </Typography>

      {recent.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          None yet. Answer a question above, and what you predicted, what happened and why are kept
          here.
        </Typography>
      ) : (
        <Stack component="ul" spacing={1.5} sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {recent.map((a) => {
            const challenge = CHALLENGE_BY_ID.get(a.challengeId);
            const said = challenge?.options.find((o) => o.id === a.prediction)?.text ?? a.prediction;
            const outcomes = Object.values(a.observed ?? {});
            const movedOutcomes = outcomes.filter(moved);
            return (
              <Box component="li" key={a.attemptId}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {challenge?.prompt ?? a.challengeId}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block' }}>
                  You said: {said}
                  {a.correct === true && ' · matches the model'}
                  {a.correct === false && ' · not what the model does'}
                </Typography>
                {outcomes.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {movedOutcomes.length > 0
                      ? movedOutcomes.slice(0, 2).map(describeOutcome).join('; ')
                      : 'Nothing moved from the baseline'}
                  </Typography>
                )}
                {a.explanationText && (
                  <Typography variant="caption" sx={{ display: 'block', whiteSpace: 'pre-wrap' }}>
                    Your explanation: {a.explanationText}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  {new Date(a.committedAt!).toLocaleString()}
                </Typography>
              </Box>
            );
          })}
        </Stack>
      )}
    </Paper>
  );
};
