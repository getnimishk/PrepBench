// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoadmapCurriculumTools } from './RoadmapCurriculumTools';
import type { RoadmapDetail } from '../../types/roadmap';

const api = {
  previewTitleRepair: vi.fn(), applyTitleRepair: vi.fn(), previewCourseLessons: vi.fn(), applyCourseLessons: vi.fn(),
};
vi.mock('../../services/api', () => ({
  previewTitleRepair: (...a: unknown[]) => api.previewTitleRepair(...a),
  applyTitleRepair: (...a: unknown[]) => api.applyTitleRepair(...a),
  previewCourseLessons: (...a: unknown[]) => api.previewCourseLessons(...a),
  applyCourseLessons: (...a: unknown[]) => api.applyCourseLessons(...a),
}));

const roadmap = (titles: string[]): RoadmapDetail => ({
  id: 6, title: 'ADF Master Roadmap', is_archived: false, phase_count: 1, resources: [], sheets: [],
  progress: {
    total_topics: titles.length, not_started_count: titles.length, in_progress_count: 0, completed_count: 0, skipped_count: 0,
    completion_percentage: 0, hours_percentage: null, total_estimated_hours: null, completed_estimated_hours: null,
  },
  phases: [{
    id: 1, roadmap_id: 6, name: '1. Foundations', order_index: 0,
    topics: titles.map((title, i) => ({
      id: 278 + i, roadmap_id: 6, phase_id: 1, order_index: i, title, status: 'not_started' as const, progress_percentage: 0,
    })),
  }],
});

const CHANGES = [
  { topic_id: 278, phase: '1. Foundations', number: '1', old_title: '1', new_title: 'What ADF Is' },
  { topic_id: 279, phase: '1. Foundations', number: '2', old_title: '2', new_title: 'Pipelines and Activities' },
];

const fileInput = (dialog: HTMLElement) => dialog.querySelector('input[type="file"]') as HTMLInputElement;

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
});

describe('RoadmapCurriculumTools -- title repair (D1)', () => {
  it('offers the repair only when some topic is titled with a bare number', () => {
    const { rerender } = render(<RoadmapCurriculumTools roadmap={roadmap(['What ADF Is'])} onChanged={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /repair titles/i })).not.toBeInTheDocument();
    rerender(<RoadmapCurriculumTools roadmap={roadmap(['1', '2', 'Named'])} onChanged={vi.fn()} />);
    expect(screen.getByText(/2 topics are titled with only a number/)).toBeInTheDocument();
  });

  it('previews the renames, changes nothing until confirmed, then renames exactly the previewed topics', async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    api.previewTitleRepair.mockResolvedValue({ roadmap_id: 6, source_filename: 'ADF.xlsx', changes: CHANGES, already_named: 1, problems: [], can_apply: true });
    api.applyTitleRepair.mockResolvedValue({ roadmap_id: 6, repaired: CHANGES });
    render(<RoadmapCurriculumTools roadmap={roadmap(['1', '2', 'Named'])} onChanged={onChanged} />);

    await user.click(screen.getByRole('button', { name: /repair titles/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Repair numbered topic titles' });
    const file = new File(['xlsx'], 'ADF_Master_Roadmap.xlsx');
    fireEvent.change(fileInput(dialog), { target: { files: [file] } });

    const table = await within(dialog).findByRole('table', { name: 'Titles that would change' });
    expect(within(table).getByText('What ADF Is')).toBeInTheDocument();
    expect(within(dialog).getByText(/1 already named are left alone/)).toBeInTheDocument();
    expect(api.applyTitleRepair).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Rename 2 topics' }));
    await waitFor(() => expect(api.applyTitleRepair).toHaveBeenCalledWith(6, file, [278, 279]));
    expect(await within(dialog).findByText(/Renamed 2 topics/)).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('refuses to run when the preview found a problem', async () => {
    const user = userEvent.setup();
    api.previewTitleRepair.mockResolvedValue({
      roadmap_id: 6, source_filename: 'x.xlsx', changes: CHANGES, already_named: 0,
      problems: ['Phase 1 has two rows numbered 2.'], can_apply: false,
    });
    render(<RoadmapCurriculumTools roadmap={roadmap(['1', '2'])} onChanged={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /repair titles/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(fileInput(dialog), { target: { files: [new File(['x'], 'x.xlsx')] } });
    expect(await within(dialog).findByText(/two rows numbered 2/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Rename' })).toBeDisabled();
  });

  it('says nothing changed when the rename is refused', async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    api.previewTitleRepair.mockResolvedValue({ roadmap_id: 6, source_filename: 'x', changes: CHANGES, already_named: 0, problems: [], can_apply: true });
    api.applyTitleRepair.mockRejectedValue({ isAxiosError: true, response: { status: 400, data: { detail: 'The topics changed since the preview.' } } });
    render(<RoadmapCurriculumTools roadmap={roadmap(['1', '2'])} onChanged={onChanged} />);
    await user.click(screen.getByRole('button', { name: /repair titles/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(fileInput(dialog), { target: { files: [new File(['x'], 'x.xlsx')] } });
    await user.click(await within(dialog).findByRole('button', { name: 'Rename 2 topics' }));
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });
});

describe('RoadmapCurriculumTools -- course lessons (D2)', () => {
  const lessonFile = (name: string, body: object) => new File([JSON.stringify(body)], name, { type: 'application/json' });

  it('reads lesson files, previews exact matches, and labels only those once confirmed', async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    const matched = [{ section_id: 41, topic_id: 300, topic_title: 'Agents', section_title: 'What an agent is' }];
    api.previewCourseLessons.mockResolvedValue({ roadmap_id: 6, matched, unmatched_written_by_you: 15, already_course: 0, ai_drafts: 2 });
    api.applyCourseLessons.mockResolvedValue({ roadmap_id: 6, relabelled: matched });
    render(<RoadmapCurriculumTools roadmap={roadmap(['Agents'])} onChanged={onChanged} />);

    await user.click(screen.getByRole('button', { name: /label course lessons/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Label course lessons' });
    fireEvent.change(fileInput(dialog), {
      target: {
        files: [
          lessonFile('01.guide.json', { topic_title: 'Agents', sections: [{ title: 'What an agent is', body: 'A loop.' }] }),
          lessonFile('notes.json', { hello: 'world' }),
        ],
      },
    });

    expect(await within(dialog).findByText(/1 section match a lesson word for word/)).toBeInTheDocument();
    expect(within(dialog).getByText(/15 do not match exactly and stay “Written by you”/)).toBeInTheDocument();
    expect(within(dialog).getByText(/1 file was not a lesson file/)).toBeInTheDocument();
    const [, lessons] = api.previewCourseLessons.mock.calls[0];
    expect(lessons).toEqual([{
      topic_title: 'Agents',
      sections: [{ title: 'What an agent is', body: 'A loop.', example: null, common_mistake: null, check_question: null, check_answer: null }],
    }]);
    expect(api.applyCourseLessons).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Label 1 as course lessons' }));
    await waitFor(() => expect(api.applyCourseLessons).toHaveBeenCalledWith(6, lessons, [41]));
    expect(await within(dialog).findByText(/Labelled 1 section “Course lesson”/)).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('offers nothing to label when no section matches', async () => {
    const user = userEvent.setup();
    api.previewCourseLessons.mockResolvedValue({ roadmap_id: 6, matched: [], unmatched_written_by_you: 3, already_course: 0, ai_drafts: 0 });
    render(<RoadmapCurriculumTools roadmap={roadmap(['Agents'])} onChanged={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /label course lessons/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(fileInput(dialog), { target: { files: [lessonFile('a.json', { sections: [{ title: 'T', body: 'B' }] })] } });
    expect(await within(dialog).findByText(/0 sections match/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Label' })).toBeDisabled();
  });
});
