// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { getSubjectCapabilities } from '../../services/capabilities';
import type { Subject } from '../../types/subject';
import type { SubjectCapabilityProfile } from '../../types/capabilities';

const getReviewCounts = vi.fn();
vi.mock('../../services/api', () => ({
  getReviewCounts: (...a: unknown[]) => getReviewCounts(...a),
}));

let mockSidebarCollapsed = false;
vi.mock('../../App', () => ({
  useSidebar: () => ({ collapsed: mockSidebarCollapsed, toggleCollapsed: () => {} }),
}));

interface MockPreparation {
  selectedId: number | null;
  selected: Subject | null;
  loading: boolean;
  capabilities?: SubjectCapabilityProfile;
}

const preparation: MockPreparation = {
  selectedId: 4,
  selected: null,
  loading: false,
};

vi.mock('../../context/PreparationContext', () => ({
  usePreparation: () => preparation,
}));

let connectionState = 'online';
vi.mock('../../hooks/useConnection', () => ({
  useConnection: () => connectionState,
}));

const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Sidebar />
  </MemoryRouter>,
);

beforeEach(() => {
  getReviewCounts.mockReset();
  getReviewCounts.mockResolvedValue({ unreviewed: 0, spaced_due: 0 });
  preparation.selectedId = 4;
  preparation.selected = null;
  preparation.loading = false;
  preparation.capabilities = undefined;
  mockSidebarCollapsed = false;
  connectionState = 'online';
});

describe('Sidebar', () => {
  it('lists every destination, Roadmaps among them, under the prototype headings when capabilities are unconstrained', async () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Main' });

    // Written in title case and set in capitals by CSS, as the prototype's .navgroup is.
    for (const heading of ['Today', 'Certification', 'Interview', 'Evidence', 'Workspace', 'Learning Lab']) {
      // Exactly one heading -- not a link: Evidence and Workspace are also destinations' names.
      expect(within(nav).getAllByText(heading).filter((el) => !el.closest('a'))).toHaveLength(1);
    }
    // 14 original destinations + 4 Learning Lab entries (All Sandboxes, Agile Metrics, Scenarios, Lakehouse Lab)
    // + Workspace and Evidence (Phase 6) = 20.
    expect(within(nav).getAllByRole('link')).toHaveLength(20);
    expect(within(nav).getByRole('link', { name: 'Workspace' })).toHaveAttribute('href', '/workspace');
    expect(within(nav).getByRole('link', { name: 'Evidence' })).toHaveAttribute('href', '/evidence');
    expect(within(nav).getByRole('link', { name: 'Roadmaps' })).toHaveAttribute('href', '/roadmaps');
    expect(within(nav).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
    expect(within(nav).getByRole('link', { name: 'All Sandboxes' })).toHaveAttribute('href', '/lab');
    expect(within(nav).getByRole('link', { name: 'Agile Metrics' })).toHaveAttribute('href', '/chart-sandbox');
    expect(within(nav).getByRole('link', { name: 'Scenarios' })).toHaveAttribute('href', '/scenarios');
    await waitFor(() => expect(getReviewCounts).toHaveBeenCalled());
  });

  it('renders the authoritative PrepBench brand logo in the sidebar header', async () => {
    renderAt('/');
    expect(screen.getByLabelText('PrepBench Mark')).toBeInTheDocument();
    expect(screen.getByText('Prep')).toBeInTheDocument();
    expect(screen.getByText('Bench')).toBeInTheDocument();
    await waitFor(() => expect(getReviewCounts).toHaveBeenCalled());
  });

  it('marks the section a nested screen belongs to', async () => {
    renderAt('/roadmaps/3/edit');
    const roadmaps = screen.getByRole('link', { name: 'Roadmaps' });
    expect(roadmaps).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
    await waitFor(() => expect(getReviewCounts).toHaveBeenCalled());
  });

  it("counts the picked preparation's waiting review on the Review Queue, and says what the number is", async () => {
    getReviewCounts.mockResolvedValue({ unreviewed: 3, spaced_due: 2 });
    renderAt('/');

    const review = await screen.findByRole('link', { name: 'Review Queue, 5 waiting: 3 misses to read, 2 due from memory' });
    expect(within(review).getByText('5')).toBeInTheDocument();
    expect(getReviewCounts).toHaveBeenCalledWith(4);
  });

  it('shows no number when nothing is waiting', async () => {
    renderAt('/');
    await waitFor(() => expect(getReviewCounts).toHaveBeenCalled());
    expect(screen.getByRole('link', { name: 'Review Queue' })).toHaveAccessibleName('Review Queue');
  });

  it('shows no number rather than a zero when the count cannot be read', async () => {
    getReviewCounts.mockRejectedValue({ isAxiosError: true, request: {} });
    renderAt('/');
    await waitFor(() => expect(getReviewCounts).toHaveBeenCalled());
    expect(screen.getByRole('link', { name: 'Review Queue' })).toHaveAccessibleName('Review Queue');
  });

  it('waits for the preparations and for the server before counting', () => {
    preparation.loading = true;
    const { unmount } = renderAt('/');
    expect(getReviewCounts).not.toHaveBeenCalled();
    unmount();

    preparation.loading = false;
    connectionState = 'unreachable';
    renderAt('/');
    expect(getReviewCounts).not.toHaveBeenCalled();
  });

  it('displays active subject indicator at bottom of sidebar when a subject is selected', async () => {
    preparation.selected = {
      id: 6,
      name: 'Azure Data Factory',
      slug: 'azure-data-factory',
      kind: 'skill',
      description: 'Master enterprise ETL pipelines and orchestrations',
      question_count: 0,
      has_exam_profile: false,
      is_archived: false,
      display_order: 6,
      readiness: { state: 'needs_evaluation', mock_count: 0, recent_scores: [], is_stale: false, domains: [], blockers: [] },
    };

    renderAt('/');
    const badge = screen.getByTestId('sidebar-active-subject');
    expect(badge).toBeInTheDocument();
    expect(within(badge).getByText('Active Subject')).toBeInTheDocument();
    expect(within(badge).getByText('Azure Data Factory')).toBeInTheDocument();
    await waitFor(() => expect(getReviewCounts).toHaveBeenCalled());
  });

  it('enforces capability truth for ADF: Certification is disabled with explaining aria labels', async () => {
    preparation.selectedId = 6;
    preparation.selected = {
      id: 6,
      name: 'Azure Data Factory',
      slug: 'azure-data-factory',
      kind: 'skill',
      question_count: 0,
      has_exam_profile: false,
      is_archived: false,
      display_order: 6,
      readiness: { state: 'needs_evaluation', mock_count: 0, recent_scores: [], is_stale: false, domains: [], blockers: [] },
    };
    preparation.capabilities = getSubjectCapabilities(6);

    renderAt('/');

    // ADF has no certification: Mock Exam, Question Bank, Practice, Review Queue must be disabled!
    const mockExam = screen.getByRole('button', { name: 'Mock Exam (Not configured for Azure Data Factory)' });
    expect(mockExam).toHaveAttribute('aria-disabled', 'true');
    expect(mockExam).toHaveClass('Mui-disabled');

    const questionBank = screen.getByRole('button', { name: 'Question Bank (Not configured for Azure Data Factory)' });
    expect(questionBank).toHaveAttribute('aria-disabled', 'true');
    expect(questionBank).toHaveClass('Mui-disabled');

    // The Behaviour Lab is live, so All Sandboxes is an ordinary link to the Learning Lab
    expect(screen.getByRole('link', { name: 'All Sandboxes' })).toHaveAttribute('href', '/lab');
    expect(screen.queryByRole('button', { name: /^All Sandboxes \(/ })).not.toBeInTheDocument();

    // Supported features for ADF are active links
    expect(screen.getByRole('link', { name: 'Roadmaps' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Study Library' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Scenarios' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Rounds' })).toBeInTheDocument();
    await waitFor(() => expect(getReviewCounts).toHaveBeenCalled());
  });

  it('enforces capability truth for Databricks: Lakehouse Lab is enabled, Cert and Interview disabled', async () => {
    preparation.selectedId = 2;
    preparation.selected = {
      id: 2,
      name: 'Databricks Lakehouse',
      slug: 'databricks',
      kind: 'skill',
      question_count: 0,
      has_exam_profile: false,
      is_archived: false,
      display_order: 2,
      readiness: { state: 'needs_evaluation', mock_count: 0, recent_scores: [], is_stale: false, domains: [], blockers: [] },
    };
    preparation.capabilities = getSubjectCapabilities(2);

    renderAt('/');

    // Databricks Lakehouse Lab is enabled
    expect(screen.getByRole('link', { name: 'Lakehouse Lab' })).toHaveAttribute('href', '/databricks-sandbox');
    expect(screen.getByRole('link', { name: 'All Sandboxes' })).toHaveAttribute('href', '/lab');

    // Certification and Interview are disabled for Databricks
    const mockExam = screen.getByRole('button', { name: 'Mock Exam (Not configured for Databricks Lakehouse)' });
    expect(mockExam).toHaveAttribute('aria-disabled', 'true');
    expect(mockExam).toHaveClass('Mui-disabled');

    const rounds = screen.getByRole('button', { name: 'Rounds (Not configured for Databricks Lakehouse)' });
    expect(rounds).toHaveAttribute('aria-disabled', 'true');
    expect(rounds).toHaveClass('Mui-disabled');
    await waitFor(() => expect(getReviewCounts).toHaveBeenCalled());
  });

  it('renders compact mark-only logo in collapsed rail mode', async () => {
    mockSidebarCollapsed = true;
    renderAt('/');

    // Mark is rendered with aria-label
    expect(screen.getByLabelText('PrepBench Mark')).toBeInTheDocument();
    // Wordmark text is hidden in mark-only mode
    expect(screen.queryByText('Prep')).not.toBeInTheDocument();
    await waitFor(() => expect(getReviewCounts).toHaveBeenCalled());
  });
});

describe('Sidebar review badge with no preparation (Phase 8)', () => {
  it("reads no counts, rather than every preparation's added together", async () => {
    const before = preparation.selectedId;
    preparation.selectedId = null;
    try {
      renderAt('/');
      await new Promise((r) => setTimeout(r, 30));
      expect(getReviewCounts).not.toHaveBeenCalled();
    } finally {
      preparation.selectedId = before;
    }
  });
});
