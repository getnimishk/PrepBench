// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import {
  Activity, BarChart3, BookOpen, FileCheck2, FlaskConical, History, LayoutDashboard, Layers, Library,
  Map as RouteMap, Mic, Mic2, Network, PlayCircle, ScrollText, Settings,
} from 'lucide-react';

/**
 * The navigation, defined once.
 *
 * The sidebar draws these groups, and the header names the section you are in
 * from the same table, so the two cannot disagree about where a screen belongs.
 *
 * The groups, labels and order are the unified prototype's rail, all fourteen
 * destinations of it. Roadmaps was left out of an earlier version of this list,
 * which made a finished area reachable only by knowing to go through Learn.
 */

export type NavKey =
  | 'home' | 'roadmaps' | 'learn' | 'practice' | 'review' | 'exam' | 'bank'
  | 'interview' | 'system-design' | 'design-reviews' | 'recordings'
  | 'insights' | 'preparations' | 'settings'
  // Learning Lab: the hub and each sandbox as it goes live.
  | 'lab' | 'agile-sandbox';

export interface NavEntry {
  key: NavKey;
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
}

export const NAV_GROUPS: { heading: string; items: NavEntry[] }[] = [
  {
    heading: 'Today',
    items: [{ key: 'home', label: 'Home', path: '/', icon: LayoutDashboard }],
  },
  {
    heading: 'Certification',
    items: [
      { key: 'roadmaps', label: 'Roadmaps', path: '/roadmaps', icon: RouteMap },
      { key: 'learn', label: 'Study Library', path: '/learn', icon: BookOpen },
      { key: 'practice', label: 'Practice', path: '/practice', icon: PlayCircle },
      { key: 'review', label: 'Review Queue', path: '/review', icon: History },
      { key: 'exam', label: 'Mock Exam', path: '/exam-setup', icon: FileCheck2 },
      { key: 'bank', label: 'Question Bank', path: '/question-bank', icon: Library },
    ],
  },
  {
    heading: 'Interview',
    items: [
      { key: 'interview', label: 'Rounds', path: '/interview-practice', icon: Mic },
      { key: 'system-design', label: 'System Design', path: '/system-design', icon: Network },
      { key: 'design-reviews', label: 'Design Reviews', path: '/design-reviews', icon: ScrollText },
      { key: 'recordings', label: 'Recordings', path: '/recordings', icon: Mic2 },
    ],
  },
  {
    heading: 'Evidence',
    items: [{ key: 'insights', label: 'Insights', path: '/analytics', icon: BarChart3 }],
  },
  {
    heading: 'Workspace',
    items: [
      { key: 'preparations', label: 'My Preparations', path: '/preparations', icon: Layers },
      { key: 'settings', label: 'Settings', path: '/settings', icon: Settings },
    ],
  },
  {
    // The Learning Lab is a family of simulation sandboxes that share one
    // learning contract: predict → manipulate → observe → explain. Each sandbox
    // teaches a different domain of professional metrics. The hub page
    // introduces the family and lets the learner choose their domain. Live
    // sandboxes have their own entries here; upcoming ones appear on the hub page.
    // The nav group is placed after Workspace so it reads as an extension of
    // the app rather than a fifth preparation tool.
    heading: 'Learning Lab',
    items: [
      { key: 'lab',           label: 'All Sandboxes',         path: '/lab',           icon: FlaskConical },
      { key: 'agile-sandbox', label: 'Agile Metrics',         path: '/chart-sandbox', icon: Activity },
    ],
  },
];

const NAV_BY_KEY = Object.fromEntries(
  NAV_GROUPS.flatMap((group) => group.items).map((item) => [item.key, item]),
) as Record<NavKey, NavEntry>;

// Which rail entry a screen belongs to, first match wins. Where a screen is
// reached from more than one place, it belongs where its work is: the spaced
// review runner is review, whichever button opened it.
//
// The Learning Lab rules come before the generic catch-alls. Each sandbox
// path (/chart-sandbox, and future /databricks-sandbox, /financial-sandbox)
// maps to its own sandbox key so the sidebar highlights the correct item.
// The hub (/lab) highlights the 'lab' entry — the parent of the group.
const SECTION_RULES: [RegExp, NavKey][] = [
  [/^\/(dashboard)?$/, 'home'],
  [/^\/roadmaps\/[^/]+\/topics\/[^/]+\/(guide|demonstrate)(\/|$)/, 'learn'],
  [/^\/roadmaps(\/|$)/, 'roadmaps'],
  [/^\/learn(\/|$)/, 'learn'],
  // Learning Lab: hub and each sandbox.
  [/^\/lab(\/|$)/, 'lab'],
  [/^\/chart-sandbox(\/|$)/, 'agile-sandbox'],
  [/^\/practice\/spaced(\/|$)/, 'review'],
  [/^\/practice(\/|$)/, 'practice'],
  [/^\/review(\/|$)/, 'review'],
  [/^\/(exam-setup|exam-review|exam)(\/|$)/, 'exam'],
  [/^\/question-bank(\/|$)/, 'bank'],
  [/^\/interview-practice(\/|$)/, 'interview'],
  [/^\/recordings(\/|$)/, 'recordings'],
  [/^\/system-design(\/|$)/, 'system-design'],
  [/^\/design-reviews(\/|$)/, 'design-reviews'],
  [/^\/analytics(\/|$)/, 'insights'],
  [/^\/(preparations|subjects)(\/|$)/, 'preparations'],
  [/^\/settings(\/|$)/, 'settings'],
];

// Screens that belong to no rail entry, named for the header.
const OTHER_SCREENS: [RegExp, string][] = [
  [/^\/search(\/|$)/, 'Search'],
  [/^\/profile(\/|$)/, 'Profile'],
  [/^\/notifications(\/|$)/, 'Notifications'],
  [/^\/onboarding(\/|$)/, 'Getting started'],
];

export interface Section {
  /** The rail entry to highlight, or null for a screen outside the rail. */
  key: NavKey | null;
  /** What the header calls the section, or null for an address nothing answers. */
  title: string | null;
}

export function sectionFor(pathname: string): Section {
  const rule = SECTION_RULES.find(([pattern]) => pattern.test(pathname));
  if (rule) return { key: rule[1], title: NAV_BY_KEY[rule[1]].label };
  const other = OTHER_SCREENS.find(([pattern]) => pattern.test(pathname));
  return { key: null, title: other ? other[1] : null };
}
