// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { type APIRequestContext, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import {
  completedMockWithMisses, createCertification, createRole, createSheetRoadmap, pickPreparation, trackApi, waitForApiIdle, waitForTransitionsToSettle,
} from './helpers';

/**
 * Every screen, checked by axe in both themes: WCAG 2.2 A and AA, plus the
 * best-practice rules that matter to a screen reader -- one h1, headings in
 * order, everything inside a landmark.
 *
 * Pages are seeded with a preparation that has sat a mock, so Insights, Home and
 * the area page are checked with content rather than as empty states.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

// The prototype's --bg in each theme.
const BACKGROUND = { light: 'rgb(246, 246, 243)', dark: 'rgb(17, 19, 16)' } as const;

type Theme = keyof typeof BACKGROUND;

/** Wait until the page is fully in `theme`: its background, every fade finished, any data it refetched. */
async function settleIn(page: Page, route: string, theme: Theme): Promise<void> {
  await expect.poll(() => page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor), { message: `${route} in the ${theme} theme` })
    .toBe(BACKGROUND[theme]);
  await waitForTransitionsToSettle(page);
  await waitForApiIdle(page);
}

/** Switch theme with the header's own button, then leave nothing hovered or focused that the audit would see. */
async function switchTo(page: Page, route: string, theme: Theme): Promise<void> {
  // The button is named for what it does: "Dark mode" while the page is light.
  await page.getByRole('banner').getByRole('button', { name: theme === 'dark' ? 'Dark mode' : 'Light mode' }).click();
  await page.mouse.move(0, 0);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await expect(page.getByRole('tooltip'), 'the theme button\'s tooltip has closed').toHaveCount(0);
  await settleIn(page, route, theme);
}

async function audit(page: Page, route: string, theme: Theme): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations.map((v) => `${theme} ${route} — ${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

async function seed(request: APIRequestContext) {
  const prep = await createCertification(request, 'Accessible Prep');
  await completedMockWithMisses(request, prep, 3, 'Accessible Area');
  const prompts = await (await request.get('/api/v1/system-design/prompts?limit=1')).json();
  const drill = await request.post('/api/v1/exams', {
    data: { subject_id: prep.id, session_kind: 'drill', total_questions: 2 },
  });
  expect(drill.status(), await drill.text()).toBe(201);
  const roadmap = await (await request.post('/api/v1/roadmaps', { data: { title: 'Accessible plan', subject_id: prep.id } })).json();
  const phase = await (await request.post(`/api/v1/roadmaps/${roadmap.id}/phases`, { data: { name: 'Accessible phase' } })).json();
  const topic = await (await request.post(`/api/v1/roadmaps/${roadmap.id}/topics`, {
    data: { phase_id: phase.id, title: 'Accessible topic', estimated_hours: 2, success_criteria: 'Explain it.' },
  })).json();
  await request.post(`/api/v1/roadmaps/${roadmap.id}/topics/${topic.id}/guide/sections`, {
    data: {
      title: 'Accessible Diagrams Section',
      body: `
### Architecture Flow
\`\`\`mermaid
flowchart TD
  accTitle: Accessible System Flowchart
  accDescr: High level flow
  A[Client] --> B[Server]
\`\`\`

### Vector Diagram
\`\`\`svg
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <title>Accessible Circle</title>
  <circle cx="50" cy="50" r="40" fill="#3157d5" />
</svg>
\`\`\`

![Bundled Guide Asset](guide:ch01-fig1-ai-ml-genai-llm.svg)
      `.trim(),
    },
  });
  const role = await createRole(request, 'Accessible Role');
  const sheets = await createSheetRoadmap(request, prep.id, 'Accessible');
  return {
    sheets, prep, promptId: prompts.items?.[0]?.id as number | undefined, examId: (await drill.json()).id as number,
    roadmapId: roadmap.id as number, roleId: role.id, topicId: topic.id as number,
  };
}

const ROUTES = (prepId: number, roadmapId: number, roleId: number, topicId: number, sheets: SheetIds) => [
  '/', '/preparations', '/preparations/new', `/preparations/${prepId}/edit`,
  '/preparations/roles/new', `/preparations/roles/${roleId}`, `/preparations/roles/${roleId}/diagnostic`, '/practice', '/practice?tab=spaced', '/practice?tab=custom', '/learn',
  '/certification', '/interview',
  '/learn/guides/adf', '/learn/guides/adf/pitfalls', '/scenarios', '/scenarios/adf/1',
  '/review', '/exam-setup', '/question-bank', '/analytics', `/analytics/area?subject=${prepId}&domain=Accessible%20Area`,
  '/roadmaps', `/roadmaps/${roadmapId}/edit`,
  // A multi-sheet roadmap: its first tab, a reference sheet's tab, a plan sheet's tab.
  `/roadmaps/${sheets.roadmapId}`, `/roadmaps/${sheets.roadmapId}?resource=${sheets.referenceId}`,
  `/roadmaps/${sheets.roadmapId}?resource=${sheets.planId}`,
   `/roadmaps/${roadmapId}/topics/${topicId}/guide`, '/search?q=Accessible', '/profile', '/lab', '/chart-sandbox', '/databricks-sandbox', '/databricks-sandbox?pack=jd-po-005-v1', '/design-reviews', '/design-reviews/1', '/system-design', '/interview-practice',
  '/interview-practice/library', '/interview-practice/setup', '/recordings', '/notifications', '/onboarding',
  '/settings', '/settings/ai', '/settings/appearance', '/settings/practice', '/settings/shortcuts',
  '/settings/notifications', '/settings/data', '/settings/about', '/settings/states',
];

interface SheetIds { roadmapId: number; referenceId: number; planId: number }
interface Ids {
  prepId: number; roadmapId: number; roleId: number; topicId: number; examId: number; promptId?: number;
  sheets: SheetIds;
}

/** Every screen audited, the focus screens (no sidebar) included. */
const allRoutes = (ids: Ids) => [
  ...ROUTES(ids.prepId, ids.roadmapId, ids.roleId, ids.topicId, ids.sheets),
  `/exam/${ids.examId}`, ...(ids.promptId ? [`/system-design/${ids.promptId}/answer`] : []),
];

// The screens are audited in parts that run side by side on separate workers:
// forty-seven screens twice over is minutes of work, and a run cannot finish
// before its longest test does. Every third screen goes to a part, so the heavy
// and light ones spread evenly; the last test below proves the parts between
// them cover every screen exactly once.
const PARTS = 3;
const part = <T>(items: T[], index: number) => items.filter((_, i) => i % PARTS === index);

test.describe('every screen passes an automated accessibility check in both themes', () => {
  test.describe.configure({ mode: 'parallel' });

  // Each screen is opened once, in the light theme, audited, switched to dark with
  // the header's button and audited again, then switched back so the next screen
  // opens light. Both audits run the full rule set: a theme can break more than
  // contrast (a link told apart from its sentence by colour alone, say).
  for (let index = 0; index < PARTS; index += 1) {
    test(`part ${index + 1} of ${PARTS}`, async ({ page, request }) => {
      await trackApi(page);
      // A timeout here used to leave the dark theme set for whatever ran next --
      // hence the finally.
      test.setTimeout(600_000);
      const { prep, promptId, examId, roadmapId, roleId, topicId, sheets } = await seed(request);
      // A learner with a name gets their initials in the header instead of an
      // icon: text, so the one variant of the avatar that axe measures contrast on.
      const profile = await (await request.get('/api/v1/profile')).json();
      await request.put('/api/v1/profile', { data: { display_name: 'Ada Lovelace', email: profile.email ?? '' } });
      await request.put('/api/v1/settings', { data: { theme: 'light' } });
      try {
        await page.goto('/');
        await pickPreparation(page, prep.name);
        await expect(page.getByRole('banner').getByRole('link', { name: 'Profile: Ada Lovelace' })).toHaveText('AL');

        const routes = part(allRoutes({ prepId: prep.id, roadmapId, roleId, topicId, examId, promptId, sheets }), index);
        await auditBothThemes(page, routes);
      } finally {
        await request.put('/api/v1/settings', { data: { theme: 'light' } });
        await request.put('/api/v1/profile', { data: { display_name: profile.display_name ?? '', email: profile.email ?? '' } });
      }
    });
  }

  test('the parts cover every screen exactly once', () => {
    const ids: Ids = {
      prepId: 11, roadmapId: 12, roleId: 13, topicId: 14, examId: 15, promptId: 16,
      sheets: { roadmapId: 17, referenceId: 18, planId: 19 },
    };
    const every = allRoutes(ids);
    const parts = Array.from({ length: PARTS }, (_, index) => part(every, index));
    expect(parts.flat().sort()).toEqual([...every].sort());
    expect(new Set(parts.flat()).size).toBe(every.length);
    for (const p of parts) expect(p.length, 'no part is empty').toBeGreaterThan(0);
  });
});

async function auditBothThemes(page: Page, routes: string[]): Promise<void> {
  const violations: string[] = [];
  // Every (screen, theme) pair actually audited, so the end can prove none was skipped.
  const audited: string[] = [];
  for (const route of routes) {
    await page.goto(route);
    // Audited once the page has its heading, its theme and its data, so contrast
    // is measured on what a learner actually sees.
    await expect(page.locator('main h1').first(), `${route} has a heading`).toBeVisible();
    await settleIn(page, route, 'light');
    violations.push(...await audit(page, route, 'light'));
    audited.push(`${route} light`);

    await switchTo(page, route, 'dark');
    violations.push(...await audit(page, route, 'dark'));
    audited.push(`${route} dark`);

    await switchTo(page, route, 'light');
  }
  expect(violations, violations.join('\n')).toEqual([]);
  expect(audited.length, 'every screen audited in both themes').toBe(routes.length * 2);
  expect(new Set(audited).size, 'no (screen, theme) pair audited twice in place of another').toBe(routes.length * 2);
}

// Controls fade their background but not their text colour, so a theme switch
// that fades leaves them in one mode's text on the other mode's fill for as long
// as it runs -- the dark accent on the light accentSoft, 2:1, on the avatar. The
// audits above only see the page once it has settled; this watches the switch.
test('switching theme never shows one theme\'s text on the other\'s fill', async ({ page, request }) => {
  const profile = await (await request.get('/api/v1/profile')).json();
  await request.put('/api/v1/profile', { data: { display_name: 'Ada Lovelace', email: profile.email ?? '' } });
  await request.put('/api/v1/settings', { data: { theme: 'light' } });
  try {
    await page.goto('/settings');
    const avatar = page.getByRole('banner').getByRole('link', { name: 'Profile: Ada Lovelace' });
    await expect(avatar).toHaveText('AL');
    const pair = () => avatar.evaluate((el) => `${getComputedStyle(el).color} on ${getComputedStyle(el).backgroundColor}`);
    const light = await pair();

    // Every colour pair the avatar shows, frame by frame, until told to stop.
    const watch = () => avatar.evaluate((el) => {
      const seen = new Set<string>();
      let on = true;
      const tick = () => {
        seen.add(`${getComputedStyle(el).color} on ${getComputedStyle(el).backgroundColor}`);
        if (on) requestAnimationFrame(tick);
      };
      tick();
      (window as unknown as { stopWatch: () => string[] }).stopWatch = () => { on = false; return [...seen]; };
    });
    const stop = () => page.evaluate(() => (window as unknown as { stopWatch: () => string[] }).stopWatch());

    await watch();
    await page.getByRole('banner').getByRole('button', { name: 'Dark mode' }).click();
    await expect(page.locator('body')).toHaveCSS('background-color', BACKGROUND.dark);
    await page.waitForTimeout(600);
    const toDark = await stop();
    const dark = await pair();
    expect(dark).not.toBe(light);
    expect(toDark.filter((p) => p !== light && p !== dark)).toEqual([]);

    await watch();
    await page.getByRole('banner').getByRole('button', { name: 'Light mode' }).click();
    await expect(page.locator('body')).toHaveCSS('background-color', BACKGROUND.light);
    await page.waitForTimeout(600);
    const toLight = await stop();
    expect(toLight.filter((p) => p !== light && p !== dark)).toEqual([]);
  } finally {
    await request.put('/api/v1/settings', { data: { theme: 'light' } });
    await request.put('/api/v1/profile', { data: { display_name: profile.display_name ?? '', email: profile.email ?? '' } });
  }
});

test('motion stops when the system asks for it, and when the learner does', async ({ page, request }) => {
  const duration = () => page.getByRole('link', { name: 'Open preparations' })
    .evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration) || 0);

  await page.goto('/settings');
  await expect(page.locator('main h1')).toBeVisible();
  expect(await duration()).toBeGreaterThan(0.05);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(duration).toBeLessThan(0.001);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(duration).toBeGreaterThan(0.05);

  await request.put('/api/v1/settings', { data: { reduce_motion: 'always' } });
  try {
    await page.reload();
    await expect(page.locator('main h1')).toBeVisible();
    await expect.poll(duration).toBeLessThan(0.001);
  } finally {
    await request.put('/api/v1/settings', { data: { reduce_motion: 'system' } });
  }
});
