// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { GuideChapterPage } from './GuideChapterPage';

const api = { getContentPack: vi.fn(), getRoadmap: vi.fn() };
vi.mock('../services/api', () => ({
  getContentPack: (...a: any[]) => api.getContentPack(...a),
  getRoadmap: (...a: any[]) => api.getRoadmap(...a),
}));

let selected: any = null;
vi.mock('../context/PreparationContext', () => ({
  usePreparation: () => ({ selected }),
}));

const PACK = {
  pack_id: 'adf', version: 2, title: 'Azure Data Factory', summary: 's',
  docs_url: 'https://example.test/adf', source_notes: 'n',
  chapters: [
    { id: 'what-it-is', title: 'What it is', summary: 'sum', sources: '§1', blocks: [{ md: 'Some text.' }], practice_links: [] },
    { id: 'building-blocks', title: 'Building blocks', summary: 'sum2', sources: '§2', blocks: [{ md: 'More text.' }], practice_links: [] },
  ],
  scenario_levels: [], diagnostic_questions: [],
};

const mapped = (chapter_id: string, relevant_sections: string | null = null) => ({
  pack_id: 'adf', pack_title: 'Azure Data Factory', chapter_id, chapter_number: 1, chapter_title: chapter_id,
  topic_number: 1, topic_title: 't', coverage: 'Full', relevant_sections, learning_evidence: null,
});
const topic = (id: number, title: string, extra: Record<string, unknown> = {}) => ({
  id, roadmap_id: 7, phase_id: 1, order_index: id, title, status: 'not_started', progress_percentage: 0,
  learning_objective: `Objective of ${title}`, success_criteria: `Criterion of ${title}`, mapped_chapters: [], ...extra,
});
// Topics 11 and 12 share the first chapter; 13 is covered by the second only; 14 has no mapping.
const ROADMAP = {
  id: 7, title: 'ADF roadmap', phases: [{ id: 1, roadmap_id: 7, name: 'P1', order_index: 1, topics: [
    topic(11, 'Linked services', { mapped_chapters: [mapped('what-it-is', 'Linked services section')] }),
    topic(12, 'Datasets', { mapped_chapters: [mapped('what-it-is', 'Datasets section')] }),
    topic(13, 'Triggers', { mapped_chapters: [mapped('building-blocks')] }),
    topic(14, 'Unmapped', { success_criteria: null }),
  ] }],
};

const Where: React.FC = () => { const l = useLocation(); return <div data-testid="where">{l.pathname + l.search}</div>; };

const renderPage = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path="/learn/guides/:packId/:chapterId" element={<><GuideChapterPage /><Where /></>} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  api.getContentPack.mockReset().mockResolvedValue(PACK);
  api.getRoadmap.mockReset().mockResolvedValue(ROADMAP);
  selected = null;
});

describe('GuideChapterPage: version selection', () => {
  it('fetches the pinned version when the preparation has attached the pack', async () => {
    selected = { id: 1, name: 'Audit Skill', content_packs: [{ pack_id: 'adf', pack_version: 2, latest_version: 2, title: 'Azure Data Factory' }] };

    renderPage('/learn/guides/adf/what-it-is');

    expect(await screen.findByRole('heading', { name: /1 · What it is/ })).toBeInTheDocument();
    expect(api.getContentPack).toHaveBeenCalledWith('adf', 2);
    expect(screen.queryByText(/Not attached/)).not.toBeInTheDocument();
  });

  it('says the pack is not attached when the preparation has no link, and still shows the chapter', async () => {
    selected = { id: 1, name: 'Audit Skill', content_packs: [] };

    renderPage('/learn/guides/adf/what-it-is');

    expect(await screen.findByText(/Not attached to Audit Skill/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /1 · What it is/ })).toBeInTheDocument();
  });

  it('shows "Chapter not found" for an unknown chapter id, with a way back', async () => {
    renderPage('/learn/guides/adf/no-such-chapter');

    expect(await screen.findByRole('heading', { name: 'Chapter not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to Azure Data Factory/ })).toBeInTheDocument();
  });
});

describe('GuideChapterPage: roadmap alignment tab', () => {
  const ALIGN = '**Roadmap topics covered in this chapter:**\n\n- **Topic 1 — Intro** (Full)\n  - *Relevant sections:* Intro\n  - *Learning evidence:* Explain it.';
  const withAlignment = {
    ...PACK,
    chapters: [
      { ...PACK.chapters[0], blocks: [{ heading: 'Roadmap alignment', md: ALIGN }, { heading: 'Body', md: 'Some text.' }] },
      PACK.chapters[1],
    ],
  };

  it('keeps the alignment out of the chapter text and shows it in its own tab', async () => {
    api.getContentPack.mockResolvedValue(withAlignment);
    renderPage('/learn/guides/adf/what-it-is');

    expect(await screen.findByRole('tab', { name: 'Roadmap alignment' })).toBeInTheDocument();
    expect(screen.getByText('Some text.')).toBeInTheDocument();
    expect(screen.queryByText(/Learning evidence/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Roadmap alignment' }));
    expect(screen.getByText(/Learning evidence/)).toBeInTheDocument();
    expect(screen.queryByText('Some text.')).not.toBeInTheDocument();
    expect(screen.queryByText(/\*Relevant sections/)).not.toBeInTheDocument();
  });

  it('shows no tabs for a chapter without an alignment block', async () => {
    renderPage('/learn/guides/adf/what-it-is');
    expect(await screen.findByText('Some text.')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });
});

describe('GuideChapterPage: practising a chapter', () => {
  const content = { bookmark: 'b' };
  const withScenarios = {
    ...PACK,
    chapters: [
      PACK.chapters[0],
      { ...PACK.chapters[1], practice_links: [{ scenario_id: '3', label: 'x' }, { scenario_id: '4', label: 'y' }] },
    ],
    scenario_levels: [{
      name: 'Moving data', about: 'a',
      scenarios: [
        { id: '1', number: 1, title: 'Lost rows', outcome: 'o', sources: 's', chapter: 'what-it-is', content },
        { id: '2', number: 2, title: 'Planned one', outcome: 'o', sources: 's', chapter: 'what-it-is' },
        { id: '3', number: 3, title: 'Linked written', outcome: 'o', sources: 's', chapter: 'elsewhere', content },
        { id: '4', number: 4, title: 'Linked planned', outcome: 'o', sources: 's', chapter: 'elsewhere' },
      ],
    }],
  };

  it('links the written scenarios for this chapter, and "Practise this" opens the first', async () => {
    api.getContentPack.mockResolvedValue(withScenarios);
    renderPage('/learn/guides/adf/what-it-is');

    expect(await screen.findByRole('link', { name: 'Practise this' })).toHaveAttribute('href', '/scenarios/adf/1');
    expect(screen.getByRole('link', { name: 'scenario 1, Lost rows' })).toHaveAttribute('href', '/scenarios/adf/1');
    // A planned scenario can't be opened, so it isn't linked.
    expect(screen.queryByText(/Planned one/)).not.toBeInTheDocument();
  });

  it('follows the pack\'s practice links to other chapters\' scenarios, written ones only', async () => {
    api.getContentPack.mockResolvedValue(withScenarios);
    renderPage('/learn/guides/adf/building-blocks');

    expect(await screen.findByRole('link', { name: 'scenario 3, Linked written' })).toHaveAttribute('href', '/scenarios/adf/3');
    expect(screen.queryByText(/Linked planned/)).not.toBeInTheDocument();
  });

  it('shows no practice at all for a chapter nothing practises', async () => {
    renderPage('/learn/guides/adf/what-it-is');
    expect(await screen.findByRole('heading', { name: /1 · What it is/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Practise this' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Practise it in the Learning Lab/)).not.toBeInTheDocument();
  });
});

describe('GuideChapterPage: roadmap topic context', () => {
  const CHAPTER = '/learn/guides/adf/what-it-is';
  const strip = () => screen.findByRole('navigation', { name: 'Roadmap topic' });

  it('names the topic the chapter was opened from, with its objective and the sections for it', async () => {
    renderPage(`${CHAPTER}?roadmap=7&topic=12`);

    const bar = await strip();
    expect(bar).toHaveTextContent('Datasets');
    expect(bar).toHaveTextContent('Objective of Datasets');
    expect(bar).toHaveTextContent('Datasets section');
    expect(bar).not.toHaveTextContent('Linked services');
    expect(bar).toHaveTextContent(/Reading does not complete the topic/);
  });

  it("returns to the topic and reaches that topic's own demonstration", async () => {
    renderPage(`${CHAPTER}?roadmap=7&topic=12`);
    const bar = await strip();

    expect(within(bar).getByRole('link', { name: 'Back to topic' })).toHaveAttribute('href', '/roadmaps/7/topics/12');
    expect(within(bar).getByRole('link', { name: 'Demonstrate mastery' })).toHaveAttribute('href', '/roadmaps/7/topics/12/demonstrate');
    expect(within(bar).getByRole('link', { name: 'Roadmap' })).toHaveAttribute('href', '/roadmaps/7');
    expect(within(bar).getByRole('link', { name: /Next topic: Triggers/ })).toHaveAttribute('href', '/roadmaps/7/topics/13');
  });

  it('continues to the next chapter without a mastery step, keeping the topic in the address', async () => {
    renderPage(`${CHAPTER}?roadmap=7&topic=13`);
    // Topic 13 is covered by chapter 2 only: no strip on chapter 1, but the address carries the topic on.
    await waitFor(() => expect(api.getRoadmap).toHaveBeenCalled());
    await userEvent.click(await screen.findByRole('link', { name: /Next: Building blocks/ }));

    expect(await screen.findByRole('heading', { name: /2 · Building blocks/ })).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/learn/guides/adf/building-blocks?roadmap=7&topic=13');
    expect(await strip()).toHaveTextContent('Triggers');
  });

  it('shows no strip on a chapter the topic does not map to, rather than a wrong one', async () => {
    renderPage('/learn/guides/adf/building-blocks?roadmap=7&topic=12');

    expect(await screen.findByRole('heading', { name: /2 · Building blocks/ })).toBeInTheDocument();
    await waitFor(() => expect(api.getRoadmap).toHaveBeenCalled());
    expect(screen.queryByRole('navigation', { name: 'Roadmap topic' })).not.toBeInTheDocument();
  });

  it('links each relevant section to its heading on the page, and leaves a name it cannot match as text', async () => {
    api.getContentPack.mockResolvedValue({
      ...PACK,
      chapters: [{ ...PACK.chapters[0], blocks: [
        { heading: 'The watermark, step by step', md: 'Steps.' },
        { heading: 'What a watermark cannot do', md: 'Limits.' },
      ] }, PACK.chapters[1]],
    });
    api.getRoadmap.mockResolvedValue({
      ...ROADMAP,
      phases: [{ ...ROADMAP.phases[0], topics: [topic(12, 'Watermark Patterns', {
        mapped_chapters: [mapped('what-it-is', 'The watermark, step by step; What a watermark cannot do; Ch 2 (the whole picture)')],
      })] }],
    });
    renderPage(`${CHAPTER}?roadmap=7&topic=12`);

    const bar = await strip();
    expect(within(bar).getByRole('link', { name: 'The watermark, step by step' })).toHaveAttribute('href', '#block-0');
    expect(within(bar).getByRole('link', { name: 'What a watermark cannot do' })).toHaveAttribute('href', '#block-1');
    expect(screen.getByRole('heading', { name: 'What a watermark cannot do' })).toHaveAttribute('id', 'block-1');
    expect(within(bar).queryByRole('link', { name: /Ch 2/ })).not.toBeInTheDocument();
    expect(bar).toHaveTextContent('Ch 2 (the whole picture)');
  });

  it('offers the next topic still to do, passing over a completed one', async () => {
    api.getRoadmap.mockResolvedValue({
      ...ROADMAP,
      phases: [{ ...ROADMAP.phases[0], topics: [
        ROADMAP.phases[0].topics[1],
        topic(13, 'Triggers', { status: 'completed', completed_at: '2026-10-01T10:00:00' }),
        topic(14, 'Unmapped'),
      ] }],
    });
    renderPage(`${CHAPTER}?roadmap=7&topic=12`);

    const bar = await strip();
    expect(within(bar).getByRole('link', { name: 'Next topic: Unmapped' })).toHaveAttribute('href', '/roadmaps/7/topics/14');
  });

  it('links the Behaviour Lab experiment that practises the chapter', async () => {
    api.getContentPack.mockResolvedValue({
      ...PACK,
      chapters: [{ ...PACK.chapters[0], id: 'incremental', title: 'Loading only new data' }, PACK.chapters[1]],
    });
    renderPage('/learn/guides/adf/incremental');

    expect(await screen.findByRole('link', { name: 'Watermark & Transient Failure' })).toHaveAttribute('href', '/lab/adf/watermark');
  });

  it('offers no demonstration when the topic has no success criterion', async () => {
    api.getRoadmap.mockResolvedValue({
      ...ROADMAP,
      phases: [{ ...ROADMAP.phases[0], topics: [topic(14, 'Unmapped', { success_criteria: null, mapped_chapters: [mapped('what-it-is')] })] }],
    });
    renderPage(`${CHAPTER}?roadmap=7&topic=14`);

    const bar = await strip();
    expect(within(bar).queryByRole('link', { name: 'Demonstrate mastery' })).not.toBeInTheDocument();
    expect(within(bar).getByRole('link', { name: 'Back to topic' })).toBeInTheDocument();
  });

  it.each([
    ['no context', ''],
    ['a topic with no roadmap', '?topic=12'],
    ['non-numeric ids', '?roadmap=abc&topic=1x'],
    ['an unknown topic', '?roadmap=7&topic=999'],
    ['a topic with no mapped chapter', '?roadmap=7&topic=14'],
  ])('shows the chapter normally with %s', async (_label, query) => {
    renderPage(`${CHAPTER}${query}`);

    expect(await screen.findByRole('heading', { name: /1 · What it is/ })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Roadmap topic' })).not.toBeInTheDocument();
    await waitFor(() => expect(api.getContentPack).toHaveBeenCalled());
    if (!query.includes('roadmap=7')) expect(api.getRoadmap).not.toHaveBeenCalled();
    if (query === '' || query.startsWith('?topic') || query.includes('abc')) {
      expect(screen.getByRole('link', { name: /Next: Building blocks/ })).toHaveAttribute('href', '/learn/guides/adf/building-blocks');
    }
  });

  it('shows the chapter when the roadmap cannot be read', async () => {
    api.getRoadmap.mockRejectedValue(new Error('down'));
    renderPage(`${CHAPTER}?roadmap=7&topic=12`);

    expect(await screen.findByRole('heading', { name: /1 · What it is/ })).toBeInTheDocument();
    await waitFor(() => expect(api.getRoadmap).toHaveBeenCalled());
    expect(screen.queryByRole('navigation', { name: 'Roadmap topic' })).not.toBeInTheDocument();
  });

  it('only reads: the chapter page has no way to write progress or mastery', async () => {
    renderPage(`${CHAPTER}?roadmap=7&topic=12`);
    await strip();
    expect(Object.keys(api).sort()).toEqual(['getContentPack', 'getRoadmap']);
  });
});
