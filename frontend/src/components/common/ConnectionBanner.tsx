// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button } from '@mui/material';
import { useConnection } from '../../hooks/useConnection';
import { pingServer } from '../../services/api';

/** How often to look for the server again while it is gone. */
const RETRY_MS = 5000;

/**
 * Said once, for the whole app, when the server stops answering.
 *
 * What it does not do is imply anything was saved: while this shows, nothing
 * reaches the database. Screens that can keep work on this device say so
 * themselves, next to the work. It checks again on its own, and says when the
 * connection is back rather than just disappearing.
 */
export const ConnectionBanner: React.FC = () => {
  const state = useConnection();
  const [checking, setChecking] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const wasDown = useRef(false);
  const [offlineDevice, setOfflineDevice] = useState(
    typeof navigator !== 'undefined' && navigator.onLine === false,
  );

  useEffect(() => {
    const on = () => setOfflineDevice(false);
    const off = () => setOfflineDevice(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => {
    if (state === 'unreachable') {
      wasDown.current = true;
      setRecovered(false);
      const timer = setInterval(() => { pingServer(); }, RETRY_MS);
      return () => clearInterval(timer);
    }
    if (wasDown.current) {
      wasDown.current = false;
      setRecovered(true);
      const timer = setTimeout(() => setRecovered(false), 4000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [state]);

  const check = async () => {
    setChecking(true);
    await pingServer();
    setChecking(false);
  };

  if (state === 'unreachable') {
    return (
      <Box sx={{ px: { xs: 2, sm: 3 }, pt: 2 }}>
        <Alert
          severity="error"
          action={<Button color="inherit" size="small" onClick={check} disabled={checking}>{checking ? 'Checking…' : 'Try again'}</Button>}
        >
          Can&apos;t reach PrepBench&apos;s server, so nothing you do now is being saved to your data.
          Checking again every few seconds.
        </Alert>
      </Box>
    );
  }
  if (recovered) {
    return (
      <Box sx={{ px: { xs: 2, sm: 3 }, pt: 2 }}>
        <Alert severity="success" role="status">Connected to the server again.</Alert>
      </Box>
    );
  }
  if (offlineDevice) {
    return (
      <Box sx={{ px: { xs: 2, sm: 3 }, pt: 2 }}>
        <Alert severity="info" role="status">
          This device is offline. Practice, review and mocks keep working here; a cloud AI provider
          cannot be reached until you are back online.
        </Alert>
      </Box>
    );
  }
  return null;
};
