// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Stack, TextField, Typography,
} from '@mui/material';
import { Plus, Sparkles } from 'lucide-react';
import {
  addTopicGuideSection, deleteTopicGuideSection, draftTopicGuide, getRoadmap, getTopicGuide,
  setTopicGuideSectionRead, updateTopicGuideSection,
} from '../services/api';
import { apiErrorMessage, loadFailed } from '../services/apiError';
import type {
  RoadmapDetail, TopicGuide, TopicGuideSection, TopicGuideSectionWrite,
} from '../types/roadmap';
import { LoadingState } from '../components/common/States';
import {
  Actions, Bar, Detail, Eyebrow, Good, Grid, Note, PageHead, Panel, Pill, Row, Section, Sub,
} from '../components/ui/primitives';
import { MONO_STACK } from '../theme/tokens';

/**
 * A topic's study guide.
 *
 * The prototype drew this as fixed text: five hardcoded headings, the same Scrum
 * paragraph under each, a made-up "2 of 5 complete" and a "Mark complete" that did
 * nothing. Here every section is real -- drafted by the configured AI or written by
 * the learner -- and every change is saved.
 *
 * What the page says about its own content matters as much as the content. An AI
 * draft is labelled as one, and stays labelled after an edit. With no AI set up
 * the draft button says so rather than producing placeholder text. And reading a
 * section is recorded but never claimed as completing the topic: the way on is the
 * Demonstrate step, which is offered at the end.
 */

const EMPTY: TopicGuideSectionWrite = {
  title: '', body: '', example: '', common_mistake: '', check_question: '', check_answer: '',
};

/** Who wrote this section, told truthfully. */
function provenance(section: TopicGuideSection): string {
  if (section.source === 'ai') {
    const by = section.generated_by ? ` (${section.generated_by})` : '';
    return section.edited_at ? `Drafted by AI${by}, edited by you` : `Drafted by AI${by} — check it against what you know`;
  }
  return 'Written by you';
}

const blankToNull = (value?: string | null) => (value && value.trim() ? value.trim() : null);

export const TopicGuidePage: React.FC = () => {
  const { roadmapId, topicId } = useParams<{ roadmapId: string; topicId: string }>();
  const rid = Number(roadmapId);
  const tid = Number(topicId);
  const navigate = useNavigate();

  const [roadmap, setRoadmap] = useState<RoadmapDetail | null>(null);
  const [guide, setGuide] = useState<TopicGuide | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ severity: 'success' | 'info' | 'error'; text: string } | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [drafting, setDrafting] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<TopicGuideSection | null>(null);
  const [form, setForm] = useState<TopicGuideSectionWrite>(EMPTY);
  const [saving, setSaving] = useState(false);

  const [checkAnswer, setCheckAnswer] = useState('');
  const [checkRevealed, setCheckRevealed] = useState(false);

  const load = useCallback(async () => {
    try {
      const [detail, g] = await Promise.all([getRoadmap(rid), getTopicGuide(rid, tid)]);
      setRoadmap(detail);
      setGuide(g);
      setLoadError(null);
      setActiveId((current) =>
        current && g.sections.some((s) => s.id === current) ? current : (g.sections[0]?.id ?? null));
    } catch (err) {
      setLoadError(loadFailed('Could not load this study guide', err));
    }
  }, [rid, tid]);

  useEffect(() => {
    void load();
  }, [load]);

  // A fresh self-check for each section.
  useEffect(() => {
    setCheckAnswer('');
    setCheckRevealed(false);
  }, [activeId]);

  const topic = useMemo(() => {
    if (!roadmap) return null;
    for (const phase of roadmap.phases) {
      const found = phase.topics.find((t) => t.id === tid);
      if (found) return found;
    }
    return null;
  }, [roadmap, tid]);

  const sections = guide?.sections ?? [];
  const activeIndex = sections.findIndex((s) => s.id === activeId);
  const active = activeIndex >= 0 ? sections[activeIndex] : null;

  const draft = async () => {
    setDrafting(true);
    setNotice(null);
    try {
      const result = await draftTopicGuide(rid, tid);
      setGuide(result.guide);
      setNotice({
        severity: result.status === 'drafted' ? 'success' : result.status === 'unavailable' ? 'info' : 'error',
        text: result.message,
      });
      if (result.status === 'drafted' && !activeId) setActiveId(result.guide.sections[0]?.id ?? null);
    } catch (err) {
      setNotice({ severity: 'error', text: apiErrorMessage(err, 'Could not reach the server. Nothing was drafted.') });
    } finally {
      setDrafting(false);
    }
  };

  const openEditor = (section: TopicGuideSection | null) => {
    setEditing(section);
    setForm(section ? {
      title: section.title,
      body: section.body,
      example: section.example ?? '',
      common_mistake: section.common_mistake ?? '',
      check_question: section.check_question ?? '',
      check_answer: section.check_answer ?? '',
    } : EMPTY);
    setEditorOpen(true);
  };

  const saveSection = async () => {
    setSaving(true);
    const payload: TopicGuideSectionWrite = {
      title: form.title.trim(),
      body: form.body.trim(),
      example: blankToNull(form.example),
      common_mistake: blankToNull(form.common_mistake),
      check_question: blankToNull(form.check_question),
      check_answer: blankToNull(form.check_answer),
    };
    try {
      const saved = editing
        ? await updateTopicGuideSection(rid, tid, editing.id, payload)
        : await addTopicGuideSection(rid, tid, payload);
      setEditorOpen(false);
      await load();
      setActiveId(saved.id);
      setNotice(null);
    } catch (err) {
      setNotice({ severity: 'error', text: apiErrorMessage(err, 'Could not save the section. Nothing was saved.') });
    } finally {
      setSaving(false);
    }
  };

  const removeSection = async (section: TopicGuideSection) => {
    try {
      await deleteTopicGuideSection(rid, tid, section.id);
      await load();
    } catch (err) {
      setNotice({ severity: 'error', text: apiErrorMessage(err, 'Could not delete the section.') });
    }
  };

  const toggleRead = async (section: TopicGuideSection) => {
    try {
      await setTopicGuideSectionRead(rid, tid, section.id, !section.read_at);
      await load();
    } catch (err) {
      setNotice({ severity: 'error', text: apiErrorMessage(err, 'Could not record that. Nothing was changed.') });
    }
  };

  if (loadError) {
    return <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void load()}>Retry</Button>}>{loadError}</Alert>;
  }
  if (!guide || !roadmap) return <LoadingState label="Loading the study guide…" />;
  if (!topic) return <Alert severity="warning">That topic is not part of this roadmap.</Alert>;

  const readPct = sections.length ? Math.round((guide.read_count / sections.length) * 100) : 0;

  // The prototype puts the sandbox under every section: an instrument to test the
  // reading against, one click away.
  const sandboxRow = (
    <Row
      title="Chart Sandbox"
      detail="An instrument for this section: predict, manipulate, observe, explain"
      action={<Button variant="outlined" component={RouterLink} to="/chart-sandbox" aria-label="Open the Chart Sandbox">Open</Button>}
      sx={{ mt: '18px', borderTop: '1px solid', borderColor: 'divider' }}
    />
  );

  return (
    <Box>
      <PageHead
        eyebrow={`Study guide · ${roadmap.title}`}
        title={topic.title}
        sub="Reading builds the model. Practice proves you can retrieve it."
        actions={(
          <>
            <Button variant="outlined" onClick={() => navigate(`/roadmaps/${rid}/topics/${tid}`)}>← Back to topic</Button>
            <Button variant="outlined" startIcon={<Plus size={16} />} onClick={() => openEditor(null)}>
              Write a section
            </Button>
            <Button
              variant="contained"
              startIcon={drafting ? <CircularProgress size={16} color="inherit" /> : <Sparkles size={16} />}
              disabled={drafting || !guide.drafting_available}
              onClick={() => void draft()}
            >
              {drafting ? 'Drafting…' : sections.length ? 'Draft more with AI' : 'Draft with AI'}
            </Button>
          </>
        )}
      />

      {!guide.drafting_available && (
        <Alert severity="info" sx={{ mt: 2 }}>{guide.drafting_unavailable_reason}</Alert>
      )}
      {notice && <Alert severity={notice.severity} sx={{ mt: 2 }} onClose={() => setNotice(null)}>{notice.text}</Alert>}

      {sections.length === 0 ? (
        <Section>
          <Panel component="section" aria-labelledby="guide-empty">
            <Typography variant="h5" component="h2" id="guide-empty">No study guide yet</Typography>
            <Sub sx={{ mb: 0 }}>
              {guide.drafting_available
                ? 'Draft one with AI and edit anything that is wrong, or write the sections yourself.'
                : 'Write the sections yourself, or set up an AI provider in Settings to draft them.'}
            </Sub>
            {sandboxRow}
          </Panel>
        </Section>
      ) : (
        <Section>
          <Grid template="250px minmax(0,1fr)" sx={{ alignItems: 'start' }}>
            <Panel soft component="nav" aria-label="Guide contents">
              <Eyebrow>Contents</Eyebrow>
              {sections.map((section, i) => {
                const current = section.id === activeId;
                return (
                  <Box
                    key={section.id}
                    component="button"
                    onClick={() => setActiveId(section.id)}
                    aria-current={current ? 'true' : undefined}
                    sx={{
                      display: 'block', width: '100%', textAlign: 'left', font: 'inherit', cursor: 'pointer',
                      border: 0, borderRadius: '8px', p: '10px', mt: '4px', color: 'text.primary',
                      bgcolor: current ? 'pb.accentSoft' : 'transparent',
                      '&:hover': { bgcolor: current ? 'pb.accentSoft' : 'pb.surface2' },
                    }}
                  >
                    <Box component="b" sx={{ display: 'block', fontWeight: 700 }}>{i + 1}. {section.title}</Box>
                    <Box component="span" sx={{ display: 'block', color: 'text.secondary', fontSize: (t) => t.typography.pxToRem(11), mt: '2px' }}>
                      {section.read_at ? 'Read' : current ? 'Reading now' : 'Not read yet'}
                    </Box>
                  </Box>
                );
              })}
              <Bar value={readPct} label={`${guide.read_count} of ${sections.length} sections read`} sx={{ mt: '14px' }} />
              <Detail sx={{ mt: '6px' }}>{guide.read_count} of {sections.length} sections read</Detail>
            </Panel>

            {active && (
              <Panel component="article" aria-labelledby="guide-section-title">
                <Eyebrow>Section {activeIndex + 1} of {sections.length}</Eyebrow>
                <Typography variant="h5" component="h2" id="guide-section-title" sx={{ mt: '2px' }}>{active.title}</Typography>
                <Pill tone={active.source === 'ai' && !active.edited_at ? 'warning' : 'neutral'} sx={{ mt: '8px' }}>
                  {provenance(active)}
                </Pill>

                <Typography component="div" variant="body1" sx={{ mt: '14px', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                  {active.body}
                </Typography>

                {active.example && (
                  <Box
                    sx={{
                      mt: '10px', p: '11px 12px', borderRadius: '9px', bgcolor: 'pb.surface2', border: '1px solid',
                      borderColor: 'divider', fontFamily: MONO_STACK, fontSize: (t) => t.typography.pxToRem(12), color: 'text.secondary',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {active.example}
                  </Box>
                )}

                {active.common_mistake && (
                  <Note sx={{ mt: '14px' }}><b>Commonly missed:</b> {active.common_mistake}</Note>
                )}

                {active.check_question && (
                  <Section>
                    <Eyebrow>Check yourself</Eyebrow>
                    <Typography variant="subtitle2" component="p" sx={{ mt: '4px' }}>{active.check_question}</Typography>
                    <TextField
                      multiline
                      minRows={3}
                      fullWidth
                      value={checkAnswer}
                      disabled={checkRevealed}
                      onChange={(e) => setCheckAnswer(e.target.value)}
                      placeholder="Answer it before you look."
                      sx={{ mt: 1 }}
                      // Named, so it is clear this is private practice and not recorded.
                      helperText="Just for you — this is not saved or graded."
                    />
                    {!checkRevealed ? (
                      <Button
                        variant="text"
                        onClick={() => setCheckRevealed(true)}
                        disabled={!checkAnswer.trim() || !active.check_answer}
                        sx={{ mt: 1 }}
                      >
                        Compare with the model answer
                      </Button>
                    ) : (
                      <Good sx={{ mt: '12px' }}>{active.check_answer}</Good>
                    )}
                  </Section>
                )}

                <Actions sx={{ mt: '18px' }}>
                  <Button variant={active.read_at ? 'outlined' : 'contained'} onClick={() => void toggleRead(active)}>
                    {active.read_at ? 'Mark as not read' : 'I have read this'}
                  </Button>
                  {activeIndex < sections.length - 1 && (
                    <Button variant="outlined" onClick={() => setActiveId(sections[activeIndex + 1].id)}>
                      Next section →
                    </Button>
                  )}
                  <Box sx={{ flexGrow: 1 }} />
                  <Button variant="text" onClick={() => openEditor(active)}>Edit</Button>
                  <Button variant="text" color="error" onClick={() => void removeSection(active)}>Delete</Button>
                </Actions>

                {sandboxRow}

                {activeIndex === sections.length - 1 && (
                  <Box sx={{ mt: '4px', pt: '14px', borderTop: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="h6" component="h3">Ready to prove it?</Typography>
                    <Detail sx={{ mt: '4px' }}>
                      Reading does not complete a topic. Explaining it unprompted against the success criterion does.
                    </Detail>
                    <Button
                      variant="contained"
                      color="ink"
                      disabled={!topic.success_criteria}
                      onClick={() => navigate(`/roadmaps/${rid}/topics/${tid}/demonstrate`)}
                      sx={{ mt: '12px' }}
                    >
                      Demonstrate this topic
                    </Button>
                  </Box>
                )}
              </Panel>
            )}
          </Grid>
        </Section>
      )}

      <Dialog open={editorOpen} onClose={() => setEditorOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{editing ? 'Edit section' : 'Write a section'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required fullWidth />
            <TextField label="Explanation" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required multiline minRows={5} fullWidth />
            <TextField label="Example (optional)" value={form.example ?? ''} onChange={(e) => setForm({ ...form, example: e.target.value })} multiline minRows={2} fullWidth />
            <TextField label="Common mistake (optional)" value={form.common_mistake ?? ''} onChange={(e) => setForm({ ...form, common_mistake: e.target.value })} multiline minRows={2} fullWidth />
            <TextField label="Check question (optional)" value={form.check_question ?? ''} onChange={(e) => setForm({ ...form, check_question: e.target.value })} fullWidth />
            <TextField label="Model answer (optional)" value={form.check_answer ?? ''} onChange={(e) => setForm({ ...form, check_answer: e.target.value })} multiline minRows={2} fullWidth />
          </Stack>
          {editing?.source === 'ai' && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              This section was drafted by AI. After you save, it will show as drafted by AI and edited by you.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setEditorOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={saving || !form.title.trim() || !form.body.trim()}
            onClick={() => void saveSection()}
          >
            {saving ? 'Saving…' : 'Save section'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
