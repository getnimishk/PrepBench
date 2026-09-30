// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
import {
  DIAGRAM_MIN_SCALE, DIAGRAM_MIN_WIDTH_PX, diagramMaxWidth, diagramMinWidth, getNextMermaidId, svgNaturalWidth,
} from './guideUtils';

describe('svgNaturalWidth', () => {
  it('reads the width from the viewBox', () => {
    expect(svgNaturalWidth('<svg viewBox="0 0 760 450" xmlns="http://www.w3.org/2000/svg"/>')).toBe(760);
    expect(svgNaturalWidth("<svg viewBox='0,0,320.5,200'/>")).toBe(320.5);
  });

  it('returns null when there is no readable viewBox', () => {
    expect(svgNaturalWidth('<svg width="100%"/>')).toBeNull();
    expect(svgNaturalWidth('<svg viewBox="0 0 0 0"/>')).toBeNull();
  });
});

describe('diagram sizing', () => {
  it('lets a wide diagram scroll rather than shrink below a readable fraction of its own width', () => {
    expect(diagramMinWidth('<svg viewBox="0 0 1500 400"/>')).toBe(`${Math.round(1500 * DIAGRAM_MIN_SCALE)}px`);
  });

  it('lets a small diagram shrink with the column, since a fraction of a small width is small', () => {
    expect(diagramMinWidth('<svg viewBox="0 0 300 200"/>')).toBe(`${Math.round(300 * DIAGRAM_MIN_SCALE)}px`);
  });

  it('never draws a diagram larger than its own width', () => {
    expect(diagramMaxWidth('<svg viewBox="0 0 260 900"/>')).toBe('260px');
  });

  it('falls back to a fixed minimum, and no maximum, when the width cannot be read', () => {
    expect(diagramMinWidth('<svg/>')).toBe(`${DIAGRAM_MIN_WIDTH_PX}px`);
    expect(diagramMaxWidth('<svg/>')).toBeUndefined();
  });
});

describe('getNextMermaidId', () => {
  it('never produces an id that is a prefix of another, because cleanup matches by prefix', () => {
    const ids = Array.from({ length: 25 }, () => getNextMermaidId());
    for (const a of ids) {
      for (const b of ids) {
        if (a !== b) expect(b.startsWith(a)).toBe(false);
      }
    }
  });
});
