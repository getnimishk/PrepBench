// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { MemoryRouter } from 'react-router-dom';
import { buildTheme } from './theme';
import { LearningLabPage } from '../pages/LearningLabPage';
import { BigFigure } from '../components/ui/primitives';

/**
 * Guard test for Issue 3: Hard-coded font sizes ignore the Large text setting.
 *
 * In PrepBench, the "Large" text setting scales MUI typography from 14px to 16px
 * base font size. Elements that specify hardcoded rem (e.g. '0.625rem') or fixed
 * number (e.g. 10) font sizes do not scale when a user selects Large text.
 * Instead, they must use the theme callback form:
 *   (t) => t.typography.pxToRem(px)
 */

// If a size ever genuinely must not scale, it goes in an explicit allowlist
// array with a comment explaining why. Start with the allowlist empty.
const ALLOWLIST: string[] = [];

describe('font size scaling guard', () => {
  it('ensures no hard-coded rem or fixed number font sizes exist in src/', () => {
    // Read all source files via Vite's raw glob import
    const rawFiles = import.meta.glob<string>('../**/*.{ts,tsx}', {
      query: '?raw',
      import: 'default',
      eager: true,
    });

    // Three spellings of the same mistake:
    //   '0.625rem' / '12px'   a quoted literal
    //   10                    a bare number, which MUI treats as px
    //   `${size / 16}rem`     a template literal -- the one the first two
    //                         missed, which is how BigFigure's number stayed
    //                         at 38px on 17 pages after the first sweep
    const remPattern = /fontSize:\s*['"][0-9.]+(rem|px)['"]/;
    const numPattern = /fontSize:\s*[0-9]+(\.[0-9]+)?([,} ]|$)/;
    const templatePattern = /fontSize:\s*`[^`]*(rem|px)`/;

    const violations: string[] = [];

    for (const [filePath, content] of Object.entries(rawFiles)) {
      if (filePath.includes('.test.')) {
        continue;
      }

      // Normalise path relative to src/
      const cleanPath = filePath.replace(/^\.\.\//, '');
      const lines = content.split('\n');

      lines.forEach((line: string, idx: number) => {
        const lineNum = idx + 1;
        const entry = `${cleanPath}:${lineNum}`;

        if (ALLOWLIST.includes(entry)) {
          return;
        }

        if (remPattern.test(line) || numPattern.test(line) || templatePattern.test(line)) {
          violations.push(`${entry}: ${line.trim()}`);
        }
      });
    }

    expect(
      violations,
      `Found ${violations.length} hard-coded font size(s) that will not scale with Large text:\n${violations.join('\n')}`,
    ).toEqual([]);
  });
});

// Every assertion below reads the element's OWN computed size. jsdom does
// resolve emotion's styles through getComputedStyle, and converts rem to px.
//
// The first version of this test searched the whole document's CSS for the
// scaled value instead, and MUI's built-in Chip style carries that exact value
// on every small chip (`.MuiChip-avatar { font-size: pxToRem(10) }`) whatever
// size the label is. It passed with the chips' hard-coded sizes put straight
// back, so it proved nothing about them.

type TextSize = 'standard' | 'large';

const px = (el: Element) => parseFloat(getComputedStyle(el).fontSize);

// What `px` becomes at a given text size, from the theme itself rather than a
// hand-copied constant: pxToRem(n) is `n/16 * base/14` rem, and jsdom's root is 16px.
const expected = (textSize: TextSize, n: number) =>
  parseFloat(buildTheme({ mode: 'light', textSize, reduceMotion: 'system' }).typography.pxToRem(n)) * 16;

const renderAt = (textSize: TextSize, ui: React.ReactElement) =>
  render(
    React.createElement(
      ThemeProvider,
      { theme: buildTheme({ mode: 'light', textSize, reduceMotion: 'system' }) },
      React.createElement(MemoryRouter, null, ui),
    ),
  );

describe('Large text reaches the sizes that used to be hard-coded', () => {
  it('scales the Learning Lab chips', () => {
    for (const textSize of ['standard', 'large'] as const) {
      const { unmount } = renderAt(textSize, React.createElement(LearningLabPage));

      const live = screen.getByText('Live').closest('.MuiChip-root')!;
      const family = screen.getByText('Reliability').closest('.MuiChip-root')!;
      expect(px(live), `${textSize}: Live chip`).toBeCloseTo(expected(textSize, 10), 3);
      expect(px(family), `${textSize}: metric-family chip`).toBeCloseTo(expected(textSize, 9.6), 3);

      unmount();
    }
    // Standard is where it was before the sweep; Large is genuinely bigger.
    expect(expected('standard', 10)).toBe(10);
    expect(expected('large', 10)).toBeGreaterThan(11);
  });

  it('scales BigFigure, the number and its detail both', () => {
    for (const textSize of ['standard', 'large'] as const) {
      const { container, unmount } = renderAt(
        textSize,
        React.createElement(BigFigure, { detail: '· 85% to pass', children: '93%' }),
      );

      const figure = container.firstElementChild!;
      const detail = screen.getByText('· 85% to pass');
      expect(px(figure), `${textSize}: the figure`).toBeCloseTo(expected(textSize, 38), 3);
      expect(px(detail), `${textSize}: the detail`).toBeCloseTo(expected(textSize, 13), 3);

      unmount();
    }
  });

  it('lets the BigFigure detail move under the number instead of running off a phone', () => {
    // It was a nowrap inline span, which could neither wrap nor move. On a
    // 390px phone Home's "· 85% to pass · -7.5 a mock" already sat 23px
    // outside its box at Standard, and at Large text it crossed the page edge
    // and lost its last word. jsdom does no layout, so this pins the
    // properties that fix it: a wrapping row, and a detail free to wrap.
    const { container, unmount } = renderAt(
      'large',
      React.createElement(BigFigure, { detail: '· 85% to pass', children: '93%' }),
    );
    const row = getComputedStyle(container.firstElementChild!);
    expect(row.display).toBe('flex');
    expect(row.flexWrap).toBe('wrap');
    expect(getComputedStyle(screen.getByText('· 85% to pass')).whiteSpace).not.toBe('nowrap');
    unmount();

    // ...and only where there is a detail. 28 of the 29 figures in the app
    // have none, and their layout must not move.
    const plain = renderAt('large', React.createElement(BigFigure, { children: '93%' }));
    expect(getComputedStyle(plain.container.firstElementChild!).display).toBe('block');
    plain.unmount();
  });
});
