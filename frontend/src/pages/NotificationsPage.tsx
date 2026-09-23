// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { BellOff } from 'lucide-react';
import { getNotifications, getSettings } from '../services/api';
import { apiErrorMessage } from '../services/apiError';
import { EmptyState, ErrorState, LoadingState } from '../components/common/States';
import type { AppNotification } from '../types/system';
import { Eyebrow, PageHead, Panel, Pill, Row, Section } from '../components/ui/primitives';

/**
 * Only things that change what you should do next -- the prototype's list, and
 * under it how alerts are delivered.
 *
 * Worked out from your evidence when this page opens. There is nothing to mark
 * as read, so the prototype's "Mark all read" is not drawn: each notification
 * goes away when what it asks for is done.
 */
export const NotificationsPage: React.FC = () => {
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Which triggers are on, for the delivery panel. Unsaid when unreadable.
  const [triggers, setTriggers] = useState<{ on: number; total: number } | null>(null);

  const load = useCallback(() => {
    setError(null);
    getNotifications()
      .then(setItems)
      .catch((err) => setError(apiErrorMessage(err, 'The server did not respond.')));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => getSettings())
      .then((s) => {
        const all = Object.values(s.notification_triggers ?? {});
        if (!cancelled && all.length > 0) setTriggers({ on: all.filter(Boolean).length, total: all.length });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <Box>
      <PageHead
        eyebrow="Activity"
        title="Notifications"
        sub="Only things that change what you should do next. Each one clears itself when it is done, and PrepBench does not notify you to create streaks."
        actions={<Button component={RouterLink} to="/settings/notifications" variant="outlined">What raises one</Button>}
      />

      {error && <ErrorState what="Could not work out your notifications" saved="nothing_to_save" detail={error} onRetry={load} />}
      {!items && !error && <LoadingState label="Checking your evidence…" />}

      {items && items.length === 0 && (
        <Panel>
          <EmptyState
            icon={<BellOff size={28} />}
            title="Nothing needs you"
            why="Nothing is due, no mock came in under its pass mark, and no plan is slipping. That is the system working, not a missed day."
          />
        </Panel>
      )}

      {items && items.length > 0 && (
        <Panel component="section" aria-label="Notifications">
          <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
            {items.map((n) => (
              <Row
                key={n.id}
                component="li"
                titleComponent="h2"
                title={n.title}
                detail={n.detail}
                middle={(
                  <Pill tone={n.severity === 'warning' ? 'warning' : 'accent'}>
                    {n.severity === 'warning' ? 'Evidence moved' : 'Waiting for you'}
                  </Pill>
                )}
                action={<Button component={RouterLink} to={n.action_path} variant="outlined">{n.action_label}</Button>}
              />
            ))}
          </Box>
        </Panel>
      )}

      <Section>
        <Panel soft component="section" aria-label="Delivery">
          <Eyebrow component="h2">Delivery</Eyebrow>
          <Row
            title="Alerts in the header"
            detail={triggers
              ? `${triggers.on} of ${triggers.total} kinds of alert switched on · raised only when something is actually due`
              : 'Raised only when something is actually due'}
            middle={triggers ? <Pill tone={triggers.on > 0 ? 'success' : 'neutral'}>{triggers.on > 0 ? 'On' : 'Off'}</Pill> : undefined}
            action={<Button component={RouterLink} to="/settings/notifications" variant="outlined" aria-label="Change alert settings">Change</Button>}
          />
          <Row
            title="Streaks and encouragement"
            detail="Deliberately not implemented"
            middle={<Pill>Off</Pill>}
          />
        </Panel>
      </Section>
    </Box>
  );
};
