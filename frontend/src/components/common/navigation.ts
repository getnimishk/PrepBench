// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import {
  Activity, BarChart3, BookOpen, Database, FileCheck2, FlaskConical, FolderOpen, History, LayoutDashboard, Layers,
  Library, Map as RouteMap, Mic, Mic2, Network, PlayCircle, ScrollText, Settings, ShieldCheck, Workflow,
} from 'lucide-react';
import type { SubjectCapabilityProfile } from '../../types/capabilities';

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
  | 'evidence' | 'insights' | 'workspace' | 'preparations' | 'settings'
  // Learning Lab: the hub and each sandbox as it goes live.
  | 'lab' | 'agile-sandbox' | 'scenarios' | 'databricks-sandbox';

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
    items: [
      { key: 'evidence', label: 'Evidence', path: '/evidence', icon: ShieldCheck },
      { key: 'insights', label: 'Insights', path: '/analytics', icon: BarChart3 },
    ],
  },
  {
    heading: 'Workspace',
    items: [
      { key: 'workspace', label: 'Workspace', path: '/workspace', icon: FolderOpen },
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
      { key: 'scenarios',     label: 'Scenarios',             path: '/scenarios',     icon: Workflow },
      { key: 'databricks-sandbox', label: 'Lakehouse Lab',    path: '/databricks-sandbox', icon: Database },
    ],
  },
];

const NAV_BY_KEY = Object.fromEntries(
  NAV_GROUPS.flatMap((group) => group.items).map((item) => [item.key, item]),
) as Record<NavKey, NavEntry>;

/**
 * Evaluates whether a navigation item is supported given the active subject
 * and its capability profile. Unsupported items render in a disabled state
 * with an explanatory tooltip rather than silently disappearing or navigating.
 *
 * Curriculum entries are decided by capability, not subject id (Phase 7, WP 7.10):
 * a learner-created preparation with the same content gets the same entries as a
 * seeded one. Agile Metrics keeps its original, Scrum-specific scope.
 */
export function isNavKeySupported(
  key: NavKey,
  capabilities?: SubjectCapabilityProfile,
  subject?: { id?: number; name?: string } | null,
): boolean {
  if (!capabilities) return true;
  switch (key) {
    case 'home':
    case 'settings':
      return true;
    case 'roadmaps':
      // Always reachable: the Roadmaps screen is where a preparation's roadmap is
      // created, imported or linked. `capabilities.roadmap` says whether one is
      // linked now, and governs what is claimed elsewhere -- not whether the screen opens.
      return true;
    case 'learn':
      // The Study Library holds a preparation's guides, its roadmap's progress, its
      // scenarios and -- for a certification -- its practice. Open when any of them
      // applies; `roadmap` is the live link now (Phase 7), so it is not the only door.
      return Boolean(capabilities.studyGuide || capabilities.roadmap || capabilities.scenarios || capabilities.certification);
    case 'practice':
    case 'review':
    case 'exam':
    case 'bank':
      return Boolean(capabilities.certification);
    case 'interview':
    case 'recordings':
      return Boolean(capabilities.interview);
    case 'system-design':
    case 'design-reviews':
      return Boolean(capabilities.interview);
    case 'evidence':
    case 'insights':
      return Boolean(capabilities.evidence);
    case 'workspace':
      return Boolean(capabilities.workspace);
    case 'preparations':
      return Boolean(capabilities.workspace);
    case 'lab':
      return capabilities.learningLabStatus === 'AVAILABLE';
    case 'agile-sandbox':
      // Unchanged by Phase 7: Agile Metrics is for Scrum (PSM I), or a preparation
      // whose Learning Lab is available.
      return subject?.id === 1 || capabilities.learningLabStatus === 'AVAILABLE';
    case 'scenarios':
      return Boolean(capabilities.scenarios);
    case 'databricks-sandbox':
      return Boolean(capabilities.lakehouseLab);
    default:
      return true;
  }
}

// Which rail entry a screen belongs to, first match wins. Where a screen is
// reached from more than one place, it belongs where its work is: the spaced
// review runner is review, whichever button opened it.
//
// The Learning Lab rules come before the generic catch-alls. Each sandbox
// path (/chart-sandbox, /scenarios, /databricks-sandbox, and future /financial-sandbox)
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
  [/^\/scenarios(\/|$)/, 'scenarios'],
  [/^\/databricks-sandbox(\/|$)/, 'databricks-sandbox'],
  [/^\/practice\/spaced(\/|$)/, 'review'],
  [/^\/practice(\/|$)/, 'practice'],
  [/^\/certification(\/|$)/, 'practice'],
  [/^\/review(\/|$)/, 'review'],
  [/^\/(exam-setup|exam-review|exam)(\/|$)/, 'exam'],
  [/^\/question-bank(\/|$)/, 'bank'],
  [/^\/interview(-practice)?(\/|$)/, 'interview'],
  [/^\/recordings(\/|$)/, 'recordings'],
  [/^\/system-design(\/|$)/, 'system-design'],
  [/^\/design-reviews(\/|$)/, 'design-reviews'],
  [/^\/analytics(\/|$)/, 'insights'],
  [/^\/evidence(\/|$)/, 'evidence'],
  [/^\/workspace(\/|$)/, 'workspace'],
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
