// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, FormControlLabel, Radio, RadioGroup, TextField, Typography,
} from '@mui/material';
import { attachContentPack, createSubject, getContentPacks } from '../services/api';
import { usePreparation } from '../context/PreparationContext';
import type { SubjectCreate } from '../types/subject';
import type { ContentPackSummary } from '../types/contentPack';
import { Actions, Eyebrow, Good, Grid, PageHead, Panel, Sub } from '../components/ui/primitives';

/** A pack whose title (or id) the typed name matches, case-insensitively --
 *  either way round, so "ADF" matches "Azure Data Factory" and typing the
 *  full title matches it back (D5: "preselected when the name matches a
 *  pack's title"). */
export function packMatchingName(packs: ContentPackSummary[], name: string): ContentPackSummary | null {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return null;
  return (
    packs.find((p) => {
      const title = p.title.toLowerCase();
      return (
        title === trimmed
        || p.pack_id.toLowerCase() === trimmed
        || title.includes(trimmed)
        || trimmed.includes(title)
      );
    }) ?? null
  );
}

/**
 * Add a preparation, in two steps.
 *
 * The prototype draws three: pick a kind, pick from a catalogue of named exams,
 * then fill in the exam profile. The catalogue step is not built here, because
 * there is no catalogue -- PrepBench has no list of the world's certifications
 * and inventing a short one would be worse than a text field: the four exams that
 * happened to be hardcoded would look like the supported set, and everything else
 * like a second-class "custom" path.
 *
 * So step 2 asks for the name and the profile together, which is what the
 * catalogue would have filled in anyway. Recorded as a documented deviation
 * rather than a silent one.
 */

type Kind = 'certification' | 'skill';

/** One of the two kinds, as the prototype's soft panel buttons. */
const KindCard: React.FC<{
  eyebrow: string;
  title: string;
  detail: string;
  onClick: () => void;
}> = ({ eyebrow, title, detail, onClick }) => (
  <Box
    component="button"
    type="button"
    onClick={onClick}
    sx={{
      bgcolor: 'pb.surface2', border: '1px solid', borderColor: 'divider', borderRadius: '13px',
      p: '20px', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'text.primary', width: '100%',
      '&:hover': { borderColor: 'primary.main' },
    }}
  >
    <Eyebrow component="span">{eyebrow}</Eyebrow>
    <Typography variant="h6" component="span" sx={{ display: 'block', mt: '6px' }}>{title}</Typography>
    <Typography variant="body2" component="span" sx={{ display: 'block', color: 'text.secondary', mt: '2px' }}>
      {detail}
    </Typography>
  </Box>
);

/** Covers the card so a click (and Playwright's `.check()`) always hits the
 *  real radio, per CLAUDE.md's custom-radio pattern. */
const COVERING_INPUT = {
  position: 'absolute' as const, inset: 0, width: '100%', height: '100%', opacity: 0, margin: 0,
};

export const PreparationNewPage: React.FC = () => {
  const navigate = useNavigate();
  const { refresh, select } = usePreparation();

  const [step, setStep] = useState(1);
  const [kind, setKind] = useState<Kind>('certification');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [certification, setCertification] = useState('');
  const [questionCount, setQuestionCount] = useState('80');
  const [minutes, setMinutes] = useState('60');
  const [passMark, setPassMark] = useState('85');
  const [targetDate, setTargetDate] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The Skill path's "start from a built-in guide" step (D5): offered, never
  // forced. Loaded once -- there is no per-kind catalogue to keep in sync.
  const [packs, setPacks] = useState<ContentPackSummary[]>([]);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [packTouched, setPackTouched] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getContentPacks()
      .then((result) => { if (!cancelled) setPacks(result); })
      .catch(() => { /* the picker still works with no packs offered */ });
    return () => { cancelled = true; };
  }, []);

  // Re-preselect on every name change, until the learner has touched the
  // pack choice themselves -- once they have, typing more of the name must
  // not silently swap their pick out from under them.
  useEffect(() => {
    if (packTouched) return;
    setSelectedPackId(packMatchingName(packs, name)?.pack_id ?? null);
  }, [name, packs, packTouched]);

  const chooseKind = (next: Kind) => {
    setKind(next);
    setStep(2);
  };

  const submit = async () => {
    setSaving(true);
    setError(null);

    const payload: SubjectCreate = {
      name: name.trim(),
      kind,
      description: description.trim() || null,
      certification: certification.trim() || null,
      target_exam_date: targetDate || null,
    };

    // A certification carries all three or the API refuses it -- a certification
    // without a pass mark cannot be measured against anything. A skill carries
    // none of them, because a pass mark it can never be measured against is
    // worse than no number at all.
    if (kind === 'certification') {
      payload.pass_mark = Number(passMark);
      payload.exam_question_count = Number(questionCount);
      payload.exam_minutes = Number(minutes);
    }

    try {
      const created = await createSubject(payload);
      if (kind === 'skill' && selectedPackId) {
        // Best-effort: a pack attach failing must not undo the preparation
        // that was just created. It can still be attached from the edit page.
        await attachContentPack(created.id, selectedPackId).catch(() => undefined);
      }
      await refresh();
      select(created.id);
      navigate('/preparations');
    } catch (e: unknown) {
      // The server's message is shown verbatim: it names the preparation already
      // using a certification string, or which exam-profile field is missing.
      // Replacing that with "Something went wrong" would throw away the only
      // part of the response that tells the person what to change.
      const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      setError(
        typeof detail === 'string'
          ? detail
          : 'Could not create the preparation. Nothing was saved.',
      );
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = name.trim().length > 0 && (
    kind === 'skill' || (passMark !== '' && questionCount !== '' && minutes !== '')
  );

  return (
    <Box>
      <PageHead
        eyebrow="New preparation"
        title="Add a preparation"
        sub="A preparation owns its own questions, roadmap, practice history and evidence. Nothing is shared between preparations."
      />

      {/* The prototype's .progress: one short track a step. */}
      <Box aria-hidden sx={{ display: 'flex', gap: '7px', mt: '4px' }}>
        {[1, 2].map((i) => (
          <Box key={i} sx={{ width: 52, height: 5, borderRadius: '8px', bgcolor: i <= step ? 'primary.main' : 'pb.track' }} />
        ))}
      </Box>

      <Panel component="section" aria-labelledby="new-preparation-step" sx={{ maxWidth: 880, mt: '28px' }}>
        <Eyebrow>Step {step} of 2</Eyebrow>

        {step === 1 ? (
          <>
            <Typography variant="h5" component="h2" id="new-preparation-step" sx={{ mt: '4px' }}>
              What are you preparing for?
            </Typography>
            <Grid template="repeat(2, minmax(0,1fr))" sx={{ mt: '14px' }}>
              <KindCard
                eyebrow="Certification"
                title="A named exam"
                detail="Has a fixed paper, timebox and pass mark. Readiness is measured by full mocks."
                onClick={() => chooseKind('certification')}
              />
              <KindCard
                eyebrow="Skill"
                title="An open-ended capability"
                detail="No pass mark. Progress is measured by attempts and analysed answers."
                onClick={() => chooseKind('skill')}
              />
            </Grid>
          </>
        ) : (
          <>
            <Typography variant="h5" component="h2" id="new-preparation-step" sx={{ mt: '4px' }}>
              {kind === 'certification' ? 'Name it and set the exam profile' : 'Name the skill'}
            </Typography>
            <Sub sx={{ mb: 0 }}>
              {kind === 'certification'
                ? 'The profile comes from the official exam. A mock takes its shape from these, so they cannot be chosen per sitting.'
                : 'A skill has no exam, so there is no pass mark to set. Progress comes from what you attempt and what gets analysed.'}
            </Sub>

            <Box sx={{ display: 'grid', gap: '13px', mt: '14px' }}>
              <Grid template="repeat(2, minmax(0,1fr))" gap="13px">
                <TextField
                  label="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={kind === 'certification' ? 'Scrum / PSM I' : 'Apache Kafka'}
                  fullWidth
                  required
                  autoFocus
                />
                <TextField
                  label="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Professional Scrum Master I Certification"
                  fullWidth
                />
              </Grid>

              {kind === 'certification' && (
                <>
                  <TextField
                    label="Certification name on your questions"
                    value={certification}
                    onChange={(e) => setCertification(e.target.value)}
                    placeholder="PSM I - Professional Scrum Master"
                    fullWidth
                    helperText={
                      'Questions are matched to this preparation by this exact string. '
                      + 'If you have already imported a bank, use the same text and those '
                      + 'questions will be adopted on save.'
                    }
                  />
                  <Grid template="repeat(2, minmax(0,1fr))" gap="13px">
                    <TextField
                      label="Questions"
                      type="number"
                      value={questionCount}
                      onChange={(e) => setQuestionCount(e.target.value)}
                      slotProps={{ htmlInput: { min: 1 } }}
                      required
                    />
                    <TextField
                      label="Time limit (minutes)"
                      type="number"
                      value={minutes}
                      onChange={(e) => setMinutes(e.target.value)}
                      slotProps={{ htmlInput: { min: 1 } }}
                      required
                    />
                    <TextField
                      label="Pass mark (%)"
                      type="number"
                      value={passMark}
                      onChange={(e) => setPassMark(e.target.value)}
                      slotProps={{ htmlInput: { min: 0, max: 100 } }}
                      required
                    />
                    <TextField
                      label="Target exam date"
                      type="date"
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      helperText="Optional. Leave empty if it is not booked."
                    />
                  </Grid>
                </>
              )}

              {kind === 'skill' && packs.length > 0 && (
                <Box>
                  <Typography component="label" id="pack-choice-label" sx={{ fontWeight: 750, display: 'block', mb: '8px' }}>
                    Start from a built-in guide (optional)
                  </Typography>
                  <RadioGroup
                    aria-labelledby="pack-choice-label"
                    value={selectedPackId ?? ''}
                    onChange={(e) => { setPackTouched(true); setSelectedPackId(e.target.value || null); }}
                    sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '10px' }}
                  >
                    <FormControlLabel
                      value=""
                      control={<Radio sx={COVERING_INPUT} />}
                      label="Start empty"
                      sx={{
                        position: 'relative', m: 0, p: '13px', borderRadius: '11px', alignItems: 'flex-start',
                        bgcolor: 'pb.surface2', border: !selectedPackId ? '2px solid' : '1px solid',
                        borderColor: !selectedPackId ? 'primary.main' : 'divider',
                        '&:has(input:focus-visible)': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                      }}
                    />
                    {packs.map((p) => (
                      <FormControlLabel
                        key={p.pack_id}
                        value={p.pack_id}
                        control={<Radio sx={COVERING_INPUT} />}
                        label={(
                          <Box component="span" sx={{ display: 'block' }}>
                            <Box component="span" sx={{ display: 'block', fontWeight: 750 }}>{p.title}</Box>
                            <Box component="span" sx={{ display: 'block', color: 'text.secondary', fontSize: (t) => t.typography.pxToRem(13) }}>
                              {p.chapter_count} chapters
                              {p.written_scenario_count > 0 ? `, ${p.written_scenario_count} practice scenario${p.written_scenario_count === 1 ? '' : 's'}` : ''}
                            </Box>
                          </Box>
                        )}
                        sx={{
                          position: 'relative', m: 0, p: '13px', borderRadius: '11px', alignItems: 'flex-start',
                          bgcolor: 'pb.surface2', border: selectedPackId === p.pack_id ? '2px solid' : '1px solid',
                          borderColor: selectedPackId === p.pack_id ? 'primary.main' : 'divider',
                          '&:has(input:focus-visible)': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                        }}
                      />
                    ))}
                  </RadioGroup>
                  <Sub sx={{ mt: '8px', mb: 0 }}>
                    Built-in guides and scenarios are read-only and versioned; you keep the version you start
                    with until you choose to update it.
                  </Sub>
                </Box>
              )}
            </Box>

            <Good sx={{ mt: '14px' }}>
              You can practise immediately with an empty bank. Import questions
              from the Question Bank once this exists.
            </Good>
          </>
        )}

        {error && <Alert severity="error" sx={{ mt: '14px' }}>{error}</Alert>}

        <Actions sx={{ mt: '20px' }}>
          <Button variant="outlined" onClick={() => (step === 1 ? navigate('/preparations') : setStep(1))}>
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          {step === 2 && (
            <Button variant="contained" color="ink" onClick={() => void submit()} disabled={!canSubmit || saving}>
              {saving ? 'Creating…' : 'Create preparation'}
            </Button>
          )}
        </Actions>
      </Panel>
    </Box>
  );
};
