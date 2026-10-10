// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import {
  completedMockWithMisses, createCertification, createRole, createSheetRoadmap, pickPreparation, trackApi, waitForApiIdle, waitForTransitionsToSettle,
} from './helpers';

/**
 * The main screens at the widths the plan names: desktop 1280 and 1024, tablet
 * 768, phones 430 and 390. At each: the page does not scroll sideways, its
 * heading and the navigation are on screen, and on a phone nothing you can tap
 * is smaller than WCAG 2.2's 24 by 24 pixels.
 *
 * Each screen is opened once and resized through every width in place: the
 * layout follows the width through media queries (MUI's useMediaQuery included),
 * so a resize shows what a load at that width would. A component that measures
 * itself only when it mounts would not follow, so each screen is also opened
 * cold at 390, the width where layouts break most. That is two loads a screen
 * instead of five, and every screen is still checked at every width.
 */

const VIEWPORTS = [
  { name: 'desktop 1280', width: 1280, height: 800, phone: false },
  { name: 'desktop 1024', width: 1024, height: 768, phone: false },
  { name: 'tablet 768', width: 768, height: 1024, phone: false },
  { name: 'phone 430', width: 430, height: 932, phone: true },
  { name: 'phone 390', width: 390, height: 844, phone: true },
];

const ROUTES = (
  prepId: number, roleId: number, roadmapId: number, topicId: number,
  sheets: { roadmapId: number; referenceId: number; planId: number },
) => [
  '/preparations/roles/new', `/preparations/roles/${roleId}`, `/preparations/roles/${roleId}/diagnostic`,
  '/', '/practice', '/certification', '/interview', '/lab/adf', '/lab/adf/watermark', '/lab/adf/triggers', '/lab/adf/concurrency', '/lab/adf/copy-perf',
  '/lab/adf/fault-tolerance', '/lab/adf/fault-tolerance?mode=bad-rows', '/review', '/exam-setup', '/question-bank', '/analytics', '/workspace', '/evidence',
  '/lab', '/chart-sandbox', '/databricks-sandbox', '/databricks-sandbox?station=d', '/databricks-sandbox?station=i', '/databricks-sandbox?pack=jd-po-005-v1', '/scenarios', '/scenarios/adf/1',
  '/design-reviews/1', '/system-design', '/interview-practice', '/preparations/new', `/preparations/${prepId}/edit`,
  '/learn', '/learn/guides/adf', '/learn/guides/adf/pitfalls',
  `/roadmaps/${roadmapId}/topics/${topicId}/guide`,
  // A multi-sheet roadmap: its scrolling tab strip, a reference sheet and a plan sheet.
  `/roadmaps/${sheets.roadmapId}`, `/roadmaps/${sheets.roadmapId}?resource=${sheets.referenceId}`,
  `/roadmaps/${sheets.roadmapId}?resource=${sheets.planId}`,
  '/notifications', '/onboarding', '/settings', '/settings/ai', '/settings/data',
];

type Viewport = typeof VIEWPORTS[number];

/** Everything wrong with `route` as it stands at `viewport`, labelled with both. */
async function problemsAt(page: Page, route: string, viewport: Viewport, how: string): Promise<string[]> {
  const where = `${route} @ ${viewport.name} (${how})`;
  const problems: string[] = [];

  if (!(await page.locator('main h1').first().isVisible())) problems.push(`${where}: heading not visible`);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) problems.push(`${where}: scrolls sideways by ${overflow}px`);

  const nav = page.getByRole('navigation', { name: 'Main' });
  if (!(await nav.isVisible())) problems.push(`${where}: navigation not visible`);
  else if (!(await nav.getByRole('link', { name: 'Home' }).isVisible())) problems.push(`${where}: Home link not reachable`);

  if (viewport.phone) {
    const small = await page.evaluate(() => {
      const out: string[] = [];
      const nodes = document.querySelectorAll<HTMLElement>(
        'main button, main [role="button"], main input:not([type="hidden"]), main select, main [role="switch"], main [role="tab"], nav a, header button, header a',
      );
      nodes.forEach((el) => {
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none') return;
        // A link inside a sentence is exempt; its size is the text's.
        if (el.tagName === 'A' && style.display === 'inline') return;
        // MUI renders the real radio/checkbox/switch input invisibly over a larger target.
        const target = (el.tagName === 'INPUT' && el.parentElement) ? el.parentElement : el;
        const rect = target.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;
        if (rect.width < 24 || rect.height < 24) {
          const name = el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 30) || el.tagName;
          out.push(`${name} (${Math.round(rect.width)}x${Math.round(rect.height)})`);
        }
      });
      return out;
    });
    if (small.length) problems.push(`${where}: targets under 24px: ${small.slice(0, 6).join(', ')}`);
  }
  return problems;
}

// The screens are checked in parts that run side by side on separate workers, so
// the run is not waiting on one long test. Every other screen goes to a part; the
// last test below proves the parts between them cover every screen exactly once.
const PARTS = 2;
const part = <T>(items: T[], index: number) => items.filter((_, i) => i % PARTS === index);

test.describe('the main screens fit every width, desktop to phone', () => {
  test.describe.configure({ mode: 'parallel' });

  for (let index = 0; index < PARTS; index += 1) {
    test(`part ${index + 1} of ${PARTS}`, async ({ page, request }) => {
      await trackApi(page);
      test.setTimeout(600_000);
      const prep = await createCertification(request, 'Responsive Prep');
      const role = await createRole(request, 'Responsive Role');
      await completedMockWithMisses(request, prep, 3, 'Responsive Area');

      const roadmap = await (await request.post('/api/v1/roadmaps', { data: { title: 'Responsive plan', subject_id: prep.id } })).json();
      const phase = await (await request.post(`/api/v1/roadmaps/${roadmap.id}/phases`, { data: { name: 'Responsive phase' } })).json();
      const topic = await (await request.post(`/api/v1/roadmaps/${roadmap.id}/topics`, {
        data: { phase_id: phase.id, title: 'Responsive topic', estimated_hours: 2, success_criteria: 'Explain it.' },
      })).json();
      await request.post(`/api/v1/roadmaps/${roadmap.id}/topics/${topic.id}/guide/sections`, {
        data: {
          title: 'Responsive Diagrams',
          body: `
### Responsive Flow
\`\`\`mermaid
flowchart LR
  A[Component Alpha Very Long Name] --> B[Component Beta Very Long Name] --> C[Component Gamma]
\`\`\`

### Responsive SVG
\`\`\`svg
<svg viewBox="0 0 600 200" width="600" height="200" xmlns="http://www.w3.org/2000/svg">
  <title>Wide Vector Diagram</title>
  <rect x="10" y="10" width="580" height="180" rx="10" fill="#3157d5" />
</svg>
\`\`\`

![Responsive Asset](guide:ch01-fig1-ai-ml-genai-llm.svg)
          `.trim(),
        },
      });

      const [widest] = VIEWPORTS;
      const phone390 = VIEWPORTS.find((v) => v.width === 390)!;
      await page.setViewportSize({ width: widest.width, height: widest.height });
      await page.goto('/');
      await pickPreparation(page, prep.name);

      const sheets = await createSheetRoadmap(request, prep.id, 'Responsive');
      const routes = part(ROUTES(prep.id, role.id, roadmap.id, topic.id, sheets), index);
      const problems: string[] = [];
      // Every (screen, width) pair actually checked, so the end can prove none was skipped.
      const resized: string[] = [];
      const cold: string[] = [];

      for (const route of routes) {
        // Opened once at the widest, then narrowed through every width in place.
        await page.setViewportSize({ width: widest.width, height: widest.height });
        await page.goto(route);
        await expect(page.locator('main h1').first(), `${route} has a heading`).toBeVisible();
        await waitForApiIdle(page);
        for (const viewport of VIEWPORTS) {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await waitForTransitionsToSettle(page);
          // A narrower layout can mount components of its own, with data of their own.
          await waitForApiIdle(page);
          problems.push(...await problemsAt(page, route, viewport, 'resized'));
          resized.push(`${route} @ ${viewport.name}`);
        }

        // And opened cold at 390 (the viewport is already there), for anything
        // that sizes itself only when it mounts.
        await page.goto(route);
        await expect(page.locator('main h1').first(), `${route} has a heading at 390`).toBeVisible();
        await waitForApiIdle(page);
        problems.push(...await problemsAt(page, route, phone390, 'loaded'));
        cold.push(route);
      }

      expect(problems, problems.join('\n')).toEqual([]);
      expect(resized.length, 'every screen checked at every width').toBe(routes.length * VIEWPORTS.length);
      expect(new Set(resized).size, 'no (screen, width) pair checked twice in place of another').toBe(routes.length * VIEWPORTS.length);
      expect(cold, 'every screen opened cold at 390').toEqual(routes);
    });
  }

  test('the parts cover every screen exactly once', () => {
    const every = ROUTES(11, 12, 13, 14, { roadmapId: 15, referenceId: 16, planId: 17 });
    const parts = Array.from({ length: PARTS }, (_, index) => part(every, index));
    expect(parts.flat().sort()).toEqual([...every].sort());
    expect(new Set(parts.flat()).size).toBe(every.length);
    for (const p of parts) expect(p.length, 'no part is empty').toBeGreaterThan(0);
  });
});
