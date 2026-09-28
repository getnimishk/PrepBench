// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { deleteRole, getRole, getRoleDiagnostics, replaceRoleRequirements } from '../services/api';
import { apiErrorMessage } from '../services/apiError';
import { usePreparation } from '../context/PreparationContext';
import { CONFIDENCE, packVersionsOf, questionByRef } from '../services/roles/diagnostic';
import { loadPackVersions } from '../services/roles/rolePacks';
import type { ContentPackDetail } from '../types/contentPack';
import type { Role, RoleDiagnostic } from '../types/role';
import { ErrorState, LoadingState } from '../components/common/States';
import { BigFigure, Detail, Grid, Metric, PageHead, Panel, PanelHead, Pill, Row, Section } from '../components/ui/primitives';

const confidenceLabel = (id: string) => CONFIDENCE.find((c) => c.id === id)?.label ?? id;
/** A date-only value is a calendar date; a timestamp from the server is naive UTC, so say so before parsing. */
const fmtDate = (iso: string) => new Date(
  iso.length === 10 ? `${iso}T00:00:00` : /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`,
).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const confidentCount = (a: RoleDiagnostic) => a.items.filter((i) => i.confidence === 'confident').length;

/** The first attempt against the latest, question by question. */
const DiagnosticResults: React.FC<{ attempts: RoleDiagnostic[]; packs: ContentPackDetail[] }> = ({ attempts, packs }) => {
  const first = attempts[0];
  const latest = attempts[attempts.length - 1];
  const again = attempts.length > 1;
  return (
    <Panel component="section" aria-labelledby="role-diag">
      <PanelHead
        title={again ? 'Diagnostic: before and after' : 'Diagnostic: your starting point'}
        titleId="role-diag"
        aside={<Pill>Your own rating</Pill>}
      >
        <Detail>
          {again
            ? `First taken ${fmtDate(first.taken_at)}; latest ${fmtDate(latest.taken_at)}. `
            : `Taken ${fmtDate(first.taken_at)}. Retake it before the interview to see what moved. `}
          Points are the ones you ticked as covered; nothing here is graded.
        </Detail>
      </PanelHead>
      <Detail sx={{ mb: '8px' }}>
        Confident on {again ? `${confidentCount(first)} → ${confidentCount(latest)}` : confidentCount(first)} of {first.items.length} questions.
      </Detail>
      <TableContainer tabIndex={0} role="region" aria-label="Diagnostic results, scrollable">
        <Table size="small" aria-labelledby="role-diag">
          <TableHead>
            <TableRow>
              <TableCell>Question</TableCell>
              <TableCell>{again ? 'Points covered, before → after' : 'Points covered'}</TableCell>
              <TableCell>{again ? 'Confidence, before → after' : 'Confidence'}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {first.items.map((item) => {
              const q = questionByRef(item.question_ref, packs);
              const now = latest.items.find((i) => i.question_ref === item.question_ref) ?? item;
              const total = q?.points.length ?? 0;
              return (
                <TableRow key={item.question_ref}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{q?.topic ?? item.question_ref}</Typography>
                    <Detail>
                      {item.fits_requirement ? 'Fits a requirement' : 'Core topic'}
                      {q && <> · <RouterLink to={q.learn.to}>{q.learn.label}</RouterLink></>}
                    </Detail>
                  </TableCell>
                  <TableCell>{again ? `${item.covered.length} → ${now.covered.length} of ${total}` : `${item.covered.length} of ${total}`}</TableCell>
                  <TableCell>{again ? `${confidenceLabel(item.confidence)} → ${confidenceLabel(now.confidence)}` : confidenceLabel(item.confidence)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Panel>
  );
};

/**
 * One job the learner is preparing for: what it asks, which of their Skills is
 * evidence for each requirement (links they confirmed), and what to do next.
 *
 * Readiness stays "Needs evaluation": readiness comes from full mocks, which a
 * role doesn't have, and the diagnostic is the learner's own rating -- shown as
 * a before/after view, never as a score.
 */
export const RolePreparationPage: React.FC = () => {
  const roleId = Number(useParams().roleId);
  const navigate = useNavigate();
  const { preparations, select } = usePreparation();
  const skills = useMemo(() => preparations.filter((p) => p.kind === 'skill'), [preparations]);

  const [role, setRole] = useState<Role | null>(null);
  const [attempts, setAttempts] = useState<RoleDiagnostic[]>([]);
  const [packs, setPacks] = useState<ContentPackDetail[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [reload, setReload] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [relinking, setRelinking] = useState(false);
  const [jdOpen, setJdOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    (async () => {
      try {
        const [r, a] = await Promise.all([getRole(roleId), getRoleDiagnostics(roleId)]);
        const p = a.length ? await loadPackVersions(packVersionsOf(a[0].items.map((i) => i.question_ref))) : [];
        if (cancelled) return;
        setRole(r); setAttempts(a); setPacks(p);
      } catch (err) {
        if (cancelled) return;
        const status = (err as { response?: { status?: number } }).response?.status;
        if (status === 404) setNotFound(true);
        else setLoadError(apiErrorMessage(err, ''));
      }
    })();
    return () => { cancelled = true; };
  }, [roleId, reload]);

  // The whole list is replaced on every change, so one change at a time: a
  // second built from the list before the first came back would undo it.
  const relink = useCallback(async (requirementId: number, subjectId: number | null) => {
    if (!role) return;
    setSaveError(null);
    setRelinking(true);
    try {
      setRole(await replaceRoleRequirements(role.id, role.requirements.map((r) => ({
        text: r.text, kind: r.kind, subject_id: r.id === requirementId ? subjectId : r.subject_id,
      }))));
    } catch (err) {
      setSaveError(`That link wasn't saved. ${apiErrorMessage(err, '')}`.trim());
    } finally {
      setRelinking(false);
    }
  }, [role]);

  if (notFound || Number.isNaN(roleId)) {
    return (
      <Box>
        <PageHead eyebrow="A job you want" title="Role not found" sub="It may have been deleted." />
        <Button variant="outlined" component={RouterLink} to="/preparations">All preparations</Button>
      </Box>
    );
  }
  if (loadError !== null) {
    return (
      <Box>
        <PageHead eyebrow="A job you want" title="Role" />
        <ErrorState what="Could not load this role." saved="nothing_to_save" detail={loadError} onRetry={() => setReload((n) => n + 1)} />
      </Box>
    );
  }
  if (!role) return <Box><PageHead eyebrow="A job you want" title="Role" /><LoadingState label="Loading this role…" /></Box>;

  const linked = role.requirements.filter((r) => r.subject_id != null).length;
  const gaps = role.requirements.length - linked;
  // Skills the learner can link: the live ones, plus any linked one that has since been archived.
  const options = [
    ...skills.map((s) => ({ id: s.id, name: s.name })),
    ...role.requirements
      .filter((r) => r.subject_id != null && !skills.some((s) => s.id === r.subject_id))
      .map((r) => ({ id: r.subject_id!, name: r.subject_name ?? `Preparation ${r.subject_id}` })),
  ].filter((o, i, all) => all.findIndex((x) => x.id === o.id) === i);

  return (
    <Box>
      <PageHead
        eyebrow="A job you want"
        title={role.name}
        sub={role.interview_date ? `Interview on ${fmtDate(role.interview_date)}.` : 'No interview date set.'}
        actions={(
          <>
            <Button variant="outlined" onClick={() => setJdOpen(true)}>Job description</Button>
            <Button variant="outlined" color="error" onClick={() => setConfirmDelete(true)}>Delete role</Button>
          </>
        )}
      />

      <Grid columns={3}>
        <Panel>
          <Detail>Role readiness</Detail>
          <BigFigure size={26}>Needs evaluation</BigFigure>
          <Detail>Readiness comes from full mock exams, and a role has none. The diagnostic below is your own rating, so it isn&apos;t a score.</Detail>
        </Panel>
        <Panel><Metric value={linked} label="Linked to a Skill" detail="evidence you are building" /></Panel>
        <Panel><Metric value={gaps} label="Gaps" detail="no Skill linked yet" /></Panel>
      </Grid>

      <Section>
        <Grid columns={2}>
          <Panel component="section" aria-labelledby="role-reqs">
            <PanelHead title="Requirements" titleId="role-reqs" />
            {saveError && <Alert severity="error" sx={{ mb: '10px' }}>{saveError}</Alert>}
            <TableContainer tabIndex={0} role="region" aria-label="Requirements and evidence, scrollable">
              <Table size="small" aria-labelledby="role-reqs">
                <TableHead><TableRow><TableCell>Requirement</TableCell><TableCell>Evidence</TableCell></TableRow></TableHead>
                <TableBody>
                  {role.requirements.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{r.text}</Typography>
                        <Detail>{r.kind === 'mandatory' ? 'Mandatory' : 'Preferred'}</Detail>
                      </TableCell>
                      <TableCell sx={{ minWidth: 200 }}>
                        <TextField
                          select
                          size="small"
                          fullWidth
                          disabled={relinking}
                          value={r.subject_id == null ? '' : String(r.subject_id)}
                          onChange={(e) => { void relink(r.id, e.target.value ? Number(e.target.value) : null); }}
                          slotProps={{ select: { native: true }, htmlInput: { 'aria-label': `Evidence for: ${r.text}` } }}
                        >
                          <option value="">Not linked: a gap</option>
                          {options.map((o) => (
                            <option key={o.id} value={String(o.id)}>{o.name}{skills.some((s) => s.id === o.id) ? '' : ' (archived)'}</option>
                          ))}
                        </TextField>
                        {r.subject_id != null && skills.some((s) => s.id === r.subject_id) && (
                          <Button
                            variant="text" size="small" component={RouterLink} to="/"
                            onClick={() => select(r.subject_id!)}
                            sx={{ mt: '4px', textAlign: 'left', justifyContent: 'flex-start' }}
                          >
                            Open {r.subject_name}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Detail sx={{ mt: '8px' }}>
              Opening a Skill makes it your active preparation and shows its Home, as the preparation picker does.
            </Detail>
          </Panel>

          <Panel component="section" aria-labelledby="role-next">
            <PanelHead title="Next" titleId="role-next" />
            <Row
              title="Diagnostic"
              detail={attempts.length
                ? `Taken ${attempts.length} time${attempts.length > 1 ? 's' : ''}; retake it with the same questions to compare`
                : '10 questions, the ones that fit these requirements first, rated by you. About 30 minutes'}
              action={(
                <Button variant="outlined" component={RouterLink} to={`/preparations/roles/${role.id}/diagnostic`}>
                  {attempts.length ? 'Retake' : 'Take it'}
                </Button>
              )}
            />
            <Row
              title="Scenarios"
              detail="Incidents practised in your role, from the guides of your linked Skills (choose the Skill as your preparation first)"
              action={<Button variant="outlined" component={RouterLink} to="/scenarios">Open</Button>}
            />
            <Row
              title="Interview questions"
              detail="Questions you saved from scenarios, and any you import, practised in Rounds"
              action={<Button variant="outlined" component={RouterLink} to="/interview-practice/library">Open</Button>}
            />
          </Panel>
        </Grid>
      </Section>

      {attempts.length > 0 && <Section><DiagnosticResults attempts={attempts} packs={packs} /></Section>}

      <Dialog open={jdOpen} onClose={() => setJdOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Job description</DialogTitle>
        <DialogContent>
          <Box component="pre" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', m: 0, fontFamily: 'inherit', fontSize: (t) => t.typography.pxToRem(13) }}>
            {role.job_description || 'No job description was saved.'}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJdOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete {role.name}?</DialogTitle>
        <DialogContent>
          <Detail>This removes the role, its requirements and its diagnostic attempts. Your preparations are untouched.</Detail>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button
            variant="contained" color="error"
            onClick={async () => {
              try {
                await deleteRole(role.id);
                navigate('/preparations');
              } catch (err) {
                setConfirmDelete(false);
                setSaveError(`The role wasn't deleted. ${apiErrorMessage(err, '')}`.trim());
              }
            }}
          >
            Delete role
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
