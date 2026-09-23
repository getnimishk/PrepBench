// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Eyebrow, Panel } from '../ui/primitives';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
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
import { describeChange, describeOutcome, moved } from '../../services/learning/experiment';
import { apiErrorMessage } from '../../services/apiError';
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
// The experiment is kept with the attempt: what was changed from the baseline
// and what the model then showed, read at the moment of commitment. "What
// actually happened" is those numbers, never a sentence about what usually
// happens. The learner's own explanation is saved beside it, and is not scored
// -- there is nothing honest to score it against without a grader.

// ORIENT is no longer a step. It was a full-width card between the learner
// and the question, and its content -- what a sprint is, that the charts are
// per-sprint, that the run is deterministic -- is framing for reading the
// charts, not for answering the question. It opens under the prediction now,
// for anyone who wants it.
export type LoopStep = 'commit' | 'result';

interface Props {
  recommendation: Recommendation;
  /** Set when the learner has already met this concept in this session. */
  conceptSeen: boolean;
  /** Applies the challenge's scenario to the sandbox. The ACT step. */
  onApplyScenario: (scenario: ScenarioId) => void;
  /**
   * The experiment, read once when the prediction is committed: the scenario
   * named, or what the sandbox is showing when none is.
   */
  observe?: (scenario?: ScenarioId) => Pick<Attempt, 'manipulation' | 'observed'>;
  /** Saves the attempt. A rejected promise is shown as "not saved", with a retry. */
  onAttemptSaved: (attempt: Attempt) => Promise<unknown> | void;
  onSkip: () => void;
}

type SaveState = { state: 'idle' | 'saving' | 'saved' } | { state: 'failed'; error: string };

export const LearningPanel: React.FC<Props> = ({
  recommendation,
  conceptSeen,
  onApplyScenario,
  observe,
  onAttemptSaved,
  onSkip,
}) => {
  const challenge = CHALLENGE_BY_ID.get(recommendation.challengeId)!;
  const concept = CONCEPTS[recommendation.conceptId];

  const [step, setStep] = useState<LoopStep>('commit');
  // Whether the framing note is open. Closed by default even on a first
  // visit: it is available, not compulsory.
  const [conceptOpen, setConceptOpen] = useState(false);
  const [attempt, setAttempt] = useState<Attempt>(() => startAttempt(challenge));
  const [hintsShown, setHintsShown] = useState(0);
  const [saved, setSaved] = useState<SaveState>({ state: 'idle' });
  const [explanation, setExplanation] = useState('');
  const [explanationSaved, setExplanationSaved] = useState<SaveState>({ state: 'idle' });

  // A fresh challenge means a fresh attempt: an id from a previous challenge
  // would attach this evidence to the wrong concept.
  //
  // This used to be a useMemo called purely for the three setState calls
  // inside it. It happened to work, because React runs a memo during render
  // and treats the updates as a render-phase change -- but a memo is allowed
  // to be discarded and recomputed, and nothing about "cache this value"
  // promises "run this side effect exactly once per id". It is the documented
  // reset-on-prop-change pattern instead: compare the id against the one this
  // state was built for, and adjust during render, which React does support.
  // A prediction question is answered before the model runs the change it asks
  // about: predict, commit, then manipulate and observe. Showing the changed
  // model while the question is open would put the answer on screen beside it.
  // Questions that ask the learner to read or diagnose a chart need the
  // scenario showing, so they get it on arrival.
  const predictsFirst = challenge.type === 'prediction';

  const [builtFor, setBuiltFor] = useState(challenge.id);
  if (builtFor !== challenge.id) {
    setBuiltFor(challenge.id);
    setAttempt(startAttempt(challenge));
    setHintsShown(0);
    setStep('commit');
    setConceptOpen(false);
    setSaved({ state: 'idle' });
    setExplanation('');
    setExplanationSaved({ state: 'idle' });
  }

  // The ACT step, which used to be tied to dismissing the orientation card.
  // The sandbox has to be showing the scenario the question is about before
  // the question can be answered, so it is applied when the challenge
  // arrives rather than when a card is clicked. An effect rather than a
  // render-phase call, because it moves state that belongs to the page.
  useEffect(() => {
    onApplyScenario(predictsFirst ? 'baseline' : challenge.scenario);
    // Keyed on the challenge alone: onApplyScenario is redefined every render
    // by the page, and depending on it would re-apply the scenario over any
    // slider the learner had since moved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge.id]);

  const persist = (next: Attempt, report: (s: SaveState) => void) => {
    report({ state: 'saving' });
    Promise.resolve(onAttemptSaved(next)).then(
      () => {
        // A save records everything the attempt has established, so any
        // save that lands is also the answer saved.
        setAttempt(next);
        setSaved({ state: 'saved' });
        report({ state: 'saved' });
      },
      (err: unknown) =>
        report({ state: 'failed', error: apiErrorMessage(err, 'The server did not accept it.') }),
    );
  };

  const commit = (optionId: string) => {
    // One click commits. Recorded before anything about the result is on
    // screen, and not amendable afterwards. The experiment is read at the same
    // moment, so what it showed is kept exactly as it was.
    const committed = commitPrediction(attempt, optionId);
    // MANIPULATE, only now that the prediction is on the record.
    if (predictsFirst) onApplyScenario(challenge.scenario);
    const experiment = observe?.(predictsFirst ? challenge.scenario : undefined);
    const finished = completeAttempt(experiment ? { ...committed, ...experiment } : committed, challenge);
    setAttempt(finished);
    persist(finished, setSaved);
    setStep('result');
  };

  const saveExplanationText = () => {
    const text = explanation.trim();
    if (!text) return;
    persist({ ...attempt, explanationText: text }, setExplanationSaved);
  };

  const revealHint = () => {
    if (hintsShown >= challenge.hints.length) return;
    setHintsShown((n) => n + 1);
    setAttempt((a) => withHint(a));
  };

  const chosen = challenge.options.find((o) => o.id === attempt.prediction);
  const answer = challenge.options.find((o) => o.id === challenge.correctOptionId)!;
  const wasRight = attempt.correct === true;
  const observedOutcomes = Object.values(attempt.observed ?? {});
  const movedOutcomes = observedOutcomes.filter(moved);
  const stillOutcomes = observedOutcomes.filter((o) => !moved(o));
  const changes = Object.entries(attempt.manipulation ?? {});

  return (
    <Panel
      soft
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
            <Eyebrow color="primary.main">
              {concept.canonicalName}
            </Eyebrow>
            {/* challenge.type -- "recognition", "prediction", "reading" --
                described the question to the curriculum, not to the person
                answering it. The scenario was a chip beside it; it is the
                one piece of context the question genuinely needs, so it is
                a sentence instead. */}
          </Stack>

          <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
            {challenge.prompt}
          </Typography>

          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
            {predictsFirst && step === 'commit'
              ? `The sandbox is showing the ${SCENARIOS.baseline.label.toLowerCase()}. Predict first; then it runs: ${SCENARIOS[challenge.scenario].label.toLowerCase()}.`
              : `The sandbox is running: ${SCENARIOS[challenge.scenario].label.toLowerCase()}.`}
          </Typography>

          {/* ------------------------------------------------------ COMMIT */}
          {step === 'commit' && (
            <>
              <Stack spacing={1} role="group" aria-label="Your prediction">
                {challenge.options.map((option) => (
                  <Button
                    key={option.id}
                    variant="outlined"
                    onClick={() => commit(option.id)}
                    sx={{
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      py: 1 }}
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
                >
                  {hintsShown === 0 ? 'Stuck? Take a hint' : 'Another hint'}
                </Button>
                <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
                  {hintsShown === 0
                    ? 'Answering without a hint is what counts as evidence — but a hint is always here.'
                    : `${hintsShown} hint${hintsShown === 1 ? '' : 's'} taken. This attempt still counts, just not as unaided.`}
                </Typography>
                <Button size="small" onClick={onSkip}>
                  Skip
                </Button>
              </Stack>

              {/* Available, never in the way. Shown only until the learner has
                  an attempt against this concept, after which they have met
                  it by doing rather than by reading. */}
              {!conceptSeen && (
                <Box sx={{ mt: 1.5 }}>
                  <Button
                    size="small"
                    onClick={() => setConceptOpen((open) => !open)}
                    endIcon={conceptOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    aria-expanded={conceptOpen}
                  >
                    New to this? What the sandbox is showing
                  </Button>
                  <Collapse in={conceptOpen} unmountOnExit>
                    <Box sx={{ mt: 1 }}>
                      <ConceptCard concept={concept} />
                    </Box>
                  </Collapse>
                </Box>
              )}
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

              {saved.state === 'saving' && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Saving your answer…
                </Typography>
              )}
              {saved.state === 'failed' && (
                <Alert
                  severity="error"
                  sx={{ mb: 1.5 }}
                  action={
                    <Button color="inherit" size="small" onClick={() => persist(attempt, setSaved)}>
                      Try again
                    </Button>
                  }
                >
                  Your answer was not saved, so it does not count yet. {saved.error}
                </Alert>
              )}

              {observedOutcomes.length > 0 && (
                <Box component="section" sx={{ mb: 1.5 }} aria-label="What actually happened">
                  <SectionLabel>What actually happened</SectionLabel>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                    {changes.length > 0
                      ? `Changed from the baseline: ${changes.map(([key, c]) => describeChange(key, c)).join(', ')}`
                      : 'Nothing was changed from the baseline.'}
                  </Typography>
                  {movedOutcomes.length > 0 ? (
                    <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
                      {movedOutcomes.map((o) => (
                        <Typography component="li" variant="body2" key={o.label} sx={{ fontWeight: 600 }}>
                          {describeOutcome(o)}
                        </Typography>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      None of the headline figures moved.
                    </Typography>
                  )}
                  {movedOutcomes.length > 0 && stillOutcomes.length > 0 && (
                    // Named, not listed: what stayed put matters, but it is not news.
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      Unchanged: {stillOutcomes.map((o) => o.label).join(', ')}
                    </Typography>
                  )}
                </Box>
              )}

              <Divider sx={{ mb: 1.5 }} />

              <SectionLabel>Why</SectionLabel>
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
                        sx={{ minHeight: 22, fontSize: (t) => t.typography.pxToRem(10.4) }}
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

              <Box sx={{ mb: 1.5 }}>
                <SectionLabel>Your explanation</SectionLabel>
                <TextField
                  multiline
                  minRows={2}
                  fullWidth
                  size="small"
                  value={explanation}
                  onChange={(e) => {
                    setExplanation(e.target.value);
                    if (explanationSaved.state === 'saved') setExplanationSaved({ state: 'idle' });
                  }}
                  placeholder="Why did it move the way it did? Name the mechanism, not the metric."
                  slotProps={{ htmlInput: { 'aria-label': 'Your explanation', maxLength: 4000 } }}
                  sx={{ mt: 0.75 }}
                />
                <Stack direction="row" spacing={1} sx={{ mt: 0.75, alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={saveExplanationText}
                    disabled={
                      !explanation.trim() ||
                      explanationSaved.state === 'saving' ||
                      explanation.trim() === attempt.explanationText
                    }
                  >
                    {attempt.explanationText ? 'Save new wording' : 'Save explanation'}
                  </Button>
                  <Typography variant="caption" color="text.secondary" role="status">
                    {explanationSaved.state === 'saving' && 'Saving…'}
                    {explanationSaved.state === 'saved' && 'Saved with this attempt. Not scored.'}
                    {explanationSaved.state === 'idle' && 'Kept with this attempt. Not scored.'}
                  </Typography>
                </Stack>
                {explanationSaved.state === 'failed' && (
                  <Alert severity="error" sx={{ mt: 1 }}>
                    Your explanation was not saved. {explanationSaved.error}
                  </Alert>
                )}
              </Box>

              <Button
                variant="contained"
                size="small"

                endIcon={<ArrowRight size={14} />}
                onClick={onSkip}
              >
                Next
              </Button>
            </>
          )}
        </Box>
      </Stack>
    </Panel>
  );
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography
    variant="caption"
    component="p"
    sx={{
      m: 0,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      fontWeight: 700,
      color: 'text.secondary',
    }}
  >
    {children}
  </Typography>
);

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
