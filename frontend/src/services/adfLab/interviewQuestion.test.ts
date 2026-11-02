// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
import { ADF_LAB } from './lab';
import { KAFKA_LAB } from '../kafkaLab/lab';
import { DATABRICKS_LAB, DATABRICKS_LAB_EXPERIMENTS } from '../databricksLab/lab';
import { observationOf, changesFrom } from './definition';
import { JOBS } from '../databricksLab/jobs';
import { labRunSourceRef, runQuestionText, runTalkingPoints } from './interviewQuestion';

describe('interview questions from a lab run', () => {
  it('name their source by lab and track, under lab/, one per experiment and mode', () => {
    expect(labRunSourceRef(DATABRICKS_LAB, 'governance.drop')).toBe('lab/databricks/experiment/governance.drop');
    expect(labRunSourceRef(KAFKA_LAB, 'log')).toBe('lab/kafka/experiment/log');
    expect(labRunSourceRef(ADF_LAB, 'watermark')).toBe('lab/adf/experiment/watermark');
  });

  it('take their talking points only from what the run recorded', () => {
    const preset = JOBS.run(null, JOBS.preset);
    const mineLevers = { ...JOBS.preset, write: 'merge' };
    const mine = JOBS.run(null, mineLevers);
    const points = runTalkingPoints(changesFrom(JOBS.preset, mineLevers), observationOf(preset, mine));
    expect(points[0]).toBe('I changed write from append to merge.');
    expect(points).toContain('Duplicate rows: 5000 in the scenario, 0 in my run.');
    expect(points).toContain('What happens: duplicated in the scenario, exact in my run.');
    // Every point names a recorded lever or measure; nothing else is added.
    expect(points).toHaveLength(1 + Object.keys(preset.measures).length);
  });

  it('offer nothing when nothing was recorded', () => {
    expect(runTalkingPoints(null, null)).toEqual([]);
    expect(runTalkingPoints({}, { source: 'simulation' })).toEqual([]);
  });

  it('ask about the learner’s own run, naming the lab and the mode', () => {
    const governance = DATABRICKS_LAB_EXPERIMENTS.find((e) => e.slug === 'governance')!;
    expect(runQuestionText(DATABRICKS_LAB, governance, 'What a drop does to the files'))
      .toBe('In the Databricks Lab (Privileges and dropped tables: What a drop does to the files), what did you change, '
        + 'what did you observe, and what would you do on a real project because of it?');
  });
});
