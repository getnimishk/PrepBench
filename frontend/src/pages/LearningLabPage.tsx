// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

// The Learning Lab hub.
//
// Each sandbox in the Lab teaches a domain of professional metrics through
// the same loop: predict → manipulate → observe → explain. No flashcards,
// no MCQs -- you move a slider and read what changed.
//
// The hub page exists because the first sandbox a learner encounters should
// arrive with context. Jumping straight into "Agile Metrics Sandbox" leaves
// open the question of what kind of thing this is. The hub names the pattern
// (simulation), names the contract (one assumption at a time), and shows the
// other domains so a learner with an interview in data engineering or finance
// knows that instrument is on the way.
//
// Adding a new sandbox: add a card to SANDBOXES below, set live: true when the
// route exists, and add its NavKey + nav entry to navigation.ts.

import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Card, CardContent, Chip, Stack, Typography, alpha, useTheme } from '@mui/material';
import { Activity } from 'lucide-react';
import { PageHead, Eyebrow } from '../components/ui/primitives';

interface SandboxCard {
  id: string;
  label: string;
  domain: string;
  description: string;
  metricFamilies: string[];
  path: string;
  live: boolean;
  icon: React.ReactNode;
  iconBgKey: 'primary' | 'warning' | 'success';
}

const SANDBOXES: SandboxCard[] = [
  {
    id: 'agile',
    label: 'Agile Metrics',
    domain: 'Scrum & Kanban delivery',
    description:
      'Move one assumption — WIP limit, sprint length, defect rate — and watch how it ' +
      'ripples across 27 charts spanning flow, predictability, quality, team health and ' +
      'engineering performance. Guided path with learning challenges, or free exploration.',
    // 27 = count of ids in CHART_VIEWS in services/metrics/charts.ts:
    // flow(8) + predictability(5) + quality(3) + teamHealth(2) + dora(5) + reliability(4) = 27 across 6 families.
    metricFamilies: ['Flow', 'Predictability', 'Quality', 'Team health', 'DORA', 'Reliability'],
    path: '/chart-sandbox',
    live: true,
    icon: <Activity size={22} aria-hidden />,
    iconBgKey: 'primary',
  },
  {
    id: 'databricks',
    label: 'Databricks Architecture',
    domain: 'Data lakehouse design',
    description:
      'Cluster sizing, job scheduling, storage tier selection and query concurrency — ' +
      'the architecture decisions that determine cost, performance and reliability in a ' +
      'data lakehouse. See the trade-offs move when you change one dial.',
    metricFamilies: ['Compute cost', 'Query performance', 'Storage efficiency', 'Job reliability', 'Cluster utilisation'],
    path: '/databricks-sandbox',
    live: false,
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
        <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5 12,2" />
        <polyline points="12,2 12,22" />
        <polyline points="2,8.5 22,8.5" />
        <polyline points="2,15.5 22,15.5" />
      </svg>
    ),
    iconBgKey: 'warning',
  },
  {
    id: 'finance',
    label: 'Financial Learning',
    domain: 'Company financial modelling',
    description:
      'P&L, cash flow, unit economics and valuation multiples in a single model. ' +
      'Change a retention rate or gross margin and watch how it propagates through ' +
      "a company's financial statements and valuation — before any interview asks you to.",
    metricFamilies: ['Revenue & growth', 'Cost & margin', 'Cash flow', 'Unit economics', 'Valuation multiples'],
    path: '/financial-sandbox',
    live: false,
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
    iconBgKey: 'success',
  },
];

// The four steps every sandbox uses. Described once here so the strip and any
// future tooltip or onboarding flow derive from the same source.
const LOOP_STEPS = [
  { step: '1 · Predict',    desc: 'What do you think will change?' },
  { step: '2 · Manipulate', desc: 'Move one slider or toggle'      },
  { step: '3 · Observe',    desc: 'Watch the charts respond'       },
  { step: '4 · Explain',    desc: 'Why did it move that way?'      },
] as const;

export const LearningLabPage: React.FC = () => {
  const theme = useTheme();

  // Icon box styling uses MUI alpha() to derive theme-safe backgrounds in both modes.
  const iconStyle = (key: SandboxCard['iconBgKey'], live: boolean) => ({
    bgcolor: alpha(theme.palette[key].main, live ? 0.12 : 0.08),
    color: live ? theme.palette[key].main : theme.palette.text.secondary,
  });

  return (
    <Box>
      <PageHead
        eyebrow="Learning Lab"
        title="Interactive Sandboxes"
        sub="Each sandbox teaches a domain of professional metrics through prediction and simulation. Change one assumption — watch what ripples, read what stayed still."
        sx={{ mb: '28px' }}
      />

      {/* The shared loop — set expectations before the learner picks a sandbox.
          Section has an explicit h2 eyebrow so heading levels never skip (h1 -> h2). */}
      <Box component="section" aria-labelledby="loop-heading" sx={{ mb: '28px' }}>
        <Eyebrow component="h2" id="loop-heading" sx={{ mb: 1 }}>
          The simulation loop
        </Eyebrow>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            border: 1,
            borderColor: 'divider',
            borderRadius: '10px',
            overflow: 'hidden',
          }}
        >
          {LOOP_STEPS.map(({ step, desc }, i) => (
            <Box
              key={step}
              sx={{
                flexBasis: { xs: '50%', sm: '25%' },
                flexGrow: 1,
                px: 2,
                py: 1.5,
                bgcolor: 'action.hover',
                borderRight: { sm: i < 3 ? 1 : 0 },
                borderBottom: { xs: i < 2 ? 1 : 0, sm: 0 },
                borderColor: 'divider',
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary', display: 'block' }}>
                {step}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {desc}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Sandbox cards section with explicit h2 heading */}
      <Box component="section" aria-labelledby="sandboxes-heading">
        <Eyebrow component="h2" id="sandboxes-heading" sx={{ mb: 1.5 }}>
          Available sandboxes
        </Eyebrow>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)' },
            gap: '20px',
          }}
        >
          {SANDBOXES.map((sb) => (
            <Card
              key={sb.id}
              variant="outlined"
              component="article"
              sx={{
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <CardContent sx={{ flexGrow: 1, p: '20px' }}>
                {/* Icon + title row */}
                <Stack direction="row" sx={{ alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
                  <Box
                    sx={{
                      width: 44, height: 44, borderRadius: '10px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                      ...iconStyle(sb.iconBgKey, sb.live),
                    }}
                  >
                    {sb.icon}
                  </Box>
                  <Box>
                    <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      {/* Heading level h3 sits under the section h2 "Available sandboxes" */}
                      <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 700 }}>
                        {sb.label}
                      </Typography>
                      {sb.live ? (
                        <Chip
                          label="Live"
                          size="small"
                          color="success"
                          variant="outlined"
                          sx={{ minHeight: 20, fontSize: (t) => t.typography.pxToRem(10), fontWeight: 700 }}
                        />
                      ) : (
                        <Chip
                          label="Coming soon"
                          size="small"
                          variant="outlined"
                          sx={{
                            minHeight: 20,
                            fontSize: (t) => t.typography.pxToRem(10),
                            fontWeight: 600,
                            color: 'text.primary',
                            borderColor: 'divider',
                          }}
                        />
                      )}
                    </Stack>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {sb.domain}
                    </Typography>
                  </Box>
                </Stack>

                {/* Description */}
                <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6, mb: 1.5 }}>
                  {sb.description}
                </Typography>

                {/* Metric families */}
                <Eyebrow sx={{ mb: 0.75 }}>Metric families</Eyebrow>
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                  {sb.metricFamilies.map((f) => (
                    <Chip
                      key={f}
                      label={f}
                      size="small"
                      variant="outlined"
                      sx={{ minHeight: 20, fontSize: (t) => t.typography.pxToRem(9.6), color: 'text.secondary', borderColor: 'divider' }}
                    />
                  ))}
                </Stack>

                {/* CTA */}
                {sb.live ? (
                  <Button
                    variant="contained"
                    component={RouterLink}
                    to={sb.path}
                    size="small"
                    // Starts with the visible text, so a voice-control user who
                    // says "click Open sandbox" reaches it (WCAG 2.5.3 Label in
                    // Name); the sandbox name keeps it unique once more than one
                    // is live. It read "Open the Agile Metrics sandbox", which
                    // never contains "Open sandbox" as a phrase.
                    aria-label={`Open sandbox: ${sb.label}`}
                  >
                    Open sandbox
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    size="small"
                    disabled
                    aria-label={`${sb.label} is not yet available`}
                  >
                    Not yet available
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </Box>
      </Box>
    </Box>
  );
};
