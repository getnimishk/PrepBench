// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useId, useState } from 'react';
import { Box, Button, Collapse, Typography } from '@mui/material';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Explanation } from '../../services/recommendation';

/**
 * "Why am I seeing this?", under a recommendation.
 *
 * Closed by default: the recommendation already says why in a sentence, and
 * most of the time that is enough. Open, it shows what the sentence rests on --
 * each piece of evidence with its number -- and what would make the
 * recommendation change, so it can be checked rather than obeyed.
 */
export const WhyThis: React.FC<{ explanation: Explanation; sx?: object }> = ({ explanation, sx }) => {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <Box sx={sx}>
      <Button
        size="small"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        startIcon={open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        sx={{ px: 0.5, ml: -0.5, color: 'text.secondary', minHeight: '24px', minWidth: '24px' }}
      >
        Why am I seeing this?
      </Button>
      <Collapse in={open} unmountOnExit>
        <Box id={panelId} role="region" aria-label="Why am I seeing this" sx={{ mt: 1, pl: 1.5, borderLeft: 2, borderColor: 'divider' }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block' }}>
            Based on
          </Typography>
          <Box component="ul" sx={{ m: 0, mt: 0.25, pl: 2.25 }}>
            {explanation.evidence.map((item) => (
              <Typography component="li" variant="body2" key={item}>
                {item}
              </Typography>
            ))}
          </Box>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mt: 1 }}>
            What would change it
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.25 }}>
            {explanation.changesWhen}
          </Typography>
        </Box>
      </Collapse>
    </Box>
  );
};
