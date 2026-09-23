// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Badge, Box, Button, Tooltip, type SxProps, type Theme } from '@mui/material';
import { NARROW_QUERY } from '../../theme/tokens';
import { usePb } from '../../theme/usePb';
import { headerIconButtonSx } from './headerStyles';

/**
 * One of the prototype's header buttons: its word, bordered. On a phone the word
 * gives way to its icon, so every action stays reachable in 314 pixels.
 *
 * `badge` is a count drawn on the button's corner -- the prototype's "Alerts
 * badge in the header". No count, or zero, draws nothing.
 */
export const HeaderAction: React.FC<{
  label: string;
  icon: React.ReactNode;
  /** The accessible name, when it says more than the word. It must start with the word. */
  ariaLabel?: string;
  tooltip?: string;
  badge?: number | null;
  onClick?: () => void;
  to?: string;
  sx?: SxProps<Theme>;
}> = ({ label, icon, ariaLabel, tooltip, badge, onClick, to, sx }) => {
  const t = usePb();
  const button = (
    <Button
      {...(to ? { component: RouterLink, to } : { onClick })}
      variant="outlined"
      aria-label={ariaLabel ?? label}
      sx={[
        {
          flexShrink: 0,
          [NARROW_QUERY]: { ...headerIconButtonSx(t)[NARROW_QUERY], p: 0, minWidth: 32 },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box component="span" sx={{ [NARROW_QUERY]: { display: 'none' } }}>{label}</Box>
      <Box component="span" aria-hidden sx={{ display: 'none', [NARROW_QUERY]: { display: 'inline-flex' } }}>{icon}</Box>
    </Button>
  );

  return (
    <Tooltip title={tooltip ?? ariaLabel ?? label}>
      {badge ? (
        // The count is in the button's name already; the dot only draws it.
        <Badge
          badgeContent={badge}
          color="error"
          max={99}
          slotProps={{ badge: { 'aria-hidden': true } }}
          sx={[
            { flexShrink: 0, '& .MuiBadge-badge': { top: 3, right: 3, height: 16, minWidth: 16, px: '4px', fontSize: (t) => t.typography.pxToRem(10), fontWeight: 800 } },
            ...(Array.isArray(sx) ? sx : [sx]),
          ]}
        >
          {button}
        </Badge>
      ) : button}
    </Tooltip>
  );
};
