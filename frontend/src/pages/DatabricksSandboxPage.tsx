// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Button, MenuItem, TextField } from '@mui/material';
import {
  deleteLakehouseJournalEntry, getLakehouseEngine, getLakehouseJournal, getLakehouseJournalMarkdown, getLakehousePack,
  getLakehousePacks, getSubjects,
} from '../services/api';
import { apiErrorMessage } from '../services/apiError';
import { SKILL_SLUG } from '../services/lakehouse/attempts';
import type { EngineStatus, JournalEntry, LabPackDetail } from '../types/lakehouse';
import { NARROW_QUERY } from '../theme/tokens';
import { ErrorState, LoadingState } from '../components/common/States';
import { Actions, Detail, Eyebrow, PageHead, Panel, Pill } from '../components/ui/primitives';
import { JournalDrawer } from '../components/lakehouse/JournalDrawer';
import { StationC } from '../components/lakehouse/StationC';

/**
 * The Lakehouse Lab (PRD P0-12, plan Phase 1B). One fictional migration, two levels.
 *
 * Station C (Delta Lake, on the real engine) is built. F, A and B are simulations
 * that arrive in later phases; they're shown in the rail so the shape of the Lab is
 * visible, and say they aren't built yet. Nothing pretends otherwise.
 */

type Station = 'f' | 'a' | 'b' | 'c';

const RAIL: { id: Station; level: 'Programme' | 'Pipeline'; name: string; built: boolean }[] = [
  { id: 'f', level: 'Programme', name: 'Migration Factory', built: false },
  { id: 'a', level: 'Pipeline', name: 'ADF + Lakeflow', built: false },
  { id: 'b', level: 'Pipeline', name: 'ADLS', built: false },
  { id: 'c', level: 'Pipeline', name: 'Delta Lake', built: true },
];

const asStation = (s: string | null): Station => (RAIL.some((r) => r.id === s) ? (s as Station) : 'c');

export const DatabricksSandboxPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const station = asStation(params.get('station'));

  const [engine, setEngine] = useState<EngineStatus | null>(null);
  const [pack, setPack] = useState<LabPackDetail | null>(null);
  const [subjectId, setSubjectId] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [journalOpen, setJournalOpen] = useState(false);
  const [journalError, setJournalError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        const [status, packs, subjects] = await Promise.all([getLakehouseEngine(), getLakehousePacks(), getSubjects()]);
        if (packs.length === 0) throw new Error('The Lab has no scenario pack installed.');
        const detail = await getLakehousePack(packs[0].id);
        if (cancelled) return;
        setEngine(status);
        setPack(detail);
        setSubjectId(subjects.find((s) => s.slug === SKILL_SLUG)?.id);
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'The Lakehouse Lab did not load.'));
      }
    })();
    return () => { cancelled = true; };
  }, [reload]);

  const packId = pack?.id;
  const refreshJournal = useCallback(async () => {
    if (!packId) return;
    try {
      setJournal(await getLakehouseJournal(packId));
      setJournalError(null);
    } catch (err) {
      setJournalError(apiErrorMessage(err, 'The journal did not load.'));
    }
  }, [packId]);
  useEffect(() => { void refreshJournal(); }, [refreshJournal]);

  const deleteEntry = async (entryUid: string) => {
    try {
      await deleteLakehouseJournalEntry(entryUid);
      setJournal((all) => all.filter((e) => e.entry_uid !== entryUid));
    } catch (err) {
      setJournalError(apiErrorMessage(err, 'The entry could not be deleted.'));
    }
  };

  const exportJournal = async () => {
    try {
      const text = await getLakehouseJournalMarkdown(packId);
      const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lakehouse-lab-journal.md';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setJournalError(apiErrorMessage(err, 'The journal could not be exported.'));
    }
  };

  const go = (s: Station) => setParams({ station: s });
  const levels: ('Programme' | 'Pipeline')[] = ['Programme', 'Pipeline'];

  return (
    <Box>
      <PageHead
        eyebrow="Learning Lab · fictional scenario"
        title="Lakehouse Lab"
        sub="A fictional semiconductor manufacturer moving from Hadoop to Databricks. Predict, change one thing, see what really happens."
        actions={<Button variant="outlined" onClick={() => setJournalOpen(true)}>Journal ({journal.length})</Button>}
      />

      {error && <Box sx={{ mt: '16px' }}><ErrorState what="The Lakehouse Lab did not load." saved="nothing_to_save" detail={error} onRetry={() => setReload((n) => n + 1)} /></Box>}
      {!error && (!engine || !pack) && <LoadingState label="Loading the Lakehouse Lab…" />}

      {engine && pack && (
        <>
          <Panel soft sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', p: '12px 16px' }}>
            <Actions>
              {engine.available
                ? <><Pill tone="success">{`Real engine${engine.version ? ` · deltalake ${engine.version}` : ''}`}</Pill><Detail>Operations run for real on this computer.</Detail></>
                : <><Pill tone="warning">Real engine not installed</Pill><Detail>Nothing runs, and nothing stands in for it.</Detail></>}
            </Actions>
          </Panel>

          {/* Station rail: the programme above the pipeline. A select on a phone. */}
          <Box component="nav" aria-label="Stations" sx={{ mt: '20px', display: 'grid', gap: '8px', [NARROW_QUERY]: { display: 'none' } }}>
            {levels.map((level) => (
              <Box key={level} sx={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <Eyebrow component="span" sx={{ width: 74 }}>{level}</Eyebrow>
                {RAIL.filter((s) => s.level === level).map((s) => (
                  <Button
                    key={s.id}
                    variant={station === s.id ? 'contained' : 'outlined'}
                    aria-current={station === s.id ? 'page' : undefined}
                    onClick={() => go(s.id)}
                  >
                    {s.id.toUpperCase()} · {s.name}{s.built ? '' : ' (not built yet)'}
                  </Button>
                ))}
              </Box>
            ))}
          </Box>
          <TextField
            select label="Station" value={station} onChange={(e) => go(e.target.value as Station)}
            sx={{ mt: '20px', width: '100%', display: 'none', [NARROW_QUERY]: { display: 'flex' } }}
          >
            {RAIL.map((s) => (
              <MenuItem key={s.id} value={s.id}>{s.id.toUpperCase()} · {s.name}{s.built ? '' : ' (not built yet)'}</MenuItem>
            ))}
          </TextField>

          {station === 'c' && (
            <StationC pack={pack} engine={engine} subjectId={subjectId} onJournalChange={refreshJournal} />
          )}
          {station !== 'c' && (
            <Panel component="section" aria-labelledby="station-later" sx={{ mt: '22px' }}>
              <Eyebrow component="h2" id="station-later">Station {station.toUpperCase()} · {RAIL.find((s) => s.id === station)?.name}</Eyebrow>
              <Detail sx={{ mt: '8px' }}>
                This station isn’t built yet. It arrives in a later phase of the Lab. Station C, Delta Lake, is ready.
              </Detail>
              <Actions sx={{ mt: '12px' }}>
                <Button variant="outlined" onClick={() => go('c')}>Open Station C</Button>
              </Actions>
            </Panel>
          )}
        </>
      )}

      <JournalDrawer
        open={journalOpen}
        entries={journal}
        error={journalError}
        onClose={() => setJournalOpen(false)}
        onDelete={deleteEntry}
        onExport={exportJournal}
      />
    </Box>
  );
};
