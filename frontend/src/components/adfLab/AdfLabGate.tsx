// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Button } from '@mui/material';
import { Note, PageHead } from '../ui/primitives';
import { LoadingState } from '../common/States';
import { usePreparation } from '../../context/PreparationContext';
import { getSubjectCapabilities } from '../../services/capabilities';
import { hasAdfPack } from '../../services/adfLab/experiments';
import type { Subject } from '../../types/subject';

/**
 * The ADF Behaviour Lab is for the preparation the learner is working in, and only when that
 * preparation has the ADF content pack attached. Every lab route renders through this, so a
 * direct link cannot open it for anything else: no preparation chosen asks for one, and any
 * other preparation is told it does not apply. Nothing here picks a preparation for the learner.
 */
export const AdfLabGate: React.FC<{ title: string; children: (prep: Subject) => React.ReactNode }> = ({ title, children }) => {
  const { selected, loading } = usePreparation();

  if (loading) return <LoadingState label="Loading your preparation…" />;

  if (!selected) {
    return (
      <PageHead
        eyebrow="ADF Behaviour Lab"
        title={title}
        sub="The Behaviour Lab works in an Azure Data Factory preparation. Pick one from the header first."
        actions={<Button component={RouterLink} to="/preparations" variant="outlined">Your preparations</Button>}
      />
    );
  }

  if (!hasAdfPack(selected)) {
    return (
      <PageHead
        eyebrow="ADF Behaviour Lab"
        title={title}
        sub={`${selected.name} has no Azure Data Factory guide attached, so the Behaviour Lab does not apply to it. `
          + 'It works in a preparation with the ADF guide attached.'}
        actions={<Button component={RouterLink} to="/lab" variant="outlined">Learning Lab</Button>}
      />
    );
  }

  return <>{children(selected)}</>;
};

/** Says plainly that the lab is not live yet, while it is not. */
export const IntegrationNotice: React.FC<{ prep: Subject }> = ({ prep }) => (
  getSubjectCapabilities(prep).learningLabStatus === 'AVAILABLE' ? null : (
    <Note sx={{ mt: '14px' }} role="note">
      Integration in progress. The ADF Behaviour Lab is still being built, so it is not yet listed on Home, in the
      sidebar or in the Learning Lab. What is here records your attempts for real.
    </Note>
  )
);

/** Every experiment is a teaching model; it never claims to be Azure Data Factory running. */
export const SimulationNotice: React.FC<{ packNote?: string }> = ({ packNote }) => (
  <Note sx={{ mt: '10px' }} role="note">
    Teaching simulation. PrepBench runs a model of this pipeline in your browser, over the fictional
    semiconductor-v1 data. Nothing runs in Azure Data Factory, and no figure here is a measurement.
    {packNote ? ` ${packNote}` : ''}
  </Note>
);
