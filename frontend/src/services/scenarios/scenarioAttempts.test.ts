// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContentPackDetail, ScenarioContent } from '../../types/contentPack';
import type { WireLearningAttempt } from '../../types/learning';
import adfPack from '../../../../backend/app/content/packs/adf/v1.json';

vi.mock('../api', () => ({
  getLearningAttempts: vi.fn(),
  startLearningAttempt: vi.fn(),
  patchLearningAttempt: vi.fn(),
}));

import * as api from '../api';
import {
  CASE_NOTES_COMMITTED, EXPLANATION_MAX, NOTE_MAX, ROLES, SAY_IT_MAX,
  answerCheck, commitCaseNotes, lastRole, lensTasks, parseLensText,
  saveCoverage, sayItSourceRef, scenarioAttemptUid, scenarioProgress, scenarioStatus, serializeLensText,
} from './scenarioAttempts';

// The shipped pack, the file the server serves, so the budget test below checks
// the real questions rather than a fixture that could drift.
const ADF = adfPack as unknown as ContentPackDetail;
const WRITTEN = ADF.scenario_levels.flatMap((l) => l.scenarios).filter((s) => s.content);
const S1 = WRITTEN[0];
const C1 = S1.content as ScenarioContent;

const KEY = { subjectId: 7, packId: 'adf', version: 1, scenarioId: '1' };

function wire(over: Partial<WireLearningAttempt>): WireLearningAttempt {
  return {
    attempt_uid: 'x', challenge_id: 'x', concept_id: 'x', scenario_fingerprint: '', mode: 'guided',
    started_at: '2026-09-27T10:00:00', hint_count: 0, ...over,
  };
}

beforeEach(() => {
  vi.mocked(api.startLearningAttempt).mockReset().mockImplementation(async (b) => wire({ ...b }));
  vi.mocked(api.patchLearningAttempt).mockReset();
});

describe('the attempt encoding', () => {
  it('records a check answer as a committed prediction on the active skill, at the pinned version', async () => {
    vi.mocked(api.patchLearningAttempt).mockResolvedValue(wire({}));
    await answerCheck(KEY, 'incremental', 2, 1, true);

    expect(api.startLearningAttempt).toHaveBeenCalledWith({
      attempt_uid: 's7:adf@1:1:c2',
      challenge_id: 'adf/1/check/2',
      concept_id: 'adf/incremental',
      scenario_fingerprint: 'pack_version=1',
      mode: 'guided',
      hint_count: 0,
      subject_id: 7,
    });
    expect(api.patchLearningAttempt).toHaveBeenCalledWith('s7:adf@1:1:c2', { prediction: '1', completed: true, correct: true }, 7);
  });

  it('commits the case notes, their text and the debrief in one request per role', async () => {
    vi.mocked(api.patchLearningAttempt).mockResolvedValue(wire({}));
    await commitCaseNotes(KEY, 'incremental', 'dm', 'a) Q\nnotes');

    expect(api.startLearningAttempt).toHaveBeenCalledWith(expect.objectContaining({
      attempt_uid: 's7:adf@1:1:lens:dm',
      challenge_id: 'adf/1/lens/dm',
      scenario_fingerprint: 'pack_version=1;lens=dm',
      subject_id: 7,
    }));
    expect(api.patchLearningAttempt).toHaveBeenCalledWith('s7:adf@1:1:lens:dm', {
      prediction: CASE_NOTES_COMMITTED, explanation_text: 'a) Q\nnotes', completed: true,
    }, 7);
  });

  it('records ticked Say-it points as binary rubric coverage, one key per point', async () => {
    vi.mocked(api.patchLearningAttempt).mockResolvedValue(wire({}));
    await saveCoverage(7, 's7:adf@1:1:lens:po', [0, 3], 5);
    expect(api.patchLearningAttempt).toHaveBeenCalledWith('s7:adf@1:1:lens:po', {
      rubric_coverage: { 0: true, 1: false, 2: false, 3: true, 4: false },
    }, 7);
  });

  it('gives the same question the same attempt id every time, so the server sees a second answer', () => {
    expect(scenarioAttemptUid(KEY, 'c0')).toBe(scenarioAttemptUid({ ...KEY }, 'c0'));
    expect(scenarioAttemptUid(KEY, 'c0')).not.toBe(scenarioAttemptUid({ ...KEY, version: 2 }, 'c0'));
    expect(scenarioAttemptUid(KEY, 'c0')).not.toBe(scenarioAttemptUid({ ...KEY, subjectId: 8 }, 'c0'));
  });

  it('keeps an attempt id within the server\'s 64 characters however long the pack id is', () => {
    const long = { ...KEY, packId: 'p'.repeat(50), scenarioId: 'scenario-with-a-long-id' };
    const uid = scenarioAttemptUid(long, 'lens:em');
    expect(uid.length).toBeLessThanOrEqual(64);
    expect(uid.length).toBeGreaterThanOrEqual(8);
    expect(uid).toBe(scenarioAttemptUid({ ...long }, 'lens:em'));
  });

  it('names the saved Say-it question by pack, version, scenario and role', () => {
    expect(sayItSourceRef('adf', 1, '1', 'po')).toBe('adf@1/scenario/1/lens/po');
  });

  it('steps past an orphaned attempt of a deleted preparation whose subject id is reused', async () => {
    // SQLite reuses the highest id after a delete; the old attempts stay, subject NULL, and the
    // server refuses to open one for this preparation (409, with none of that attempt in it).
    vi.mocked(api.startLearningAttempt).mockImplementation(async (b) => {
      if (b.attempt_uid === 's7:adf@1:1:c0') throw { response: { status: 409, data: { detail: 'taken' } } };
      return wire({ ...b, prediction: null });
    });
    vi.mocked(api.patchLearningAttempt).mockResolvedValue(wire({}));

    await answerCheck(KEY, 'incremental', 0, 1, true);

    expect(vi.mocked(api.startLearningAttempt).mock.calls.map(([b]) => b.attempt_uid)).toEqual(['s7:adf@1:1:c0', 's7:adf@1:1:c0~1']);
    expect(api.patchLearningAttempt).toHaveBeenCalledWith('s7:adf@1:1:c0~1', expect.objectContaining({ prediction: '1' }), 7);
  });

  it('does not step past a failure that is not a taken id', async () => {
    vi.mocked(api.startLearningAttempt).mockRejectedValue({ response: { status: 500, data: { detail: 'down' } } });
    await expect(answerCheck(KEY, 'incremental', 0, 1, true)).rejects.toMatchObject({ response: { status: 500 } });
    expect(api.startLearningAttempt).toHaveBeenCalledTimes(1);
    expect(api.patchLearningAttempt).not.toHaveBeenCalled();
  });

  it('keeps the real attempt id of each lens in its progress, for the saves after the debrief', () => {
    const progress = scenarioProgress([wire({
      attempt_uid: 's7:adf@1:1:lens:po~1', challenge_id: 'adf/1/lens/po', scenario_fingerprint: 'pack_version=1;lens=po',
      prediction: CASE_NOTES_COMMITTED, committed_at: 't', completed_at: 't',
    })], 'adf', 1, S1);
    expect(progress.lenses.po?.attemptUid).toBe('s7:adf@1:1:lens:po~1');
  });
});

describe('the lock: your first answer to a check stands', () => {
  it('passes on the server\'s refusal of a second, different answer instead of hiding it', async () => {
    const refusal = Object.assign(new Error('Request failed with status code 409'), {
      response: { status: 409, data: { detail: 'This attempt already has a committed prediction.' } },
    });
    vi.mocked(api.patchLearningAttempt)
      .mockResolvedValueOnce(wire({ prediction: '1', committed_at: '2026-09-27T10:00:05' }))
      .mockRejectedValueOnce(refusal);

    await answerCheck(KEY, 'incremental', 0, 1, true);
    await expect(answerCheck(KEY, 'incremental', 0, 2, false)).rejects.toBe(refusal);

    // Both went to the same attempt: the second was a change of answer, not a new attempt.
    const uids = vi.mocked(api.patchLearningAttempt).mock.calls.map(([uid]) => uid);
    expect(uids).toEqual(['s7:adf@1:1:c0', 's7:adf@1:1:c0']);
  });

  it('reads the locked answer back from the committed prediction', () => {
    const progress = scenarioProgress([
      wire({ challenge_id: 'adf/1/check/0', scenario_fingerprint: 'pack_version=1', prediction: '1', committed_at: 't' }),
      wire({ challenge_id: 'adf/1/check/1', scenario_fingerprint: 'pack_version=1', prediction: null, committed_at: null }),
      // Another version's answer is not this version's.
      wire({ challenge_id: 'adf/1/check/2', scenario_fingerprint: 'pack_version=2', prediction: '0', committed_at: 't' }),
      // Another scenario's.
      wire({ challenge_id: 'adf/10/check/3', scenario_fingerprint: 'pack_version=1', prediction: '0', committed_at: 't' }),
    ], 'adf', 1, S1);
    expect(progress.answers).toEqual({ 0: 1 });
  });
});

describe('case notes and the Say-it answer, as one explanation_text', () => {
  const tasks = lensTasks(C1, 'po');
  const question = C1.lenses.po.sayIt.question;

  it('writes each note under its question and reads them back', () => {
    const notes = { 0: 'The bookmark moved on completion.', 1: 'Nothing compared counts.\nAnd the logs expired.', 2: 'Ask about the exit.', 3: 'Count check fails the run.' };
    const text = serializeLensText(tasks, notes);
    expect(text.startsWith(`a) ${tasks[0]}\nThe bookmark moved on completion.`)).toBe(true);
    expect(parseLensText(tasks, question, text)).toEqual({ notes, sayIt: '' });

    const withSay = serializeLensText(tasks, notes, { question, answer: 'Watermark on success.' });
    expect(withSay.endsWith(`Say it: ${question}\nWatermark on success.`)).toBe(true);
    expect(parseLensText(tasks, question, withSay)).toEqual({ notes, sayIt: 'Watermark on success.' });
  });

  it('keeps a note that mentions another question\'s wording, as long as it isn\'t that heading line', () => {
    const notes = { 0: `b) is next`, 1: 'second', 2: 'third', 3: 'fourth' };
    expect(parseLensText(tasks, question, serializeLensText(tasks, notes)).notes).toEqual(notes);
  });

  it('fits the server\'s 4000 characters for every role of every written scenario at the field caps', () => {
    for (const s of WRITTEN) {
      const content = s.content as ScenarioContent;
      for (const r of ROLES) {
        const t = lensTasks(content, r.id);
        const full = serializeLensText(
          t,
          Object.fromEntries(t.map((_, i) => [i, 'x'.repeat(NOTE_MAX)])),
          { question: content.lenses[r.id].sayIt.question, answer: 'y'.repeat(SAY_IT_MAX) },
        );
        expect(full.length, `scenario ${s.id} as ${r.id}`).toBeLessThanOrEqual(EXPLANATION_MAX);
      }
    }
  });
});

describe('status', () => {
  const lens = (role: string, over: Partial<WireLearningAttempt> = {}) => wire({
    challenge_id: `adf/1/lens/${role}`, scenario_fingerprint: `pack_version=1;lens=${role}`,
    prediction: CASE_NOTES_COMMITTED, committed_at: '2026-09-27T10:10:00', completed_at: '2026-09-27T10:10:00', ...over,
  });
  const q = (role: 'po' | 'dm') => C1.lenses[role].sayIt.question;

  it('is planned without content, then not started, in progress and practised', () => {
    expect(scenarioStatus(false, { answers: {}, lenses: {} })).toBe('planned');
    expect(scenarioStatus(true, { answers: {}, lenses: {} })).toBe('not-started');
    expect(scenarioStatus(true, scenarioProgress([
      wire({ challenge_id: 'adf/1/check/0', scenario_fingerprint: 'pack_version=1', prediction: '1', committed_at: 't' }),
    ], 'adf', 1, S1))).toBe('in-progress');

    const debriefOnly = scenarioProgress([lens('po', { explanation_text: serializeLensText(lensTasks(C1, 'po'), { 0: 'n' }) })], 'adf', 1, S1);
    expect(scenarioStatus(true, debriefOnly)).toBe('in-progress');

    const said = scenarioProgress([lens('po', {
      explanation_text: serializeLensText(lensTasks(C1, 'po'), { 0: 'n' }, { question: q('po'), answer: 'My answer.' }),
      rubric_coverage: { 0: true, 1: false, 2: true },
    })], 'adf', 1, S1);
    expect(scenarioStatus(true, said)).toBe('practised');
    expect(said.lenses.po?.pointsCovered).toEqual([0, 2]);
  });

  it('opens on the role last practised here', () => {
    const progress = scenarioProgress([
      lens('po', { completed_at: '2026-09-27T10:10:00' }),
      lens('dm', { completed_at: '2026-09-27T11:10:00' }),
    ], 'adf', 1, S1);
    expect(lastRole(progress)).toBe('dm');
    expect(lastRole({ answers: {}, lenses: {} })).toBe('po');
  });
});
