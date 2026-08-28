// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  ArrowRight,
  Check,
  HelpCircle,
  Lightbulb,
  Target,
  X,
} from 'lucide-react';
import type { Attempt, ScenarioId } from '../../types/learning';
import { CONCEPTS } from '../../services/learning/concepts';
import { CHALLENGE_BY_ID } from '../../services/learning/challenges';
import { SCENARIOS } from '../../services/learning/scenarios';
import { COUPLING_BY_ID } from '../../services/metrics/couplings';
import {
  commitPrediction,
  completeAttempt,
  startAttempt,
  withHint,
} from '../../services/learning/attempts';
import type { Recommendation } from '../../services/learning/recommendations';
import { ConceptCard } from './ConceptCard';

// The guided loop, in one surface.
//
//   ORIENT -> RECOGNIZE / COMMIT -> ACT -> COMPARE -> EXPLAIN -> GENERALISE
//
// Two things carry the whole design and both are structural rather than
// cosmetic:
//
// 1. THE PREDICTION IS RECORDED BEFORE ANY RESULT IS VISIBLE. One click on an
//    option commits it, and it cannot be amended. Without that, everything
//    downstream is hindsight, and every accuracy number in the product would
//    be measuring nothing.
//
// 2. THE EXPLANATION ARRIVES AFTER. The mechanism is revealed once the learner
//    has already been right or wrong about it, which is when they want it.
//    Showing it first would make the sandbox an illustration of a paragraph.
//
// Hints are always available and always recorded. Taking one is legitimate;
// it just stops the attempt counting as unaided evidence, which is the honest
// consequence rather than a punishment.
//
// PHASE 1: there is no articulation step. Turning this reasoning into a spoken
// answer is Phase 2, and the recorder is deliberately untouched.

export type LoopStep = 'orient' | 'commit' | 'result';

interface Props {
  recommendation: Recommendation;
  /** Set when the learner has already met this concept in this session. */
  conceptSeen: boolean;
  /** Applies the challenge's scenario to the sandbox. The ACT step. */
  onApplyScenario: (scenario: ScenarioId) => void;
  onAttemptSaved: (attempt: Attempt) => void;
  onSkip: () => void;
}

export const LearningPanel: React.FC<Props> = ({
  recommendation,
  conceptSeen,
  onApplyScenario,
  onAttemptSaved,
  onSkip,
}) => {
  const challenge = CHALLENGE_BY_ID.get(recommendation.challengeId)!;
  const concept = CONCEPTS[recommendation.conceptId];

  const [step, setStep] = useState<LoopStep>(conceptSeen ? 'commit' : 'orient');
  const [attempt, setAttempt] = useState<Attempt>(() => startAttempt(challenge));
  const [hintsShown, setHintsShown] = useState(0);

  // A fresh challenge means a fresh attempt: an id from a previous challenge
  // would attach this evidence to the wrong concept.
  const challengeId = challenge.id;
  useMemo(() => {
    setAttempt(startAttempt(challenge));
    setHintsShown(0);
    setStep(conceptSeen ? 'commit' : 'orient');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeId]);

  const beginChallenge = () => {
    onApplyScenario(challenge.scenario);
    setStep('commit');
  };

  const commit = (optionId: string) => {
    // One click commits. Recorded before anything about the result is on
    // screen, and not amendable afterwards.
    const committed = commitPrediction(attempt, optionId);
    const finished = completeAttempt(committed, challenge);
    setAttempt(finished);
    onAttemptSaved(finished);
    setStep('result');
  };

  const revealHint = () => {
    if (hintsShown >= challenge.hints.length) return;
    setHintsShown((n) => n + 1);
    setAttempt((a) => withHint(a));
  };

  const chosen = challenge.options.find((o) => o.id === attempt.prediction);
  const answer = challenge.options.find((o) => o.id === challenge.correctOptionId)!;
  const wasRight = attempt.correct === true;

  // -------------------------------------------------------------- ORIENT
  if (step === 'orient') {
    return (
      <ConceptCard
        concept={concept}
        onContinue={beginChallenge}
        continueLabel="Got it — try it"
      />
    );
  }

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, mb: 2, borderColor: 'primary.main', bgcolor: (t) => t.palette.primary.main + '0A' }}
    >
      <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
        <Box sx={{ color: 'primary.main', mt: 0.25 }}>
          <Target size={22} />
        </Box>

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5, mb: 0.5 }}
          >
            <Typography
              variant="caption"
              sx={{
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                fontWeight: 700,
                color: 'primary.main',
              }}
            >
              {concept.canonicalName}
            </Typography>
            <Chip
              size="small"
              variant="outlined"
              label={challenge.type}
              sx={{ height: 18, fontSize: '0.6rem' }}
            />
            <Chip
              size="small"
              variant="outlined"
              label={SCENARIOS[challenge.scenario].label}
              sx={{ height: 18, fontSize: '0.6rem' }}
            />
          </Stack>

          <Typography variant="body1" sx={{ fontWeight: 600, mb: 1.5 }}>
            {challenge.prompt}
          </Typography>

          {/* ------------------------------------------------------ COMMIT */}
          {step === 'commit' && (
            <>
              <Stack spacing={1}>
                {challenge.options.map((option) => (
                  <Button
                    key={option.id}
                    variant="outlined"
                    onClick={() => commit(option.id)}
                    sx={{
                      textTransform: 'none',
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      py: 1,
                    }}
                  >
                    {option.text}
                  </Button>
                ))}
              </Stack>

              {challenge.hints.slice(0, hintsShown).map((hint) => (
                <Alert
                  key={hint.tier}
                  severity="info"
                  icon={<Lightbulb size={16} />}
                  sx={{ mt: 1, py: 0.25 }}
                >
                  <Typography variant="caption">{hint.text}</Typography>
                </Alert>
              ))}

              <Stack
                direction="row"
                spacing={1}
                sx={{ mt: 1.5, alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}
              >
                <Button
                  size="small"
                  startIcon={<HelpCircle size={14} />}
                  disabled={hintsShown >= challenge.hints.length}
                  onClick={revealHint}
                  sx={{ textTransform: 'none' }}
                >
                  {hintsShown === 0 ? 'Stuck? Take a hint' : 'Another hint'}
                </Button>
                <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
                  {hintsShown === 0
                    ? 'Answering without a hint is what counts as evidence — but a hint is always here.'
                    : `${hintsShown} hint${hintsShown === 1 ? '' : 's'} taken. This attempt still counts, just not as unaided.`}
                </Typography>
                <Button size="small" onClick={onSkip} sx={{ textTransform: 'none' }}>
                  Skip
                </Button>
              </Stack>
            </>
          )}

          {/* ------------------------------ COMPARE, then EXPLAIN ---------- */}
          {step === 'result' && (
            <>
              <Stack spacing={1} sx={{ mb: 1.5 }}>
                <ResultRow
                  label="You said"
                  text={chosen?.text ?? '—'}
                  tone={wasRight ? 'success' : 'warning'}
                  icon={wasRight ? <Check size={15} /> : <X size={15} />}
                />
                {!wasRight && (
                  <ResultRow label="The model does this" text={answer.text} tone="success" />
                )}
              </Stack>

              <Divider sx={{ mb: 1.5 }} />

              <Typography
                variant="caption"
                sx={{
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  fontWeight: 700,
                  color: 'text.secondary',
                }}
              >
                Why
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, mb: 1 }}>
                {challenge.explanation}
              </Typography>

              {challenge.explanationCouplings.length > 0 && (
                <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap', mb: 1 }}>
                  {challenge.explanationCouplings.map((id) => {
                    const coupling = COUPLING_BY_ID.get(id);
                    if (!coupling) return null;
                    return (
                      <Chip
                        key={id}
                        size="small"
                        variant="outlined"
                        color={coupling.type === 'assumption' ? 'warning' : 'default'}
                        label={`${coupling.type}: ${coupling.formula}`}
                        sx={{ height: 22, fontSize: '0.65rem' }}
                      />
                    );
                  })}
                </Stack>
              )}

              {concept.evidenceBoundary && (
                // The sixth move of a defensible answer, and the one the model
                // cannot supply raw material for: what this cannot establish
                // about a real organisation.
                <Alert severity="warning" sx={{ py: 0.25, mb: 1 }}>
                  <Typography variant="caption">
                    <strong>What this cannot tell you: </strong>
                    {concept.evidenceBoundary}
                  </Typography>
                </Alert>
              )}

              <Button
                variant="contained"
                size="small"
                disableElevation
                endIcon={<ArrowRight size={14} />}
                onClick={onSkip}
                sx={{ textTransform: 'none' }}
              >
                Next
              </Button>
            </>
          )}
        </Box>
      </Stack>
    </Paper>
  );
};

const ResultRow: React.FC<{
  label: string;
  text: string;
  tone: 'success' | 'warning';
  icon?: React.ReactNode;
}> = ({ label, text, tone, icon }) => (
  <Box
    sx={{
      p: 1,
      borderRadius: 1,
      bgcolor: (t) => t.palette[tone].main + '14',
      borderLeft: (t) => `3px solid ${t.palette[tone].main}`,
    }}
  >
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
      {icon && <Box sx={{ color: `${tone}.main`, display: 'flex' }}>{icon}</Box>}
      <Typography variant="caption" sx={{ fontWeight: 700 }}>
        {label}
      </Typography>
    </Stack>
    <Typography variant="body2" sx={{ mt: 0.25 }}>
      {text}
    </Typography>
  </Box>
);
