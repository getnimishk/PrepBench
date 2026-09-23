// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { Box, Button, Stack, Typography } from '@mui/material';

/**
 * An address no screen answers to.
 *
 * Without it an old bookmark or a mistyped path drew an empty page with no
 * heading and no way on -- indistinguishable from the app having broken.
 */
export const NotFoundPage: React.FC = () => {
  const { pathname } = useLocation();
  return (
    <Box sx={{ maxWidth: 560, py: 6 }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>Nothing at this address</Typography>
      <Typography variant="body1" sx={{ mt: 1.5, color: 'text.secondary', lineHeight: 1.6, wordBreak: 'break-word' }}>
        There is no page at {pathname}. The link may be out of date or mistyped. Nothing was changed.
      </Typography>
      <Stack direction="row" sx={{ gap: 1.5, mt: 3, flexWrap: 'wrap' }}>
        <Button component={RouterLink} to="/" variant="contained">
          Go to Home
        </Button>
        <Button component={RouterLink} to="/preparations">
          My preparations
        </Button>
      </Stack>
    </Box>
  );
};
