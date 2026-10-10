// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Button, MenuItem, TextField } from '@mui/material';
import {
  deleteLakehouseJournalEntry, getLakehouseEngine, getLakehouseJournal, getLakehouseJournalMarkdown, getLakehousePack,
  getLakehousePacks, getSubjects,
} from '../services/api';
import { apiErrorMessage } from '../services/apiError';
import { DEFAULT_LEVERS, leversKey, parseAdf, parseLevers, runPipeline, type AdfLevers, type SourceRow } from '../services/lakehouse/adfModel';
import { SKILL_SLUG } from '../services/lakehouse/attempts';
import { loadSourceIndex } from '../services/lakehouse/sourceIndex';
import { downstreamChallenge, DOWNSTREAM_PARAM } from '../services/lakehouse/stationC';
import type { EngineStatus, JournalEntry, LabPackDetail, LabPackSummary } from '../types/lakehouse';
import { NARROW_QUERY } from '../theme/tokens';
import { ErrorState, LoadingState } from '../components/common/States';
import { Actions, Detail, Eyebrow, PageHead, Panel, Pill } from '../components/ui/primitives';
import { JournalDrawer } from '../components/lakehouse/JournalDrawer';
import { StationA } from '../components/lakehouse/StationA';
import { StationB } from '../components/lakehouse/StationB';
import { StationC } from '../components/lakehouse/StationC';
import { StationD } from '../components/lakehouse/StationD';
import { StationF } from '../components/lakehouse/StationF';
import { StationI } from '../components/lakehouse/StationI';

/**
 * The Lakehouse Lab (PRD P0-12, plan Phase 1B). One fictional migration, two levels.
 *
 * Six stations: F (the Migration Factory), I (identity and governance), A (ADF + Lakeflow) and B (ADLS)
 * are simulations, and C (Delta Lake) and D (the Reconciliation Detective) run on the real engine. A's
 * batch manifest feeds C.
 *
 * More than one scenario pack can be installed. The page offers the stations a pack lists in its
 * manifest and no others, so a pack that ships only data (the JD-PO-005 pack) shows Station C and
 * nothing that would have to say "no content". Nothing here is specific to a pack.
 */

type Station = 'f' | 'i' | 'a' | 'b' | 'c' | 'd';

const RAIL: { id: Station; level: 'Programme' | 'Pipeline'; name: string }[] = [
  { id: 'f', level: 'Programme', name: 'Migration Factory' },
  { id: 'i', level: 'Programme', name: 'Identity and governance' },
  { id: 'a', level: 'Pipeline', name: 'ADF + Lakeflow' },
  { id: 'b', level: 'Pipeline', name: 'ADLS' },
  { id: 'c', level: 'Pipeline', name: 'Delta Lake' },
  { id: 'd', level: 'Pipeline', name: 'Reconciliation Detective' },
];

// The programme comes first: it shows why the pipeline details matter.
const UPSTREAM_KEY = 'prepbench.lab.lakehouse.upstream';

/** The upstream Station A last ran, kept for the session; anything unreadable is the default upstream. */
function readUpstream(): AdfLevers {
  try {
    const raw = window.sessionStorage.getItem(UPSTREAM_KEY);
    return raw ? parseLevers(JSON.parse(raw)) : DEFAULT_LEVERS;
  } catch {
    return DEFAULT_LEVERS;
  }
}

/** The station to show: the one asked for if the pack has it, else the first it has (programme first). */
const stationFor = (requested: string | null, available: Station[]): Station =>
  (available.find((s) => s === requested) ?? available[0] ?? 'c');

/** The pack asked for if it's installed; otherwise the one with the most stations (the full scenario), then the first. */
function choosePack(packs: LabPackSummary[], requested: string | null): string | null {
  const asked = packs.find((p) => p.id === requested);
  if (asked) return asked.id;
  return [...packs].sort((a, b) => b.stations.length - a.stations.length)[0]?.id ?? null;
}

export const DatabricksSandboxPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [engine, setEngine] = useState<EngineStatus | null>(null);
  const [packList, setPackList] = useState<LabPackSummary[] | null>(null);
  const [pack, setPack] = useState<LabPackDetail | null>(null);
  const [subjectId, setSubjectId] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  // Which pack, and which of its stations. Both come from the address, so a reload and a link keep them.
  const packParam = params.get('pack');
  const packId = packList ? choosePack(packList, packParam) : null;
  const available = RAIL.map((r) => r.id).filter((id) => !pack || pack.stations.includes(id));
  const station = stationFor(params.get('station'), available);
  // Station F's yield wave sends the learner to Station C's comparison, and says where from.
  const presetChallenge = station === 'c' ? params.get('challenge') : null;
  const fromStationA = station === 'c' && params.get('from') === 'a';
  const fromWave = params.get('from') === 'f' ? Number(params.get('wave')) || null : null;

  // What Station A last ran: the upstream Station C's downstream challenge writes for real. Kept for
  // the session, so a reload doesn't forget it; unreadable or absent, it is the default upstream.
  const [upstream, setUpstreamState] = useState<AdfLevers>(readUpstream);
  const setUpstream = useCallback((levers: AdfLevers) => {
    setUpstreamState(levers);
    try { window.sessionStorage.setItem(UPSTREAM_KEY, JSON.stringify(levers)); } catch { /* the page still works without it */ }
  }, []);
  const upstreamIsDefault = leversKey(upstream) === leversKey(DEFAULT_LEVERS);

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
        if (cancelled) return;
        setEngine(status);
        setPackList(packs);
        setSubjectId(subjects.find((s) => s.slug === SKILL_SLUG)?.id);
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'The Lakehouse Lab did not load.'));
      }
    })();
    return () => { cancelled = true; };
  }, [reload]);

  // The chosen pack's content. Changing pack drops the old one first, so nothing of it is shown for the new one.
  useEffect(() => {
    if (!packId) return undefined;
    let cancelled = false;
    setPack((current) => (current?.id === packId ? current : null));
    getLakehousePack(packId)
      .then((detail) => { if (!cancelled) setPack(detail); })
      .catch((err) => { if (!cancelled) setError(apiErrorMessage(err, 'The scenario did not load.')); });
    return () => { cancelled = true; };
  }, [packId, reload]);

  // Station C's downstream challenge is built from Station A's manifest, over the source index.
  const adf = useMemo(() => (pack ? parseAdf(pack.pipeline) : null), [pack]);
  const adfTable = adf?.ok ? adf.config.table : null;
  const [sourceRows, setSourceRows] = useState<SourceRow[] | null | 'failed'>(null);
  useEffect(() => {
    if (station !== 'c' || !pack || !adfTable) return undefined;
    let cancelled = false;
    setSourceRows(null);
    loadSourceIndex(pack.id, pack.version, adfTable)
      .then((rows) => { if (!cancelled) setSourceRows(rows); })
      .catch(() => { if (!cancelled) setSourceRows('failed'); });
    return () => { cancelled = true; };
  }, [station, pack, adfTable]);
  const downstream = useMemo(() => {
    if (!adf?.ok || !Array.isArray(sourceRows)) return undefined;
    return downstreamChallenge(runPipeline(adf.config, sourceRows, upstream), upstream, upstreamIsDefault);
  }, [adf, sourceRows, upstream, upstreamIsDefault]);

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
      const text = await getLakehouseJournalMarkdown(packId ?? undefined);
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

  // Links keep the pack in the address, but only one that is really installed: a stale or mistyped one is dropped.
  const withPack = (p: Record<string, string>) => (packParam && packId === packParam ? { ...p, pack: packParam } : p);
  const go = (s: Station) => setParams(withPack({ station: s }));
  const loadInStationC = () => setParams(withPack({ station: 'c', challenge: DOWNSTREAM_PARAM, from: 'a' }));
  const compareInStationC = (wave: number) => setParams(withPack({ station: 'c', challenge: 'reconciliation', from: 'f', wave: String(wave) }));
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

          {packList && packList.length > 1 && (
            <TextField
              select label="Scenario" value={pack.id} sx={{ mt: '16px', maxWidth: 520 }}
              onChange={(e) => setParams({ pack: e.target.value })}
            >
              {packList.map((p) => <MenuItem key={p.id} value={p.id}>{p.title}</MenuItem>)}
            </TextField>
          )}

          {/* Station rail: the programme above the pipeline. A select on a phone. */}
          <Box component="nav" aria-label="Stations" sx={{ mt: '20px', display: 'grid', gap: '8px', [NARROW_QUERY]: { display: 'none' } }}>
            {levels.filter((level) => RAIL.some((r) => r.level === level && available.includes(r.id))).map((level) => (
              <Box key={level} sx={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <Eyebrow component="span" sx={{ width: 74 }}>{level}</Eyebrow>
                {RAIL.filter((s) => s.level === level && available.includes(s.id)).map((s) => (
                  <Button
                    key={s.id}
                    variant={station === s.id ? 'contained' : 'outlined'}
                    aria-current={station === s.id ? 'page' : undefined}
                    onClick={() => go(s.id)}
                  >
                    {s.id.toUpperCase()} · {s.name}
                  </Button>
                ))}
              </Box>
            ))}
          </Box>
          <TextField
            select label="Station" value={station} onChange={(e) => go(e.target.value as Station)}
            sx={{ mt: '20px', width: '100%', display: 'none', [NARROW_QUERY]: { display: 'flex' } }}
          >
            {RAIL.filter((s) => available.includes(s.id)).map((s) => (
              <MenuItem key={s.id} value={s.id}>{s.id.toUpperCase()} · {s.name}</MenuItem>
            ))}
          </TextField>

          {station === 'f' && (
            <StationF pack={pack} subjectId={subjectId} onJournalChange={refreshJournal} onCompare={compareInStationC} />
          )}
          {station === 'a' && (
            <StationA
              pack={pack} subjectId={subjectId} upstream={upstream} onUpstream={setUpstream}
              onJournalChange={refreshJournal} onLoadInC={loadInStationC}
            />
          )}
          {station === 'i' && <StationI pack={pack} subjectId={subjectId} onJournalChange={refreshJournal} />}
          {station === 'b' && <StationB pack={pack} subjectId={subjectId} onJournalChange={refreshJournal} />}
          {station === 'c' && (adf?.ok && sourceRows === null ? (
            <LoadingState label="Loading Station C…" />
          ) : (
            <StationC
              key={`${presetChallenge ?? 'default'}:${downstream?.id ?? ''}`}
              pack={pack} engine={engine} subjectId={subjectId} onJournalChange={refreshJournal}
              initialChallengeId={
                presetChallenge === DOWNSTREAM_PARAM ? downstream?.id
                  : presetChallenge ? `lakehouse.c.${presetChallenge}` : undefined
              }
              fromFactoryWave={fromWave}
              fromStationA={fromStationA}
              extraChallenges={downstream ? [downstream] : []}
              upstream={downstream ? { isDefault: upstreamIsDefault, onChange: () => go('a') } : undefined}
            />
          ))}
          {station === 'd' && <StationD pack={pack} engine={engine} subjectId={subjectId} onJournalChange={refreshJournal} />}
          {station === 'c' && sourceRows === 'failed' && (
            <Detail sx={{ mt: '8px' }}>The source index didn’t load, so the batch from Station A isn’t available as a challenge.</Detail>
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
