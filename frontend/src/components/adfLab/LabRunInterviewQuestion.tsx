// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { Box, Button, TextField } from '@mui/material';
import { Actions, Detail, Good, Panel, PanelHead, Sub } from '../ui/primitives';
import { saveInterviewQuestionFromSource } from '../../services/api';
import { apiErrorMessage } from '../../services/apiError';
import type { LabExperiment } from '../../services/adfLab/experiments';
import type { LabSpec } from '../../services/adfLab/lab';
import { labRunSourceRef, runQuestionText, runTalkingPoints } from '../../services/adfLab/interviewQuestion';
import type { WireLearningAttempt } from '../../types/learning';

/**
 * Save a finished lab run as an interview question in this preparation (Interview → Question library),
 * so a practice round is graded against the learner's own talking points. Offered only when the run
 * recorded what the learner changed and saw; nothing is invented to fill it.
 */
export const LabRunInterviewQuestion: React.FC<{
  lab: LabSpec;
  experiment: LabExperiment;
  track: string;
  modeTitle?: string;
  subjectId: number;
  /** The run's predict row: it holds the manipulation and the observation. */
  run: WireLearningAttempt;
  idPrefix: string;
}> = ({ lab, experiment, track, modeTitle, subjectId, run, idPrefix }) => {
  const points = runTalkingPoints(run.manipulation as Record<string, unknown> | null, run.observed as Record<string, unknown> | null);
  const pointsText = points.join('\n');
  const [question, setQuestion] = useState(() => runQuestionText(lab, experiment, modeTitle));
  const [talkingPoints, setTalkingPoints] = useState(pointsText);
  const [answer, setAnswer] = useState(run.explanation_text ?? '');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Start again for another run, never on a refetch of the same values.
  useEffect(() => {
    setQuestion(runQuestionText(lab, experiment, modeTitle));
    setTalkingPoints(pointsText);
    setAnswer(run.explanation_text ?? '');
    setStatus(null);
    setError(null);
  }, [run.attempt_uid, pointsText, lab, experiment, modeTitle, run.explanation_text]);

  const titleId = `${idPrefix}-interview-question`;
  if (points.length === 0) {
    return (
      <Panel component="section" aria-labelledby={titleId} sx={{ mt: '15px' }}>
        <PanelHead title="Save as interview question" titleId={titleId} />
        <Detail>This run recorded no observations, so there is nothing of yours to turn into talking points.</Detail>
      </Panel>
    );
  }

  const save = async () => {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const result = await saveInterviewQuestionFromSource({
        source_ref: labRunSourceRef(lab, track),
        subject_id: subjectId,
        round_type: 'technical',
        question_text: question.trim(),
        category: lab.name,
        prepared_answer: answer.trim() || undefined,
        key_talking_points: talkingPoints.split('\n').map((p) => p.trim()).filter(Boolean),
      });
      setStatus(result.created
        ? 'Added to your interview question library as a Technical question. Rehearse it aloud in Interview practice.'
        : 'Updated in your interview question library with this run’s talking points.');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the interview question.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel component="section" aria-labelledby={titleId} sx={{ mt: '15px' }}>
      <PanelHead title="Save as interview question" titleId={titleId} />
      <Sub sx={{ mb: '8px' }}>
        Turn this run into a question you can rehearse. The talking points are what your run recorded; edit them freely.
        One question per experiment: saving a later run updates it.
      </Sub>
      <TextField label="Question" size="small" fullWidth multiline value={question} onChange={(e) => setQuestion(e.target.value)} sx={{ mt: '8px' }} />
      <TextField
        label="Key talking points (one per line)" size="small" fullWidth multiline minRows={3}
        value={talkingPoints} onChange={(e) => setTalkingPoints(e.target.value)} sx={{ mt: '12px' }}
        helperText="A practice round checks your spoken answer against these."
      />
      <TextField
        label="Prepared answer (optional)" size="small" fullWidth multiline minRows={2}
        value={answer} onChange={(e) => setAnswer(e.target.value)} sx={{ mt: '12px' }}
        helperText="Starts as your explanation from this run."
      />
      <Actions sx={{ mt: '12px' }}>
        <Button variant="contained" onClick={save} disabled={saving || !question.trim() || !talkingPoints.trim()}>
          {saving ? 'Saving…' : 'Save as interview question'}
        </Button>
      </Actions>
      {status && <Good sx={{ mt: '10px' }} role="status">{status}</Good>}
      {error && <Box role="alert" sx={{ mt: '10px' }}><Detail sx={{ color: 'error.main' }}>{error}</Detail></Box>}
    </Panel>
  );
};
