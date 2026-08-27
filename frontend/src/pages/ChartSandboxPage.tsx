import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Paper,
  Stack,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import type { FamilyId, ScenarioParams, TierId } from '../types/agileMetrics';
import { CHART_VIEWS, FAMILIES, chartsInFamily } from '../services/metrics/charts';
import { DEFAULT_PARAMS, validateParams } from '../services/metrics/params';
import { simulate } from '../services/metrics/compose';
import { buildChartPayload } from '../services/metrics/chartData';
import { ChartPrimitiveView } from '../components/sandbox/ChartPrimitives';
import { AssumptionCallouts } from '../components/sandbox/AssumptionCallouts';
import { ScenarioControls } from '../components/sandbox/ScenarioControls';
import { DerivedFields } from '../components/sandbox/DerivedFields';

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

  const familiesInTier = FAMILIES.filter((f) => f.tier === tier);
  const activeFamily = familiesInTier.some((f) => f.id === family)
    ? family
    : familiesInTier[0].id;

  const violations = useMemo(() => validateParams(params), [params]);

  const sprints = useMemo(
    () => (violations.length === 0 ? simulate(params) : []),
    [params, violations],
  );

  const views = chartsInFamily(activeFamily);
  const familyMeta = FAMILIES.find((f) => f.id === activeFamily)!;

  const changeTier = (next: TierId) => {
    setTier(next);
    setFamily(FAMILIES.find((f) => f.tier === next)!.id);
  };

  return (
    <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', flexWrap: { xs: 'wrap', lg: 'nowrap' } }}>
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          width: { xs: '100%', lg: 320 },
          flexShrink: 0,
          position: { lg: 'sticky' },
          top: { lg: 16 },
          maxHeight: { lg: 'calc(100vh - 32px)' },
          overflowY: { lg: 'auto' },
        }}
      >
        <ScenarioControls params={params} onChange={setParams} />
        {/* Below the sliders, not beside them: the reader works down through
            what they can set and arrives at what that produced. */}
        {sprints.length > 0 && (
          <DerivedFields sprint={sprints[sprints.length - 1]} params={params} />
        )}
      </Paper>

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
          Chart Sandbox
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Move a control, watch what moves with it. Every relationship that is a modelling
          choice rather than arithmetic says so on the chart it affects.
        </Typography>

        {violations.length > 0 && (
          // Reachable only if a slider range and a formula have drifted apart,
          // which is a programming error rather than user input -- so it says
          // what broke instead of asking the user to fix it.
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="subtitle2">These parameters cannot produce a meaningful chart</Typography>
            {violations.map((v) => (
              <Typography key={`${v.kind}-${v.subject}`} variant="caption" sx={{ display: 'block' }}>
                {v.message}
              </Typography>
            ))}
          </Alert>
        )}

        <ToggleButtonGroup
          size="small"
          exclusive
          value={tier}
          onChange={(_, next: TierId | null) => next && changeTier(next)}
          sx={{ mb: 1 }}
        >
          {TIERS.map((t) => (
            <ToggleButton key={t.id} value={t.id} sx={{ textTransform: 'none', px: 2 }}>
              {t.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {TIERS.find((t) => t.id === tier)!.blurb}
        </Typography>

        <Tabs
          value={activeFamily}
          onChange={(_, next: FamilyId) => setFamily(next)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}
        >
          {familiesInTier.map((f) => (
            <Tab
              key={f.id}
              value={f.id}
              label={`${f.label} (${chartsInFamily(f.id).length})`}
              sx={{ textTransform: 'none' }}
            />
          ))}
        </Tabs>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {familyMeta.blurb}
        </Typography>

        {sprints.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Adjust the scenario to run the simulation.
          </Typography>
        ) : (
          <Stack spacing={2}>
            {views.map((view) => {
              const payload = buildChartPayload(view.id, sprints, params);
              return (
                <Card key={view.id} variant="outlined">
                  <CardContent>
                    <Stack
                      direction="row"
                      sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, gap: 1 }}
                    >
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          {view.canonicalName}
                        </Typography>
                        {view.externalAnalogues.length > 0 ? (
                          <Tooltip
                            arrow
                            title="Analogues, not equivalents. These reports resemble this view; they do not compute the same thing."
                          >
                            <Typography variant="caption" color="text.secondary">
                              Similar to: {view.externalAnalogues.join(' · ')}
                            </Typography>
                          </Tooltip>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            No standard chart exists for this.
                          </Typography>
                        )}
                      </Box>
                      <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                        <Chip size="small" label={view.primitive} variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                        <Chip size="small" label={view.provenance} sx={{ height: 20, fontSize: '0.65rem' }} />
                      </Stack>
                    </Stack>

                    <Box sx={{ height: 260 }}>
                      <ChartPrimitiveView primitive={view.primitive} payload={payload} />
                    </Box>

                    <Typography variant="body2" sx={{ mt: 1.5, mb: 1 }}>
                      {payload.reading}
                    </Typography>

                    <AssumptionCallouts consumes={view.consumes} />
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>
          {CHART_VIEWS.length} views across {FAMILIES.length} families. This is a teaching
          model, not a measurement of any real team.
        </Typography>
      </Box>
    </Box>
  );
};
