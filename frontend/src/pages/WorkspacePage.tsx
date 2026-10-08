// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, InputAdornment, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { FolderOpen, Search } from 'lucide-react';
import { usePreparation } from '../context/PreparationContext';
import { EmptyState, ErrorState, LoadingState } from '../components/common/States';
import { Actions, Detail, Note, Panel, PanelHead, PageHead, Pill } from '../components/ui/primitives';
import { getWorkspace } from '../services/api';
import { shortDate, titleOf, WORKSPACE_KIND_LABEL } from '../services/portfolio';
import { usePortfolioScopes, type Loaded } from '../components/portfolio/usePortfolioScopes';
import type { SubjectCapabilityProfile } from '../types/capabilities';
import type { WorkspaceItem, WorkspaceKind, WorkspaceResponse } from '../types/portfolio';

/**
 * Workspace: "Where is the work I created, investigated and kept?"
 *
 * The learner's own work in the chosen preparation -- lab runs, case notes,
 * prepared answers, recordings, topic guides and notes -- read from the rows the
 * features already keep (GET /workspace), each opening where it was made. Work
 * that belongs to no preparation is shown apart, under its own heading, never
 * merged in. Evidence is a different question and a different page.
 */
export const WorkspacePage: React.FC = () => {
  const { selected, selectedId, loading, capabilities } = usePreparation();
  const { own, unowned, retry } = usePortfolioScopes(getWorkspace, loading ? null : selectedId, 'Your workspace');

  if (loading) return <LoadingState label="Loading your preparation…" />;

  const name = selected?.name ?? null;
  return (
    <Box>
      <PageHead
        eyebrow="Workspace"
        title="Workspace"
        sub="Your own work, where you can find it again: lab runs, case notes, prepared answers, recordings, topic guides and notes. Each opens where you made it, to carry on there."
        actions={<Button variant="outlined" component={RouterLink} to="/evidence">See your evidence</Button>}
      />

      {selectedId === null || name === null ? (
        <Note sx={{ mb: '18px' }}>
          No preparation is chosen, so no preparation’s work is shown. Choose one in the header to see its workspace.
          Below is work that belongs to no preparation.
        </Note>
      ) : !capabilities.workspace ? (
        <Panel component="section" aria-labelledby="ws-own" sx={{ mb: '18px' }}>
          <PanelHead title={name} titleId="ws-own" />
          <EmptyState title="Workspace is not available here" why={`${name} does not keep a workspace.`} />
        </Panel>
      ) : (
        <ScopePanel
          id="ws-own" heading={name}
          sub="Work you made in this preparation."
          state={own} onRetry={retry}
          empty={<OwnEmpty name={name} capabilities={capabilities} />}
        />
      )}

      <ScopePanel
        id="ws-unowned" heading="Not tied to a preparation"
        sub="System design answers, design review calls, Chart Sandbox runs, and library questions and recordings belong to no preparation, so they are kept here rather than filed under one."
        state={unowned} onRetry={retry}
        empty={<EmptyState title="Nothing here" why="You have no work that sits outside a preparation." />}
      />
    </Box>
  );
};

/** What to do next in an empty workspace: only actions this preparation really has. */
const OwnEmpty: React.FC<{ name: string; capabilities: SubjectCapabilityProfile }> = ({ name, capabilities }) => {
  const actions: { to: string; label: string }[] = [];
  if (capabilities.learningLabStatus === 'AVAILABLE') actions.push({ to: '/lab', label: 'Open the Learning Lab' });
  if (capabilities.scenarios) actions.push({ to: '/scenarios', label: 'Work a scenario' });
  if (capabilities.roadmap) actions.push({ to: '/roadmaps', label: 'Write a topic guide' });
  if (capabilities.interview) actions.push({ to: '/interview', label: 'Prepare an interview answer' });
  return (
    <EmptyState
      icon={<FolderOpen size={28} />}
      title="Nothing in this workspace yet"
      why={`Work appears here as you make it in ${name}: a lab run you predict and explain, case notes, a prepared answer, a topic guide. Nothing is added for you.`}
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
  state: Loaded<WorkspaceResponse> | null;
  onRetry: () => void;
  empty: React.ReactNode;
}> = ({ id, heading, sub, state, onRetry, empty }) => (
  <Panel component="section" aria-labelledby={id} sx={{ mb: '18px' }}>
    <PanelHead title={heading} titleId={id}><Detail>{sub}</Detail></PanelHead>
    {state === null || state.status === 'loading' ? (
      <LoadingState label="Loading work…" />
    ) : state.status === 'error' ? (
      <ErrorState what="This work did not load." saved="nothing_to_save" detail={state.message} onRetry={onRetry} />
    ) : state.data.items.length === 0 ? (
      empty
    ) : (
      <WorkList idPrefix={id} items={state.data.items} />
    )}
  </Panel>
);

const WorkList: React.FC<{ idPrefix: string; items: WorkspaceItem[] }> = ({ idPrefix, items }) => {
  const [kind, setKind] = useState<WorkspaceKind | 'all'>('all');
  const [query, setQuery] = useState('');
  const kinds = useMemo(() => {
    const counts = new Map<WorkspaceKind, number>();
    for (const i of items) counts.set(i.kind, (counts.get(i.kind) ?? 0) + 1);
    return [...counts.entries()];
  }, [items]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => (kind === 'all' || i.kind === kind)
      && (!q || [titleOf(i), i.context, i.excerpt, i.detail].some((t) => t?.toLowerCase().includes(q))));
  }, [items, kind, query]);

  return (
    <Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', mb: '14px' }}>
        {kinds.length > 1 && (
          <ToggleButtonGroup
            size="small" exclusive value={kind} aria-label="Show work of one kind"
            onChange={(_, v: WorkspaceKind | 'all' | null) => v && setKind(v)}
            sx={{ flexWrap: 'wrap' }}
          >
            <ToggleButton value="all">All ({items.length})</ToggleButton>
            {kinds.map(([k, n]) => <ToggleButton key={k} value={k}>{`${WORKSPACE_KIND_LABEL[k]} (${n})`}</ToggleButton>)}
          </ToggleButtonGroup>
        )}
        <TextField
          size="small" placeholder="Search your work" value={query} onChange={(e) => setQuery(e.target.value)}
          slotProps={{
            htmlInput: { 'aria-label': 'Search your work' },
            input: { startAdornment: <InputAdornment position="start"><Search size={16} aria-hidden /></InputAdornment> },
          }}
          sx={{ minWidth: 220, flex: '1 1 220px', maxWidth: 360 }}
        />
      </Box>
      {shown.length === 0 ? (
        <Detail>Nothing matches.</Detail>
      ) : (
        <Box component="ul" aria-label="Work" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: '10px' }}>
          {shown.map((item) => <WorkCard key={item.id} idPrefix={idPrefix} item={item} />)}
        </Box>
      )}
    </Box>
  );
};

const WorkCard: React.FC<{ idPrefix: string; item: WorkspaceItem }> = ({ idPrefix, item }) => {
  const title = titleOf(item);
  const when = shortDate(item.updated_at);
  const titleId = `${idPrefix}-${item.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  return (
    <Box
      component="li" aria-labelledby={titleId}
      sx={{ border: '1px solid', borderColor: 'pb.line', borderRadius: '10px', p: '14px 16px', bgcolor: 'pb.surface' }}
    >
      <Box sx={{ display: 'flex', gap: '12px', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Box sx={{ minWidth: 0, flex: '1 1 320px' }}>
          <Box sx={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', mb: '4px' }}>
            <Pill>{WORKSPACE_KIND_LABEL[item.kind]}</Pill>
            {item.context && <Detail component="span">{item.context}</Detail>}
          </Box>
          <Typography variant="subtitle1" component="h3" id={titleId} sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
            {title}
          </Typography>
          {item.excerpt && (
            <Typography
              variant="body2"
              sx={{ mt: '6px', color: 'text.secondary', borderLeft: '3px solid', borderColor: 'pb.line', pl: '10px', overflowWrap: 'anywhere' }}
            >
              {item.excerpt}
            </Typography>
          )}
          {(item.detail || when) && (
            <Detail sx={{ mt: '6px' }}>{[item.detail, when].filter(Boolean).join(' · ')}</Detail>
          )}
        </Box>
        <Button variant="outlined" size="small" component={RouterLink} to={item.href} aria-label={`Open ${title}`}>
          Open
        </Button>
      </Box>
    </Box>
  );
};

export default WorkspacePage;
