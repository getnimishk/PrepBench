// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
import { parseJobDescription, suggestLink } from './jdParse';

// Ported from the prototype's jdParse.test.ts (parser cases unchanged).
describe('parseJobDescription', () => {
  it('reads bullets under mandatory and preferred headings, emoji and bold removed', () => {
    const jd = [
      'We are looking for an experienced Product Owner.',
      '🔑 Mandatory Skills',
      '✅ Strong **Product Owner** experience',
      '✅ Hands-on experience with **Databricks**',
      '⭐ Preferred Technical Exposure',
      '• Azure Data Factory (ADF)',
      '• Power BI',
    ].join('\n');
    expect(parseJobDescription(jd)).toEqual([
      { text: 'Strong Product Owner experience', kind: 'mandatory' },
      { text: 'Hands-on experience with Databricks', kind: 'mandatory' },
      { text: 'Azure Data Factory (ADF)', kind: 'preferred' },
      { text: 'Power BI', kind: 'preferred' },
    ]);
  });

  it('treats bullets before any heading as mandatory and skips repeats', () => {
    expect(parseJobDescription('- SQL\n- sql\n* Agile')).toEqual([
      { text: 'SQL', kind: 'mandatory' },
      { text: 'Agile', kind: 'mandatory' },
    ]);
  });

  it('does not let a long prose line that mentions "preferred" change the section', () => {
    const jd = 'Candidates with a preferred start date within 30 days of the offer will be considered first.\n- SQL';
    expect(parseJobDescription(jd)).toEqual([{ text: 'SQL', kind: 'mandatory' }]);
  });

  it('reads numbered section headings as headings, not requirements', () => {
    const jd = '1. Required qualifications\n- SQL\n2. Preferred qualifications\n- Power BI';
    expect(parseJobDescription(jd)).toEqual([
      { text: 'SQL', kind: 'mandatory' },
      { text: 'Power BI', kind: 'preferred' },
    ]);
  });

  it('keeps a plain numbered list as requirements, even when an item says "skills"', () => {
    expect(parseJobDescription('1. Strong SQL skills\n2. Stakeholder management')).toEqual([
      { text: 'Strong SQL skills', kind: 'mandatory' },
      { text: 'Stakeholder management', kind: 'mandatory' },
    ]);
  });

  it('reads Windows line endings the same way', () => {
    expect(parseJobDescription('Preferred\r\n- Power BI\r\n')).toEqual([{ text: 'Power BI', kind: 'preferred' }]);
  });

  it('finds nothing in text without bullets', () => {
    expect(parseJobDescription('A paragraph with no list at all.')).toEqual([]);
  });
});

describe('suggestLink', () => {
  const skills = [
    { id: 1, name: 'Databricks Data Platform', content_packs: [] },
    { id: 2, name: 'My ADF prep', content_packs: [{ pack_id: 'adf', title: 'Azure Data Factory' }] },
    { id: 3, name: 'Lake storage', content_packs: [{ pack_id: 'adls', title: 'ADLS Gen2' }] },
    { id: 4, name: 'System Design', content_packs: [] },
  ];

  it('suggests the Skill whose name, guide title or guide id the requirement names', () => {
    expect(suggestLink('Hands-on Databricks Data Platform work', skills)?.id).toBe(1);
    expect(suggestLink('Azure Data Factory pipelines', skills)?.id).toBe(2);
    expect(suggestLink('Experience with ADF', skills)?.id).toBe(2);
    expect(suggestLink('ADLS access control', skills)?.id).toBe(3);
  });

  it('never links on a shared common word', () => {
    expect(suggestLink('Data quality', skills)).toBeNull();
    expect(suggestLink('Data flows, data integration and system integrations', skills)).toBeNull();
    expect(suggestLink('Power BI', skills)).toBeNull();
  });

  it('matches whole words only: "adf" inside another word is not ADF', () => {
    expect(suggestLink('Handfuls of dashboards', skills)).toBeNull();
  });

  it('leaves the choice to the learner when two Skills are named', () => {
    expect(suggestLink('Azure Data Factory (ADF), ADLS, Delta Lake', skills)).toBeNull();
  });
});
