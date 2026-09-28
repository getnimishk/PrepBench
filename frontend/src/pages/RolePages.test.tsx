// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ContentPackDetail } from '../types/contentPack';
import type { Role, RoleDiagnostic } from '../types/role';
import adfPack from '../../../backend/app/content/packs/adf/v1.json';
import adlsPack from '../../../backend/app/content/packs/adls/v1.json';
import { RolePreparationNewPage } from './RolePreparationNewPage';
import { RolePreparationPage } from './RolePreparationPage';
import { RoleDiagnosticPage } from './RoleDiagnosticPage';

const ADF = adfPack as unknown as ContentPackDetail;
const ADLS = adlsPack as unknown as ContentPackDetail;

const api = {
  createRole: vi.fn(), getRole: vi.fn(), getRoleDiagnostics: vi.fn(), replaceRoleRequirements: vi.fn(),
  deleteRole: vi.fn(), addRoleDiagnostic: vi.fn(), getSubject: vi.fn(), getContentPack: vi.fn(), getContentPacks: vi.fn(),
};
vi.mock('../services/api', () => Object.fromEntries(
  ['createRole', 'getRole', 'getRoleDiagnostics', 'replaceRoleRequirements', 'deleteRole', 'addRoleDiagnostic',
    'getSubject', 'getContentPack', 'getContentPacks']
    .map((name) => [name, (...a: any[]) => (api as any)[name](...a)]),
));

const ADF_SKILL = { id: 7, name: 'My ADF prep', kind: 'skill', content_packs: [{ pack_id: 'adf', pack_version: 1, latest_version: 1, title: 'Azure Data Factory' }] };
const CERT = { id: 3, name: 'PSM I', kind: 'certification', content_packs: [] };
const select = vi.fn();
vi.mock('../context/PreparationContext', () => ({
  usePreparation: () => ({ preparations: [ADF_SKILL, CERT], select }),
}));

const ROLE: Role = {
  id: 4, name: 'Technical Product Owner', interview_date: null, job_description: 'SAMPLE (fictional)', lens: 'pm',
  is_archived: false, created_at: 't', updated_at: 't', diagnostic_count: 0,
  requirements: [
    { id: 1, order_index: 0, text: 'Data reconciliation and validation for migrations', kind: 'mandatory', subject_id: 7, subject_name: 'My ADF prep' },
    { id: 2, order_index: 1, text: 'Power BI', kind: 'preferred', subject_id: null, subject_name: null },
  ],
};

const at = (path: string, route: string, element: React.ReactElement) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path={route} element={element} />
      <Route path="/preparations/roles/:roleId" element={<p>role page</p>} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  select.mockReset();
  api.getRole.mockResolvedValue(ROLE);
  api.getRoleDiagnostics.mockResolvedValue([]);
  api.getSubject.mockImplementation(async (id: number) => (id === 7 ? ADF_SKILL : CERT));
  api.getContentPack.mockImplementation(async (id: string) => (id === 'adf' ? ADF : ADLS));
  api.getContentPacks.mockResolvedValue([
    { pack_id: 'adf', latest_version: 1 }, { pack_id: 'adls', latest_version: 1 },
  ]);
});

describe('RolePreparationNewPage', () => {
  it('suggests a Skill but saves no link until the learner confirms it (D8)', async () => {
    const user = userEvent.setup({ delay: null });
    api.createRole.mockResolvedValue({ ...ROLE, id: 9 });
    at('/preparations/roles/new', '/preparations/roles/new', <RolePreparationNewPage />);

    await user.click(screen.getByRole('button', { name: 'Use a fictional sample' }));
    await user.click(screen.getByRole('button', { name: 'Read requirements' }));

    const adfRow = screen.getByLabelText('Evidence for: Azure Data Factory (ADF), ADLS, Delta Lake');
    expect(adfRow).toHaveValue('');   // suggested, not chosen
    expect(within(adfRow).getByRole('option', { name: 'My ADF prep (suggested)' })).toBeInTheDocument();
    // Certifications are never offered as evidence for a requirement.
    expect(within(adfRow).queryByRole('option', { name: /PSM I/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText(/0 of 13 requirements are linked/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));

    await user.click(screen.getByRole('button', { name: 'Link to My ADF prep' }));
    expect(screen.getByLabelText('Evidence for: Azure Data Factory (ADF), ADLS, Delta Lake')).toHaveValue('7');
    await user.click(screen.getByRole('checkbox', { name: 'Keep: Power BI' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText(/1 of 12 requirements are linked/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create role preparation' }));

    await waitFor(() => expect(api.createRole).toHaveBeenCalled());
    const body = api.createRole.mock.calls[0][0];
    expect(body.lens).toBe('po');   // guessed from "Technical Product Owner"
    expect(body.requirements).toHaveLength(12);
    expect(body.requirements.filter((r: any) => r.subject_id != null)).toEqual([
      { text: 'Azure Data Factory (ADF), ADLS, Delta Lake', kind: 'preferred', subject_id: 7 },
    ]);
    expect(body.requirements.map((r: any) => r.text)).not.toContain('Power BI');
    expect(await screen.findByText('role page')).toBeInTheDocument();
  });
});

describe('RolePreparationPage', () => {
  it('says readiness needs evaluation, shows links and gaps, and relinks a requirement', async () => {
    const user = userEvent.setup({ delay: null });
    api.replaceRoleRequirements.mockImplementation(async (_id: number, reqs: any[]) => ({
      ...ROLE, requirements: reqs.map((r, i) => ({ ...r, id: i + 1, order_index: i, subject_name: r.subject_id ? 'My ADF prep' : null })),
    }));
    at('/preparations/roles/4', '/preparations/roles/:roleId', <RolePreparationPage />);

    expect(await screen.findByText('Needs evaluation')).toBeInTheDocument();
    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Take it' })).toHaveAttribute('href', '/preparations/roles/4/diagnostic');

    await user.selectOptions(screen.getByLabelText('Evidence for: Power BI'), '7');
    await waitFor(() => expect(api.replaceRoleRequirements).toHaveBeenCalledWith(4, [
      { text: 'Data reconciliation and validation for migrations', kind: 'mandatory', subject_id: 7 },
      { text: 'Power BI', kind: 'preferred', subject_id: 7 },
    ]));
  });

  it('holds every link still while one is saving, so two changes cannot undo each other', async () => {
    const user = userEvent.setup({ delay: null });
    let finish: (r: Role) => void = () => {};
    api.replaceRoleRequirements.mockImplementation(() => new Promise<Role>((resolve) => { finish = resolve; }));
    at('/preparations/roles/4', '/preparations/roles/:roleId', <RolePreparationPage />);

    await user.selectOptions(await screen.findByLabelText('Evidence for: Power BI'), '7');
    expect(screen.getByLabelText('Evidence for: Data reconciliation and validation for migrations')).toBeDisabled();
    finish({ ...ROLE, requirements: ROLE.requirements.map((r) => ({ ...r, subject_id: 7, subject_name: 'My ADF prep' })) });
    await waitFor(() => expect(screen.getByLabelText('Evidence for: Power BI')).toBeEnabled());
  });

  it('names an archived linked Skill as archived and does not offer to open it', async () => {
    api.getRole.mockResolvedValue({ ...ROLE, requirements: [{ ...ROLE.requirements[1], subject_id: 99, subject_name: 'Old ADF prep' }] });
    at('/preparations/roles/4', '/preparations/roles/:roleId', <RolePreparationPage />);
    const evidence = await screen.findByLabelText('Evidence for: Power BI');
    expect(evidence).toHaveValue('99');
    expect(within(evidence).getByRole('option', { name: 'Old ADF prep (archived)' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Open Old ADF prep/ })).not.toBeInTheDocument();
  });

  it('shows before and after, question by question, once retaken', async () => {
    const attempt = (confidence: 'not-yet' | 'confident', covered: number[], takenAt: string): RoleDiagnostic => ({
      id: takenAt.length, role_id: 4, taken_at: takenAt, lens: 'pm',
      items: [{ question_ref: 'adf@1/diagnostic/reconciliation', answer: 'a', covered, confidence, fits_requirement: true }],
    });
    api.getRoleDiagnostics.mockResolvedValue([
      attempt('not-yet', [0], '2026-09-01T10:00:00'), attempt('confident', [0, 1, 2], '2026-10-01T10:00:00Z'),
    ]);
    at('/preparations/roles/4', '/preparations/roles/:roleId', <RolePreparationPage />);

    const table = await screen.findByRole('region', { name: 'Diagnostic results, scrollable' });
    expect(within(table).getByText('Proving a migration is complete')).toBeInTheDocument();
    expect(within(table).getByText('1 → 3 of 6')).toBeInTheDocument();
    expect(within(table).getByText('Not yet → Confident')).toBeInTheDocument();
    expect(within(table).getByText(/Fits a requirement/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Diagnostic: before and after' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Retake' })).toBeInTheDocument();
  });
});

describe('RoleDiagnosticPage', () => {
  it('states the real count and draws fitting questions from the linked skill\'s pack', async () => {
    at('/preparations/roles/4/diagnostic', '/preparations/roles/:roleId/diagnostic', <RoleDiagnosticPage />);
    const sub = await screen.findByText(/10 interview questions: \d+ fit this job's requirements, the rest are core topics/);
    const fit = Number(/: (\d+) fit/.exec(sub.textContent!)![1]);
    expect(fit).toBeGreaterThan(0);
    expect(screen.getAllByText('Fits')).toHaveLength(fit);
    expect(screen.getAllByText('Core topic')).toHaveLength(10 - fit);
    expect(screen.getByRole('button', { name: 'Product Manager' })).toHaveAttribute('aria-pressed', 'true');
    expect(api.getContentPack).toHaveBeenCalledWith('adf', 1);
  });

  it('says every question is a core topic when no requirement is linked', async () => {
    api.getRole.mockResolvedValue({ ...ROLE, requirements: ROLE.requirements.map((r) => ({ ...r, subject_id: null, subject_name: null })) });
    at('/preparations/roles/4/diagnostic', '/preparations/roles/:roleId/diagnostic', <RoleDiagnosticPage />);
    expect(await screen.findByText(/10 interview questions, all core topics/)).toBeInTheDocument();
    expect(screen.getAllByText('Core topic')).toHaveLength(10);
    expect(screen.getByText(/None of this job's requirements is linked to a Skill yet/)).toBeInTheDocument();
  });

  it('retakes with the first attempt\'s questions and lens, and saves the answers', async () => {
    const user = userEvent.setup({ delay: null });
    const refs = ['adf@1/diagnostic/cost', 'adf@1/scenario/1/lens/dm'];
    api.getRoleDiagnostics.mockResolvedValue([{
      id: 1, role_id: 4, taken_at: 't', lens: 'dm',
      items: refs.map((ref, i) => ({ question_ref: ref, answer: 'a', covered: [], confidence: 'not-yet', fits_requirement: i === 0 })),
    }]);
    api.addRoleDiagnostic.mockResolvedValue({});
    at('/preparations/roles/4/diagnostic', '/preparations/roles/:roleId/diagnostic', <RoleDiagnosticPage />);

    expect(await screen.findByText(/2 interview questions: 1 fit/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delivery Manager' })).toBeDisabled();
    expect(api.getContentPacks).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Start the retake' }));
    for (let i = 0; i < 2; i += 1) {
      await user.click(screen.getByLabelText('Your answer, in your own words'));
      await user.paste(`Answer ${i + 1}`);
      await user.click(screen.getByRole('button', { name: 'Compare with the key points' }));
      await user.click(screen.getAllByRole('checkbox')[1]);
      await user.click(screen.getByRole('button', { name: 'Confident' }));
      await user.click(screen.getByRole('button', { name: i === 1 ? 'Finish and save' : 'Next question' }));
    }

    await waitFor(() => expect(api.addRoleDiagnostic).toHaveBeenCalledWith(4, {
      lens: 'dm',
      items: [
        { question_ref: refs[0], answer: 'Answer 1', covered: [1], confidence: 'confident', fits_requirement: true },
        { question_ref: refs[1], answer: 'Answer 2', covered: [1], confidence: 'confident', fits_requirement: false },
      ],
    }));
    expect(await screen.findByText('role page')).toBeInTheDocument();
  });
});
