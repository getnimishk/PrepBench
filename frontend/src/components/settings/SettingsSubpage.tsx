// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { Detail, Eyebrow, PageHead, Panel, Row, Section } from '../ui/primitives';

/**
 * The frame every settings screen shares, as the prototype draws it: "Settings"
 * over the title, what the screen is for in one sentence, and the way back at
 * the top right beside the screen's own actions.
 */
export const SettingsSubpage: React.FC<{
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, description, actions, children }) => (
  <Box>
    <PageHead
      eyebrow="Settings"
      title={title}
      sub={description}
      actions={(
        <>
          {actions}
          <Button component={RouterLink} to="/settings" variant="outlined">← Back to Settings</Button>
        </>
      )}
    />
    <Box sx={{ maxWidth: 900 }}>{children}</Box>
  </Box>
);

/** A titled group of rows on a settings screen: one of the prototype's panels. */
export const SettingsSection: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({
  title, hint, children,
}) => (
  <Section sx={{ '&:first-of-type': { mt: 0 } }}>
    <Panel component="section" aria-label={title}>
      <Eyebrow component="h2">{title}</Eyebrow>
      {hint && <Detail sx={{ mt: '4px' }}>{hint}</Detail>}
      <Box sx={{ mt: '4px' }}>{children}</Box>
    </Panel>
  </Section>
);

/** One row: what it is, what it is set to, and the control or link for it. */
export const SettingsRow: React.FC<{
  label: string;
  detail?: React.ReactNode;
  control?: React.ReactNode;
}> = ({ label, detail, control }) => (
  <Row
    title={label}
    detail={detail}
    columns="minmax(0,1fr) auto"
    // No middle cell: the control sits at the right, at its own width.
    middle={undefined}
    action={control}
    sx={{ '& > :nth-of-type(2)': { justifySelf: 'end' } }}
  />
);
