// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completedMockWithMisses, createCertification, createRole, createSheetRoadmap, pickPreparation, tag, trackApi, waitForApiIdle } from './helpers';

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

function watchConsole(page: Page, where: () => string, errors: string[]): void {
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${where()}: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`${where()}: ${error.message}`));
}

// Screens opened in one tab before the crawl moves to a fresh one. Every screen
// here comes from the dev server as several hundred separate modules, and one tab
// taking sixty of those in a row grew by gigabytes; on a machine with a few GB of
// memory to spare, Chrome then failed to allocate for a module mid-crawl
// (net::ERR_INSUFFICIENT_RESOURCES), the app never mounted, and a screen that
// works was reported headless. A fresh tab in the same context keeps the chosen
// preparation (localStorage), and closing the old one frees its memory.
const SCREENS_PER_TAB = 10;

async function landed(page: Page, route: string) {
  // 15s, not the 5s default. This spec alone runs against Vite's dev server (the
  // chromium-dev project in playwright.config.ts), so React's development warnings
  // reach the console check below. The dev server compiles a route on its first
  // visit, and a page never hit before in this run can occasionally take longer
  // than 5s to serve -- not a broken screen, just an uncompiled one. This crawl
  // visits every screen once each, so the first visit is the common case here.
  await expect(page.locator('main h1').first(), `${route} has a heading`).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: NOT_FOUND }), `${route} is a real page`).toHaveCount(0);
  await waitForApiIdle(page);
}

test('every screen opens with no console errors, and no link on any of them leads nowhere', async ({ page, request }) => {
  await trackApi(page);
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
  const sheets = await createSheetRoadmap(request, prep.id, 'Navigation');
  const review = (await (await request.get('/api/v1/design-reviews?limit=1')).json()).items[0].id;
  const prompt = (await (await request.get('/api/v1/system-design/prompts?limit=1')).json()).items[0].id;
  const role = await createRole(request, 'Navigation Role');

  let where = '(start)';
  const errors: string[] = [];
  watchConsole(page, () => where, errors);

  let tab = page;
  let opened = 0;
  const open = async (href: string) => {
    if (opened > 0 && opened % SCREENS_PER_TAB === 0) {
      const next = await page.context().newPage();
      next.setDefaultTimeout(20_000);
      await trackApi(next);
      watchConsole(next, () => where, errors);
      await tab.close();
      tab = next;
    }
    opened += 1;
    await tab.goto(href);
  };

  const routes = [
    '/', '/preparations', '/preparations/new', `/preparations/${prep.id}/edit`, `/subjects/${prep.id}`,
    '/practice', '/practice?tab=weak', '/practice?tab=spaced', '/practice?tab=custom', '/practice?tab=mock', '/practice/spaced',
    '/certification', '/interview', '/lab/adf', '/lab/adf/watermark', '/lab/adf/triggers', '/lab/adf/concurrency', '/lab/adf/copy-perf',
    '/lab/adf/fault-tolerance', '/lab/adf/fault-tolerance?mode=bad-rows',
    '/learn', '/learn/guides/adf', '/learn/guides/adf/pitfalls', '/review', '/exam-setup', '/exam-setup?kind=drill', `/exam-review/${mock}`,
    '/question-bank', '/analytics', `/analytics/area?subject=${prep.id}&domain=${encodeURIComponent(area)}`,
    '/roadmaps', `/roadmaps/${roadmap.id}`,
    `/roadmaps/${sheets.roadmapId}`, `/roadmaps/${sheets.roadmapId}?resource=${sheets.referenceId}`,
    `/roadmaps/${sheets.roadmapId}?resource=${sheets.planId}`, `/roadmaps/${roadmap.id}/edit`, `/roadmaps/${roadmap.id}/topics/${topic.id}`,
    `/roadmaps/${roadmap.id}/topics/${topic.id}/guide`, `/roadmaps/${roadmap.id}/topics/${topic.id}/demonstrate`,
    '/lab', '/chart-sandbox', '/databricks-sandbox', '/databricks-sandbox?pack=jd-po-005-v1', '/scenarios', '/scenarios/adf/1',
    '/preparations/roles/new', `/preparations/roles/${role.id}`, `/preparations/roles/${role.id}/diagnostic`, '/design-reviews', `/design-reviews/${review}`, '/system-design', `/system-design/${prompt}/answer`,
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
    await open(route);
    await landed(tab, route);
    const hrefs = await tab.locator('main a[href^="/"], nav a[href^="/"]').evaluateAll(
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
    await open(href);
    await landed(tab, href);
  }

  // And an address nothing answers to says so, with a way on.
  where = '/no-such-page';
  await open(`/no-such-page-${t}`);
  await expect(tab.getByRole('heading', { name: NOT_FOUND })).toBeVisible();
  await tab.getByRole('link', { name: 'Go to Home' }).click();
  await expect(tab).toHaveURL(/\/$/);

  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  expect(links.size).toBeGreaterThan(20);
});
