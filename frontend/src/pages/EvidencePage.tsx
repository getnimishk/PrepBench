// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, MenuItem, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { ShieldCheck } from 'lucide-react';
import { usePreparation } from '../context/PreparationContext';
import { EmptyState, ErrorState, LoadingState } from '../components/common/States';
import { Actions, Detail, Metric, MetricRow, Note, Panel, PanelHead, PageHead, Pill } from '../components/ui/primitives';
import { getEvidence } from '../services/api';
import {
  ASSESSED_BY_LABEL, EVIDENCE_KIND_LABEL, EVIDENCE_LEVELS, LEVEL, shortDate, titleOf,
} from '../services/portfolio';
import { usePortfolioScopes, type Loaded } from '../components/portfolio/usePortfolioScopes';
import type { SubjectCapabilityProfile } from '../types/capabilities';
import type { EvidenceItem, EvidenceLevel, EvidenceResponse, PortfolioSource } from '../types/portfolio';

/**
 * Evidence: "What proves what I have actually demonstrated?"
 *
 * Every item is read from a persisted row (GET /evidence) and given one level --
 * activity, completed, demonstrated, evidenced -- with the exact basis for it and
 * who judged it. Self- and AI-assessed work never counts above completed. This is
 * not readiness: whether the learner is ready to pass is decided on Certification,
 * from full mocks only. Nothing is shown here that the record does not hold.
 */

const SOURCE_LABEL: Record<PortfolioSource, string> = {
  learning_lab: 'Learning Lab',
  scenarios: 'Scenarios',
  roadmap: 'Roadmaps',
  certification: 'Certification',
  interview: 'Interview',
};

export const EvidencePage: React.FC = () => {
  const { selected, selectedId, loading, capabilities } = usePreparation();
  const { own, unowned, retry } = usePortfolioScopes(getEvidence, loading ? null : selectedId, 'Your evidence');

  if (loading) return <LoadingState label="Loading your preparation…" />;

  const name = selected?.name ?? null;
  return (
    <Box>
      <PageHead
        eyebrow="Evidence"
        title="Evidence"
        sub="What your saved work shows you have demonstrated, and how strongly. Each item says exactly what supports it and who judged it. Nothing is added for show."
        actions={(
          <>
            <Button variant="outlined" component={RouterLink} to="/workspace">Open your workspace</Button>
            {capabilities.certification && (
              <Button variant="outlined" component={RouterLink} to="/certification">Check exam readiness</Button>
            )}
          </>
        )}
      />

      <Panel component="section" aria-labelledby="ev-levels" soft sx={{ mb: '18px' }}>
        <PanelHead title="How each item is graded" titleId="ev-levels">
          <Detail>
            Self-assessed and AI-assessed work is never counted above Completed, because it is not verified.
            Evidence is not a readiness verdict: whether you are ready to pass is decided on Certification, from full mocks only.
          </Detail>
        </PanelHead>
        <Box component="dl" sx={{ m: 0, display: 'grid', gap: '6px', gridTemplateColumns: { xs: '1fr', sm: 'max-content 1fr' }, columnGap: '14px' }}>
          {EVIDENCE_LEVELS.map((l) => (
            <React.Fragment key={l}>
              <Box component="dt" sx={{ fontWeight: 600 }}>{LEVEL[l].label}</Box>
              <Box component="dd" sx={{ m: 0, color: 'text.secondary' }}>{LEVEL[l].meaning}</Box>
            </React.Fragment>
          ))}
        </Box>
      </Panel>

      {selectedId === null || name === null ? (
        <Note sx={{ mb: '18px' }}>
          No preparation is chosen, so no preparation’s evidence is shown. Choose one in the header to see its evidence.
          Below is evidence from work that belongs to no preparation.
        </Note>
      ) : !capabilities.evidence ? (
        <Panel component="section" aria-labelledby="ev-own" sx={{ mb: '18px' }}>
          <PanelHead title={name} titleId="ev-own" />
          <EmptyState title="Evidence is not available here" why={`${name} does not record evidence.`} />
        </Panel>
      ) : (
        <ScopePanel
          id="ev-own" heading={name} sub="Evidence from work in this preparation."
          state={own} onRetry={retry} empty={<OwnEmpty name={name} capabilities={capabilities} />}
        />
      )}

      <ScopePanel
        id="ev-unowned" heading="Not tied to a preparation"
        sub="Evidence from system design answers, design review calls, Chart Sandbox runs and library recordings, which belong to no preparation."
        state={unowned} onRetry={retry}
        empty={<EmptyState title="Nothing here" why="You have no evidence from work that sits outside a preparation." />}
      />
    </Box>
  );
};

/** What would create evidence here: only actions this preparation really has. */
const OwnEmpty: React.FC<{ name: string; capabilities: SubjectCapabilityProfile }> = ({ name, capabilities }) => {
  const actions: { to: string; label: string }[] = [];
  if (capabilities.learningLabStatus === 'AVAILABLE') actions.push({ to: '/lab', label: 'Run an experiment' });
  if (capabilities.scenarios) actions.push({ to: '/scenarios', label: 'Answer a scenario’s checks' });
  if (capabilities.certification && capabilities.questionAvailability) actions.push({ to: '/exam-setup', label: 'Sit a full mock' });
  return (
    <EmptyState
      icon={<ShieldCheck size={28} />}
      title="No evidence yet"
      why={`Evidence appears when work in ${name} is checked: a prediction against the model, a scenario answer against its key, a full mock against its pass mark. Visiting a page is not evidence.`}
      action={actions.length ? (
        <Actions sx={{ justifyContent: 'center' }}>
          {actions.map((a) => <Button key={a.to} variant="outlined" component={RouterLink} to={a.to}>{a.label}</Button>)}
        </Actions>
      ) : undefined}
    />
  );
};

const ScopePanel: React.FC<{
  id: string;
  heading: string;
  sub: string;
  state: Loaded<EvidenceResponse> | null;
  onRetry: () => void;
  empty: React.ReactNode;
}> = ({ id, heading, sub, state, onRetry, empty }) => (
  <Panel component="section" aria-labelledby={id} sx={{ mb: '18px' }}>
    <PanelHead title={heading} titleId={id}><Detail>{sub}</Detail></PanelHead>
    {state === null || state.status === 'loading' ? (
      <LoadingState label="Loading evidence…" />
    ) : state.status === 'error' ? (
      <ErrorState what="This evidence did not load." saved="nothing_to_save" detail={state.message} onRetry={onRetry} />
    ) : state.data.items.length === 0 ? (
      empty
    ) : (
      <>
        <MetricRow sx={{ mb: '16px' }}>
          {EVIDENCE_LEVELS.map((l) => <Metric key={l} value={state.data.counts[l]} label={LEVEL[l].label} />)}
        </MetricRow>
        <EvidenceList idPrefix={id} items={state.data.items} />
      </>
    )}
  </Panel>
);

const EvidenceList: React.FC<{ idPrefix: string; items: EvidenceItem[] }> = ({ idPrefix, items }) => {
  const [level, setLevel] = useState<EvidenceLevel | 'all'>('all');
  const [source, setSource] = useState<PortfolioSource | 'all'>('all');
  const sources = useMemo(() => [...new Set(items.map((i) => i.source))], [items]);
  const shown = items.filter((i) => (level === 'all' || i.level === level) && (source === 'all' || i.source === source));

  return (
    <Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', mb: '14px' }}>
        <ToggleButtonGroup
          size="small" exclusive value={level} aria-label="Show one level"
          onChange={(_, v: EvidenceLevel | 'all' | null) => v && setLevel(v)} sx={{ flexWrap: 'wrap' }}
        >
          <ToggleButton value="all">All</ToggleButton>
          {EVIDENCE_LEVELS.map((l) => <ToggleButton key={l} value={l}>{LEVEL[l].label}</ToggleButton>)}
        </ToggleButtonGroup>
        {sources.length > 1 && (
          <TextField
            select size="small" label="From" value={source} sx={{ minWidth: 180 }}
            onChange={(e) => setSource(e.target.value as PortfolioSource | 'all')}
          >
            <MenuItem value="all">Everywhere</MenuItem>
            {sources.map((s) => <MenuItem key={s} value={s}>{SOURCE_LABEL[s]}</MenuItem>)}
          </TextField>
        )}
      </Box>
      {shown.length === 0 ? (
        <Detail>Nothing at this level.</Detail>
      ) : (
        <Box component="ul" aria-label="Evidence" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: '10px' }}>
          {shown.map((item) => <EvidenceCard key={item.id} idPrefix={idPrefix} item={item} />)}
        </Box>
      )}
    </Box>
  );
};

const EvidenceCard: React.FC<{ idPrefix: string; item: EvidenceItem }> = ({ idPrefix, item }) => {
  const title = titleOf(item);
  const when = shortDate(item.at);
  const titleId = `${idPrefix}-${item.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  return (
    <Box
      component="li" aria-labelledby={titleId}
      sx={{ border: '1px solid', borderColor: 'pb.line', borderRadius: '10px', p: '14px 16px', bgcolor: 'pb.surface' }}
    >
      <Box sx={{ display: 'flex', gap: '12px', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Box sx={{ minWidth: 0, flex: '1 1 320px' }}>
          <Box sx={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', mb: '4px' }}>
            <Pill tone={LEVEL[item.level].tone}>{LEVEL[item.level].label}</Pill>
            <Detail component="span">{EVIDENCE_KIND_LABEL[item.kind]}</Detail>
          </Box>
          <Typography variant="subtitle1" component="h3" id={titleId} sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
            {title}{item.demonstrates ? ` · ${item.demonstrates}` : ''}
          </Typography>
          <Typography variant="body2" sx={{ mt: '4px', overflowWrap: 'anywhere' }}>{item.basis}.</Typography>
          <Detail sx={{ mt: '6px' }}>{[ASSESSED_BY_LABEL[item.assessed_by], when].filter(Boolean).join(' · ')}</Detail>
        </Box>
        <Button variant="outlined" size="small" component={RouterLink} to={item.href} aria-label={`Open ${title}`}>
          Open
        </Button>
      </Box>
    </Box>
  );
};

export default EvidencePage;
