// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

/**
 * Every keyboard shortcut in the product, defined once.
 *
 * The screens bind their keys from these definitions and the Shortcuts settings
 * page lists these same definitions, so the reference cannot describe a key that
 * does nothing, or miss one that does something.
 *
 * `bind` is the KeyboardEvent.key values the handler listens for (letters
 * lowercase, " " as "Space"); `keys` is how the reference shows them.
 */
export interface Shortcut {
  bind: string[];
  keys: string[];
  label: string;
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export const EXAM_SHORTCUTS = {
  chooseAnswer: { bind: DIGITS, keys: ['1', '…', '9'], label: 'Choose an answer, in the order shown' },
  previous: { bind: ['ArrowLeft'], keys: ['←'], label: 'Previous question' },
  next: { bind: ['ArrowRight'], keys: ['→'], label: 'Next question (never submits the paper)' },
  flag: { bind: ['f'], keys: ['F'], label: 'Flag or unflag the question' },
} satisfies Record<string, Shortcut>;

export const SPACED_SHORTCUTS = {
  show: { bind: ['Space'], keys: ['Space'], label: 'Show the answer' },
  again: { bind: ['1'], keys: ['1'], label: 'Grade: again' },
  hard: { bind: ['2'], keys: ['2'], label: 'Grade: hard' },
  good: { bind: ['3'], keys: ['3'], label: 'Grade: good' },
  easy: { bind: ['4'], keys: ['4'], label: 'Grade: easy' },
} satisfies Record<string, Shortcut>;

export const INTERVIEW_SHORTCUTS = {
  answer: { bind: ['Space'], keys: ['Space'], label: 'Start or stop your answer' },
  end: { bind: ['Escape'], keys: ['Esc'], label: 'End the session' },
} satisfies Record<string, Shortcut>;

export const GLOBAL_SHORTCUTS = {
  search: { bind: ['/'], keys: ['/'], label: 'Search everything' },
} satisfies Record<string, Shortcut>;

export const SHORTCUT_GROUPS: { title: string; where: string; items: Shortcut[] }[] = [
  { title: 'Anywhere', where: 'On any screen except a paper or a recorded round', items: Object.values(GLOBAL_SHORTCUTS) },
  { title: 'Exams and practice', where: 'While answering a mock or a drill', items: Object.values(EXAM_SHORTCUTS) },
  { title: 'Spaced repetition', where: 'On a review card', items: Object.values(SPACED_SHORTCUTS) },
  { title: 'Interview sessions', where: 'During a recorded round', items: Object.values(INTERVIEW_SHORTCUTS) },
];

/** The key as the definitions name it. */
export function keyOf(e: KeyboardEvent): string {
  if (e.key === ' ' || e.code === 'Space') return 'Space';
  return e.key.length === 1 ? e.key.toLowerCase() : e.key;
}

/**
 * Whether a key press belongs to something other than a shortcut: typing in a
 * field, or a key a focused control already acts on (Space and Enter on a
 * button or link activate it).
 */
export function belongsElsewhere(e: KeyboardEvent): boolean {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return true;
  const target = e.target as HTMLElement | null;
  if (!target || !target.tagName) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return true;
  const activates = tag === 'BUTTON' || tag === 'A' || target.getAttribute('role') === 'button'
    || target.getAttribute('role') === 'radio' || target.getAttribute('role') === 'checkbox';
  return activates && (keyOf(e) === 'Space' || e.key === 'Enter');
}
