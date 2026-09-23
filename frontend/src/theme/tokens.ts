// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

/**
 * The prototype's design tokens, as its stylesheet declares them.
 *
 * PrepBench_Unified_Prototype.html is the UI contract, and these are the values
 * behind every surface, line and colour in it: `:root` for light and
 * `html[data-theme="dark"]` for dark. They are copied rather than approximated
 * so that a screen built from them can be held against the prototype side by
 * side and not differ in shade.
 */
export interface Tokens {
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  muted: string;
  faint: string;
  line: string;
  accent: string;
  accentSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  nav: string;
  shadow: string;
  track: string;
  track2: string;
  chip: string;
  chipText: string;
  rule: string;
  dash: string;
  noteLine: string;
  goodLine: string;
}

export const TOKENS: Record<'light' | 'dark', Tokens> = {
  light: {
    bg: '#f6f6f3', surface: '#ffffff', surface2: '#fafaf8', text: '#171817', muted: '#5f625c', faint: '#6a6d67',
    line: '#dedfd9', accent: '#3157d5', accentSoft: '#edf1ff', success: '#2e7650', successSoft: '#edf7f1',
    warning: '#946319', warningSoft: '#fff5e5', danger: '#b54040', dangerSoft: '#fff0ef',
    nav: '#fbfbf9', shadow: '0 12px 30px rgba(20,20,20,.09)',
    track: '#e7e8e2', track2: '#c7cddc', chip: '#efefeb', chipText: '#5f625c',
    rule: '#bfc2ba', dash: '#c7c9c1', noteLine: '#ead8b5', goodLine: '#cbe4d4',
  },
  dark: {
    bg: '#111310', surface: '#191c18', surface2: '#151815', text: '#f2f3ee', muted: '#aeb3aa', faint: '#82887f',
    line: '#2b302b', accent: '#8ea6ff', accentSoft: '#202a49', success: '#7fd3a0', successSoft: '#163122',
    warning: '#e9bb72', warningSoft: '#382b17', danger: '#ff9292', dangerSoft: '#351919',
    nav: '#141714', shadow: '0 18px 45px rgba(0,0,0,.3)',
    track: '#2b302b', track2: '#3a4152', chip: '#242821', chipText: '#aeb3aa',
    rule: '#3a403a', dash: '#3a403a', noteLine: '#5a4726', goodLine: '#2a4d38',
  },
};

/** The prototype's type stack: Inter, then the platform's own sans. */
export const FONT_STACK =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

/** The prototype's monospace stack, for code, keys and table references. */
export const MONO_STACK = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/**
 * The prototype's two layout breakpoints. Below 1080px the rail keeps only its
 * icons; below 760px grids fall to one column and the page title shrinks.
 */
export const RAIL_QUERY = '@media (max-width:1080px)';
export const NARROW_QUERY = '@media (max-width:768px)';
