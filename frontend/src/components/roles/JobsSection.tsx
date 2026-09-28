// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Button } from '@mui/material';
import { getRoles } from '../../services/api';
import { loadFailed } from '../../services/apiError';
import type { RoleSummary } from '../../types/role';
import { Detail, Panel, PanelHead, Row, Section } from '../ui/primitives';

const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });

/**
 * "Jobs you're preparing for", on My Preparations. A role is not a preparation
 * you take mocks in -- it borrows evidence from the Skills linked to its
 * requirements -- so it is listed apart, and never with a readiness figure.
 */
export const JobsSection: React.FC = () => {
  const [roles, setRoles] = useState<RoleSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getRoles()
      .then((r) => { if (!cancelled) setRoles(r); })
      .catch((err) => { if (!cancelled) setError(loadFailed('Could not load the jobs you are preparing for', err)); });
    return () => { cancelled = true; };
  }, [attempt]);

  return (
    <Section>
      <Panel component="section" aria-labelledby="role-preparations">
        <PanelHead
          eyebrow="A job you want"
          title="Jobs you're preparing for"
          titleId="role-preparations"
          aside={<Button variant="outlined" component={RouterLink} to="/preparations/roles/new">+ From a job description</Button>}
        />
        {error && (
          <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => setAttempt((n) => n + 1)}>Retry</Button>}>
            {error}
          </Alert>
        )}
        {roles !== null && roles.length === 0 && (
          <Detail>None yet. Paste a job description to see its requirements and link each one to a Skill you are preparing.</Detail>
        )}
        {roles?.map((r) => (
          <Row
            key={r.id}
            title={r.name}
            titleComponent="h3"
            detail={[
              `${r.linked_count} of ${r.requirement_count} requirements linked to a Skill`,
              r.diagnostic_count ? `diagnostic taken ${r.diagnostic_count} time${r.diagnostic_count > 1 ? 's' : ''}` : 'diagnostic not taken',
              r.interview_date ? `interview ${fmtDate(r.interview_date)}` : null,
              'readiness needs evaluation',
            ].filter(Boolean).join(' · ')}
            action={<Button variant="outlined" component={RouterLink} to={`/preparations/roles/${r.id}`} aria-label={`Open ${r.name}`}>Open</Button>}
          />
        ))}
      </Panel>
    </Section>
  );
};
