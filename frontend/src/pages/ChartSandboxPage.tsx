import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Paper,
  Stack,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { ChevronDown, ChevronRight, EyeOff, GraduationCap, Compass, Map } from 'lucide-react';
import type { FamilyId, ScenarioParams, Stage, TierId } from '../types/agileMetrics';
import { CHART_VIEWS, FAMILIES, chartsInFamily } from '../services/metrics/charts';
import { DEFAULT_PARAMS, validateParams } from '../services/metrics/params';
import { simulate } from '../services/metrics/compose';
import { buildChartPayload } from '../services/metrics/chartData';
import { lineageFor } from '../services/metrics/lineage';
import { baselineFor, isBaseline, keyOutcomes, whatMoved } from '../services/metrics/whatMoved';
import { changedModels, homeFamilies } from '../services/metrics/relevance';
import { ChartPrimitiveView } from '../components/sandbox/ChartPrimitives';
import { AssumptionCallouts } from '../components/sandbox/AssumptionCallouts';
import { ScenarioControls } from '../components/sandbox/ScenarioControls';
import { KeyOutcomes } from '../components/sandbox/KeyOutcomes';
import { FirstExperiment } from '../components/sandbox/FirstExperiment';
import { WhatChanged } from '../components/sandbox/WhatChanged';
import { ScenarioState } from '../components/sandbox/ScenarioState';
import { LearningPanel } from '../components/learning/LearningPanel';
import { ProgressPanel } from '../components/learning/ProgressPanel';
import { ConceptMap } from '../components/learning/ConceptMap';
import type { Attempt, ConceptId, ScenarioId } from '../types/learning';
import { loadAttempts, saveAttempt } from '../services/learning/attempts';
import { recommendNext } from '../services/learning/recommendations';
import { hasHistory, probeProgress } from '../services/learning/placement';
import { CHALLENGE_BY_ID, challengesForConcept } from '../services/learning/challenges';
import { paramsFor } from '../services/learning/scenarios';

// The Chart Sandbox.
//
// One family on screen at a time, and never more. The whole point is to read
// one shape properly rather than to skim a wall of twenty-seven charts, which
// is what every real dashboard already does badly.
//
// Two tiers: Core is what this sandbox is primarily for -- flow,
// predictability, quality, team health. The engineering extension is the
// deployment and operations picture, reachable but secondary, because DORA
// and SRE metrics answer a different question from the ones a Scrum team
// asks in a retro.
//
// The page reads top to bottom as a loop, which is the shape usability
// testing asked for:
//
//   what to try  ->  what you can change  ->  what responded  ->  the shapes
//
// The controls used to be a 1737px rail beside the charts in a 720px
// viewport, which is six screens of scroll and put every chart below the
// fold. They are now a band that collapses ONCE, on the first committed
// change, so the charts take the viewport as soon as the learner has seen
// what there is to move.
//
// Every label on this page is derived. The lineage caption comes from
// `provenance` and `externalAnalogues`, the caveats come from the coupling
// ledger typed as arithmetic / assumption / convention, and the summary
// counts come from diffing two simulation runs. Nothing here restates a
// modelling claim in hand-written copy, because hand-written copy has no
// source of truth to drift from -- and a chart captioned with the wrong
// lineage or an arithmetic identity mislabelled as an assumption teaches
// something worse than nothing.

// The reasoning arc a family walks the reader through.
//
// Eight charts of equal visual weight is a list, not an argument: the reader
// arrives and has no idea which one to read first, so they read none of them
// properly. Grouping them turns the family into a sequence -- what is
// happening, why, and where to go looking -- which is the order an analyst
// would actually work in.
//
// Only three stages, not four. Forecasting would be a fourth, and this
// inventory has no forecast view: predictability is a whole family, not a
// stage inside one, and inventing an empty heading for it would be a promise
// the page cannot keep.
const STAGES: { id: Stage; label: string; blurb: string }[] = [
  { id: 'what', label: 'What is happening', blurb: 'The outcome, before any explanation of it.' },
  { id: 'why', label: 'Why it is happening', blurb: 'Where the time and the work actually went.' },
  { id: 'where', label: 'Where to look', blurb: 'Which items, and which part of the system.' },
];

const TIERS: { id: TierId; label: string; blurb: string }[] = [
  {
    id: 'core',
    label: 'Core',
    blurb: 'How the team works, and what the work costs.',
  },
  {
    id: 'engineeringExtension',
    label: 'Engineering extension',
    blurb: 'What happens after the code is done.',
  },
];

export const ChartSandboxPage: React.FC = () => {
  const [params, setParams] = useState<ScenarioParams>({ ...DEFAULT_PARAMS });
  const [tier, setTier] = useState<TierId>('core');
  const [family, setFamily] = useState<FamilyId>('flow');
  const [controlsOpen, setControlsOpen] = useState(true);

  // Learn vs Explore. NOTHING is locked in either: Explore is the sandbox
  // exactly as it has always been, and a learner can switch at any point. The
  // difference is what the page points at, never what it permits.
  const [mode, setMode] = useState<'learn' | 'explore'>('learn');
  const [attempts, setAttempts] = useState<Attempt[]>(() => loadAttempts());
  const [seenConcepts, setSeenConcepts] = useState<Set<string>>(() => new Set());
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [showMap, setShowMap] = useState(false);
  /** Set when the learner picks a concept off the map. Overrides the recommender. */
  const [chosenChallenge, setChosenChallenge] = useState<string | null>(null);

  // Blind mode removes INTERPRETIVE scaffolding -- what to look for, why it
  // moved, what to do -- and keeps every referent: titles, axes, lineage. The
  // question it asks is whether the learner can read the evidence, not whether
  // they can read our commentary about it.
  const [blind, setBlind] = useState(false);
  // Which families the learner has actually opened since the last change. A
  // badge that stays lit after you have looked is a status light; one that
  // clears is a checklist, and the checklist is what gets the click.
  const [visited, setVisited] = useState<Set<FamilyId>>(() => new Set<FamilyId>(['flow']));

  // Collapses once and then never again. A band that re-closed itself every
  // time the learner touched a slider would be fighting them; the point is
  // only to hand the viewport over to the charts after the first experiment.
  const hasCollapsed = useRef(false);
  const outcomesRef = useRef<HTMLDivElement>(null);

  const collapseOnce = () => {
    if (hasCollapsed.current) return;
    hasCollapsed.current = true;
    setControlsOpen(false);

    // Collapsing alone is not enough. It removes height ABOVE the charts
    // while the reader is still parked at the top of the page, so the first
    // chart lands within about 60px of an 800px fold -- visible, unreadable.
    // Anchoring on the outcomes strip instead of the charts is deliberate:
    // it puts the numbers and the first chart row on screen together, which
    // is the pairing the page exists to teach. Scroll to the charts alone and
    // the thing that answered the slider disappears.
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    requestAnimationFrame(() =>
      outcomesRef.current?.scrollIntoView?.({
        behavior: reduce ? 'auto' : 'smooth',
        block: 'start',
      }),
    );
  };

  const familiesInTier = FAMILIES.filter((f) => f.tier === tier);
  const activeFamily = familiesInTier.some((f) => f.id === family) ? family : familiesInTier[0].id;

  const violations = useMemo(() => validateParams(params), [params]);
  const sprints = useMemo(
    () => (violations.length === 0 ? simulate(params) : []),
    [params, violations],
  );

  const baseline = useMemo(() => baselineFor(params), [params]);
  const baselineSprints = useMemo(() => simulate(baseline), [baseline]);
  const atBaseline = isBaseline(params);

  const outcomes = useMemo(
    () => keyOutcomes(sprints, params, baselineSprints, baseline),
    [sprints, params, baselineSprints, baseline],
  );
  const movement = useMemo(
    () => whatMoved(sprints, params, baselineSprints, baseline),
    [sprints, params, baselineSprints, baseline],
  );

  // Which models the learner reached into, and therefore which families it
  // would be no news at all to see move. Badging a flow control's effect on
  // the flow family spends the signal on arithmetic.
  const changed = useMemo(() => changedModels(params, baseline), [params, baseline]);
  const home = useMemo(() => homeFamilies(changed), [changed]);

  // Every change starts the tour again, with the tab already on screen
  // counted as seen.
  useEffect(() => {
    setVisited(new Set<FamilyId>([activeFamily]));
    // Deliberately not keyed on activeFamily: this fires when the SCENARIO
    // changes, and re-running it on navigation would erase the tour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const openFamily = (next: FamilyId) => {
    setFamily(next);
    setVisited((seen) => new Set(seen).add(next));
  };

  /** Families that moved, that the learner did not go looking for. */
  const surprises = FAMILIES.filter(
    (f) => !home.has(f.id) && (movement.countByFamily.get(f.id) ?? 0) > 0,
  );
  const nextSurprise = [...surprises]
    .filter((f) => !visited.has(f.id))
    .sort(
      (a, b) =>
        (movement.countByFamily.get(b.id) ?? 0) / chartsInFamily(b.id).length -
        (movement.countByFamily.get(a.id) ?? 0) / chartsInFamily(a.id).length,
    )[0];

  // The diagnostic probe runs before the recommender takes over. It TESTS
  // rather than asks: a self-report would place the manager who knows the
  // vocabulary and the analyst who can diagnose in exactly the wrong cells.
  const probe = useMemo(() => probeProgress(attempts), [attempts]);
  const placing = !hasHistory(attempts) || !probe.complete;

  const recommendation = useMemo(() => {
    // A concept picked off the map wins: the map is navigation, and
    // navigation the product overrules is not navigation.
    if (chosenChallenge) {
      const challenge = CHALLENGE_BY_ID.get(chosenChallenge);
      if (challenge) {
        return {
          conceptId: challenge.conceptId,
          challengeId: challenge.id,
          rationale: 'You chose this from the map.',
          expectedEvidence: ['progress on this concept'],
          difficulty: challenge.difficulty,
        };
      }
    }

    // While placing, walk the probe rather than the curriculum.
    if (placing && probe.next) {
      const challenge = CHALLENGE_BY_ID.get(probe.next);
      if (challenge) {
        return {
          conceptId: challenge.conceptId,
          challengeId: challenge.id,
          rationale:
            `Finding where to start (${probe.done + 1} of ${probe.total}). These get ` +
            `harder on purpose — not knowing one is the answer, not a failure.`,
          expectedEvidence: ['where to start you'],
          difficulty: challenge.difficulty,
        };
      }
    }

    const next = recommendNext(attempts);
    // A skipped challenge stays available; it just stops being the thing the
    // page pushes. Skipping is not failing.
    if (next && skipped.has(next.challengeId)) return null;
    return next;
  }, [attempts, skipped, chosenChallenge, placing, probe]);

  const recordAttempt = (attempt: Attempt) => {
    setAttempts(saveAttempt(attempt));
    setSeenConcepts((seen) => new Set(seen).add(attempt.conceptId));
    setChosenChallenge(null);
  };

  const openConcept = (conceptId: ConceptId) => {
    // The first challenge in this concept the learner has not settled, or its
    // first challenge if they have settled them all. Never blocked by
    // prerequisites -- the map recommends an order, it does not enforce one.
    const settled = new Set(
      attempts.filter((a) => a.correct === true && a.hintCount === 0).map((a) => a.challengeId),
    );
    const list = challengesForConcept(conceptId);
    const next = list.find((c) => !settled.has(c.id)) ?? list[0];
    if (!next) return;
    setChosenChallenge(next.id);
    setShowMap(false);
  };

  const applyLearningScenario = (scenario: ScenarioId) => {
    // The ACT step. Applies the challenge's parameterisation to the live
    // sandbox so the learner watches the real model respond.
    applyScenario({ ...paramsFor(scenario), sprints: params.sprints });
  };

  const views = chartsInFamily(activeFamily);
  const familyMeta = FAMILIES.find((f) => f.id === activeFamily)!;

  const changeTier = (next: TierId) => {
    setTier(next);
    openFamily(FAMILIES.find((f) => f.tier === next)!.id);
  };

  const goToFamily = (next: FamilyId) => {
    setTier(FAMILIES.find((f) => f.id === next)!.tier);
    openFamily(next);
  };

  const applyScenario = (next: ScenarioParams) => {
    setParams(next);
    collapseOnce();
  };

  const reset = () => setParams({ ...DEFAULT_PARAMS, sprints: params.sprints });

  return (
    <Box>
      <Box sx={{ mb: 1.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
          Chart Sandbox
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Change one thing. See what happens everywhere.
        </Typography>
      </Box>

      {/* Access is open in both modes. The toggle changes what the page
          POINTS AT, never what it permits -- a practitioner who wants DORA
          immediately can have it, in either mode. */}
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1, mb: 1.5 }}
      >
        <ToggleButtonGroup
          size="small"
          exclusive
          value={mode}
          onChange={(_, next: 'learn' | 'explore' | null) => next && setMode(next)}
        >
          <ToggleButton value="learn" sx={{ textTransform: 'none', px: 1.5, gap: 0.75 }}>
            <GraduationCap size={15} />
            Learn
          </ToggleButton>
          <ToggleButton value="explore" sx={{ textTransform: 'none', px: 1.5, gap: 0.75 }}>
            <Compass size={15} />
            Explore
          </ToggleButton>
        </ToggleButtonGroup>

        <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1, minWidth: 200 }}>
          {mode === 'learn'
            ? 'Guided path. Everything in the sandbox stays open — this only chooses what to point at.'
            : 'The full sandbox, with no task attached. Switch back whenever you like.'}
        </Typography>

        {mode === 'learn' && (
          <ToggleButton
            size="small"
            value="map"
            selected={showMap}
            onChange={() => setShowMap((m) => !m)}
            sx={{ textTransform: 'none', px: 1.5, gap: 0.75, flexShrink: 0 }}
          >
            <Map size={15} />
            Concept map
          </ToggleButton>
        )}

        <Tooltip
          arrow
          title={
            blind
              ? 'Showing what to look for, why it moved, and what to do.'
              : 'Hides the interpretation and keeps the evidence: titles, axes and lineage stay.'
          }
        >
          <ToggleButton
            size="small"
            value="blind"
            selected={blind}
            onChange={() => setBlind((b) => !b)}
            sx={{ textTransform: 'none', px: 1.5, gap: 0.75, flexShrink: 0 }}
          >
            <EyeOff size={15} />
            Blind mode
          </ToggleButton>
        </Tooltip>
      </Stack>

      {mode === 'learn' && (
        <ProgressPanel attempts={attempts} focusConceptId={recommendation?.conceptId} />
      )}

      {mode === 'learn' && showMap && (
        <ConceptMap
          attempts={attempts}
          focusConceptId={recommendation?.conceptId}
          onSelect={openConcept}
        />
      )}

      <ScenarioState
        params={params}
        baseline={baseline}
        atBaseline={atBaseline}
        onReset={reset}
      />

      {mode === 'learn' && recommendation ? (
        <LearningPanel
          key={recommendation.challengeId}
          recommendation={recommendation}
          conceptSeen={seenConcepts.has(recommendation.conceptId)}
          onApplyScenario={applyLearningScenario}
          onAttemptSaved={recordAttempt}
          onSkip={() => setSkipped((s) => new Set(s).add(recommendation.challengeId))}
        />
      ) : (
        <FirstExperiment
          params={params}
          atBaseline={atBaseline}
          onApply={applyScenario}
        />
      )}

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack
          direction="row"
          sx={{ alignItems: 'center', justifyContent: 'space-between', mb: controlsOpen ? 1.5 : 0 }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Scenario controls
          </Typography>
          <Button
            size="small"
            onClick={() => setControlsOpen((open) => !open)}
            endIcon={controlsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            aria-expanded={controlsOpen}
            sx={{ textTransform: 'none' }}
          >
            {controlsOpen ? 'Hide controls' : 'Show controls'}
          </Button>
        </Stack>

        {/* Unmounted while closed, not merely hidden: a collapsed MUI panel
            keeps its children focusable, so a keyboard user would tab into
            sliders they cannot see. */}
        <Collapse in={controlsOpen} unmountOnExit>
          <ScenarioControls params={params} onChange={setParams} onCommit={collapseOnce} />
        </Collapse>
      </Paper>

      {violations.length > 0 && (
        // Reachable only if a slider range and a formula have drifted apart,
        // which is a programming error rather than user input -- so it says
        // what broke instead of asking the user to fix it.
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="subtitle2">
            These parameters cannot produce a meaningful chart
          </Typography>
          {violations.map((v) => (
            <Typography key={`${v.kind}-${v.subject}`} variant="caption" sx={{ display: 'block' }}>
              {v.message}
            </Typography>
          ))}
        </Alert>
      )}

      <Box ref={outcomesRef} sx={{ scrollMarginTop: 8 }}>
        {outcomes.length > 0 && <KeyOutcomes outcomes={outcomes} atBaseline={atBaseline} />}
      </Box>

      {/* Tier and family on ONE row. Stacked, they cost about 100px of the
          space between a slider and the first chart, which is the distance
          this redesign exists to close. */}
      <Stack
        direction="row"
        spacing={2}
        sx={{
          alignItems: 'center',
          flexWrap: 'wrap',
          rowGap: 1,
          borderBottom: 1,
          borderColor: 'divider',
          mb: 1,
        }}
      >
      <Tooltip arrow title={TIERS.find((t) => t.id === tier)!.blurb}>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={tier}
        onChange={(_, next: TierId | null) => next && changeTier(next)}
        sx={{ flexShrink: 0, mb: 0.5 }}
      >
        {TIERS.map((t) => {
          // Without this, a change that reached DORA or reliability is
          // invisible from the core tier -- the tab indicators only speak for
          // the tier that is open, so the furthest-reaching consequences
          // would be the ones nothing points at.
          //
          // Counts only the UNSEEN SURPRISES in that tier. A badge on a tier
          // whose families you have already read, or whose model you changed
          // yourself, is a status light; this is meant to be an errand.
          const unseen = surprises.filter((f) => f.tier === t.id && !visited.has(f.id)).length;
          return (
            <ToggleButton key={t.id} value={t.id} sx={{ textTransform: 'none', px: 2, gap: 0.75 }}>
              {t.label}
              {unseen > 0 && (
                <Chip
                  size="small"
                  color="warning"
                  label={unseen}
                  sx={{ height: 18, minWidth: 18, fontSize: '0.6rem' }}
                />
              )}
            </ToggleButton>
          );
        })}
      </ToggleButtonGroup>
      </Tooltip>

      <Tabs
        value={activeFamily}
        onChange={(_, next: FamilyId) => openFamily(next)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ flexGrow: 1, minWidth: 0, minHeight: 44 }}
      >
        {familiesInTier.map((f) => {
          const moved = movement.countByFamily.get(f.id) ?? 0;
          // Badge SURPRISE, not presence. Raising WIP moves something in all
          // six families, and an indicator on all six carries exactly as much
          // information as an indicator on none. The families whose model the
          // learner touched are the ones it is arithmetic to see move, so
          // they get nothing; the rest are the payoff.
          const surprising = moved > 0 && !home.has(f.id);
          const seen = visited.has(f.id);
          return (
            <Tab
              key={f.id}
              value={f.id}
              sx={{ textTransform: 'none' }}
              label={
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                  <span>{`${f.label} (${chartsInFamily(f.id).length})`}</span>
                  {surprising && (
                    <Chip
                      size="small"
                      color={seen ? 'default' : 'warning'}
                      variant={seen ? 'outlined' : 'filled'}
                      label={`${moved} moved`}
                      sx={{ height: 18, fontSize: '0.6rem' }}
                    />
                  )}
                </Stack>
              }
            />
          );
        })}
      </Tabs>
      </Stack>

      {nextSurprise && (
        // The click this page is trying to earn. A dot says "something
        // happened"; this says what, where, and why it is worth the trip --
        // and it disappears once the trip is made.
        <Alert
          severity="warning"
          variant="outlined"
          sx={{ py: 0, mb: 1.5, alignItems: 'center' }}
          action={
            <Button
              size="small"
              color="warning"
              onClick={() => goToFamily(nextSurprise.id)}
              sx={{ textTransform: 'none' }}
            >
              Open {nextSurprise.label}
            </Button>
          }
        >
          <Typography variant="body2">
            <Box component="span" sx={{ fontWeight: 700 }}>
              {nextSurprise.label}
            </Box>{' '}
            moved {movement.countByFamily.get(nextSurprise.id)} of its{' '}
            {chartsInFamily(nextSurprise.id).length} charts, and you changed nothing in that
            model.
          </Typography>
        </Alert>
      )}

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {familyMeta.blurb}
      </Typography>

      {sprints.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Adjust the scenario to run the simulation.
        </Typography>
      ) : (
        <>{STAGES.map((stageMeta) => {
          const inStage = views.filter((v) => v.stage === stageMeta.id);
          if (inStage.length === 0) return null;

          return (
            <Box key={stageMeta.id} sx={{ mb: 3 }}>
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: 'baseline', flexWrap: 'wrap', rowGap: 0.5, mb: 1 }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    fontWeight: 700,
                    color: 'text.primary',
                  }}
                >
                  {stageMeta.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {stageMeta.blurb}
                </Typography>
              </Stack>

        <Box
          sx={{
            display: 'grid',
            gap: 2,
            alignItems: 'start',
            gridTemplateColumns: {
              xs: '1fr',
              md: 'repeat(2, minmax(0, 1fr))',
              xl: 'repeat(3, minmax(0, 1fr))',
            },
          }}
        >
          {inStage.map((view) => {
            const payload = buildChartPayload(view.id, sprints, params);
            const lineage = lineageFor(view);
            const moved = movement.movedViews.has(view.id);

            return (
              <Card
                key={view.id}
                variant="outlined"
                sx={{
                  minWidth: 0,
                  // Declared in the inventory, not special-cased by id. The
                  // CFD teaches by band thickness and horizontal distance,
                  // and neither is legible in a third of a row.
                  gridColumn: view.emphasis === 'wide' ? '1 / -1' : undefined,
                }}
              >
                <CardContent>
                  <Stack
                    direction="row"
                    sx={{
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      mb: 1,
                      gap: 1,
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          {view.canonicalName}
                        </Typography>
                        {/* Derived from the data, not from the inventory. It is
                            what turns a chart from analysis into an errand. */}
                        {payload.headline && (
                          <Chip
                            size="small"
                            color="warning"
                            label={payload.headline}
                            sx={{ height: 20, fontSize: '0.62rem' }}
                          />
                        )}
                      </Stack>
                      <Tooltip arrow title={lineage.analoguesNote}>
                        <Typography variant="caption" color="text.secondary">
                          {/* Never "Jira: N/A". An absent analogue is a fact
                              about the tools, not a gap in the view -- and a
                              Jira-shaped caption on all 27 would quietly make
                              Jira the standard everything is measured against. */}
                          {lineage.analogues ?? 'No standard chart exists for this.'}
                        </Typography>
                      </Tooltip>
                    </Box>
                    <Stack spacing={0.5} sx={{ flexShrink: 0, alignItems: 'flex-end' }}>
                      <Tooltip arrow title={lineage.labelNote}>
                        <Chip
                          size="small"
                          label={lineage.label}
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.65rem' }}
                        />
                      </Tooltip>
                      {moved && (
                        <Chip
                          size="small"
                          color="warning"
                          label="moved"
                          sx={{ height: 18, fontSize: '0.6rem' }}
                        />
                      )}
                    </Stack>
                  </Stack>

                  {/* Taller, and the supporting text below it is shorter.
                      The card used to ask the eye to process a title, a
                      lineage, a chart, a legend and three paragraphs at once,
                      which reads the chart as the illustration and the prose
                      as the content -- backwards, on a page about charts. */}
                  <Box sx={{ height: view.emphasis === 'wide' ? 320 : 270 }}>
                    <ChartPrimitiveView primitive={view.primitive} payload={payload} />
                  </Box>

                  {/* Blind mode removes INTERPRETATION and keeps EVIDENCE.
                      The title, the lineage, the axes and the chart itself all
                      stay: the question is whether the learner can read the
                      picture, not whether they can read our commentary. */}
                  {blind ? (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                      Blind mode — read the chart. The interpretation is hidden.
                    </Typography>
                  ) : (
                    <>
                      <Typography variant="body2" sx={{ mt: 1.5, mb: 1 }}>
                        <Box component="span" sx={{ fontWeight: 700 }}>
                          Look for:{' '}
                        </Box>
                        {payload.lookFor}
                      </Typography>

                      <AssumptionCallouts consumes={view.consumes} changedModels={changed} />
                    </>
                  )}

                  {/* The conditional. A chart that says what happened and not
                      what to do with it is a report; this is what makes it an
                      instrument -- and it is different for every view, which
                      is the point. The ledger-driven callouts above answer how
                      the MODEL is wired, and most of a family is wired the
                      same way, so on their own six cards in a row explained
                      themselves identically. */}
                  {!blind && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      <Box component="span" sx={{ fontWeight: 700 }}>
                        Action:{' '}
                      </Box>
                      {payload.action}
                    </Typography>
                  )}

                  {/* The long reading is still here and still worth reading --
                      folded, so it cannot crowd out the picture. A native
                      disclosure rather than a controlled Collapse: no state to
                      hold, and it is keyboard-operable for free. */}
                  {!blind && (
                  <Box
                    component="details"
                    sx={{
                      mt: 1,
                      '& > summary': {
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        userSelect: 'none',
                      },
                    }}
                  >
                    <Box component="summary">What this shape means</Box>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {payload.reading}
                    </Typography>
                    {/* The factors in the WORLD, not the couplings in the
                        model -- deliberately including ones this sandbox does
                        not simulate, because a learner who leaves thinking
                        cycle time has four inputs has learned the model
                        rather than the subject. */}
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                      <Box component="span" sx={{ fontWeight: 700 }}>
                        Depends on:{' '}
                      </Box>
                      {payload.dependsOn.join(' · ')}
                    </Typography>
                  </Box>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </Box>
            </Box>
          );
        })}</>
      )}

      <WhatChanged
        params={params}
        baseline={baseline}
        outcomes={outcomes}
        movement={movement}
        atBaseline={atBaseline}
        onSelectFamily={goToFamily}
        onApply={applyScenario}
      />

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>
        {CHART_VIEWS.length} views across {FAMILIES.length} families. This is a teaching
        model, not a measurement of any real team.
      </Typography>
    </Box>
  );
};
