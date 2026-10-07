// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
import { NAV_GROUPS, isNavKeySupported, sectionFor } from './navigation';
import { getSubjectCapabilities, UNASSIGNED_CAPABILITIES } from '../../services/capabilities';

describe('the navigation table', () => {
  it("is the prototype's rail: six groups, seventeen destinations, in its order", () => {
    expect(NAV_GROUPS.map((g) => [g.heading, g.items.map((i) => i.label)])).toEqual([
      ['Today', ['Home']],
      ['Certification', ['Roadmaps', 'Study Library', 'Practice', 'Review Queue', 'Mock Exam', 'Question Bank']],
      ['Interview', ['Rounds', 'System Design', 'Design Reviews', 'Recordings']],
      ['Evidence', ['Insights']],
      ['Workspace', ['My Preparations', 'Settings']],
      ['Learning Lab', ['All Sandboxes', 'Agile Metrics', 'Scenarios', 'Lakehouse Lab']],
    ]);
  });

  it.each([
    ['/', 'home', 'Home'],
    ['/roadmaps', 'roadmaps', 'Roadmaps'],
    ['/roadmaps/3/edit', 'roadmaps', 'Roadmaps'],
    ['/roadmaps/3/topics/7', 'roadmaps', 'Roadmaps'],
    // The prototype files a topic's guide and its demonstration under study.
    ['/roadmaps/3/topics/7/guide', 'learn', 'Study Library'],
    ['/roadmaps/3/topics/7/demonstrate', 'learn', 'Study Library'],
    ['/learn', 'learn', 'Study Library'],
    // Learning Lab: hub and sandboxes each highlight their own nav entry.
    ['/lab', 'lab', 'All Sandboxes'],
    ['/chart-sandbox', 'agile-sandbox', 'Agile Metrics'],
    ['/databricks-sandbox', 'databricks-sandbox', 'Lakehouse Lab'],
    ['/scenarios', 'scenarios', 'Scenarios'],
    ['/scenarios/adf/1', 'scenarios', 'Scenarios'],
    ['/practice', 'practice', 'Practice'],
    // The spaced runner is review work, whichever button opened it.
    ['/practice/spaced', 'review', 'Review Queue'],
    ['/review', 'review', 'Review Queue'],
    ['/exam-setup', 'exam', 'Mock Exam'],
    ['/exam-review/12', 'exam', 'Mock Exam'],
    ['/question-bank', 'bank', 'Question Bank'],
    ['/interview-practice/library', 'interview', 'Rounds'],
    ['/recordings/4', 'recordings', 'Recordings'],
    ['/system-design/attempts/2', 'system-design', 'System Design'],
    ['/design-reviews/9', 'design-reviews', 'Design Reviews'],
    ['/analytics/area', 'insights', 'Insights'],
    ['/subjects/2', 'preparations', 'My Preparations'],
    ['/preparations/new', 'preparations', 'My Preparations'],
    ['/settings/data', 'settings', 'Settings'],
  ])('%s belongs to %s', (path, key, title) => {
    expect(sectionFor(path)).toEqual({ key, title });
  });

  it('names the screens outside the rail without highlighting anything', () => {
    expect(sectionFor('/search')).toEqual({ key: null, title: 'Search' });
    expect(sectionFor('/profile')).toEqual({ key: null, title: 'Profile' });
    expect(sectionFor('/notifications')).toEqual({ key: null, title: 'Notifications' });
    expect(sectionFor('/onboarding')).toEqual({ key: null, title: 'Getting started' });
  });

  it('does not guess a section for an address nothing answers', () => {
    expect(sectionFor('/no-such-page')).toEqual({ key: null, title: null });
    // A prefix is not a match.
    expect(sectionFor('/reviewers')).toEqual({ key: null, title: null });
  });
});

describe('isNavKeySupported', () => {
  it('returns true for home and settings under all contexts', () => {
    expect(isNavKeySupported('home', UNASSIGNED_CAPABILITIES, null)).toBe(true);
    expect(isNavKeySupported('settings', UNASSIGNED_CAPABILITIES, null)).toBe(true);
  });

  it('correctly handles ADF (Skill track with interview, learning lab, scenarios, roadmap, but NOT certification)', () => {
    const adfCaps = getSubjectCapabilities(6);
    const adfSubj = { id: 6, name: 'Azure Data Factory' };

    // Certification features are unsupported for ADF
    expect(isNavKeySupported('practice', adfCaps, adfSubj)).toBe(false);
    expect(isNavKeySupported('review', adfCaps, adfSubj)).toBe(false);
    expect(isNavKeySupported('exam', adfCaps, adfSubj)).toBe(false);
    expect(isNavKeySupported('bank', adfCaps, adfSubj)).toBe(false);

    // Supported capabilities for ADF
    expect(isNavKeySupported('roadmaps', adfCaps, adfSubj)).toBe(true);
    expect(isNavKeySupported('learn', adfCaps, adfSubj)).toBe(true);
    expect(isNavKeySupported('interview', adfCaps, adfSubj)).toBe(true);
    expect(isNavKeySupported('system-design', adfCaps, adfSubj)).toBe(true);
    expect(isNavKeySupported('scenarios', adfCaps, adfSubj)).toBe(true);
    expect(isNavKeySupported('insights', adfCaps, adfSubj)).toBe(true);
    expect(isNavKeySupported('preparations', adfCaps, adfSubj)).toBe(true);

    // The Behaviour Lab is live (all five experiments built), so the lab entry is supported:
    expect(adfCaps.learningLabStatus).toBe('AVAILABLE');
    expect(isNavKeySupported('lab', adfCaps, adfSubj)).toBe(true);
    // ...and it is withheld again whenever the registry is incomplete:
    expect(isNavKeySupported('lab', { ...adfCaps, learningLabStatus: 'INTEGRATION_PENDING' }, adfSubj)).toBe(false);

    // Databricks-specific sandbox is unsupported for ADF
    expect(isNavKeySupported('databricks-sandbox', adfCaps, adfSubj)).toBe(false);
  });

  it('correctly handles Databricks (Lakehouse sandbox, but no exam bank or interview)', () => {
    const dbrCaps = getSubjectCapabilities(2);
    const dbrSubj = { id: 2, name: 'Databricks Lakehouse' };

    expect(isNavKeySupported('databricks-sandbox', dbrCaps, dbrSubj)).toBe(true);
    expect(isNavKeySupported('lab', dbrCaps, dbrSubj)).toBe(true);
    expect(isNavKeySupported('practice', dbrCaps, dbrSubj)).toBe(false);
    expect(isNavKeySupported('interview', dbrCaps, dbrSubj)).toBe(false);
    expect(isNavKeySupported('roadmaps', dbrCaps, dbrSubj)).toBe(false);
  });

  it('correctly handles Kafka CCDAK (Certification, Roadmap, but no interview or lab)', () => {
    const kafkaCaps = getSubjectCapabilities(4);
    const kafkaSubj = { id: 4, name: 'Kafka CCDAK' };

    expect(isNavKeySupported('practice', kafkaCaps, kafkaSubj)).toBe(true);
    expect(isNavKeySupported('exam', kafkaCaps, kafkaSubj)).toBe(true);
    expect(isNavKeySupported('bank', kafkaCaps, kafkaSubj)).toBe(true);
    expect(isNavKeySupported('roadmaps', kafkaCaps, kafkaSubj)).toBe(true);
    expect(isNavKeySupported('interview', kafkaCaps, kafkaSubj)).toBe(false);
    expect(isNavKeySupported('lab', kafkaCaps, kafkaSubj)).toBe(false);
    expect(isNavKeySupported('scenarios', kafkaCaps, kafkaSubj)).toBe(false);
  });

  it('correctly handles PSM I (Certification, Interview, Roadmap, Agile sandbox)', () => {
    const psmCaps = getSubjectCapabilities(1);
    const psmSubj = { id: 1, name: 'PSM I' };

    expect(isNavKeySupported('practice', psmCaps, psmSubj)).toBe(true);
    expect(isNavKeySupported('interview', psmCaps, psmSubj)).toBe(false);
    expect(isNavKeySupported('roadmaps', psmCaps, psmSubj)).toBe(true);
    expect(isNavKeySupported('agile-sandbox', psmCaps, psmSubj)).toBe(true);
    expect(isNavKeySupported('lab', psmCaps, psmSubj)).toBe(false);
    expect(isNavKeySupported('scenarios', psmCaps, psmSubj)).toBe(false);
    expect(isNavKeySupported('databricks-sandbox', psmCaps, psmSubj)).toBe(false);
  });

  it('falls back to true when capabilities is undefined for backward compatibility', () => {
    expect(isNavKeySupported('practice', undefined, null)).toBe(true);
    expect(isNavKeySupported('lab', undefined, null)).toBe(true);
  });
});
