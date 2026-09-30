// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { GuideMarkdown } from './GuideMarkdown';

// Mock mermaid for unit tests
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({
      svg: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" /></svg>',
    }),
  },
}));

describe('GuideMarkdown', () => {
  it('does not render raw HTML (<img onerror>, <script>) and shows it as text', () => {
    const hostile = 'Safe text with <img src="x" onerror="window.pwned=1" /> and <script>window.hacked=1</script>';
    const { container } = render(<GuideMarkdown text={hostile} />);

    // No HTML <img> or <script> tags should be created in the DOM
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();

    // The raw text should be visible on screen
    expect(screen.getByText(/Safe text with/)).toBeInTheDocument();
    expect(screen.getByText(/<img src="x" onerror="window.pwned=1" \/>/)).toBeInTheDocument();
    expect(screen.getByText(/<script>window.hacked=1<\/script>/)).toBeInTheDocument();
  });

  it('does not create javascript: links and renders plain text', () => {
    const md = '[Click me](javascript:alert("hacked")) and [Safe link](https://prepbench.test)';
    const { container } = render(<GuideMarkdown text={md} />);

    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('https://prepbench.test');
    expect(links[0].getAttribute('target')).toBe('_blank');
    expect(links[0].getAttribute('rel')).toBe('noopener noreferrer');

    // javascript: link text is rendered as plain text, not a link
    expect(screen.getByText('Click me')).toBeInTheDocument();
    expect(screen.getByText('Click me').closest('a')).toBeNull();
  });

  it('shows error message when image has an unknown scheme or external url', () => {
    const md = '![Architecture diagram](https://evil.com/pic.png)\n\n![Local image](file:///etc/pic.png)';
    render(<GuideMarkdown text={md} />);

    expect(screen.getByText(/Image not shown: only bundled guide images are allowed \(Architecture diagram\)/)).toBeInTheDocument();
    expect(screen.getByText(/Image not shown: only bundled guide images are allowed \(Local image\)/)).toBeInTheDocument();
  });

  it('shows error message when image has an empty alt text', () => {
    const md = '![](guide:ch01-fig1-ai-ml-genai-llm.svg)\n\n![   ](guide:ch01-fig2-programming-vs-ml.svg)';
    render(<GuideMarkdown text={md} />);

    const missing = screen.getAllByText('Image is missing a description');
    expect(missing).toHaveLength(2);
  });

  it('resolves bundled guide images as an img inside figure with alt', () => {
    const md = '![AI/ML Layers](guide:ch01-fig1-ai-ml-genai-llm.svg)';
    const { container } = render(<GuideMarkdown text={md} />);

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('alt')).toBe('AI/ML Layers');
    expect(img?.getAttribute('src')).toBeTruthy();
    expect(img?.closest('figure')).not.toBeNull();
  });

  it('shows fallback with error message and source when mermaid diagram has an unknown type', () => {
    const md = '```mermaid\npie title Pets\n"Dogs" : 386\n"Cats" : 85\n```';
    render(<GuideMarkdown text={md} />);

    expect(screen.getByText(/Diagram could not be rendered:/)).toBeInTheDocument();
    expect(screen.getByText(/Diagram type "pie" is not supported/)).toBeInTheDocument();
    expect(screen.getByText(/pie title Pets/)).toBeInTheDocument();
  });

  it('renders a valid mermaid diagram with accTitle alt and source details', async () => {
    const md = '```mermaid\nflowchart LR\naccTitle: Data pipeline flow\nA --> B\n```';
    const { container } = render(<GuideMarkdown text={md} />);

    await waitFor(() => {
      const img = container.querySelector('img');
      expect(img).not.toBeNull();
      expect(img?.getAttribute('alt')).toBe('Data pipeline flow');
    });

    const details = container.querySelector('details');
    expect(details).not.toBeNull();
    expect(details?.querySelector('summary')?.textContent).toBe('Diagram source');
    expect(details?.querySelector('pre code')?.textContent).toContain('flowchart LR');
  });

  it('renders valid inline svg blocks as data URI img inside figure', () => {
    const md = '```svg\n<svg viewBox="0 0 100 100"><title>Custom Circle</title><circle cx="50" cy="50" r="40" /></svg>\n```';
    const { container } = render(<GuideMarkdown text={md} />);

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('alt')).toBe('Custom Circle');
    expect(img?.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
    expect(img?.closest('figure')).not.toBeNull();
  });

  it('renders headings as h3 and h4 only (never h1 or h2)', () => {
    const md = `
# Main Section Heading
## Subsection Heading
### Deep Heading
#### Deeper Heading
##### Deepest Heading
    `.trim();

    const { container } = render(<GuideMarkdown text={md} />);

    expect(container.querySelectorAll('h1')).toHaveLength(0);
    expect(container.querySelectorAll('h2')).toHaveLength(0);

    const h3s = container.querySelectorAll('h3');
    const h4s = container.querySelectorAll('h4');

    expect(h3s.length).toBeGreaterThanOrEqual(2);
    expect(h4s.length).toBeGreaterThanOrEqual(1);
  });

  it('renders GFM tables properly', () => {
    const md = `
| Term | Definition |
| --- | --- |
| Kafka | Distributed log |
| Flink | Stream processor |
    `.trim();

    const { container } = render(<GuideMarkdown text={md} />);

    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    expect(screen.getByText('Kafka')).toBeInTheDocument();
    expect(screen.getByText('Stream processor')).toBeInTheDocument();
  });

  it('preserves paragraph breaks and lists in existing lesson-style plain text', () => {
    const text = `The first paragraph explains the fundamental concept.

The second paragraph elaborates with more details and context.

- First key takeaway
- Second key takeaway
- Third key takeaway

Final concluding remarks.`;

    const { container } = render(<GuideMarkdown text={text} />);

    // Paragraphs separated by blank lines are distinct <p> elements
    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs.length).toBe(3);
    expect(paragraphs[0].textContent).toContain('The first paragraph explains');
    expect(paragraphs[1].textContent).toContain('The second paragraph elaborates');
    expect(paragraphs[2].textContent).toContain('Final concluding remarks');

    // List items are parsed into <ul> and <li>
    const listItems = container.querySelectorAll('li');
    expect(listItems.length).toBe(3);
    expect(listItems[0].textContent).toBe('First key takeaway');
    expect(listItems[1].textContent).toBe('Second key takeaway');
    expect(listItems[2].textContent).toBe('Third key takeaway');
  });
});
