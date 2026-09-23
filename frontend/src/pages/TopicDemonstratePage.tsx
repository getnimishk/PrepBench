// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, TextField, Typography } from '@mui/material';
import { demonstrateTopic, getQuestions, getRoadmap, getTopicDemonstrations } from '../services/api';
import { apiErrorMessage, loadFailed } from '../services/apiError';
import { usePreparation } from '../context/PreparationContext';
import type { DemonstrationGrade, RoadmapDetail, RoadmapTopicStatus, TopicDemonstration } from '../types/roadmap';
import type { Question } from '../types/question';
import { LoadingState } from '../components/common/States';
import {
  Actions, Bar, BigFigure, Detail, Eyebrow, Good, Grid, Note, PageHead, Panel, Row, Section, Sub,
} from '../components/ui/primitives';

/**
 * Demonstrate a topic: the step between reading and practising.
 *
 * The order is the whole method, and the page enforces it:
 *
 *   1. write the explanation you would give a colleague, without looking
 *   2. only then reveal the standard
 *   3. grade yourself against the success criterion
 *
 * Revealing the standard before answering turns retrieval into recognition --
 * anyone can agree with a correct explanation they have just read -- so the
 * grading buttons do not exist until the answer is written and the standard is
 * shown. And the answer is saved with the grade, so what you claimed you could do
 * is on the record next to what you actually wrote.
 *
 * Beside it, as in the prototype: where the topic stands, and the questions in
 * the roadmap's own preparation that touch it.
 */

/** The server's floor. A demonstration is an explanation, not a word. */
const MIN_LENGTH = 20;

const STATUS_LABEL: Record<RoadmapTopicStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  skipped: 'Skipped',
};

// Words that say what kind of topic it is rather than what it is about. Two
// topics sharing "understand" are not about the same thing.
const TOPIC_STOP = new Set([
  'understand', 'understanding', 'explain', 'describe', 'identify', 'apply', 'applying', 'using', 'through',
  'between', 'within', 'should', 'which', 'their', 'these', 'those', 'about', 'basic', 'basics', 'model', 'models',
  'concept', 'concepts', 'learn', 'learning', 'overview', 'introduction', 'fundamentals',
]);

export const topicWords = (title: string): string[] =>
  [...new Set(title.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 4 && !TOPIC_STOP.has(w)))];

/**
 * The bank's questions whose own topic shares at least two of this topic's
 * words. One shared word is not a link: "Events" alone would tie a Kafka topic
 * to Scrum events.
 */
export function questionsTouching(title: string, questions: Question[]): Question[] {
  const words = topicWords(title);
  if (words.length < 2) return [];
  return questions.filter((q) => {
    const topic = (q.topic ?? '').toLowerCase();
    return words.filter((w) => topic.includes(w)).length >= 2;
  });
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export const TopicDemonstratePage: React.FC = () => {
  const { roadmapId, topicId } = useParams<{ roadmapId: string; topicId: string }>();
  const rid = Number(roadmapId);
  const tid = Number(topicId);
  const navigate = useNavigate();
  const { preparations } = usePreparation();

  const [roadmap, setRoadmap] = useState<RoadmapDetail | null>(null);
  const [history, setHistory] = useState<TopicDemonstration[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [answer, setAnswer] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState<DemonstrationGrade | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [related, setRelated] = useState<Question[] | null>(null);
  const [relatedError, setRelatedError] = useState(false);

  useEffect(() => {
    setLoadError(null);
    Promise.all([getRoadmap(rid), getTopicDemonstrations(rid, tid).catch(() => [] as TopicDemonstration[])])
      .then(([detail, demos]) => { setRoadmap(detail); setHistory(demos); })
      .catch((err) => setLoadError(loadFailed('Could not load this topic', err)));
  }, [rid, tid, loadAttempt]);

  const found = useMemo(() => {
    if (!roadmap) return null;
    for (const phase of roadmap.phases) {
      const topic = phase.topics.find((t) => t.id === tid);
      if (topic) return { topic, phase };
    }
    return null;
  }, [roadmap, tid]);

  // Questions are looked for only in the roadmap's own preparation, by the
  // topic's most specific word, then held to the two-word rule above.
  const subjectId = roadmap?.subject_id ?? null;
  const title = found?.topic.title ?? null;
  useEffect(() => {
    setRelated(null);
    setRelatedError(false);
    if (subjectId == null || !title) return undefined;
    const words = topicWords(title);
    if (words.length < 2) { setRelated([]); return undefined; }
    let cancelled = false;
    const longest = [...words].sort((a, b) => b.length - a.length)[0];
    getQuestions({ subject_id: subjectId, keyword: longest, limit: 200 })
      .then((res) => { if (!cancelled) setRelated(questionsTouching(title, res.items).slice(0, 3)); })
      .catch(() => { if (!cancelled) setRelatedError(true); });
    return () => { cancelled = true; };
  }, [subjectId, title]);

  const grade = async (selfGrade: DemonstrationGrade) => {
    setSaving(selfGrade);
    setSaveError(null);
    try {
      await demonstrateTopic(rid, tid, answer, selfGrade);
      navigate(`/roadmaps/${rid}/topics/${tid}`);
    } catch (err) {
      setSaveError(apiErrorMessage(err, 'Could not save the demonstration. Nothing was recorded.'));
    } finally {
      setSaving(null);
    }
  };

  if (loadError) {
    return <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => setLoadAttempt((n) => n + 1)}>Retry</Button>}>{loadError}</Alert>;
  }
  if (!roadmap) return <LoadingState label="Loading this topic…" />;
  if (!found) return <Alert severity="warning">That topic is not part of this roadmap.</Alert>;

  const { topic, phase } = found;
  const longEnough = answer.trim().length >= MIN_LENGTH;
  const latest = history[0] ?? null;
  const recheckDue = latest ? new Date(latest.next_recheck_at).getTime() <= Date.now() : false;
  const preparation = subjectId != null ? preparations.find((s) => s.id === subjectId) ?? null : null;

  return (
    <Box>
      <PageHead
        eyebrow={`Demonstrate · ${phase.name}`}
        title={topic.title}
        sub="Completion is not time spent. It is whether you can meet the success criterion unprompted."
        actions={(
          <>
            <Button variant="outlined" onClick={() => navigate(`/roadmaps/${rid}/topics/${tid}`)}>← Back to topic</Button>
            <Button variant="outlined" component={RouterLink} to={`/roadmaps/${rid}`}>Syllabus</Button>
          </>
        )}
      />

      <Section>
        <Grid template="minmax(0,1.4fr) minmax(0,1fr)" sx={{ alignItems: 'start' }}>
          <Panel component="section" aria-label="Your demonstration">
            <Eyebrow>The criterion you are meeting</Eyebrow>
            <Note sx={{ mt: '8px', fontSize: (t) => t.typography.pxToRem(15) }}>
              {topic.success_criteria || 'No success criterion was recorded for this topic.'}
            </Note>

            <Section>
              <Eyebrow component="label" sx={{ mb: '8px' }}>
                <Box component="span" id="demonstration-answer-label">Explain it in your own words</Box>
              </Eyebrow>
              <TextField
                id="demonstration-answer"
                multiline
                minRows={7}
                fullWidth
                value={answer}
                // Locked once the standard is shown. Editing the answer after reading
                // the model answer is the recognition the order exists to prevent.
                disabled={revealed}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Write the explanation you would give a colleague. Do not look anything up first — this is retrieval, not note-taking."
                slotProps={{ htmlInput: { 'aria-labelledby': 'demonstration-answer-label' } }}
              />
            </Section>

            {!revealed ? (
              <>
                <Actions sx={{ mt: '18px' }}>
                  <Button variant="contained" color="ink" disabled={!longEnough} onClick={() => setRevealed(true)}>
                    I have written my answer — reveal the standard
                  </Button>
                </Actions>
                <Detail sx={{ mt: '10px' }}>
                  {longEnough
                    ? 'Write first. Revealing the standard before you answer turns retrieval into recognition.'
                    : `Write at least a sentence (${MIN_LENGTH} characters) before revealing the standard.`}
                </Detail>
              </>
            ) : (
              <>
                <Section>
                  <Eyebrow>What a strong answer covers</Eyebrow>
                  <Good sx={{ mt: '8px' }}><b>Objective:</b> {topic.learning_objective || '—'}</Good>
                  <Sub sx={{ mt: '10px', mb: 0 }}>
                    Compare what you wrote against the criterion above. A strong answer states the mechanism, not
                    the definition — and would survive the question &ldquo;why does that happen?&rdquo;
                  </Sub>
                </Section>
                <Eyebrow sx={{ mt: '18px' }}>Can you meet the criterion unprompted?</Eyebrow>
                {saveError && <Alert severity="error" sx={{ mt: 1.5 }}>{saveError}</Alert>}
                <Actions sx={{ mt: '10px' }}>
                  <Button variant="outlined" disabled={saving !== null} onClick={() => void grade('not_yet')}>
                    {saving === 'not_yet' ? 'Saving…' : 'Not yet — back tomorrow'}
                  </Button>
                  <Button variant="contained" disabled={saving !== null} onClick={() => void grade('partial')}>
                    {saving === 'partial' ? 'Saving…' : 'Partially — recheck soon'}
                  </Button>
                  <Button variant="contained" color="ink" disabled={saving !== null} onClick={() => void grade('yes')}>
                    {saving === 'yes' ? 'Saving…' : 'Yes, unprompted — complete it'}
                  </Button>
                </Actions>
              </>
            )}
          </Panel>

          <Box sx={{ display: 'grid', gap: '15px', minWidth: 0 }}>
            <Panel soft component="section" aria-labelledby="demonstrate-state">
              <Eyebrow component="h2" id="demonstrate-state">Current state</Eyebrow>
              <BigFigure size={24}>{STATUS_LABEL[topic.status]}</BigFigure>
              <Bar value={topic.progress_percentage} label={`${topic.progress_percentage}% progress`} sx={{ mt: '9px' }} />
              <Detail sx={{ mt: '7px' }}>
                {topic.progress_percentage}%
                {topic.estimated_hours != null ? ` · ${topic.estimated_hours}h estimated` : ''}
                {latest ? ` · last checked interval ${latest.interval_days}d` : ''}
              </Detail>
              {latest && (recheckDue
                ? <Note sx={{ mt: '12px' }}>Due for a recheck</Note>
                : <Good sx={{ mt: '12px' }}>Next recheck {shortDate(latest.next_recheck_at)}</Good>)}
            </Panel>

            <Panel component="section" aria-labelledby="demonstrate-questions">
              <Eyebrow component="h2" id="demonstrate-questions">Check with questions</Eyebrow>
              {subjectId == null ? (
                <Detail sx={{ mt: '8px' }}>
                  This roadmap belongs to no preparation, so there is no question bank to check it against.
                  Self-demonstration against the criterion is the only check available here.
                </Detail>
              ) : relatedError ? (
                <Detail sx={{ mt: '8px' }}>Could not look the bank up. Nothing was changed.</Detail>
              ) : related === null ? (
                <LoadingState label="Looking through the bank…" />
              ) : related.length === 0 ? (
                <Detail sx={{ mt: '8px' }}>
                  No questions in {preparation ? `${preparation.name}’s` : 'this preparation’s'} bank match this
                  topic. Self-demonstration against the criterion is the only check available here.
                </Detail>
              ) : (
                <>
                  <Detail sx={{ mt: '8px' }}>
                    {related.length} {related.length === 1 ? 'question' : 'questions'} in the bank touch this topic.
                  </Detail>
                  {related.map((q) => (
                    <Row
                      key={q.id}
                      title={<Typography component="span" sx={{ fontWeight: 600 }}>{q.text.length > 54 ? `${q.text.slice(0, 54)}…` : q.text}</Typography>}
                      detail={q.topic ?? undefined}
                      action={(
                        <Button
                          variant="outlined"
                          component={RouterLink}
                          to={`/question-bank?keyword=${encodeURIComponent(q.text.slice(0, 60))}`}
                          aria-label={`Open the question: ${q.text.slice(0, 60)}`}
                        >
                          Open
                        </Button>
                      )}
                    />
                  ))}
                </>
              )}
            </Panel>
          </Box>
        </Grid>
      </Section>
    </Box>
  );
};
