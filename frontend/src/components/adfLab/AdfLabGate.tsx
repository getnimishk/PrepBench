// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Button } from '@mui/material';
import { Note, PageHead } from '../ui/primitives';
import { LoadingState } from '../common/States';
import { usePreparation } from '../../context/PreparationContext';
import { ADF_LAB, hasLabPack, type LabSpec } from '../../services/adfLab/lab';
import type { Subject } from '../../types/subject';

/**
 * A lab (the ADF Behaviour Lab, the Kafka Lab) is for the preparation the learner is working in,
 * and only when that preparation has the lab's content pack attached. Every lab route renders
 * through this, so a direct link cannot open it for anything else: no preparation chosen asks for
 * one, and any other preparation is told it does not apply. Nothing here picks a preparation.
 */
export const LabGate: React.FC<{ lab: LabSpec; title: string; children: (prep: Subject) => React.ReactNode }> = ({ lab, title, children }) => {
  const { selected, loading } = usePreparation();

  if (loading) return <LoadingState label="Loading your preparation…" />;

  if (!selected) {
    return (
      <PageHead
        eyebrow={lab.name}
        title={title}
        sub={`The ${lab.name} works in ${lab.forWhom}. Pick one from the header first.`}
        actions={<Button component={RouterLink} to="/preparations" variant="outlined">Your preparations</Button>}
      />
    );
  }

  if (!hasLabPack(lab, selected)) {
    return (
      <PageHead
        eyebrow={lab.name}
        title={title}
        sub={`${selected.name} has no ${lab.guideTitle} attached, so the ${lab.name} does not apply to it. `
          + `It works in a preparation with ${lab.guideName} attached.`}
        actions={<Button component={RouterLink} to="/lab" variant="outlined">Learning Lab</Button>}
      />
    );
  }

  return <>{children(selected)}</>;
};

/** The ADF Behaviour Lab's gate. */
export const AdfLabGate: React.FC<{ title: string; children: (prep: Subject) => React.ReactNode }> = ({ title, children }) => (
  <LabGate lab={ADF_LAB} title={title}>{children}</LabGate>
);

/** Says plainly that the lab is not live yet, while it is not. */
export const IntegrationNotice: React.FC<{ lab?: LabSpec }> = ({ lab = ADF_LAB }) => (
  lab.status() === 'AVAILABLE' ? null : (
    <Note sx={{ mt: '14px' }} role="note">
      Integration in progress. The {lab.name} is still being built, so it is not yet listed on Home, in the
      sidebar or in the Learning Lab. What is here records your attempts for real.
    </Note>
  )
);

/** Every experiment is a teaching model; it never claims to be the real product running. */
export const SimulationNotice: React.FC<{ lab?: LabSpec; packNote?: string }> = ({ lab = ADF_LAB, packNote }) => (
  <Note sx={{ mt: '10px' }} role="note">
    {lab.simulation}
    {packNote ? ` ${packNote}` : ''}
  </Note>
);
