// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { PageHead } from '../components/ui/primitives';
import { AdfLabGate } from '../components/adfLab/AdfLabGate';
import { ExperimentRunner } from '../components/adfLab/ExperimentRunner';
import { adfLabExperiment } from '../services/adfLab/experiments';
import { DEFINITIONS } from '../services/adfLab/definitions';

/**
 * /lab/adf/:slug -- one ADF Behaviour Lab experiment, through the shared runner. Only built
 * experiments open; the others say so rather than showing an empty page, and an unknown slug
 * says it is unknown. An experiment with fault modes (Fault Tolerance) takes ?mode= to pick
 * one: each mode is its own eight-stage run of the one experiment.
 */
export const AdfExperimentPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const experiment = adfLabExperiment(slug);

  if (!experiment) {
    return (
      <PageHead
        eyebrow="ADF Behaviour Lab"
        title="No such experiment"
        sub="The Behaviour Lab has five experiments, and this address is none of them."
        actions={<Button component={RouterLink} to="/lab/adf" variant="outlined">All experiments</Button>}
      />
    );
  }

  const defs = DEFINITIONS[experiment.slug];
  const tracks = experiment.tracks ?? [];
  const modeIndex = Math.max(0, tracks.findIndex((t) => t.id === params.get('mode')));
  const def = defs?.[tracks.length ? modeIndex : 0];

  return (
    <AdfLabGate title={experiment.title}>
      {(prep) => (experiment.ready && def
        ? (
          <ExperimentRunner
            key={def.track}
            prep={prep} def={def} experiment={experiment}
            titleSuffix={tracks.length ? tracks[modeIndex].title : undefined}
            modeSwitch={tracks.length > 0 && (
              <Box component="nav" aria-label="Fault modes" sx={{ display: 'flex', gap: '8px', flexWrap: 'wrap', mt: '14px' }}>
                {tracks.map((t, i) => (
                  <Button
                    key={t.id} component={RouterLink} to={`/lab/adf/${experiment.slug}?mode=${t.id}`}
                    variant={i === modeIndex ? 'contained' : 'outlined'} aria-current={i === modeIndex ? 'page' : undefined}
                  >
                    {t.title}
                  </Button>
                ))}
              </Box>
            )}
          />
        )
        : (
          <PageHead
            eyebrow={`${prep.name} · ADF Behaviour Lab`}
            title={experiment.title}
            sub="This experiment is not built yet. It will open here when it is."
            actions={<Button component={RouterLink} to="/lab/adf" variant="outlined">All experiments</Button>}
          />
        ))}
    </AdfLabGate>
  );
};
