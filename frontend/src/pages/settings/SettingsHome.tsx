// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { getAboutReport, getLLMProviders, getProfile, getSettings, getStorageReport } from '../../services/api';
import { useImportLauncher } from '../../context/importLauncherContext';
import { usePreparation } from '../../context/PreparationContext';
import { useThemeMode } from '../../context/ThemeContext';
import { SHORTCUT_GROUPS } from '../../services/shortcuts';
import { formatBytes } from '../../services/format';
import type { AppSettings } from '../../types/settings';
import type { LLMProvider } from '../../types/llm';
import type { AboutReport, StorageReport } from '../../types/system';
import type { Profile } from '../../types/profile';
import {
  Actions, Detail, Grid, PageHead, Panel, PanelHead, Pill, Row, Section,
} from '../../components/ui/primitives';

/**
 * Settings: configuration, kept outside the learning loop -- the prototype's
 * six panels, two rows of three.
 *
 * Each row says what it is set to now, read from where it is actually stored,
 * and opens the screen that changes it. A row whose value could not be read
 * says so rather than showing a default as if it were the setting. The
 * prototype's "weekly backups" row is not drawn: backups here are downloaded
 * on demand, and the row says that instead.
 */

type Load<T> = { state: 'loading' } | { state: 'ready'; value: T } | { state: 'failed' };

function useLoad<T>(fetch: () => Promise<T>): Load<T> {
  const [load, setLoad] = useState<Load<T>>({ state: 'loading' });
  useEffect(() => {
    let cancelled = false;
    fetch()
      .then((value) => { if (!cancelled) setLoad({ state: 'ready', value }); })
      .catch(() => { if (!cancelled) setLoad({ state: 'failed' }); });
    return () => { cancelled = true; };
    // Read once, when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return load;
}

function read<T>(load: Load<T>, show: (value: T) => React.ReactNode): React.ReactNode {
  if (load.state === 'loading') return 'Loading…';
  if (load.state === 'failed') return 'Could not be read';
  return show(load.value);
}

const Go: React.FC<{ to: string; label: string; children: React.ReactNode }> = ({ to, label, children }) => (
  <Button component={RouterLink} to={to} variant="outlined" aria-label={label}>{children}</Button>
);

const THEME_NAMES = { light: 'Light', dark: 'Dark', system: 'Follows the system' } as const;

/** A settings row: the prototype's .row with the control at the right. */
const Line: React.FC<{ title: string; detail: React.ReactNode; children?: React.ReactNode }> = ({ title, detail, children }) => (
  <Row
    title={title}
    detail={detail}
    columns="minmax(0,1fr) auto"
    action={children ? <Actions sx={{ gap: '6px', flexWrap: 'nowrap', justifyContent: 'flex-end' }}>{children}</Actions> : undefined}
  />
);

export const SettingsHome: React.FC = () => {
  const { preparations, selected, loading: preparationsLoading, error: preparationsError } = usePreparation();
  const { mode, toggleTheme } = useThemeMode();
  const settings = useLoad<AppSettings>(getSettings);
  const providers = useLoad<LLMProvider[]>(getLLMProviders);
  const storage = useLoad<StorageReport>(getStorageReport);
  const profile = useLoad<Profile>(getProfile);
  const about = useLoad<AboutReport>(getAboutReport);
  const { openImport } = useImportLauncher();

  const shortcutCount = SHORTCUT_GROUPS.reduce((n, g) => n + g.items.length, 0);
  const enabled = providers.state === 'ready' ? providers.value.filter((p) => p.is_enabled) : [];
  const local = enabled.filter((p) => p.is_local);
  const cloud = enabled.filter((p) => !p.is_local);
  const names = (list: LLMProvider[]) => list.map((p) => p.name).join(', ');

  return (
    <Box>
      <PageHead
        eyebrow="System"
        title="Settings"
        sub="Configuration lives outside the learning loop. Core practice runs entirely on this machine; AI is optional and routed per task."
      />

      <Grid columns={3} sx={{ alignItems: 'start' }}>
        <Panel component="section" aria-label="Workspace">
          <PanelHead eyebrow="Account & workspace" title="You" />
          <Line
            title="Profile"
            detail={read(profile, (p) => (
              [p.display_name, p.email].filter(Boolean).join(' · ') || 'No name yet · there is no account, only what this copy shows'
            ))}
          >
            <Go to="/profile" label="Open profile">Open</Go>
          </Line>
          <Line
            title="Preparations"
            detail={preparationsLoading
              ? 'Loading…'
              : preparationsError
                ? 'Could not be read'
                : `${preparations.length} active${selected ? ` · working on ${selected.name}` : ''}`}
          >
            <Go to="/preparations" label="Open preparations">Open</Go>
          </Line>
          <Line title="Add preparation" detail="A certification or a skill, with its own bank and evidence">
            <Go to="/preparations/new" label="Add a preparation">Add</Go>
          </Line>
        </Panel>

        <Panel component="section" aria-label="Practice and learning">
          <PanelHead eyebrow="Practice & learning" title="How sessions behave" />
          <Line
            title="Practice preferences"
            detail={read(settings, (s) => `Daily review cap ${s.review_daily_cap} · timer sound ${s.timer_sound_enabled ? 'on' : 'off'}`)}
          >
            <Go to="/settings/practice" label="Open practice preferences">Configure</Go>
          </Line>
          <Line
            title="Keyboard shortcuts"
            detail={read(settings, (s) => (s.shortcuts_enabled === false
              ? 'Off'
              : `On · ${shortcutCount} shortcuts for search, exams, spaced review and interviews`))}
          >
            <Go to="/settings/shortcuts" label="Open keyboard shortcuts">Edit</Go>
          </Line>
          <Line title="Getting started" detail="The setup steps, and which of them are done">
            <Go to="/onboarding" label="Open getting started">Open</Go>
          </Line>
        </Panel>

        <Panel component="section" aria-label="Data">
          <PanelHead eyebrow="Data" title="Local storage" />
          <Line
            title="Data & storage"
            detail={read(storage, (r) => (r.database.path
              ? `${formatBytes((r.database.size_bytes ?? 0) + (r.database.wal_bytes ?? 0))} · ${r.counts.questions ?? 0} questions · backup available`
              : `${r.database.engine} database`))}
          >
            <Go to="/settings/data" label="Open data and storage">Manage</Go>
          </Line>
          <Line title="Import questions" detail="CSV, JSON, Excel or Markdown, audited row by row">
            <Button variant="outlined" onClick={openImport} aria-label="Import questions">Import</Button>
          </Line>
          <Line title="Backups" detail="Downloaded when you ask, from Data & storage">
            <Pill>On demand</Pill>
          </Line>
        </Panel>
      </Grid>

      <Section>
        <Grid columns={3} sx={{ alignItems: 'start' }}>
          <Panel component="section" aria-label="AI">
            <PanelHead eyebrow="AI" title="Providers" />
            <Line title="On this machine" detail={read(providers, () => (local.length ? names(local) : 'No local model set up'))}>
              {providers.state === 'ready' && <Pill tone={local.length ? 'success' : 'neutral'}>{local.length ? 'Configured' : 'None'}</Pill>}
            </Line>
            <Line title="Cloud provider" detail={read(providers, () => (cloud.length ? names(cloud) : 'Optional, task-level routing'))}>
              {providers.state === 'ready' && <Pill tone={cloud.length ? 'success' : 'neutral'}>{cloud.length ? 'Configured' : 'None'}</Pill>}
            </Line>
            <Line
              title="AI providers and task routing"
              detail={read(providers, (list) => {
                const on = list.filter((p) => p.is_enabled);
                if (on.length === 0) return 'None configured';
                const here = on.filter((p) => p.is_local).length;
                return `${on.length} enabled: ${here} on this machine, ${on.length - here} cloud`;
              })}
            >
              <Go to="/settings/ai" label="Open AI providers">Configure</Go>
            </Line>
            <Detail sx={{ mt: '10px' }}>
              With no provider able to run a task, it shows <b>Not graded</b> or stays unavailable. Nothing is invented.
            </Detail>
          </Panel>

          <Panel component="section" aria-label="Interface">
            <PanelHead eyebrow="Interface" title="Appearance & alerts" />
            <Line
              title="Theme"
              detail={read(settings, (s) => `${THEME_NAMES[s.theme] ?? 'Light'}${s.theme === 'system' ? ` (${mode} now)` : ''} · text ${s.text_size === 'large' ? 'large' : 'standard'}`)}
            >
              <Button variant="outlined" onClick={toggleTheme}>Switch</Button>
              <Go to="/settings/appearance" label="Open appearance">Open</Go>
            </Line>
            <Line
              title="Notifications"
              detail={read(settings, (s) => {
                const on = Object.values(s.notification_triggers ?? {}).filter(Boolean).length;
                return `${on} of ${Object.keys(s.notification_triggers ?? {}).length} alerts on · no streaks, ever`;
              })}
            >
              <Go to="/settings/notifications" label="Open notification settings">Configure</Go>
            </Line>
          </Panel>

          <Panel component="section" aria-label="System">
            <PanelHead eyebrow="System" title="About this build" />
            <Line
              title="About & privacy"
              detail={read(about, (a) => `v${a.version} · telemetry ${a.telemetry ? 'on' : 'off'}`)}
            >
              <Go to="/settings/about" label="Open about and privacy">Open</Go>
            </Line>
            <Line title="Interface states" detail="Empty, loading, error and offline screens">
              <Go to="/settings/states" label="Open interface states">Open</Go>
            </Line>
          </Panel>
        </Grid>
      </Section>
    </Box>
  );
};
