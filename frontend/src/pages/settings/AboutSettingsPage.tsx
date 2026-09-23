// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import { getAboutReport } from '../../services/api';
import { apiErrorMessage } from '../../services/apiError';
import { SettingsRow, SettingsSection, SettingsSubpage } from '../../components/settings/SettingsSubpage';
import type { AboutReport } from '../../types/system';

/**
 * What this build is, where the data sits, and what leaves the machine.
 *
 * "What leaves the machine" is read from the providers actually configured and
 * the tasks actually routed to them, not written as a promise: add a cloud
 * provider and this page names the tasks that now send text to it.
 */

const KEY_STORAGE: Record<string, string> = {
  keyring: "your operating system's credential store",
  file: 'an obfuscated file beside the database (obfuscation, not encryption)',
  env: 'the backend .env file',
};

export const AboutSettingsPage: React.FC = () => {
  const [about, setAbout] = useState<AboutReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    getAboutReport()
      .then(setAbout)
      .catch((err) => setError(apiErrorMessage(err, 'Could not read this build\'s details.')));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SettingsSubpage
      title="About and privacy"
      description="What this build is, where your data sits, and what leaves this machine."
    >
      {error && (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}>
          {error}
        </Alert>
      )}
      {!about && !error && <CircularProgress aria-label="Loading build details" />}

      {about && (
        <>
          <SettingsSection title="This build">
            <SettingsRow label="Version" detail={`PrepBench ${about.version}`} />
            <SettingsRow label="Running on" detail={`${about.platform} · Python ${about.python_version}`} />
            <SettingsRow
              label="Data"
              detail={about.database_path ?? `A ${about.database_engine} database`}
              control={<Button component={RouterLink} to="/settings/data" size="small">Manage data</Button>}
            />
            <SettingsRow
              label="Telemetry"
              detail={about.telemetry ? 'On' : 'None. No analytics and no crash reporting are built in.'}
            />
          </SettingsSection>

          <SettingsSection title="What leaves this machine">
            {about.data_leaving.length === 0 ? (
              <SettingsRow
                label="Nothing, as configured now"
                detail="No enabled cloud provider answers any task. Questions, answers, schedules and recordings stay here."
              />
            ) : (
              <SettingsRow
                label="Text for these tasks"
                detail={(
                  <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
                    {about.data_leaving.map((d) => (
                      <li key={`${d.task}-${d.provider}`}>{d.task}, sent to {d.provider}</li>
                    ))}
                  </Box>
                )}
                control={<Button component={RouterLink} to="/settings/ai" size="small">Change routing</Button>}
              />
            )}
            <SettingsRow
              label="API keys"
              detail={about.key_storage.length === 0
                ? 'No keys are stored.'
                : `Held in ${about.key_storage.map((k) => KEY_STORAGE[k] ?? k).join('; ')}. Never in the database, so never in a backup.`}
            />
            <SettingsRow
              label="Recordings"
              detail={about.data_leaving.some((d) => d.task === 'Interview recording analysis')
                ? 'Kept on this machine. Analysis sends the audio to the provider named above.'
                : 'Kept on this machine, and analysed here or not at all.'}
            />
          </SettingsSection>

          <SettingsSection title="Local-first, stated plainly">
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="body2">
                There is no PrepBench server holding a copy of your preparation. That is the tradeoff: no
                sync, and no recovery if the disk is lost. Download a backup before reinstalling or moving
                machines.
              </Typography>
            </Box>
          </SettingsSection>

          <SettingsSection title="Legal">
            <SettingsRow label="Licence" detail={`${about.license}. Commercial use needs a separate licence from the copyright holder.`} />
            <SettingsRow
              label="Trademarks"
              detail="Certification names belong to their respective bodies. PrepBench is not affiliated with or endorsed by any of them."
            />
          </SettingsSection>
        </>
      )}
    </SettingsSubpage>
  );
};
