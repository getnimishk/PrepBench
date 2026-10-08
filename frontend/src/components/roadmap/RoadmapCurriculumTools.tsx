// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Table, TableBody, TableCell, TableHead,
  TableRow, Typography,
} from '@mui/material';
import { applyCourseLessons, applyTitleRepair, previewCourseLessons, previewTitleRepair } from '../../services/api';
import { apiErrorMessage } from '../../services/apiError';
import type {
  CourseLesson, CourseLessonRelabelPreview, RoadmapDetail, TopicTitleRepairPreview,
} from '../../types/roadmap';
import { Detail, Panel, PanelHead, Row } from '../ui/primitives';

/**
 * Two curriculum repairs the learner runs on their own roadmap (Phase 7, D1 and D2).
 * Neither ever runs by itself, and neither changes anything until its preview has been
 * seen and confirmed:
 *
 *  - Repair numbered topic titles: an import that took a "Topic #" column for the title
 *    left topics called "1", "2", "3". The roadmap's own workbook names them again,
 *    matched by phase and number. Only titles change.
 *  - Label course lessons: guide sections loaded from course lesson files were saved as
 *    "Written by you". Given those files, the sections that match a lesson word for word
 *    are labelled "Course lesson". Only that label changes.
 */
export const RoadmapCurriculumTools: React.FC<{ roadmap: RoadmapDetail; onChanged: () => void }> = ({
  roadmap, onChanged,
}) => {
  const [repairOpen, setRepairOpen] = useState(false);
  const [lessonsOpen, setLessonsOpen] = useState(false);
  const numbered = roadmap.phases.flatMap((p) => p.topics).filter((t) => /^\d+$/.test(t.title.trim())).length;

  return (
    <Panel component="section" aria-labelledby="curriculum-tools-title">
      <PanelHead title="Curriculum tools" titleId="curriculum-tools-title">
        <Detail>Repairs you run yourself. Each shows exactly what would change before anything does.</Detail>
      </PanelHead>
      {numbered > 0 && (
        <Row
          title="Repair numbered topic titles"
          detail={`${numbered} topic${numbered === 1 ? ' is' : 's are'} titled with only a number. Choose this roadmap's workbook to put the real names back.`}
          action={<Button variant="outlined" size="small" onClick={() => setRepairOpen(true)}>Repair titles…</Button>}
        />
      )}
      <Row
        title="Label course lessons"
        detail="Guide sections loaded from course lesson files show as “Written by you”. Choose the lesson files to label the ones that match them word for word."
        action={<Button variant="outlined" size="small" onClick={() => setLessonsOpen(true)}>Label course lessons…</Button>}
      />
      {repairOpen && <TitleRepairDialog roadmap={roadmap} onClose={() => setRepairOpen(false)} onChanged={onChanged} />}
      {lessonsOpen && <CourseLessonsDialog roadmap={roadmap} onClose={() => setLessonsOpen(false)} onChanged={onChanged} />}
    </Panel>
  );
};

const TitleRepairDialog: React.FC<{ roadmap: RoadmapDetail; onClose: () => void; onChanged: () => void }> = ({
  roadmap, onClose, onChanged,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<TopicTitleRepairPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  const choose = async (f: File | null) => {
    setFile(f); setPreview(null); setError(null);
    if (!f) return;
    setBusy(true);
    try { setPreview(await previewTitleRepair(roadmap.id, f)); } catch (err) {
      setError(apiErrorMessage(err, 'The workbook could not be read.'));
    } finally { setBusy(false); }
  };

  const apply = async () => {
    if (!file || !preview) return;
    setBusy(true); setError(null);
    try {
      const result = await applyTitleRepair(roadmap.id, file, preview.changes.map((c) => c.topic_id));
      setDone(result.repaired.length);
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err, 'Nothing was changed.'));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth aria-labelledby="title-repair-title">
      <DialogTitle id="title-repair-title">Repair numbered topic titles</DialogTitle>
      <DialogContent>
        {done !== null ? (
          <Alert severity="success">Renamed {done} topic{done === 1 ? '' : 's'}. Nothing else about them changed.</Alert>
        ) : (
          <>
            <Typography variant="body2" sx={{ mb: '12px' }}>
              Topics are matched to the workbook by their phase and number. Only their titles change: progress, notes,
              demonstrations and guides stay as they are, and nothing is added, removed or reordered.
            </Typography>
            <Button variant="outlined" component="label" disabled={busy}>
              {file ? `Workbook: ${file.name}` : 'Choose the roadmap’s workbook (.xlsx)'}
              <input hidden type="file" accept=".xlsx,.xlsm" onChange={(e) => choose(e.target.files?.[0] ?? null)} />
            </Button>
            {error && <Alert severity="error" sx={{ mt: '12px' }}>{error}</Alert>}
            {preview && (
              <Box sx={{ mt: '14px' }}>
                {preview.problems.length > 0 && (
                  <Alert severity="warning" sx={{ mb: '10px' }}>
                    This repair cannot run: {preview.problems.join(' ')}
                  </Alert>
                )}
                {preview.changes.length === 0 ? (
                  <Detail>Nothing to repair: every topic already has a name.</Detail>
                ) : (
                  <>
                    <Detail sx={{ mb: '8px' }}>
                      {preview.changes.length} topic{preview.changes.length === 1 ? '' : 's'} would be renamed
                      {preview.already_named ? `; ${preview.already_named} already named are left alone` : ''}.
                    </Detail>
                    <Box sx={{ maxHeight: 320, overflow: 'auto', border: '1px solid', borderColor: 'pb.line', borderRadius: '8px' }}>
                      <Table size="small" stickyHeader aria-label="Titles that would change">
                        <TableHead>
                          <TableRow>
                            <TableCell>Phase</TableCell>
                            <TableCell>Number</TableCell>
                            <TableCell>New title</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {preview.changes.map((c) => (
                            <TableRow key={c.topic_id}>
                              <TableCell>{c.phase}</TableCell>
                              <TableCell>{c.old_title}</TableCell>
                              <TableCell>{c.new_title}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                  </>
                )}
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>{done !== null ? 'Close' : 'Cancel'}</Button>
        {done === null && (
          <Button variant="contained" onClick={apply} disabled={busy || !preview?.can_apply}>
            {preview?.can_apply ? `Rename ${preview.changes.length} topic${preview.changes.length === 1 ? '' : 's'}` : 'Rename'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

/** A lesson file's sections, as the API wants them; null when the file is not a lesson. */
function lessonFrom(raw: unknown): CourseLesson | null {
  if (!raw || typeof raw !== 'object') return null;
  const sections = (raw as { sections?: unknown }).sections;
  if (!Array.isArray(sections) || sections.length === 0) return null;
  const pick = (s: Record<string, unknown>, k: string) => (typeof s[k] === 'string' ? (s[k] as string) : null);
  const out = sections
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
    .map((s) => ({
      title: pick(s, 'title') ?? '', body: pick(s, 'body') ?? '',
      example: pick(s, 'example'), common_mistake: pick(s, 'common_mistake'),
      check_question: pick(s, 'check_question'), check_answer: pick(s, 'check_answer'),
    }))
    .filter((s) => s.title && s.body);
  const topic = (raw as { topic_title?: unknown }).topic_title;
  return out.length ? { topic_title: typeof topic === 'string' ? topic : null, sections: out } : null;
}

const CourseLessonsDialog: React.FC<{ roadmap: RoadmapDetail; onClose: () => void; onChanged: () => void }> = ({
  roadmap, onClose, onChanged,
}) => {
  const [lessons, setLessons] = useState<CourseLesson[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [preview, setPreview] = useState<CourseLessonRelabelPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  const choose = async (files: FileList | null) => {
    setPreview(null); setError(null); setLessons(null); setSkipped(0);
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const read: CourseLesson[] = [];
      let bad = 0;
      for (const f of Array.from(files)) {
        try {
          const lesson = lessonFrom(JSON.parse(await f.text()));
          if (lesson) read.push(lesson); else bad += 1;
        } catch { bad += 1; }
      }
      setSkipped(bad);
      setLessons(read);
      if (read.length > 0) setPreview(await previewCourseLessons(roadmap.id, read));
    } catch (err) {
      setError(apiErrorMessage(err, 'The lesson files could not be checked.'));
    } finally { setBusy(false); }
  };

  const apply = async () => {
    if (!lessons || !preview) return;
    setBusy(true); setError(null);
    try {
      const result = await applyCourseLessons(roadmap.id, lessons, preview.matched.map((m) => m.section_id));
      setDone(result.relabelled.length);
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err, 'Nothing was changed.'));
    } finally { setBusy(false); }
  };

  const n = preview?.matched.length ?? 0;
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth aria-labelledby="course-lessons-title">
      <DialogTitle id="course-lessons-title">Label course lessons</DialogTitle>
      <DialogContent>
        {done !== null ? (
          <Alert severity="success">Labelled {done} section{done === 1 ? '' : 's'} “Course lesson”. Their text did not change.</Alert>
        ) : (
          <>
            <Typography variant="body2" sx={{ mb: '12px' }}>
              Choose the course’s lesson files (.guide.json). A section is proposed only when every part of it — title,
              text, example, common mistake, check question and answer — matches a lesson exactly. Anything else stays
              “Written by you”.
            </Typography>
            <Button variant="outlined" component="label" disabled={busy}>
              {lessons ? `${lessons.length} lesson file${lessons.length === 1 ? '' : 's'} chosen` : 'Choose lesson files'}
              <input hidden type="file" accept=".json" multiple onChange={(e) => choose(e.target.files)} />
            </Button>
            {skipped > 0 && <Detail sx={{ mt: '8px' }}>{skipped} file{skipped === 1 ? ' was' : 's were'} not a lesson file and {skipped === 1 ? 'was' : 'were'} skipped.</Detail>}
            {error && <Alert severity="error" sx={{ mt: '12px' }}>{error}</Alert>}
            {preview && (
              <Box sx={{ mt: '14px' }}>
                <Detail>
                  {n} section{n === 1 ? '' : 's'} match a lesson word for word and would be labelled “Course lesson”.
                  {preview.unmatched_written_by_you > 0 && ` ${preview.unmatched_written_by_you} do not match exactly and stay “Written by you” — you can mark one at a time from its guide page.`}
                  {preview.already_course > 0 && ` ${preview.already_course} are already course lessons.`}
                  {preview.ai_drafts > 0 && ` ${preview.ai_drafts} AI drafts are left as they are.`}
                </Detail>
                {n > 0 && (
                  <Box component="ul" aria-label="Sections that would be labelled" sx={{ maxHeight: 260, overflow: 'auto', mt: '10px', pl: '20px' }}>
                    {preview.matched.map((m) => (
                      <li key={m.section_id}><Typography variant="body2">{m.topic_title} — {m.section_title}</Typography></li>
                    ))}
                  </Box>
                )}
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>{done !== null ? 'Close' : 'Cancel'}</Button>
        {done === null && (
          <Button variant="contained" onClick={apply} disabled={busy || n === 0}>
            {n > 0 ? `Label ${n} as course lessons` : 'Label'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
