// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
import type { ContentPackDetail, ScenarioRole } from '../../types/contentPack';
import adfPack from '../../../../backend/app/content/packs/adf/v1.json';
import adlsPack from '../../../../backend/app/content/packs/adls/v1.json';
import {
  DIAGNOSTIC_LENGTH, MIN_RELEVANCE, NOT_KEYWORDS, guessLens, packQuestions, packVersionsOf, pickQuestions,
  questionByRef, relevance, requirementsFor,
} from './diagnostic';

// The shipped packs, the files the server serves.
const ADF = adfPack as unknown as ContentPackDetail;
const ADLS = adlsPack as unknown as ContentPackDetail;
const ALL = [ADF, ADLS];
const LENSES: ScenarioRole[] = ['po', 'pm', 'dm', 'em'];
const id = (ref: string) => ref.split('/').slice(-1)[0];

describe('pickQuestions (ported from the prototype)', () => {
  it('asks ten different questions, even when no requirement matches', () => {
    const qs = pickQuestions('po', [], [ADF], ALL);
    expect(qs).toHaveLength(DIAGNOSTIC_LENGTH);
    expect(new Set(qs.map((q) => q.ref)).size).toBe(DIAGNOSTIC_LENGTH);
  });

  it('puts the questions for the job\'s requirements first, mandatory ones ahead', () => {
    const qs = pickQuestions('pm', [
      { text: 'Experience with FinOps and cloud cost management', kind: 'preferred' },
      { text: 'Data reconciliation and validation for migrations', kind: 'mandatory' },
    ], [ADF], ALL);
    expect(qs[0].ref).toBe('adf@1/diagnostic/reconciliation');
    expect(qs[0].fits).toBe(true);
    expect(qs.find((q) => q.ref === 'adf@1/diagnostic/cost')?.fits).toBe(true);
  });

  it('asks about recovery and tuning when the job does, pointing at the right chapters', () => {
    const qs = pickQuestions('dm', [
      { text: 'Incident management and recovery for production data pipelines', kind: 'mandatory' },
      { text: 'Performance tuning of batch loads', kind: 'mandatory' },
    ], [ADF], ALL);
    expect(qs.slice(0, 2).map((q) => id(q.ref)).sort()).toEqual(['fine-tuning', 'recovery']);
    expect(questionByRef('adf@1/diagnostic/recovery', ALL)!.learn).toEqual({
      to: '/learn/guides/adf/recovery', label: 'Azure Data Factory guide, chapter 13',
    });
    expect(questionByRef('adf@1/diagnostic/fine-tuning', ALL)!.learn.label).toBe('Azure Data Factory guide, chapter 17');
  });

  it('uses the chosen role\'s version of the scenarios\' questions', () => {
    expect(questionByRef('adf@1/scenario/1/lens/po', ALL)!.question)
      .not.toBe(questionByRef('adf@1/scenario/1/lens/dm', ALL)!.question);
  });
});

describe('pickQuestions: linked skills, the threshold and the core set', () => {
  it('with no linked skill, asks ten core questions, all labelled core', () => {
    const qs = pickQuestions('po', [{ text: 'Data reconciliation and validation for migrations', kind: 'mandatory' }], [], ALL);
    expect(qs).toHaveLength(DIAGNOSTIC_LENGTH);
    expect(qs.every((q) => !q.fits)).toBe(true);
    // The core set is each pack's diagnostic questions, in order, before its scenarios.
    expect(qs.map((q) => id(q.ref)).slice(0, 3)).toEqual(['reconciliation', 'sensitive-data', 'cdc']);
  });

  it('draws fitting questions only from the linked skills\' packs', () => {
    const reqs = [{ text: 'Data lake access control and RBAC for vendors', kind: 'mandatory' as const }];
    const adfOnly = pickQuestions('po', reqs, [ADF], ALL);
    expect(adfOnly.find((q) => q.ref === 'adls@1/diagnostic/lake-access')?.fits ?? false).toBe(false);
    const withAdls = pickQuestions('po', reqs, [ADF, ADLS], ALL);
    expect(withAdls[0]).toMatchObject({ ref: 'adls@1/diagnostic/lake-access', fits: true });
  });

  it('respects the minimum relevance: one keyword in a preferred requirement is a core topic', () => {
    const reqs = [{ text: 'Cost awareness', kind: 'preferred' as const }];
    const cost = packQuestions(ADF, 'po').find((q) => id(q.ref) === 'cost')!;
    expect(relevance(cost, reqs)).toBeLessThan(MIN_RELEVANCE);
    expect(pickQuestions('po', reqs, [ADF], ALL).every((q) => !q.fits)).toBe(true);
    // The same word in a mandatory requirement is enough.
    expect(pickQuestions('po', [{ text: 'Cost awareness', kind: 'mandatory' }], [ADF], ALL)[0])
      .toMatchObject({ ref: 'adf@1/diagnostic/cost', fits: true });
  });

  it('says how many fit, so the intro can state the real count', () => {
    const qs = pickQuestions('pm', [
      { text: 'Data reconciliation and validation for migrations', kind: 'mandatory' },
      { text: 'Power BI', kind: 'preferred' },
    ], [ADF], ALL);
    const fit = qs.filter((q) => q.fits).length;
    expect(fit).toBeGreaterThan(0);
    expect(fit).toBeLessThan(DIAGNOSTIC_LENGTH);
    expect(qs.slice(0, fit).every((q) => q.fits)).toBe(true);
    expect(qs.slice(fit).every((q) => !q.fits)).toBe(true);
  });
});

describe('the question bank', () => {
  it('never uses "pipeline" or "load" as a keyword, in any pack or scenario', () => {
    for (const lens of LENSES) {
      for (const q of ALL.flatMap((p) => packQuestions(p, lens))) {
        expect(q.keywords.filter((k) => NOT_KEYWORDS.has(k)), q.ref).toEqual([]);
      }
    }
    // So a job that says only "pipelines" and "loads" fits nothing.
    expect(pickQuestions('po', [{ text: 'Build pipelines and loads', kind: 'mandatory' }], [ADF], ALL).every((q) => !q.fits)).toBe(true);
  });

  it('gives every question, in every role, key points and somewhere to study it', () => {
    for (const lens of LENSES) {
      for (const q of ALL.flatMap((p) => packQuestions(p, lens))) {
        expect(q.points.length).toBeGreaterThanOrEqual(4);
        expect(q.learn.to).toMatch(/^\/(learn\/guides|scenarios)\//);
      }
    }
  });

  it('has enough questions to always fill ten', () => {
    expect(ALL.flatMap((p) => packQuestions(p, 'po')).length).toBeGreaterThanOrEqual(DIAGNOSTIC_LENGTH);
  });

  it('matches a requirement to a question by shared words', () => {
    const q = questionByRef('adf@1/diagnostic/sensitive-data', ALL)!;
    expect(requirementsFor(q, [{ text: 'Knowledge of PII handling in BFSI', kind: 'mandatory' }, { text: 'Power BI', kind: 'preferred' }]))
      .toEqual([{ text: 'Knowledge of PII handling in BFSI', kind: 'mandatory' }]);
  });

  it('finds the pack versions a set of refs needs', () => {
    expect(packVersionsOf(['adf@1/diagnostic/cost', 'adf@1/scenario/1/lens/po', 'adls@1/diagnostic/lake-access']))
      .toEqual([{ packId: 'adf', version: 1 }, { packId: 'adls', version: 1 }]);
    expect(questionByRef('adf@9/diagnostic/cost', ALL)).toBeNull();
  });
});

describe('guessLens', () => {
  it('reads the role from the job title', () => {
    expect(guessLens('Senior Product Owner, Data Platform', '')).toBe('po');
    expect(guessLens('Product Manager, Lakehouse', '')).toBe('pm');
    expect(guessLens('Delivery Manager', '')).toBe('dm');
    expect(guessLens('Cloud Engineering Manager', '')).toBe('em');
  });

  it('falls back to Product Owner when the title says nothing', () => {
    expect(guessLens('Data role', '')).toBe('po');
  });
});
