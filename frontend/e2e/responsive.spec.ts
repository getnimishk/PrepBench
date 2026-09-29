// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { expect, test } from '@playwright/test';
import { completedMockWithMisses, createCertification, createRole, pickPreparation } from './helpers';

/**
 * The main screens at the widths the plan names: desktop 1280 and 1024, tablet
 * 768, phones 430 and 390. At each: the page does not scroll sideways, its
 * heading and the navigation are on screen, and on a phone nothing you can tap
 * is smaller than WCAG 2.2's 24 by 24 pixels.
 */

const VIEWPORTS = [
  { name: 'desktop 1280', width: 1280, height: 800, phone: false },
  { name: 'desktop 1024', width: 1024, height: 768, phone: false },
  { name: 'tablet 768', width: 768, height: 1024, phone: false },
  { name: 'phone 430', width: 430, height: 932, phone: true },
  { name: 'phone 390', width: 390, height: 844, phone: true },
];

const ROUTES = (prepId: number, roleId: number, roadmapId: number, topicId: number) => [
  '/preparations/roles/new', `/preparations/roles/${roleId}`, `/preparations/roles/${roleId}/diagnostic`,
  '/', '/practice', '/review', '/exam-setup', '/question-bank', '/analytics',
  '/lab', '/chart-sandbox', '/scenarios', '/scenarios/adf/1',
  '/design-reviews/1', '/system-design', '/interview-practice', '/preparations/new', `/preparations/${prepId}/edit`,
  '/learn', '/learn/guides/adf', '/learn/guides/adf/pitfalls',
  `/roadmaps/${roadmapId}/topics/${topicId}/guide`,
  '/notifications', '/onboarding', '/settings', '/settings/ai', '/settings/data',
];

for (const viewport of VIEWPORTS) {
  test(`the main screens fit a ${viewport.name} screen`, async ({ page, request }) => {
    test.setTimeout(240_000);
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

    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await pickPreparation(page, prep.name);

    const problems: string[] = [];
    for (const route of ROUTES(prep.id, role.id, roadmap.id, topic.id)) {
      await page.goto(route);
      await expect(page.locator('main h1').first()).toBeVisible();
      await page.waitForLoadState('networkidle');

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 1) problems.push(`${route}: scrolls sideways by ${overflow}px`);

      const nav = page.getByRole('navigation', { name: 'Main' });
      if (!(await nav.isVisible())) problems.push(`${route}: navigation not visible`);
      else if (!(await nav.getByRole('link', { name: 'Home' }).isVisible())) problems.push(`${route}: Home link not reachable`);

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
        if (small.length) problems.push(`${route}: targets under 24px: ${small.slice(0, 6).join(', ')}`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
}
