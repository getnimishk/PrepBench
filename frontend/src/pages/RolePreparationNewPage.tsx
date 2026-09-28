// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Checkbox, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { createRole } from '../services/api';
import { apiErrorMessage } from '../services/apiError';
import { usePreparation } from '../context/PreparationContext';
import { parseJobDescription, suggestLink, type ParsedRequirement } from '../services/roles/jdParse';
import { guessLens } from '../services/roles/diagnostic';
import { Actions, Detail, Eyebrow, Grid, Note, PageHead, Panel, Pill, Sub } from '../components/ui/primitives';
import { VISUALLY_HIDDEN } from '../components/ui/visuallyHidden';

/** Fictional, and labelled so wherever it appears (hard rule 2). */
export const SAMPLE_JD = `SAMPLE JOB DESCRIPTION (fictional)
Technical Product Owner, Data Platform · onsite · 6+ years

Mandatory skills
- Product Owner / Technical Product Owner experience
- Hands-on Databricks / Azure Databricks
- Microsoft Azure
- Data migration / data platform / data transformation projects
- Data flows, data integration and system integrations
- Product backlog, user stories and acceptance criteria
- Agile / Scrum
- Stakeholder and communication skills
- Working with technical teams and third-party vendors

Preferred
- Azure Data Factory (ADF), ADLS, Delta Lake
- SQL, ETL / ELT
- Data quality and data governance
- Power BI`;

/**
 * A preparation for a job, from its job description, in three steps: paste it,
 * confirm what it asks for and which of your Skills is evidence for each, then
 * create it.
 *
 * Requirements are read from the posting's bullet lists without AI
 * (services/roles/jdParse.ts). A Skill is only *suggested* for a requirement
 * that names it; nothing is linked until the learner chooses it (D8). Nothing
 * here is scored: a requirement with no Skill is a gap, and says so.
 */
export const RolePreparationNewPage: React.FC = () => {
  const navigate = useNavigate();
  const { preparations } = usePreparation();
  const skills = useMemo(() => preparations.filter((p) => p.kind === 'skill'), [preparations]);

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [interviewDate, setInterviewDate] = useState('');
  const [jd, setJd] = useState('');
  const [requirements, setRequirements] = useState<ParsedRequirement[]>([]);
  const [keep, setKeep] = useState<boolean[]>([]);
  /** Confirmed links by requirement index. Starts empty: suggestions aren't links. */
  const [links, setLinks] = useState<Record<number, number | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kept = requirements.map((r, i) => ({ ...r, i })).filter((r) => keep[r.i]);
  const linked = kept.filter((r) => links[r.i] != null);
  const skillName = (id: number | undefined) => skills.find((s) => s.id === id)?.name;

  const readRequirements = () => {
    const found = parseJobDescription(jd);
    setRequirements(found);
    setKeep(found.map(() => true));
    setLinks({});
    setStep(2);
  };

  const create = async () => {
    setSaving(true);
    setError(null);
    try {
      const role = await createRole({
        name: name.trim(),
        interview_date: interviewDate || null,
        job_description: jd,
        lens: guessLens(name, jd),
        requirements: kept.map((r) => ({ text: r.text, kind: r.kind, subject_id: links[r.i] ?? null })),
      });
      navigate(`/preparations/roles/${role.id}`);
    } catch (err) {
      setError(`The role wasn't saved. ${apiErrorMessage(err, '')}`.trim());
      setSaving(false);
    }
  };

  return (
    <Box>
      <PageHead
        eyebrow="New preparation · a job you want"
        title="Build a preparation from a job description"
        sub="PrepBench reads what the job asks for, you link each requirement to a Skill you are preparing, and the rest are your gaps."
      />

      <Box aria-hidden sx={{ display: 'flex', gap: '7px', mt: '4px' }}>
        {[1, 2, 3].map((i) => (
          <Box key={i} sx={{ width: 52, height: 5, borderRadius: '8px', bgcolor: i <= step ? 'primary.main' : 'pb.track' }} />
        ))}
      </Box>

      <Panel component="section" aria-labelledby="role-step" sx={{ maxWidth: 1000, mt: '28px' }}>
        <Eyebrow>Step {step} of 3</Eyebrow>

        {step === 1 && (
          <>
            <Typography variant="h5" component="h2" id="role-step" sx={{ mt: '4px' }}>Paste the job description</Typography>
            <Sub sx={{ mb: 0 }}>It stays on this computer. Nothing is sent anywhere.</Sub>
            <Box sx={{ display: 'grid', gap: '13px', mt: '14px' }}>
              <Grid template="repeat(2, minmax(0,1fr))" gap="13px">
                <TextField label="Role name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Technical Product Owner" required autoFocus slotProps={{ htmlInput: { maxLength: 200 } }} />
                <TextField label="Interview date" type="date" value={interviewDate} onChange={(e) => setInterviewDate(e.target.value)} helperText="Optional." />
              </Grid>
              <TextField
                label="Job description" multiline minRows={10} value={jd} onChange={(e) => setJd(e.target.value)}
                placeholder="Paste the whole posting. Requirements are read from its bullet lists."
                required
              />
            </Box>
            <Actions sx={{ mt: '10px' }}>
              <Button variant="text" size="small" onClick={() => { setJd(SAMPLE_JD); if (!name) setName('Technical Product Owner, Data Platform'); }}>
                Use a fictional sample
              </Button>
            </Actions>
          </>
        )}

        {step === 2 && (
          <>
            <Typography variant="h5" component="h2" id="role-step" sx={{ mt: '4px' }}>Confirm the requirements and your evidence</Typography>
            <Sub sx={{ mb: 0 }}>
              Found in the posting&apos;s bullet lists. For each one, choose the Skill you are preparing that covers it, if
              any. A Skill is suggested when the requirement names it or its guide, but nothing is linked until you choose
              it. A requirement with no Skill is a gap; it isn&apos;t given a score.
            </Sub>
            {requirements.length === 0 ? (
              <Note sx={{ mt: '14px' }}>
                No bullet lists were found in the text, so there are no requirements to confirm. Go back and paste the
                posting with its lists.
              </Note>
            ) : (
              <TableContainer tabIndex={0} role="region" aria-label="Requirements, scrollable" sx={{ mt: '14px' }}>
                <Table size="small" aria-labelledby="role-step">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox"><Box component="span" sx={VISUALLY_HIDDEN}>Keep</Box></TableCell>
                      <TableCell>Requirement</TableCell><TableCell>Type</TableCell><TableCell>Your evidence</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {requirements.map((r, i) => {
                      const suggestion = suggestLink(r.text, skills);
                      const chosen = links[i];
                      return (
                        <TableRow key={r.text}>
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={keep[i] ?? false}
                              onChange={(e) => setKeep(keep.map((k, j) => (j === i ? e.target.checked : k)))}
                              slotProps={{ input: { 'aria-label': `Keep: ${r.text}` } }}
                            />
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>{r.text}</TableCell>
                          <TableCell><Pill tone={r.kind === 'mandatory' ? 'accent' : 'neutral'}>{r.kind === 'mandatory' ? 'Mandatory' : 'Preferred'}</Pill></TableCell>
                          <TableCell sx={{ minWidth: 220 }}>
                            <TextField
                              select
                              size="small"
                              fullWidth
                              disabled={!keep[i]}
                              value={chosen == null ? '' : String(chosen)}
                              onChange={(e) => setLinks({ ...links, [i]: e.target.value ? Number(e.target.value) : undefined })}
                              slotProps={{ select: { native: true }, htmlInput: { 'aria-label': `Evidence for: ${r.text}` } }}
                            >
                              <option value="">Not linked: a gap</option>
                              {skills.map((s) => (
                                <option key={s.id} value={String(s.id)}>{s.name}{suggestion?.id === s.id ? ' (suggested)' : ''}</option>
                              ))}
                            </TextField>
                            {suggestion && chosen == null && keep[i] && (
                              <Button size="small" variant="text" sx={{ mt: '4px' }} onClick={() => setLinks({ ...links, [i]: suggestion.id })}>
                                Link to {suggestion.name}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            {skills.length === 0 && requirements.length > 0 && (
              <Detail sx={{ mt: '10px' }}>You have no Skill preparations yet, so every requirement starts as a gap. You can link them later from the role.</Detail>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <Typography variant="h5" component="h2" id="role-step" sx={{ mt: '4px' }}>Check and create</Typography>
            <Sub sx={{ mb: 0 }}>
              {linked.length} of {kept.length} requirements are linked to a Skill you are preparing; the other{' '}
              {kept.length - linked.length} are gaps. Nothing is copied: a linked Skill stays where it is.
            </Sub>
            {linked.length > 0 && (
              <Box component="ul" sx={{ m: '10px 0 0', pl: '20px' }}>
                {linked.map((r) => <Typography component="li" variant="body2" key={r.i}>{r.text}: <b>{skillName(links[r.i])}</b></Typography>)}
              </Box>
            )}
            <Grid columns={2} sx={{ mt: '14px' }}>
              <Panel soft>
                <Eyebrow>Measure first</Eyebrow>
                <Typography variant="h6" component="h3">Diagnostic, 10 questions</Typography>
                <Detail>Chosen from the guides of the Skills you linked, the ones that fit the job first. You answer and rate them yourself, now and again before the interview, to see what moved.</Detail>
              </Panel>
              <Panel soft>
                <Eyebrow>Readiness</Eyebrow>
                <Typography variant="h6" component="h3">Needs evaluation</Typography>
                <Detail>A role has no mock exam, so it has no readiness figure. The diagnostic is your own rating, never a score.</Detail>
              </Panel>
            </Grid>
          </>
        )}

        {error && <Alert severity="error" sx={{ mt: '14px' }}>{error}</Alert>}

        <Actions sx={{ mt: '20px' }}>
          <Button variant="outlined" onClick={() => (step === 1 ? navigate('/preparations/new') : setStep(step - 1))}>Back</Button>
          {step === 1 && <Button variant="contained" color="ink" disabled={!name.trim() || !jd.trim()} onClick={readRequirements}>Read requirements</Button>}
          {step === 2 && <Button variant="contained" color="ink" disabled={kept.length === 0} onClick={() => setStep(3)}>Continue</Button>}
          {step === 3 && <Button variant="contained" color="ink" disabled={saving} onClick={() => { void create(); }}>Create role preparation</Button>}
        </Actions>
      </Panel>
    </Box>
  );
};
