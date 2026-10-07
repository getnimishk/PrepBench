// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Stack, Typography, useTheme } from '@mui/material';
import { ArrowRight, ShieldAlert } from 'lucide-react';
import { PageHead, Panel } from '../ui/primitives';
import { getSubjectsWithCapability, KNOWN_PRODUCTION_SUBJECTS } from '../../services/capabilities';
import type { CapabilityName } from '../../types/capabilities';
import type { Subject } from '../../types/subject';

export interface CapabilityUnavailablePageProps {
  capability: 'Certification' | 'Interview' | 'Learning Lab' | 'Roadmap' | 'Study Guide' | 'Scenarios';
  subject?: { id?: number | null; name?: string; slug?: string } | null;
}

export const CapabilityUnavailablePage: React.FC<CapabilityUnavailablePageProps> = ({
  capability,
  subject,
}) => {
  const theme = useTheme();
  const subjectName = subject?.name ?? 'This subject';

  const capabilityKey: CapabilityName =
    capability === 'Certification'
      ? 'certification'
      : capability === 'Interview'
      ? 'interview'
      : capability === 'Learning Lab'
      ? 'lab'
      : capability === 'Roadmap'
      ? 'roadmap'
      : capability === 'Scenarios'
      ? 'scenarios'
      : 'studyGuide';

  const capableSubjects = getSubjectsWithCapability(capabilityKey);

  return (
    <Box sx={{ maxWidth: 840, mx: 'auto', py: 4 }}>
      <PageHead
        eyebrow="PrepBench · Capability Guard"
        title={`${capability} Unavailable`}
        sub={`${capability} capability is not configured for ${subjectName}.`}
      />

      <Panel sx={{ p: { xs: 2.5, sm: 4 }, textAlign: 'center', mb: 3 }}>
        <Box
          sx={{
            display: 'inline-flex',
            p: 2,
            borderRadius: '50%',
            bgcolor: 'pb.surface2',
            mb: 2,
          }}
        >
          <ShieldAlert size={36} color={theme.palette.warning.main} />
        </Box>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 800, mb: 1 }}>
          {capability} is not configured for {subjectName}
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 600, mx: 'auto', mb: 3 }}>
          {capability === 'Certification' ? (
            <>
              <b>{subjectName}</b> is tracked as a <b>Professional Skill Track</b>, not a Certification.
              PrepBench evaluates it through practical sandboxes, incident scenarios, or interview rehearsal rather than formal exam scoring.
            </>
          ) : capability === 'Interview' ? (
            <>
              <b>{subjectName}</b> is tracked as a <b>Formal Certification Track</b> with an authoritative
              question bank, timed mock exam simulator, and spaced repetition queue. Verbal interviews and system design reviews are not configured.
            </>
          ) : (
            <>
              Curriculum content for <b>{subjectName}</b> is not configured for this capability in the current repository dataset.
            </>
          )}
        </Typography>

        <Stack direction="row" spacing={2} sx={{ justifyContent: 'center', flexWrap: 'wrap', gap: 1.5 }}>
          {subject?.id ? (
            <Button
              variant="contained"
              color="primary"
              component={RouterLink}
              to={`/subjects/${subject.id}`}
            >
              Open {subjectName} Overview
            </Button>
          ) : (
            <Button variant="contained" color="primary" component={RouterLink} to="/">
              Return to Home
            </Button>
          )}
          {capableSubjects.length > 0 && (
            <Button
              variant="outlined"
              component={RouterLink}
              to={
                capability === 'Certification'
                  ? `/certification?subject=${capableSubjects[0].id}`
                  : capability === 'Interview'
                  ? `/interview?subject=${capableSubjects[0].id}`
                  : `/subjects/${capableSubjects[0].id}`
              }
              endIcon={<ArrowRight size={16} />}
            >
              Switch to {capableSubjects[0].name} ({capability})
            </Button>
          )}
        </Stack>
      </Panel>
    </Box>
  );
};
