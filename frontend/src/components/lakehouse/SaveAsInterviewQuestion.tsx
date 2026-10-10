// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { Box, Button, TextField, Typography } from '@mui/material';
import { Actions, Detail, Good, Panel, Sub } from '../ui/primitives';
import { saveInterviewQuestionFromSource } from '../../services/api';
import { apiErrorMessage } from '../../services/apiError';
import {
  defaultQuestionText,
  extractTalkingPoints,
  labInterviewSourceRef,
} from '../../services/lakehouse/labInterviewQuestion';
import type { WireLearningAttempt } from '../../types/learning';
import type { LabStation } from '../../types/lakehouse';

export interface SaveAsInterviewQuestionProps {
  subjectId?: number;
  packId: string;
  packVersion: number;
  /** The station's letter; it names the question's source, so it must not be a display label. */
  station: LabStation;
  challengeId: string;
  challengeTitle: string;
  attempt?: WireLearningAttempt | null;
  category?: string;
}

/**
 * Allows the learner to save an interview question to their preparation from their
 * own finished station attempt.
 *
 * Invariant: Talking points are drawn strictly and only from what this learner observed
 * in that attempt. If no observations exist, nothing is offered to save.
 */
export const SaveAsInterviewQuestion: React.FC<SaveAsInterviewQuestionProps> = ({
  subjectId,
  packId,
  packVersion,
  station,
  challengeId,
  challengeTitle,
  attempt,
  category = 'Databricks Lakehouse',
}) => {
  const points = extractTalkingPoints(attempt?.observed);
  const hasObservations = points.length > 0;
  // Compared by value: a refetch hands over a new `observed` object with the same values, and
  // that must not wipe what the learner has typed.
  const pointsText = points.join('\n');

  const [questionText, setQuestionText] = useState(() => defaultQuestionText(station, challengeTitle));
  const [talkingPointsText, setTalkingPointsText] = useState(pointsText);
  const [preparedAnswer, setPreparedAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ created: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Start again only when it is a different attempt, or its recorded values really changed.
  useEffect(() => {
    setQuestionText(defaultQuestionText(station, challengeTitle));
    setTalkingPointsText(pointsText);
    setSaveStatus(null);
    setError(null);
  }, [attempt?.attempt_uid, pointsText, station, challengeTitle]);

  // A lab question belongs to the Databricks preparation. Without one there is nowhere private to
  // keep it: saving with no preparation would put it in the shared library, seen from every one.
  if (subjectId == null) {
    return (
      <Panel sx={{ mt: '12px' }}>
        <Typography variant="subtitle2" component="h4" sx={{ fontWeight: 700, mb: '4px' }}>
          Interview question
        </Typography>
        <Detail>
          Interview questions from the lab are saved under the Databricks preparation, and there isn't one.
          Create it in Preparations to save this result as a question.
        </Detail>
      </Panel>
    );
  }

  if (!hasObservations) {
    return (
      <Panel sx={{ mt: '12px' }}>
        <Typography variant="subtitle2" component="h4" sx={{ fontWeight: 700, mb: '4px' }}>
          Interview question
        </Typography>
        <Detail>
          No observations recorded yet. Complete this challenge to record observations before saving an interview question.
        </Detail>
      </Panel>
    );
  }

  const onSave = async () => {
    setSaving(true);
    setError(null);
    setSaveStatus(null);

    const sourceRef = labInterviewSourceRef(packId, packVersion, station, challengeId);
    const parsedPoints = talkingPointsText
      .split('\n')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    try {
      const result = await saveInterviewQuestionFromSource({
        source_ref: sourceRef,
        subject_id: subjectId,
        round_type: 'technical',
        question_text: questionText.trim(),
        category,
        prepared_answer: preparedAnswer.trim() || undefined,
        key_talking_points: parsedPoints,
      });

      setSaveStatus({
        created: result.created,
        message: result.created
          ? 'Added to your interview question library as a Technical question. Rehearse it aloud in the Interview Studio.'
          : 'Updated in your interview question library: your talking points and prepared answer are on record.',
      });
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the interview question.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel sx={{ mt: '12px' }}>
      <Typography variant="subtitle2" component="h4" sx={{ fontWeight: 700, mb: '4px' }}>
        Save as interview question
      </Typography>
      <Sub sx={{ mb: '8px' }}>
        Turn your actual lab findings into a technical interview rehearsal question. Talking points come from what you observed.
      </Sub>

      <TextField
        label="Question prompt"
        size="small"
        fullWidth
        value={questionText}
        onChange={(e) => setQuestionText(e.target.value)}
        sx={{ mt: '8px' }}
      />

      <TextField
        label="Key talking points (one per line, from your observations)"
        size="small"
        multiline
        minRows={3}
        fullWidth
        value={talkingPointsText}
        onChange={(e) => setTalkingPointsText(e.target.value)}
        sx={{ mt: '12px' }}
        helperText="These points are checked against your verbal response when rehearsing in the studio."
      />

      <TextField
        label="Prepared answer (optional)"
        size="small"
        multiline
        minRows={2}
        fullWidth
        value={preparedAnswer}
        onChange={(e) => setPreparedAnswer(e.target.value)}
        sx={{ mt: '12px' }}
        placeholder="Draft your model response or leave blank to formulate during practice…"
      />

      <Actions sx={{ mt: '12px' }}>
        <Button
          variant="contained"
          color="primary"
          onClick={onSave}
          disabled={saving || !questionText.trim() || !talkingPointsText.trim()}
        >
          {saving ? 'Saving…' : 'Save as interview question'}
        </Button>
      </Actions>

      {saveStatus && (
        <Good sx={{ mt: '10px' }} role="status">
          {saveStatus.message}
        </Good>
      )}

      {error && (
        <Box role="alert" sx={{ mt: '10px' }}>
          <Detail sx={{ color: 'error.main' }}>{error}</Detail>
        </Box>
      )}
    </Panel>
  );
};
