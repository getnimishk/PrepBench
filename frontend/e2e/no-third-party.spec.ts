// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { expect, test } from './fixtures';

/**
 * The app's promise is that a network call leaves the machine only when the
 * learner configures a cloud AI provider. So with none configured, loading it
 * and moving around it must ask no host but its own -- no web fonts, no CDN
 * scripts, no analytics. Inter used to be fetched from Google on every load.
 */

const SCREENS = ['/', '/preparations', '/roadmaps', '/practice', '/review', '/interview-practice', '/settings'];

test('loading the app and its screens asks no host but its own', async ({ page, baseURL }) => {
  test.setTimeout(120_000);
  const own = new URL(baseURL!).origin;
  const foreign: string[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    // data: and blob: URLs never leave the page.
    if (url.protocol === 'data:' || url.protocol === 'blob:') return;
    if (url.origin !== own) foreign.push(req.url());
  });

  for (const route of SCREENS) {
    await page.goto(route);
    await expect(page.locator('main')).toBeVisible();
    // networkidle, not waitForApiIdle, on purpose: that one waits only for the
    // app's own requests, and a request to any other host -- the very thing
    // this test looks for -- is what it would not wait on.
    await page.waitForLoadState('networkidle');
  }

  expect(foreign, 'requests to a host other than the app itself').toEqual([]);
});

test('Inter is served by the app itself and is the font in use', async ({ page, baseURL }) => {
  const own = new URL(baseURL!).origin;
  const fontFiles: string[] = [];
  page.on('response', (res) => {
    if (res.request().resourceType() === 'font') fontFiles.push(res.url());
  });

  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);

  expect(fontFiles.length, 'a font file was loaded').toBeGreaterThan(0);
  for (const url of fontFiles) expect(new URL(url).origin).toBe(own);

  const inter = await page.evaluate(() => {
    let loaded = false;
    document.fonts.forEach((face) => {
      if (/^"?Inter/.test(face.family) && face.status === 'loaded') loaded = true;
    });
    return loaded;
  });
  expect(inter, 'an Inter face finished loading').toBe(true);
});
