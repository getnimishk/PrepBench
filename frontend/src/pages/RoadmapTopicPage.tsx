// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, Link, TextField, Typography } from '@mui/material';
import { getRoadmap, getTopicDemonstrations, updateRoadmapTopic } from '../services/api';
import { apiErrorMessage, loadFailed } from '../services/apiError';
import type {
  RoadmapDetail, RoadmapTopic, RoadmapTopicStatus, TopicDemonstration,
} from '../types/roadmap';
import { LoadingState } from '../components/common/States';
import {
  Actions, Bar, Detail, Eyebrow, Good, Grid, Metric, MetricRow, Note, PageHead, Panel, Pill, Row, Section, Sub,
} from '../components/ui/primitives';

/**
 * One roadmap topic: what to learn, the bar for having learnt it, and the
 * evidence so far.
 *
 * There is no "Mark complete" button, and that is the point of the page. The
 * prototype drew one; plan section 11 rules it out -- completion is earned by
 * demonstrating the topic against its success criterion, which is the one
 * primary action here. The status row offers only the states that claim
 * nothing: not started, in progress, and skipped for material you already know.
 */

const STATUS_LABEL: Record<RoadmapTopicStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  skipped: 'Skipped',
};

const GRADE_LABEL: Record<string, string> = {
  yes: 'Yes, unprompted',
  partial: 'Partially',
  not_yet: 'Not yet',
};

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export const RoadmapTopicPage: React.FC = () => {
  const { roadmapId, topicId } = useParams<{ roadmapId: string; topicId: string }>();
  const rid = Number(roadmapId);
  const tid = Number(topicId);
  const navigate = useNavigate();

  const [roadmap, setRoadmap] = useState<RoadmapDetail | null>(null);
  const [history, setHistory] = useState<TopicDemonstration[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [busyStatus, setBusyStatus] = useState(false);

  const load = useCallback(async () => {
    try {
      const [detail, demos] = await Promise.all([getRoadmap(rid), getTopicDemonstrations(rid, tid)]);
      setRoadmap(detail);
      setHistory(demos);
      setLoadError(null);
    } catch (err) {
      setLoadError(loadFailed('Could not load this topic', err));
    }
  }, [rid, tid]);

  useEffect(() => {
    void load();
  }, [load]);

  // Flattened in order, so previous/next follow the syllabus across phases.
  const ordered = useMemo(
    () => (roadmap ? roadmap.phases.flatMap((ph) => ph.topics.map((t) => ({ topic: t, phase: ph }))) : []),
    [roadmap],
  );
  const index = ordered.findIndex((x) => x.topic.id === tid);
  const current = index >= 0 ? ordered[index] : null;
  const topic: RoadmapTopic | null = current?.topic ?? null;

  useEffect(() => {
    if (topic) setNotes(topic.evidence_notes ?? '');
    // Re-seed only when the topic itself changes, not on every refetch, so an
    // unsaved note is not overwritten by a status change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic?.id]);

  const setStatus = async (status: RoadmapTopicStatus) => {
    if (!topic) return;
    setBusyStatus(true);
    setActionError(null);
    try {
      await updateRoadmapTopic(rid, topic.id, { status });
      await load();
    } catch (err) {
      setActionError(apiErrorMessage(err, 'Could not change the status. Nothing was changed.'));
    } finally {
      setBusyStatus(false);
    }
  };

  const saveNotes = async () => {
    if (!topic) return;
    setSavingNotes(true);
    setNotesSaved(false);
    setActionError(null);
    try {
      await updateRoadmapTopic(rid, topic.id, { evidence_notes: notes.trim() || null });
      await load();
      setNotesSaved(true);
    } catch (err) {
      setActionError(apiErrorMessage(err, 'Could not save your notes. Nothing was saved.'));
    } finally {
      setSavingNotes(false);
    }
  };

  if (loadError) {
    return <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void load()}>Retry</Button>}>{loadError}</Alert>;
  }
  if (!roadmap) {
    return <LoadingState label="Loading this topic…" />;
  }
  if (!topic || !current) {
    return (
      <Alert severity="warning">
        That topic is not part of {roadmap.title}.{' '}
        <Link component={RouterLink} to={`/roadmaps/${rid}`}>Back to the roadmap</Link>
      </Alert>
    );
  }

  const previous = index > 0 ? ordered[index - 1].topic : null;
  const next = index < ordered.length - 1 ? ordered[index + 1].topic : null;
  const latest = history[0] ?? null;
  const recheckDue = latest ? new Date(latest.next_recheck_at).getTime() <= Date.now() : false;
  const completed = topic.status === 'completed';
  // Completed with no demonstration behind it: set in an imported file, or by
  // the "mark complete" that existed before demonstrations were recorded. Shown
  // the same as an earned completion, it would claim evidence that is not there.
  const unevidenced = completed && history.length === 0;

  const started = topic.started_at ? shortDate(topic.started_at) : null;

  return (
    <Box>
      <PageHead
        eyebrow={`Roadmap · ${current.phase.name}`}
        title={topic.title}
        actions={(
          <>
            <Button variant="outlined" onClick={() => navigate(`/roadmaps/${rid}`)}>← Back to syllabus</Button>
            {previous && (
              <Button variant="outlined" onClick={() => navigate(`/roadmaps/${rid}/topics/${previous.id}`)}>
                ← {previous.title.slice(0, 28)}
              </Button>
            )}
            {next && (
              <Button variant="outlined" onClick={() => navigate(`/roadmaps/${rid}/topics/${next.id}`)}>
                {next.title.slice(0, 28)} →
              </Button>
            )}
          </>
        )}
      />
      <Actions sx={{ mt: '-4px', mb: '6px' }}>
        <Pill tone={completed ? 'success' : topic.status === 'in_progress' ? 'accent' : 'neutral'}>{STATUS_LABEL[topic.status]}</Pill>
        <Detail component="span">
          Topic {index + 1} of {ordered.length} · {roadmap.title}
          {topic.estimated_hours != null && ` · ${topic.estimated_hours}h estimated`}
        </Detail>
      </Actions>

      {actionError && <Alert severity="error" sx={{ mt: 2 }}>{actionError}</Alert>}

      <Section>
        <Grid columns={2} sx={{ alignItems: 'start' }}>
          <Panel component="section" aria-labelledby="topic-objective">
            <Eyebrow>Learning objective</Eyebrow>
            <Typography variant="h5" component="h2" id="topic-objective" sx={{ fontSize: (t) => t.typography.pxToRem(19), mt: '2px' }}>
              {topic.learning_objective || 'No objective recorded for this topic.'}
            </Typography>

            <Section>
              <Eyebrow>Success criterion</Eyebrow>
              {completed
                ? <Good sx={{ mt: '8px' }}>{topic.success_criteria || 'No success criterion recorded.'}</Good>
                : <Note sx={{ mt: '8px' }}>{topic.success_criteria || 'No success criterion recorded.'}</Note>}
              <Sub sx={{ mt: '12px', mb: 0 }}>
                This is the bar for completing the topic. Time spent is not the measure — meeting the
                criterion unprompted is.
              </Sub>
            </Section>

            <Actions sx={{ mt: '16px' }}>
              <Button variant="outlined" onClick={() => navigate(`/roadmaps/${rid}/topics/${topic.id}/guide`)}>
                Study guide
              </Button>
            </Actions>
          </Panel>

          <Panel soft component="section" aria-labelledby="topic-status">
            <Eyebrow>Status</Eyebrow>
            <Typography variant="h5" component="h2" id="topic-status">{STATUS_LABEL[topic.status]}</Typography>

            {/* Only the states that claim nothing. Completion lives on the
                Demonstrate button, because it has to be earned. */}
            {!completed && (
              <Actions sx={{ mt: '12px' }}>
                {(['not_started', 'in_progress', 'skipped'] as RoadmapTopicStatus[]).map((s) => (
                  <Button
                    key={s}
                    variant={topic.status === s ? 'contained' : 'outlined'}
                    color={topic.status === s ? 'ink' : 'primary'}
                    aria-pressed={topic.status === s}
                    disabled={busyStatus || topic.status === s}
                    onClick={() => { if (topic.status !== s) void setStatus(s); }}
                  >
                    {STATUS_LABEL[s]}
                  </Button>
                ))}
              </Actions>
            )}

            <MetricRow sx={{ mt: '16px' }}>
              <Metric value={`${topic.progress_percentage}%`} label="progress" />
              <Metric value={topic.estimated_hours != null ? `${topic.estimated_hours}h` : '—'} label="estimated" />
              <Metric value={started ?? '—'} label="started" />
            </MetricRow>
            <Bar value={topic.progress_percentage} label={`${topic.progress_percentage}% progress`} sx={{ mt: '12px' }} />

            {unevidenced && (
              <Note sx={{ mt: '14px' }}>
                Marked complete without a demonstration, in an imported file or before PrepBench recorded them.
                Nothing here shows the criterion was met — demonstrate it to add that evidence.
              </Note>
            )}
            {latest && (recheckDue
              ? <Note sx={{ mt: '14px' }}>Due for a recheck — demonstrate it again to keep it.</Note>
              : <Good sx={{ mt: '14px' }}>Next recheck {shortDate(latest.next_recheck_at)}.</Good>)}

            <Section>
              <Eyebrow id="topic-notes-label" sx={{ mb: '6px' }}>Evidence notes</Eyebrow>
              <TextField
                multiline
                minRows={4}
                fullWidth
                value={notes}
                onChange={(e) => { setNotes(e.target.value); setNotesSaved(false); }}
                placeholder="What proves you met the criterion? A working example, a link to something you built…"
                slotProps={{ htmlInput: { 'aria-labelledby': 'topic-notes-label' } }}
              />
              <Actions sx={{ mt: '10px' }}>
                <Button
                  variant="outlined"
                  onClick={() => void saveNotes()}
                  disabled={savingNotes || notes === (topic.evidence_notes ?? '')}
                >
                  {savingNotes ? 'Saving…' : 'Save evidence'}
                </Button>
                <Button
                  variant="contained"
                  color="ink"
                  onClick={() => navigate(`/roadmaps/${rid}/topics/${topic.id}/demonstrate`)}
                  disabled={!topic.success_criteria}
                >
                  {completed && !unevidenced ? 'Demonstrate again' : 'Demonstrate'}
                </Button>
                {notesSaved && <Detail component="span" sx={{ color: 'success.main' }}>Saved</Detail>}
              </Actions>
              {!topic.success_criteria && (
                <Detail sx={{ mt: '8px' }}>
                  Add a success criterion to this topic before it can be demonstrated — there is nothing to meet
                  without one.
                </Detail>
              )}
            </Section>
          </Panel>
        </Grid>
      </Section>

      <Section>
        <Panel component="section" aria-labelledby="topic-demonstrations">
          <Eyebrow component="h2" id="topic-demonstrations">Demonstrations</Eyebrow>
          {history.length === 0 ? (
            <Sub sx={{ mb: 0, mt: '8px' }}>
              None yet. A demonstration is the explanation you can give without looking anything up, graded against
              the criterion above.
            </Sub>
          ) : (
            history.map((d) => (
              <Box key={d.id} sx={{ py: '14px', borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}>
                <Actions>
                  <Pill tone={d.self_grade === 'yes' ? 'success' : d.self_grade === 'partial' ? 'warning' : 'neutral'}>
                    {GRADE_LABEL[d.self_grade] ?? d.self_grade}
                  </Pill>
                  <Detail component="span">
                    {shortDate(d.created_at)} · next recheck in {d.interval_days} day{d.interval_days === 1 ? '' : 's'}
                  </Detail>
                </Actions>
                <Typography variant="body1" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>{d.response_text}</Typography>
              </Box>
            ))
          )}
        </Panel>
      </Section>

      <Section>
        <Panel component="section" aria-labelledby="topic-siblings">
          <Eyebrow component="h2" id="topic-siblings">Others in {current.phase.name}</Eyebrow>
          {current.phase.topics.map((sibling) => (
            <Row
              key={sibling.id}
              title={sibling.title}
              detail={sibling.learning_objective
                ? (sibling.learning_objective.length > 90 ? `${sibling.learning_objective.slice(0, 90)}…` : sibling.learning_objective)
                : undefined}
              middle={(
                <Pill tone={sibling.status === 'completed' ? 'success' : sibling.status === 'in_progress' ? 'accent' : 'neutral'}>
                  {STATUS_LABEL[sibling.status]}
                </Pill>
              )}
              action={sibling.id === topic.id
                ? <Detail component="span">viewing</Detail>
                : (
                  <Button
                    variant="outlined"
                    onClick={() => navigate(`/roadmaps/${rid}/topics/${sibling.id}`)}
                    aria-label={`Open ${sibling.title}`}
                  >
                    Open
                  </Button>
                )}
            />
          ))}
        </Panel>
      </Section>
    </Box>
  );
};
