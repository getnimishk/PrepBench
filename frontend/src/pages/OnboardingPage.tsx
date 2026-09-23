// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { getLLMProviders, getStorageReport } from '../services/api';
import { usePreparation } from '../context/PreparationContext';
import { ErrorState, LoadingState } from '../components/common/States';
import type { LLMProvider } from '../types/llm';
import type { StorageReport } from '../types/system';
import { Actions, Detail, Note, PageHead, Pill, Section, type Tone } from '../components/ui/primitives';

/**
 * Getting started, as a checklist the evidence ticks.
 *
 * Every step is marked done from what is actually true -- a preparation picked,
 * questions in it, a mock sat, a provider enabled -- never from having visited
 * this page. It is not forced on anyone: it lives here and in Settings, and
 * every part of PrepBench works without finishing it.
 *
 * A step whose evidence could not be read is "Not checked", never "To do":
 * telling someone who has 700 questions to go and add some is the checklist
 * inventing a fact.
 */

type StepState = 'done' | 'todo' | 'unchecked';

interface Step {
  title: string;
  detail: string;
  state: StepState;
  optional?: boolean;
  action?: { label: string; to: string };
}

const PILL: Record<StepState, { label: string; tone: Tone }> = {
  done: { label: 'Done', tone: 'success' },
  todo: { label: 'To do', tone: 'neutral' },
  unchecked: { label: 'Not checked', tone: 'warning' },
};

const SPOKEN: Record<StepState, string> = { done: 'done', todo: 'not done', unchecked: 'not checked' };

const doneOrTodo = (done: boolean): StepState => (done ? 'done' : 'todo');

export const OnboardingPage: React.FC = () => {
  const {
    preparations, selected, loading: preparationsLoading, error: preparationsError, refresh,
  } = usePreparation();
  const [storage, setStorage] = useState<StorageReport | null | 'failed'>(null);
  const [providers, setProviders] = useState<LLMProvider[] | null | 'failed'>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setStorage(null);
    setProviders(null);
    getStorageReport().then(setStorage).catch(() => setStorage('failed'));
    getLLMProviders().then(setProviders).catch(() => setProviders('failed'));
  }, [attempt]);

  const retry = () => {
    if (preparationsError) void refresh();
    setAttempt((n) => n + 1);
  };

  if (preparationsLoading || storage === null || providers === null) {
    return <LoadingState label="Checking what is already set up…" />;
  }

  const readiness = selected?.readiness;
  const needsMock = !!selected?.has_exam_profile;
  const enabledProviders = providers === 'failed' ? [] : providers.filter((p) => p.is_enabled);
  const unread = !!preparationsError;
  const UNREAD = 'Your preparations could not be read, so this step could not be checked.';

  const steps: Step[] = [
    {
      title: 'PrepBench is installed',
      detail: storage === 'failed'
        ? 'The server did not report its database, so this step could not be checked.'
        : storage.database.path
          ? `Your data is kept in ${storage.database.path}.`
          : `Your data is kept in a ${storage.database.engine} database.`,
      state: storage === 'failed' ? 'unchecked' : 'done',
    },
    {
      title: 'Pick what you are preparing for',
      detail: unread
        ? UNREAD
        : selected
          ? `Working on ${selected.name}. You have ${preparations.length} ${preparations.length === 1 ? 'preparation' : 'preparations'}.`
          : 'A certification with a pass mark, or an open-ended skill. Pick one in the header, or add your own.',
      state: unread ? 'unchecked' : doneOrTodo(!!selected),
      action: { label: selected ? 'Manage preparations' : 'Add a preparation', to: selected ? '/preparations' : '/preparations/new' },
    },
    {
      title: 'Add questions',
      detail: unread
        ? UNREAD
        : selected
          ? selected.question_count > 0
            ? `${selected.name} has ${selected.question_count} questions.`
            : `${selected.name} has no questions yet. Import a file or write your own.`
          : 'Once a preparation is picked, import a bank for it or write your own questions.',
      state: unread ? 'unchecked' : doneOrTodo(!!selected && selected.question_count > 0),
      action: { label: 'Open Question Bank', to: '/question-bank' },
    },
    {
      title: 'Take a baseline mock',
      detail: unread
        ? UNREAD
        : !selected
          ? 'Readiness and recommendations start from a first full mock.'
          : !needsMock
            ? `${selected.name} has no exam to sit, so there is no mock to take.`
            : readiness && readiness.mock_count > 0
              ? `${readiness.mock_count} ${readiness.mock_count === 1 ? 'mock' : 'mocks'} sat. Recommendations now come from your evidence.`
              : 'Until there is one, Home cannot recommend a focus from evidence. Skipping is allowed.',
      state: unread ? 'unchecked' : doneOrTodo(!!selected && (!needsMock || (readiness?.mock_count ?? 0) > 0)),
      action: selected && needsMock ? { label: 'Set up a mock', to: `/exam-setup?kind=mock&subject=${selected.id}` } : undefined,
    },
    {
      title: 'Connect an AI model',
      detail: providers === 'failed'
        ? 'Could not check your providers.'
        : enabledProviders.length > 0
          ? `${enabledProviders.map((p) => p.name).join(', ')} enabled.`
          : 'Grading written and spoken answers needs one. Practice, review and mocks do not.',
      state: providers === 'failed' ? 'unchecked' : doneOrTodo(enabledProviders.length > 0),
      optional: true,
      action: { label: 'Set up AI', to: '/settings/ai' },
    },
  ];

  const required = steps.filter((s) => !s.optional);
  const remaining = required.filter((s) => s.state === 'todo').length;
  const unchecked = steps.filter((s) => s.state === 'unchecked').length;
  const setUp = required.every((s) => s.state === 'done');

  const progress = setUp
    ? ' Every step below is done.'
    : `${remaining > 0 ? ` ${remaining} of ${required.length} steps to go.` : ''}${
      unchecked > 0 ? ` ${unchecked === 1 ? 'One step' : `${unchecked} steps`} could not be checked.` : ''}`;

  // The first step still to do is the one the page leads with, as the
  // prototype's timeline does: one filled button, on the step that is next.
  const current = steps.findIndex((st) => st.state === 'todo' && !st.optional);
  const mockStep = steps.find((st) => st.title === 'Take a baseline mock');

  return (
    <Box sx={{ maxWidth: 820 }}>
      <PageHead
        eyebrow="Welcome"
        title={setUp ? 'You are set up' : 'Set up your preparation'}
        sub={`PrepBench is local-first: your questions, attempts and review state stay on this machine.${progress}`}
      />

      {unchecked > 0 && (
        <Box sx={{ mb: '14px' }}>
          <ErrorState
            what="Some of your setup could not be checked"
            saved="nothing_to_save"
            detail="The steps marked Not checked are unknown, not undone."
            onRetry={retry}
          />
        </Box>
      )}

      {/* The prototype's .timeline: a numbered circle and the step beside it. */}
      <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: '14px' }}>
        {steps.map((step, i) => {
          const isCurrent = i === current;
          return (
            <Box
              component="li"
              key={step.title}
              aria-label={`${step.title}: ${SPOKEN[step.state]}`}
              sx={{ display: 'grid', gridTemplateColumns: '26px minmax(0,1fr)', gap: '10px', alignItems: 'start' }}
            >
              <Box
                aria-hidden
                sx={{
                  width: 24, height: 24, borderRadius: '50%', display: 'grid', placeItems: 'center',
                  fontSize: (t) => t.typography.pxToRem(10), fontWeight: 800,
                  bgcolor: step.state === 'done' ? 'pb.successSoft' : isCurrent ? 'primary.main' : step.state === 'unchecked' ? 'pb.warningSoft' : 'pb.chip',
                  color: step.state === 'done' ? 'pb.success' : isCurrent ? 'primary.contrastText' : step.state === 'unchecked' ? 'pb.warning' : 'pb.chipText',
                }}
              >
                {step.state === 'done' ? '✓' : step.state === 'unchecked' ? '?' : i + 1}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Box component="b" sx={{ fontSize: (t) => t.typography.pxToRem(14) }}>{step.title}</Box>
                  {step.optional && <Pill>Optional</Pill>}
                  <Pill tone={PILL[step.state].tone}>{PILL[step.state].label}</Pill>
                </Box>
                <Detail sx={{ mt: '2px', wordBreak: 'break-word' }}>{step.detail}</Detail>
                {step.action && step.state === 'todo' && (
                  <Button
                    component={RouterLink}
                    to={step.action.to}
                    variant={isCurrent ? 'contained' : 'outlined'}
                    sx={{ mt: '10px' }}
                  >
                    {step.action.label}
                  </Button>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      {mockStep?.state === 'todo' && (
        <Section>
          <Note>
            Skipping the baseline mock is allowed, but Home will not recommend a focused topic until there is
            evidence to recommend from.
          </Note>
        </Section>
      )}

      <Actions sx={{ mt: '18px' }}>
        {setUp ? (
          <Button component={RouterLink} to="/" variant="contained" color="ink">Go to Home</Button>
        ) : (
          <Button component={RouterLink} to="/" variant="outlined">Skip for now</Button>
        )}
      </Actions>
    </Box>
  );
};
