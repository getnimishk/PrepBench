// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { getContentPack } from '../services/api';
import { apiErrorMessage } from '../services/apiError';
import { usePreparation } from '../context/PreparationContext';
import {
  fetchPreparationAttempts, rolesPractised, scenarioProgress, scenarioStatus, type ScenarioStatus,
} from '../services/scenarios/scenarioAttempts';
import type { ContentPackDetail, Scenario } from '../types/contentPack';
import type { WireLearningAttempt } from '../types/learning';
import { EmptyState, ErrorState, LoadingState } from '../components/common/States';
import {
  Actions, CheckRow, Detail, Grid, Note, PageHead, Panel, PanelHead, Pill, Row, Section, Sub,
} from '../components/ui/primitives';

const STATUS: Record<ScenarioStatus, { label: string; tone: 'neutral' | 'accent' | 'success' | 'warning' }> = {
  planned: { label: 'Planned', tone: 'neutral' },
  'not-started': { label: 'Ready', tone: 'accent' },
  'in-progress': { label: 'In progress', tone: 'warning' },
  practised: { label: 'Practised', tone: 'success' },
};

const ScenarioRow: React.FC<{
  pack: ContentPackDetail; scenario: Scenario; attempts: WireLearningAttempt[]; heading: 'h3' | 'h4';
}> = ({ pack, scenario, attempts, heading }) => {
  const progress = scenarioProgress(attempts, pack.pack_id, pack.version, scenario);
  const s = STATUS[scenarioStatus(Boolean(scenario.content), progress)];
  const roles = rolesPractised(progress);
  const index = pack.chapters.findIndex((c) => c.id === scenario.chapter);
  const chapter = index >= 0 ? pack.chapters[index] : null;
  return (
    <Row
      title={`${scenario.number} · ${scenario.title}`}
      titleComponent={heading}
      detail={(
        <>
          {scenario.outcome}{' '}
          {chapter && (
            <RouterLink to={`/learn/guides/${pack.pack_id}/${chapter.id}`}>
              Guide chapter {index + 1}: {chapter.title}
            </RouterLink>
          )}
        </>
      )}
      middle={(
        <Pill tone={s.tone} title={roles.length ? `Practised as: ${roles.map((r) => r.label).join(', ')}` : undefined}>
          {roles.length ? `${s.label} · ${roles.length} role${roles.length > 1 ? 's' : ''}` : s.label}
        </Pill>
      )}
      action={scenario.content
        ? (
          <Button
            size="small"
            variant="contained"
            component={RouterLink}
            to={`/scenarios/${pack.pack_id}/${scenario.id}`}
            aria-label={`Open scenario ${scenario.number}: ${scenario.title}`}
          >
            Open
          </Button>
        )
        : <Detail>Not written yet</Detail>}
    />
  );
};

/**
 * The Learning Lab's scenario sandbox: incidents from real projects, practised
 * in your role. One sandbox for every content pack -- it shows the scenarios of
 * the packs attached to the preparation you are working in, at the version it
 * pinned (D2, D4).
 */
export const ScenarioSandboxPage: React.FC = () => {
  const { selected, loading: loadingPreparation } = usePreparation();
  const links = selected?.content_packs ?? [];
  const linkKey = links.map((l) => `${l.pack_id}@${l.pack_version}`).join(',');

  const [packs, setPacks] = useState<ContentPackDetail[] | null>(null);
  const [attempts, setAttempts] = useState<WireLearningAttempt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [unloaded, setUnloaded] = useState<string[]>([]);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!selected) return undefined;
    let cancelled = false;
    setPacks(null);
    setError(null);
    // One pack that won't load (a pinned version file missing, say) is named
    // on the page; it doesn't hide the scenarios of every other pack.
    Promise.all([
      Promise.allSettled(links.map((l) => getContentPack(l.pack_id, l.pack_version))),
      links.length ? fetchPreparationAttempts(selected.id) : Promise.resolve([]),
    ])
      .then(([settled, recorded]) => {
        if (cancelled) return;
        setPacks(settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])));
        setUnloaded(links.filter((_, i) => settled[i].status === 'rejected').map((l) => `${l.title} (version ${l.pack_version})`));
        setAttempts(recorded);
      })
      .catch((err) => { if (!cancelled) setError(apiErrorMessage(err, '')); });
    return () => { cancelled = true; };
    // linkKey stands for `links`: a new array on every render, the same links.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, linkKey, reload]);

  const head = (
    <PageHead
      eyebrow="Learning Lab · Sandbox"
      title="Scenarios"
      sub="Fictional incidents and decisions from data projects, each practising one chapter of a guide in the Study Library, worked through in your role."
      actions={packs?.length === 1 && (
        <Button variant="outlined" component={RouterLink} to={`/learn/guides/${packs[0].pack_id}`}>Read the guide</Button>
      )}
    />
  );

  if (loadingPreparation || (selected && packs === null && error === null)) {
    return <Box>{head}<LoadingState label="Loading scenarios…" /></Box>;
  }
  if (error !== null) {
    return (
      <Box>
        {head}
        <ErrorState what="Could not load the scenarios." saved="nothing_to_save" detail={error} onRetry={() => setReload((n) => n + 1)} />
      </Box>
    );
  }

  const withScenarios = (packs ?? []).filter((p) => p.scenario_levels.some((l) => l.scenarios.length));
  const unloadedNote = unloaded.length > 0 && (
    <Note sx={{ mb: '16px' }}>
      Couldn&apos;t load {unloaded.join(', ')}, so its scenarios aren&apos;t shown. Reload the page to try again.
    </Note>
  );

  if (!selected || withScenarios.length === 0) {
    const why = !selected
      ? 'Scenarios come from the built-in guide of a Skill preparation. Choose or create one to practise them.'
      : selected.kind !== 'skill'
        ? `Scenarios come from the built-in guide of a Skill preparation, and ${selected.name} is a certification.`
        : links.length === 0
          ? `Scenarios come from a built-in guide, and ${selected.name} has none attached.`
          : unloaded.length === links.length
            ? `The guides attached to ${selected.name} couldn't be loaded.`
            : `The guides attached to ${selected.name} have no scenarios yet.`;
    return (
      <Box>
        {head}
        {unloadedNote}
        <Panel>
          <EmptyState
            title="No scenarios for this preparation"
            why={why}
            action={(
              <Actions sx={{ justifyContent: 'center' }}>
                {selected?.kind === 'skill' && (
                  <Button variant="contained" component={RouterLink} to={`/preparations/${selected.id}/edit`}>Attach a guide</Button>
                )}
                <Button variant="outlined" component={RouterLink} to="/preparations/new">New Skill preparation</Button>
              </Actions>
            )}
          />
        </Panel>
      </Box>
    );
  }

  return (
    <Box>
      {head}
      {unloadedNote}

      <Panel component="section" aria-labelledby="sandbox-how">
        <PanelHead title="How a scenario works" titleId="sandbox-how" />
        <Grid columns={3}>
          <CheckRow mark="1"><b>Learn it in the Study Library.</b> Each scenario links to the guide chapter it practises.</CheckRow>
          <CheckRow mark="2"><b>Work through it here, as your role.</b> A short check, then a fictional incident as a product owner, product manager, delivery manager or engineering manager, then the debrief.</CheckRow>
          <CheckRow mark="3"><b>Say it.</b> Answer a real interview question, honestly: what you studied, not what you claim to have built.</CheckRow>
        </Grid>
        <Sub>
          Scenarios give you understanding, not experience. Nothing here is presented as work you have done; where you have a
          real story, the Say-it step asks you to lead with it.
        </Sub>
        <Detail>Your work is kept in {selected.name}. None of it counts towards readiness.</Detail>
      </Panel>

      {withScenarios.map((pack) => (
        <React.Fragment key={pack.pack_id}>
          {withScenarios.length > 1 && (
            <Section><PanelHead title={pack.title} sx={{ mb: 0 }} /></Section>
          )}
          {pack.scenario_levels.map((level, i) => (
            <Section key={level.name}>
              <Panel component="section" aria-labelledby={`sandbox-${pack.pack_id}-level-${i}`}>
                <PanelHead
                  title={withScenarios.length > 1 ? level.name : `${pack.title}: ${level.name}`}
                  titleComponent={withScenarios.length > 1 ? 'h3' : 'h2'}
                  titleId={`sandbox-${pack.pack_id}-level-${i}`}
                >
                  <Detail>{level.about}</Detail>
                </PanelHead>
                {level.scenarios.map((s) => <ScenarioRow key={s.id} pack={pack} scenario={s} attempts={attempts} heading={withScenarios.length > 1 ? 'h4' : 'h3'} />)}
              </Panel>
            </Section>
          ))}
        </React.Fragment>
      ))}

      <Section>
        <Actions><Button variant="outlined" component={RouterLink} to="/lab">All sandboxes</Button></Actions>
      </Section>
    </Box>
  );
};
