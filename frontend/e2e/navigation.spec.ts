// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { expect, test, type Page } from '@playwright/test';
import { completedMockWithMisses, createCertification, pickPreparation, tag } from './helpers';

/**
 * The release gate's "no console errors" and "no dead navigation", checked the
 * only way they can be: every screen opened with real data behind it, every
 * link on it followed, and the browser console read throughout.
 *
 * A link is dead if it lands on "Nothing at this address" or on a page with no
 * heading. The exam runner and the interview recorder are left out of the crawl:
 * they are focus screens entered on purpose, and each has its own journey.
 */

const NOT_FOUND = 'Nothing at this address';

function watchConsole(page: Page, where: () => string): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${where()}: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`${where()}: ${error.message}`));
  return errors;
}

async function landed(page: Page, route: string) {
  await expect(page.locator('main h1').first(), `${route} has a heading`).toBeVisible();
  await expect(page.getByRole('heading', { name: NOT_FOUND }), `${route} is a real page`).toHaveCount(0);
  await page.waitForLoadState('networkidle');
}

test('every screen opens with no console errors, and no link on any of them leads nowhere', async ({ page, request }) => {
  test.setTimeout(600_000);
  page.setDefaultTimeout(20_000);
  const t = tag();

  const prep = await createCertification(request, 'Navigation');
  const area = `Navigation area ${t}`;
  await completedMockWithMisses(request, prep, 3, area);
  const mock = (await (await request.get(`/api/v1/review/queue?subject_id=${prep.id}`)).json()).items[0].session_id;
  const roadmap = await (await request.post('/api/v1/roadmaps', { data: { title: `Navigation roadmap ${t}`, subject_id: prep.id } })).json();
  const phase = await (await request.post(`/api/v1/roadmaps/${roadmap.id}/phases`, { data: { name: 'Phase' } })).json();
  const topic = await (await request.post(`/api/v1/roadmaps/${roadmap.id}/topics`, {
    data: { phase_id: phase.id, title: 'Navigation topic', success_criteria: 'Explain it.' },
  })).json();
  const review = (await (await request.get('/api/v1/design-reviews?limit=1')).json()).items[0].id;
  const prompt = (await (await request.get('/api/v1/system-design/prompts?limit=1')).json()).items[0].id;

  let where = '(start)';
  const errors = watchConsole(page, () => where);

  const routes = [
    '/', '/preparations', '/preparations/new', `/preparations/${prep.id}/edit`, `/subjects/${prep.id}`,
    '/practice', '/practice?tab=weak', '/practice?tab=spaced', '/practice?tab=custom', '/practice?tab=mock', '/practice/spaced',
    '/learn', '/review', '/exam-setup', '/exam-setup?kind=drill', `/exam-review/${mock}`,
    '/question-bank', '/analytics', `/analytics/area?subject=${prep.id}&domain=${encodeURIComponent(area)}`,
    '/roadmaps', `/roadmaps/${roadmap.id}`, `/roadmaps/${roadmap.id}/edit`, `/roadmaps/${roadmap.id}/topics/${topic.id}`,
    `/roadmaps/${roadmap.id}/topics/${topic.id}/guide`, `/roadmaps/${roadmap.id}/topics/${topic.id}/demonstrate`,
    '/lab', '/chart-sandbox', '/design-reviews', `/design-reviews/${review}`, '/system-design', `/system-design/${prompt}/answer`,
    '/interview-practice', '/interview-practice/setup', '/interview-practice/library', '/recordings',
    '/search', '/search?q=Navigation', '/profile', '/notifications', '/onboarding', '/settings', '/settings/ai', '/settings/appearance', '/settings/practice',
    '/settings/shortcuts', '/settings/notifications', '/settings/data', '/settings/about', '/settings/states',
  ];

  await page.goto('/');
  await pickPreparation(page, prep.name);

  // Every screen, and the links each one offers.
  const links = new Set<string>();
  for (const route of routes) {
    where = route;
    await page.goto(route);
    await landed(page, route);
    const hrefs = await page.locator('main a[href^="/"], nav a[href^="/"]').evaluateAll(
      (anchors) => anchors.map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? ''),
    );
    hrefs.forEach((href) => links.add(href));
  }

  // Every link, followed.
  const focusScreens = /^\/(exam\/\d+|interview-practice\/(\d+|general)\/record|interview-practice\/sessions\/\d+$)/;
  // A link into the API is a download (the backup): it has to answer, not render.
  const downloads = [...links].filter((href) => href.startsWith('/api/'));
  for (const href of downloads) {
    const response = await request.get(href);
    expect(response.status(), `${href} answers`).toBe(200);
  }
  const unvisited = [...links].filter((href) => !href.startsWith('/api/') && !routes.includes(href) && !focusScreens.test(href));
  // One link of each shape is enough to show that its address leads somewhere:
  // /preparations/7/edit and /preparations/12/edit are the same screen. Following
  // every one made this test grow with everything the earlier tests had left in
  // the database -- ten minutes by the end of a full run, and a timeout.
  const shapeOf = (href: string) => href.replace(/\/\d+(?=\/|\?|$)/g, '/:id').replace(/=\d+/g, '=:n');
  const seenShapes = new Set(routes.map(shapeOf));
  const toFollow = unvisited.filter((href) => {
    const shape = shapeOf(href);
    if (seenShapes.has(shape)) return false;
    seenShapes.add(shape);
    return true;
  });
  for (const href of toFollow) {
    where = `link ${href}`;
    await page.goto(href);
    await landed(page, href);
  }

  // And an address nothing answers to says so, with a way on.
  where = '/no-such-page';
  await page.goto(`/no-such-page-${t}`);
  await expect(page.getByRole('heading', { name: NOT_FOUND })).toBeVisible();
  await page.getByRole('link', { name: 'Go to Home' }).click();
  await expect(page).toHaveURL(/\/$/);

  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  expect(links.size).toBeGreaterThan(20);
});
