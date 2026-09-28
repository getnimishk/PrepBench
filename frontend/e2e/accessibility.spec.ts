// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { completedMockWithMisses, createCertification, pickPreparation } from './helpers';

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

async function audit(page: Page, route: string, theme: keyof typeof BACKGROUND): Promise<string[]> {
  await page.goto(route);
  // Checked once the page has its heading and the theme has been applied, so
  // contrast is measured on what a learner actually sees.
  await expect(page.locator('main h1').first()).toBeVisible();
  await expect.poll(() => page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(BACKGROUND[theme]);
  await page.waitForLoadState('networkidle');
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
  await request.post(`/api/v1/roadmaps/${roadmap.id}/topics`, {
    data: { phase_id: phase.id, title: 'Accessible topic', estimated_hours: 2, success_criteria: 'Explain it.' },
  });
  return {
    prep, promptId: prompts.items?.[0]?.id as number | undefined, examId: (await drill.json()).id as number,
    roadmapId: roadmap.id as number,
  };
}

const ROUTES = (prepId: number, roadmapId: number) => [
  '/', '/preparations', '/preparations/new', `/preparations/${prepId}/edit`, '/practice', '/practice?tab=spaced', '/practice?tab=custom', '/learn',
  '/learn/guides/adf', '/learn/guides/adf/pitfalls', '/scenarios', '/scenarios/adf/1',
  '/review', '/exam-setup', '/question-bank', '/analytics', `/analytics/area?subject=${prepId}&domain=Accessible%20Area`,
  '/roadmaps', `/roadmaps/${roadmapId}/edit`, '/search?q=Accessible', '/profile', '/lab', '/chart-sandbox', '/design-reviews', '/design-reviews/1', '/system-design', '/interview-practice',
  '/interview-practice/library', '/interview-practice/setup', '/recordings', '/notifications', '/onboarding',
  '/settings', '/settings/ai', '/settings/appearance', '/settings/practice', '/settings/shortcuts',
  '/settings/notifications', '/settings/data', '/settings/about', '/settings/states',
];

for (const theme of ['light', 'dark'] as const) {
  test(`every screen passes an automated accessibility check in the ${theme} theme`, async ({ page, request }) => {
    // 38 screens audited with axe, twice over. Seven minutes was enough until the
    // suite grew around it; a run on a busy machine needs the room, and a timeout
    // here used to leave the dark theme set for whatever ran next.
    test.setTimeout(900_000);
    const { prep, promptId, examId, roadmapId } = await seed(request);
    // A learner with a name gets their initials in the header instead of an
    // icon: text, so the one variant of the avatar that axe measures contrast on.
    const profile = await (await request.get('/api/v1/profile')).json();
    await request.put('/api/v1/profile', { data: { display_name: 'Ada Lovelace', email: profile.email ?? '' } });
    await request.put('/api/v1/settings', { data: { theme } });
    try {
      await page.goto('/');
      await pickPreparation(page, prep.name);
      await expect(page.getByRole('banner').getByRole('link', { name: 'Profile: Ada Lovelace' })).toHaveText('AL');

      const focusRoutes = [`/exam/${examId}`, ...(promptId ? [`/system-design/${promptId}/answer`] : [])];
      const violations: string[] = [];
      for (const route of [...ROUTES(prep.id, roadmapId), ...focusRoutes]) {
        violations.push(...await audit(page, route, theme));
      }
      expect(violations, violations.join('\n')).toEqual([]);
    } finally {
      await request.put('/api/v1/settings', { data: { theme: 'light' } });
      await request.put('/api/v1/profile', { data: { display_name: profile.display_name ?? '', email: profile.email ?? '' } });
    }
  });
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
