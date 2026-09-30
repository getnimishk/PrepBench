// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { expect, type APIRequestContext, type Page, type Request } from '@playwright/test';

/**
 * Shared set-up for the browser tests.
 *
 * Data is created through the API rather than by clicking, for two reasons.
 * It is fast, so each test can build exactly the state it needs instead of
 * sharing fixtures. And it keeps each test about one thing: the isolation test
 * should fail because isolation broke, not because the Add Preparation form
 * moved a button.
 *
 * Every request goes through the dev server's /api proxy to the E2E backend,
 * which runs against its own throwaway database -- see playwright.config.ts.
 */

export const tag = () => Math.random().toString(36).slice(2, 8);

export interface CreatedPreparation {
  id: number;
  name: string;
  certification: string;
}

export async function createCertification(
  request: APIRequestContext,
  stem: string,
): Promise<CreatedPreparation> {
  const t = tag();
  const name = `${stem} ${t}`;
  const certification = `${stem} Certification ${t}`;
  const response = await request.post('/api/v1/subjects', {
    data: {
      name,
      kind: 'certification',
      certification,
      pass_mark: 85,
      exam_question_count: 3,
      exam_minutes: 30,
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  const body = await response.json();
  return { id: body.id, name, certification };
}

export interface CreatedSkill {
  id: number;
  name: string;
}

/** A Skill preparation with a built-in content pack attached, at its latest version. */
export async function createSkillWithPack(
  request: APIRequestContext,
  stem: string,
  packId: string,
): Promise<CreatedSkill> {
  const name = `${stem} ${tag()}`;
  const created = await request.post('/api/v1/subjects', { data: { name, kind: 'skill' } });
  expect(created.status(), await created.text()).toBe(201);
  const body = await created.json();

  const attached = await request.post(`/api/v1/subjects/${body.id}/content-packs`, { data: { pack_id: packId } });
  expect(attached.status(), await attached.text()).toBe(201);

  return { id: body.id, name };
}

/**
 * A role (a job the learner is preparing for) through the API, with one
 * requirement linked to `skillId` when given -- a link a learner confirmed.
 */
export async function createRole(
  request: APIRequestContext,
  stem: string,
  skillId?: number,
): Promise<{ id: number; name: string }> {
  const name = `${stem} ${tag()}`;
  const created = await request.post('/api/v1/roles', {
    data: {
      name,
      job_description: 'SAMPLE JOB DESCRIPTION (fictional)\nMandatory skills\n- Data reconciliation for migrations\n- Power BI',
      lens: 'po',
      requirements: [
        { text: 'Data reconciliation and validation for migrations', kind: 'mandatory', subject_id: skillId ?? null },
        { text: 'Power BI', kind: 'preferred' },
      ],
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  return { id: (await created.json()).id, name };
}

/** One question owned by `prep`, with text unique enough to find on screen. */
export async function createQuestion(
  request: APIRequestContext,
  prep: CreatedPreparation,
  text: string,
  domain = 'E2E Domain',
): Promise<number> {
  const response = await request.post('/api/v1/questions', {
    data: {
      text,
      question_type: 'single_choice',
      difficulty: 'medium',
      domain,
      topic: 'E2E Topic',
      certification: prep.certification,
      explanation: 'Created by the browser test suite.',
      options: [
        { option_text: 'Right', is_correct: true, order_index: 0 },
        { option_text: 'Wrong', is_correct: false, order_index: 1 },
      ],
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  const body = await response.json();
  // The server attributes a question to a preparation by exact certification
  // match. Asserting it here means a broken attribution fails in set-up with a
  // clear message, instead of later as a mysteriously empty question bank.
  expect(body.subject_id, 'question was not attributed to its preparation').toBe(prep.id);
  return body.id;
}

/** Choose a preparation from the header picker, the way a person would. */
export async function pickPreparation(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: /^Preparation:/ }).click();
  await page.getByRole('menuitem', { name: new RegExp(escapeRegExp(name)) }).click();
  await expect(page.getByRole('button', { name: `Preparation: ${name}. Change preparation` }))
    .toBeVisible();
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * "The screen has its data", without networkidle.
 *
 * networkidle waits for 500 ms with no connection of any kind open -- a fixed
 * half second on every screen, and it counts things that are not the screen's
 * data (fonts from Google, say). What a check needs is narrower: everything the
 * screen asked the app itself for has arrived -- its API calls, its bundled
 * images (a study guide's `guide:` figures), and its code, since each screen and
 * tab loads its own JavaScript chunk on demand and shows a spinner until it has.
 * Tracking only the API missed those chunks: axe once audited a Practice tab
 * still showing its loading spinner. So every same-origin request is tracked,
 * third-party ones are not, with a 100 ms quiet window so a request one response
 * sets off is not missed.
 *
 * API calls are counted inside the page, where the app makes them: every fetch
 * and XMLHttpRequest to the app's own origin, from the moment it starts until it
 * settles -- which an XHR's loadend and a fetch's promise always do, whether it
 * succeeded, failed or was cancelled. They were first counted from Playwright's
 * request events instead, and a screen that cancels its calls when you move on
 * (Home does, on the way to a scenario) left requests for which Playwright
 * reported neither an end nor a failure: in flight forever, and a test failing
 * on a page that had long finished loading. Code chunks, styles and images are
 * not cancelled that way, and are still counted from Playwright's events.
 *
 * The tracker has to be on the page before it navigates. Attached at the moment
 * of waiting, it would not see a request the page made while loading -- it would
 * count nothing in flight and report idle while the data is still coming, which
 * is a check passing on a half-loaded screen. Hence two calls: trackApi(page) up
 * front, waitForApiIdle(page) at each point that needs the data.
 */
const QUIET_MS = 100;

interface ResourceTracker {
  pending: Set<Request>;
  lastActivity: number;
}

const trackers = new WeakMap<Page, ResourceTracker>();

const RESOURCE_TYPES = new Set(['script', 'stylesheet', 'image', 'font']);

function isOwnResource(request: Request): boolean {
  // The app's own code, styles and images -- not a third party's, and not a
  // data: URL, which makes no request to wait for.
  if (!RESOURCE_TYPES.has(request.resourceType())) return false;
  const url = new URL(request.url());
  return url.hostname === '127.0.0.1' || url.hostname === 'localhost';
}

interface InPageCount { count: number; msSinceLast: number; urls: string[] }

/** Runs in the page, before any of its own scripts: counts its same-origin fetch and XHR calls. */
function countApiCalls(): void {
  type State = { count: number; last: number; pending: Map<number, string>; next: number };
  const w = window as unknown as { __pbApiCalls?: State };
  if (w.__pbApiCalls) return;
  const state: State = { count: 0, last: performance.now(), pending: new Map(), next: 0 };
  w.__pbApiCalls = state;

  const own = (url: string) => {
    try { return new URL(url, location.href).origin === location.origin; } catch { return false; }
  };
  const begin = (url: string) => {
    const id = state.next;
    state.next += 1;
    state.pending.set(id, url);
    state.count += 1;
    state.last = performance.now();
    return id;
  };
  const end = (id: number) => {
    if (!state.pending.delete(id)) return;
    state.count -= 1;
    state.last = performance.now();
  };

  const fetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!own(url)) return fetch.call(this, input, init);
    const id = begin(url);
    return fetch.call(this, input, init).finally(() => end(id));
  };

  const open = XMLHttpRequest.prototype.open;
  const send = XMLHttpRequest.prototype.send;
  const urls = new WeakMap<XMLHttpRequest, string>();
  XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, ...args: unknown[]) {
    urls.set(this, String(args[1]));
    return (open as (...a: unknown[]) => void).apply(this, args);
  };
  XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    const url = urls.get(this) ?? '';
    if (own(url)) {
      const id = begin(url);
      // loadend follows load, error, abort and timeout alike.
      this.addEventListener('loadend', () => end(id), { once: true });
    }
    return send.call(this, body);
  };
}

async function inPageCount(page: Page): Promise<InPageCount> {
  try {
    return await page.evaluate(() => {
      const s = (window as unknown as { __pbApiCalls?: { count: number; last: number; pending: Map<number, string> } }).__pbApiCalls;
      if (!s) return { count: 0, msSinceLast: Number.POSITIVE_INFINITY, urls: [] };
      return { count: s.count, msSinceLast: performance.now() - s.last, urls: [...s.pending.values()] };
    });
  } catch {
    // Mid-navigation: the old document is gone and the new one not yet ready. Not idle.
    return { count: 1, msSinceLast: 0, urls: ['(page navigating)'] };
  }
}

/** Start tracking `page`'s own requests. Call before its first goto; calling again is harmless. */
export async function trackApi(page: Page): Promise<void> {
  if (trackers.has(page)) return;
  const tracker: ResourceTracker = { pending: new Set(), lastActivity: Date.now() };
  trackers.set(page, tracker);
  const settle = (request: Request) => {
    if (tracker.pending.delete(request)) tracker.lastActivity = Date.now();
  };
  page.on('request', (request) => {
    if (!isOwnResource(request)) return;
    tracker.pending.add(request);
    tracker.lastActivity = Date.now();
  });
  page.on('requestfinished', settle);
  page.on('requestfailed', settle);
  await page.addInitScript(countApiCalls);
}

// What the app shows while something is loading: an indeterminate spinner or
// bar (MUI's determinate ones are value bars -- a score, a progress count -- and
// stay), or a diagram still drawing (aria-busy while mermaid renders, which is
// computation, not a request). Not inside a [data-specimen]: the Interface
// states page shows a loading state as a sample, spinning forever by design.
const LOADING = ':is(.MuiCircularProgress-indeterminate, .MuiLinearProgress-indeterminate, [aria-busy="true"]):not([data-specimen] *)';

/**
 * Wait until none of `page`'s same-origin requests is in flight, none has
 * started or ended for 100 ms, and nothing on the page says it is still loading
 * -- all three at once. The last is not redundant: a screen can wait on a timer
 * before it asks for anything (Practice's Custom tab waits 250 ms after each
 * change before it fetches its preview), and with nothing in flight during that
 * gap the first two alone called it ready while it still showed "Checking your
 * bank…". Fails naming what was still pending, rather than returning early.
 */
export async function waitForApiIdle(page: Page, timeoutMs = 15_000): Promise<void> {
  const tracker = trackers.get(page);
  if (!tracker) throw new Error('waitForApiIdle: call trackApi(page) before the page navigates, or requests made while it loads go unseen.');
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const calls = await inPageCount(page);
    const quiet = calls.count === 0 && calls.msSinceLast >= QUIET_MS
      && tracker.pending.size === 0 && Date.now() - tracker.lastActivity >= QUIET_MS;
    const loading = quiet ? await page.locator(LOADING).count() : 0;
    if (quiet && loading === 0) return;
    if (Date.now() > deadline) {
      const pending = [...calls.urls, ...[...tracker.pending].map((r) => `${r.method()} ${r.url()}`)];
      throw new Error(`waitForApiIdle: not idle after ${timeoutMs} ms; still in flight: ${pending.join(', ') || '(none)'}`
        + (loading ? `; ${loading} loading indicator(s) still on the page` : ''));
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

/**
 * Wait until a change made in place -- a new viewport size, a theme switch -- has
 * finished drawing: two animation frames, so React has re-rendered for the new
 * media query or theme and the browser has laid that out, then until no CSS
 * transition is still running. A theme switch fades backgrounds but not text, so
 * measuring mid-fade would check contrast on colours no learner sees at rest.
 * Only transitions: a spinner's animation never ends and is not being waited on.
 */
export async function waitForTransitionsToSettle(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await expect.poll(() => page.evaluate(() => document.getAnimations()
    .filter((a) => 'transitionProperty' in a && a.playState === 'running').length), { message: 'a CSS transition is still running' })
    .toBe(0);
}

/**
 * A completed mock for `prep`, with every answer wrong.
 *
 * Built through the same endpoints the exam runner uses -- create, answer,
 * finish -- rather than by writing rows, so the misses it produces are exactly
 * the ones a learner would have: in the review queue, counted by the daily goal.
 */
export async function completedMockWithMisses(
  request: APIRequestContext,
  prep: CreatedPreparation,
  questionCount: number,
  domain = 'E2E Domain',
): Promise<void> {
  for (let i = 0; i < questionCount; i += 1) {
    await createQuestion(request, prep, `Mock question ${i} ${tag()}`, domain);
  }

  const created = await request.post('/api/v1/exams', {
    data: { subject_id: prep.id, session_kind: 'mock', total_questions: questionCount },
  });
  expect(created.status(), await created.text()).toBe(201);
  const sessionId = (await created.json()).id;

  const detail = await (await request.get(`/api/v1/exams/${sessionId}`)).json();
  for (const question of detail.questions as { id: number; options: { id: number; is_correct?: boolean }[] }[]) {
    // Deliberately wrong. The detail endpoint may not reveal correctness before
    // the paper is finished, so pick an option that is not the correct one when
    // it is known and otherwise the last one; the seeded questions put the
    // correct option first.
    const wrong = question.options.find((o) => o.is_correct === false) ?? question.options[question.options.length - 1];
    const answered = await request.post(`/api/v1/exams/${sessionId}/answer`, {
      data: { question_id: question.id, selected_option_ids: [wrong.id] },
    });
    expect(answered.status(), await answered.text()).toBe(200);
  }

  const finished = await request.post(`/api/v1/exams/${sessionId}/finish`);
  expect(finished.status(), await finished.text()).toBe(200);
}
