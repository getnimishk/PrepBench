// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { type APIRequestContext } from '@playwright/test';
import { expect, test } from './fixtures';
import { tag } from './helpers';

/**
 * A topic's study guide, in a real browser.
 *
 * The E2E backend runs with no AI provider (playwright.config.ts blanks the key),
 * which is exactly the state worth testing: the page must say drafting is not set
 * up rather than produce placeholder content, and a learner-written guide must
 * work end to end without it. The AI drafting path itself is covered by the
 * backend suite against a faked transport.
 */

async function roadmapTopic(request: APIRequestContext) {
  const roadmap = await (await request.post('/api/v1/roadmaps', { data: { title: `Guide E2E ${tag()}` } })).json();
  const phase = await (await request.post(`/api/v1/roadmaps/${roadmap.id}/phases`, { data: { name: 'Phase 1' } })).json();
  const topic = await (await request.post(`/api/v1/roadmaps/${roadmap.id}/topics`, {
    data: {
      phase_id: phase.id,
      title: 'Consumer Groups & Assignment',
      learning_objective: 'Understand how partitions are assigned across consumers in a group.',
      success_criteria: 'Explain max parallelism for a given partition count and group size.',
    },
  })).json();
  return { roadmapId: roadmap.id as number, topicId: topic.id as number };
}

test('with no AI set up, the guide says so and nothing is invented', async ({ page, request }) => {
  const { roadmapId, topicId } = await roadmapTopic(request);

  await page.goto(`/roadmaps/${roadmapId}/topics/${topicId}/guide`);

  await expect(page.getByText('No study guide yet')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Draft with AI' })).toBeDisabled();
  await expect(page.getByText(/No AI provider is set up for drafting study guides/)).toBeVisible();

  const guide = await (await request.get(`/api/v1/roadmaps/${roadmapId}/topics/${topicId}/guide`)).json();
  expect(guide.sections).toEqual([]);
});

test('a guide written by the learner is saved, read, and does not complete the topic', async ({ page, request }) => {
  const { roadmapId, topicId } = await roadmapTopic(request);

  await page.goto(`/roadmaps/${roadmapId}/topics/${topicId}`);
  await page.getByRole('button', { name: 'Study guide' }).click();

  await page.getByRole('button', { name: 'Write a section' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Title').fill('Parallelism is capped by partitions');
  await dialog.getByLabel('Explanation').fill('Each partition is read by at most one consumer in a group, so extra consumers sit idle.');
  await dialog.getByLabel('Check question (optional)').fill('Six partitions, eight consumers: how many are busy?');
  await dialog.getByLabel('Model answer (optional)').fill('Six. Two consumers have no partition to read.');
  await dialog.getByRole('button', { name: 'Save section' }).click();

  await expect(page.getByRole('heading', { name: 'Parallelism is capped by partitions' })).toBeVisible();
  await expect(page.getByText('Written by you')).toBeVisible();

  // The self-check reveals the model answer only after an answer is written.
  const compare = page.getByRole('button', { name: 'Compare with the model answer' });
  await expect(compare).toBeDisabled();
  await page.getByPlaceholder('Answer it before you look.').fill('Six, since each partition has one reader.');
  await compare.click();
  await expect(page.getByText('Six. Two consumers have no partition to read.')).toBeVisible();

  await page.getByRole('button', { name: 'I have read this' }).click();
  await expect(page.getByText('1 of 1 sections read')).toBeVisible();

  // Survives a reload.
  await page.reload();
  await expect(page.getByText('1 of 1 sections read')).toBeVisible();

  // Reading is not completion.
  const detail = await (await request.get(`/api/v1/roadmaps/${roadmapId}`)).json();
  const topic = detail.phases[0].topics.find((t: { id: number }) => t.id === topicId);
  expect(topic.status).not.toBe('completed');

  // The way on is demonstrating it.
  await expect(page.getByRole('button', { name: 'Demonstrate this topic' })).toBeVisible();
});

test('rich study guide diagrams, SVG, guide images, theme switching, text scaling and hostile security checks', async ({ page, request }) => {
  const { roadmapId, topicId } = await roadmapTopic(request);

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const externalRequests: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost' && !url.hostname.includes('google') && !url.hostname.includes('gstatic')) {
      externalRequests.push(req.url());
    }
  });

  const richBody = `
### Architecture Flowchart
\`\`\`mermaid
flowchart TD
  accTitle: System Flowchart
  accDescr: High level architecture
  Client[Client App] --> Gateway[API Gateway]
  Gateway --> DB[(Database)]
\`\`\`

### Authentication Sequence
\`\`\`mermaid
sequenceDiagram
  accTitle: Auth Sequence
  accDescr: User authentication flow
  User->>Server: Login credentials
  Server-->>User: JWT token
\`\`\`

### State Lifecycle
\`\`\`mermaid
stateDiagram-v2
  accTitle: Service State Lifecycle
  accDescr: Processing states from Idle to Complete
  [*] --> Idle
  Idle --> Running: Start
  Running --> Stopped: Stop
  Stopped --> [*]
\`\`\`

### Inline SVG Diagram
\`\`\`svg
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <title>Storage Layout</title>
  <desc>Partition replication layout</desc>
  <circle cx="50" cy="50" r="40" fill="#3157d5" />
</svg>
\`\`\`

### Bundled Guide Image
![Agentic Workflow](guide:ch01-fig1-ai-ml-genai-llm.svg)

### Broken Diagram
\`\`\`mermaid
flowchart TD
  :::invalid:::
\`\`\`
`.trim();

  // Create section via API
  await request.post(`/api/v1/roadmaps/${roadmapId}/topics/${topicId}/guide/sections`, {
    data: {
      title: 'Rich Content Architecture',
      body: richBody,
    },
  });

  await page.goto(`/roadmaps/${roadmapId}/topics/${topicId}/guide`);

  // Assert: each renders as an <img> with the expected alt
  const flowchartImg = page.locator('img[alt*="System Flowchart"]');
  await expect(flowchartImg).toBeVisible();

  const seqImg = page.locator('img[alt*="Auth Sequence"]');
  await expect(seqImg).toBeVisible();

  const stateImg = page.locator('img[alt*="Service State Lifecycle"]');
  await expect(stateImg).toBeVisible();

  const svgImg = page.locator('img[alt*="Storage Layout"]');
  await expect(svgImg).toBeVisible();

  const guideImg = page.locator('img[alt="Agentic Workflow"]');
  await expect(guideImg).toBeVisible();

  // Assert: the diagram source <details> is present
  const details = page.locator('details:has(summary:has-text("Diagram source"))');
  expect(await details.count()).toBeGreaterThanOrEqual(3);
  await expect(details.first().locator('pre code')).toContainText('flowchart TD');

  // Assert: malformed mermaid block shows fallback with its source
  await expect(page.getByText('Diagram could not be rendered:')).toBeVisible();
  await expect(page.locator('pre code', { hasText: ':::invalid:::' })).toBeVisible();

  // Assert: zero external requests and zero console errors
  expect(externalRequests).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);

  // Assert: Switch theme light to dark and assert the diagram re-renders
  const lightSrc = await flowchartImg.getAttribute('src');
  expect(lightSrc).toBeTruthy();

  await request.put('/api/v1/settings', { data: { theme: 'dark' } });
  await page.reload();
  await expect(flowchartImg).toBeVisible();
  await expect.poll(async () => flowchartImg.getAttribute('src')).not.toBe(lightSrc);
  const darkSrc = await flowchartImg.getAttribute('src');

  // Assert: Set the Large-text setting and assert the diagram grows
  await request.put('/api/v1/settings', { data: { text_size: 'large' } });
  await page.reload();
  await expect(flowchartImg).toBeVisible();
  await expect.poll(async () => flowchartImg.getAttribute('src')).not.toBe(darkSrc);
  const largeSrc = (await flowchartImg.getAttribute('src')) || '';
  const decodedLarge = decodeURIComponent(largeSrc);
  const decodedDark = decodeURIComponent(darkSrc || '');
  // 16px is used for large text font size versus 14px in standard
  expect(decodedLarge).toContain('16px');
  expect(decodedDark).toContain('14px');

  // Restore settings
  await request.put('/api/v1/settings', { data: { theme: 'light', text_size: 'standard' } });

  // Add a hostile section (svg with <script> and onload, markdown with <img src=x onerror=...>, a javascript: link)
  const hostileBody = `
Safe text before hostile attack.

<img src="x" onerror="window.__hostileExecuted = true" />

<script>window.__hostileExecuted = true;</script>

[Click for bonus](javascript:window.__hostileExecuted=true)

\`\`\`svg
<svg viewBox="0 0 100 100" onload="window.__hostileExecuted = true">
  <script>window.__hostileExecuted = true;</script>
  <circle cx="50" cy="50" r="40" />
</svg>
\`\`\`
  `.trim();

  await request.post(`/api/v1/roadmaps/${roadmapId}/topics/${topicId}/guide/sections`, {
    data: {
      title: 'Hostile Security Section',
      body: hostileBody,
    },
  });

  await page.reload();
  await page.getByRole('button', { name: /Hostile Security Section/ }).click();

  // Assert nothing executes and raw text is shown
  const executed = await page.evaluate(() => (window as unknown as { __hostileExecuted?: boolean }).__hostileExecuted);
  expect(executed).toBeUndefined();

  await expect(page.getByText('<img src="x" onerror="window.__hostileExecuted = true" />')).toBeVisible();
  await expect(page.getByText('<script>window.__hostileExecuted = true;</script>')).toBeVisible();

  // javascript: link is not rendered as an anchor tag
  const linkText = page.getByText('Click for bonus');
  await expect(linkText).toBeVisible();
  expect(await linkText.evaluate((el) => el.tagName)).not.toBe('A');

  // SVG with forbidden tags and onload rejected by sanitizeSvg
  await expect(page.getByText(/SVG could not be rendered:/)).toBeVisible();
  await expect(page.getByText(/Forbidden/)).toBeVisible();
});

test('editor has Write / Preview toggle and helper text', async ({ page, request }) => {
  const { roadmapId, topicId } = await roadmapTopic(request);

  await page.goto(`/roadmaps/${roadmapId}/topics/${topicId}/guide`);
  await page.getByRole('button', { name: 'Write a section' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/Supports Markdown, headings, lists, tables, links/)).toBeVisible();

  await dialog.getByLabel('Title').fill('Preview Test Title');
  await dialog.getByLabel('Explanation').fill('### Heading In Preview\n- Point 1\n- Point 2');

  // Click Preview toggle
  await dialog.getByRole('button', { name: 'Preview' }).click();
  await expect(dialog.getByRole('heading', { name: 'Preview Test Title' })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Heading In Preview' })).toBeVisible();
  await expect(dialog.getByText('Point 1')).toBeVisible();

  // Toggle back to Write
  await dialog.getByRole('button', { name: 'Write' }).click();
  await expect(dialog.getByLabel('Title')).toHaveValue('Preview Test Title');
});

