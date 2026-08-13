import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoadmapImportModal } from './RoadmapImportModal';
import { RoadmapImportPreview } from '../../types/roadmap';

const mockValidate = vi.fn();
const mockConfirm = vi.fn();

vi.mock('../../services/api', () => ({
  validateRoadmapImport: (...args: any[]) => mockValidate(...args),
  confirmRoadmapImport: (...args: any[]) => mockConfirm(...args),
}));

function makePreview(overrides: Partial<RoadmapImportPreview> = {}): RoadmapImportPreview {
  return {
    title: 'Apache Kafka Mastery',
    description: null,
    source_filename: 'kafka.xlsx',
    phases: ['1. Core Foundations'],
    topics: [
      {
        title: 'Event Streaming Fundamentals',
        phase_name: '1. Core Foundations',
        learning_objective: 'Understand pub/sub.',
        success_criteria: null,
        estimated_hours: 3,
        status: 'not_started',
        progress_percentage: 0,
        started_at: null,
        completed_at: null,
        evidence_notes: null,
      },
    ],
    resources: [{ title: 'CLI Command Reference', columns: ['Category', 'Command'], rows: [['Create', 'kafka-topics.sh']] }],
    warnings: [],
    ignored_sheets: [],
    ...overrides,
  };
}

function makeFile(name = 'kafka.xlsx') {
  return new File(['binary'], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

const onClose = vi.fn();
const onImported = vi.fn();

function renderModal() {
  return render(<RoadmapImportModal open onClose={onClose} onImported={onImported} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RoadmapImportModal', () => {
  it('validates the chosen file and previews what will be imported', async () => {
    const user = userEvent.setup();
    mockValidate.mockResolvedValue(makePreview());
    renderModal();

    await user.upload(screen.getByTestId('roadmap-file-input'), makeFile());

    await waitFor(() => expect(screen.getByText('1 topics')).toBeInTheDocument());
    expect(screen.getByText('1 phases')).toBeInTheDocument();
    expect(screen.getByText('1 reference sheets')).toBeInTheDocument();
    expect(screen.getByText('3h estimated')).toBeInTheDocument();
    expect(screen.getByText('Event Streaming Fundamentals')).toBeInTheDocument();
  });

  it('surfaces parser warnings instead of swallowing them', async () => {
    // These are how the user learns a totals row was dropped or a progress
    // sheet could not be read -- hiding them would make the import look
    // cleaner than it was.
    const user = userEvent.setup();
    mockValidate.mockResolvedValue(makePreview({
      warnings: [
        "Ignored 1 summary row(s) in 'Syllabus': TOTAL ESTIMATED HOURS",
        "Progress sheet 'Tracker' was found but contained no readable values.",
      ],
      ignored_sheets: ['Scratch'],
    }));
    renderModal();

    await user.upload(screen.getByTestId('roadmap-file-input'), makeFile());

    await waitFor(() => expect(screen.getByText(/TOTAL ESTIMATED HOURS/)).toBeInTheDocument());
    expect(screen.getByText(/no readable values/i)).toBeInTheDocument();
    expect(screen.getByText(/Ignored sheet\(s\): Scratch/)).toBeInTheDocument();
  });

  it('commits the preview along with optional schedule settings', async () => {
    const user = userEvent.setup();
    mockValidate.mockResolvedValue(makePreview());
    mockConfirm.mockResolvedValue({ roadmap_id: 9, title: 'Apache Kafka Mastery', phase_count: 1, topic_count: 1, resource_count: 1 });
    renderModal();

    await user.upload(screen.getByTestId('roadmap-file-input'), makeFile());
    await waitFor(() => expect(screen.getByText('1 topics')).toBeInTheDocument());

    await user.type(screen.getByLabelText(/study hours per week/i), '10');
    await user.click(screen.getByRole('button', { name: /^import roadmap$/i }));

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Apache Kafka Mastery',
        weekly_hours_budget: 10,
      }));
    });
    await waitFor(() => expect(onImported).toHaveBeenCalledWith(9));
  });

  it('shows the backend error when the file cannot be parsed', async () => {
    // Uses an accepted extension deliberately: the input's `accept` filter
    // already blocks obviously-wrong types, so the case that actually reaches
    // the server is a file with the right extension and unreadable contents.
    const user = userEvent.setup();
    mockValidate.mockRejectedValue({
      response: { data: { detail: { message: 'Could not read the Excel file: bad zip.', errors: [] } } },
    });
    renderModal();

    await user.upload(screen.getByTestId('roadmap-file-input'), makeFile('corrupt.xlsx'));

    await waitFor(() => expect(screen.getByText(/Could not read the Excel file/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /^import roadmap$/i })).toBeDisabled();
  });

  it('cannot import a preview with no topics', async () => {
    const user = userEvent.setup();
    mockValidate.mockResolvedValue(makePreview({
      topics: [], phases: [], resources: [],
      warnings: ['No topics were found in this file.'],
    }));
    renderModal();

    await user.upload(screen.getByTestId('roadmap-file-input'), makeFile());

    await waitFor(() => expect(screen.getByText(/No topics were found/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /^import roadmap$/i })).toBeDisabled();
  });
});
