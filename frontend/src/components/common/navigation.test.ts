// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
import { NAV_GROUPS, sectionFor } from './navigation';

describe('the navigation table', () => {
  it("is the prototype's rail: six groups, sixteen destinations, in its order", () => {
    expect(NAV_GROUPS.map((g) => [g.heading, g.items.map((i) => i.label)])).toEqual([
      ['Today', ['Home']],
      ['Certification', ['Roadmaps', 'Study Library', 'Practice', 'Review Queue', 'Mock Exam', 'Question Bank']],
      ['Interview', ['Rounds', 'System Design', 'Design Reviews', 'Recordings']],
      ['Evidence', ['Insights']],
      ['Workspace', ['My Preparations', 'Settings']],
      ['Learning Lab', ['All Sandboxes', 'Agile Metrics']],
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
