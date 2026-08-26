import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ChartSandboxPage } from './ChartSandboxPage';
import { chartsInFamily } from '../services/metrics/charts';

// chart.js needs a real canvas, which jsdom does not provide. Stubbing the
// renderers keeps these tests about what this page is responsible for --
// which family is on screen, and whether the caveats reached it -- rather
// than about whether chart.js can draw. The payload itself is asserted
// directly in chartData.test.ts.
//
// The stub records the payload it was handed, so the tests can still assert
// that moving a control actually reaches the renderer. Without that, a page
// that recomputed nothing would pass every other test here -- and "move a
// control, watch what moves" is the entire premise of the page.
const rendered: { viewId: string; series: (number | null)[] }[] = [];

vi.mock('../components/sandbox/ChartPrimitives', () => ({
  ChartPrimitiveView: ({
    primitive,
    payload,
  }: {
    primitive: string;
    payload: { viewId: string; series: { reference?: boolean; data: (number | null)[] }[] };
  }) => {
    rendered.push({
      viewId: payload.viewId,
      series: payload.series.filter((s) => !s.reference).flatMap((s) => s.data),
    });
    return <div data-testid="chart" data-primitive={primitive} />;
  },
}));

const lastPayloadFor = (viewId: string) =>
  [...rendered].reverse().find((r) => r.viewId === viewId);

function renderPage() {
  return render(
    <MemoryRouter>
      <ChartSandboxPage />
    </MemoryRouter>,
  );
}

beforeAll(() => {
  // MUI's Tabs measures its scroll container on mount.
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { value: vi.fn(), writable: true });
});

describe('ChartSandboxPage', () => {
  it('opens on the core tier showing the flow family', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Chart Sandbox' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Flow \(8\)/ })).toBeInTheDocument();
    expect(screen.getAllByTestId('chart')).toHaveLength(chartsInFamily('flow').length);
  });

  it('shows one family at a time', async () => {
    // The core constraint of the whole page. Twenty-seven charts at once is
    // what every real dashboard already does badly.
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText('Throughput')).toBeInTheDocument();
    expect(screen.queryByText('Velocity')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Predictability/ }));

    expect(screen.getByText('Velocity')).toBeInTheDocument();
    expect(screen.queryByText('Throughput')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('chart')).toHaveLength(chartsInFamily('predictability').length);
  });

  it('keeps the engineering extension behind its own tier', async () => {
    const user = userEvent.setup();
    renderPage();

    // DORA is not reachable from the core tier's tabs at all.
    expect(screen.queryByRole('tab', { name: /DORA/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Engineering extension/ }));

    expect(screen.getByRole('tab', { name: /DORA \(5\)/ })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Flow/ })).not.toBeInTheDocument();
    expect(screen.getByText('Deployment rework rate')).toBeInTheDocument();
  });

  it('puts the model assumption on the chart it affects', async () => {
    // The reason the ledger types every edge. An assumption that never
    // reaches a chart is one the reader takes for a fact.
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('tab', { name: /Quality/ }));

    const defectRate = screen.getByText('Defect rate').closest('.MuiCard-root');
    expect(defectRate).not.toBeNull();
    expect(within(defectRate as HTMLElement).getAllByText(/Model assumption/).length).toBeGreaterThan(0);
    expect(within(defectRate as HTMLElement).getByText(/high WIP raises defect injection/i))
      .toBeInTheDocument();
  });

  it('says when a view has no standard chart rather than inventing a lineage', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('tab', { name: /Predictability/ }));

    const sprintGoal = screen.getByText('Sprint goal achievement').closest('.MuiCard-root');
    // Said twice on purpose: once as the lineage caption where every other
    // card names its analogues, and again in the reading, because "no tool
    // draws this for you" is the teaching point rather than a missing field.
    expect(within(sprintGoal as HTMLElement).getAllByText(/No standard chart exists/i))
      .toHaveLength(2);

    // ...while a view that does have one names it as an analogue.
    const velocity = screen.getByText('Velocity').closest('.MuiCard-root');
    expect(within(velocity as HTMLElement).getByText(/Jira Velocity Chart/)).toBeInTheDocument();
  });

  it('exposes no calibration coefficient as a slider', async () => {
    // Surfacing them invites reading a teaching constant as a finding.
    renderPage();
    for (const banned of [
      'k1 - WIP pressure to defect injection',
      'k2 - batch size to change fail rate',
      'k3 - automation to recovery time',
      'k4 - overload to happiness decay',
      'Unplanned deployments per incident',
    ]) {
      expect(screen.queryByLabelText(banned), banned).not.toBeInTheDocument();
    }
    expect(screen.getByLabelText('WIP limit')).toBeInTheDocument();
  });

  it('re-simulates and re-renders the charts when a control moves', async () => {
    // Asserts the payload reaching the renderer changes, not just the slider
    // label. A page that updated its own controls and handed the charts stale
    // data would look completely correct without this.
    const user = userEvent.setup();
    rendered.length = 0;
    renderPage();

    await user.click(screen.getByRole('tab', { name: /Predictability/ }));
    const before = lastPayloadFor('velocity');
    expect(before).toBeDefined();
    expect(screen.getByText('12 items/sprint')).toBeInTheDocument();

    screen.getByLabelText('Capacity').focus();
    await user.keyboard('{ArrowRight}');

    expect(screen.getByText('13 items/sprint')).toBeInTheDocument();
    const after = lastPayloadFor('velocity');
    expect(after!.series).not.toEqual(before!.series);
  });

  it('draws a velocity chart with something to read on the default scenario', async () => {
    // The canonical scenario is what a learner lands on. Seven identical bars
    // would be correct and useless -- variability is the whole subject of
    // this chart.
    const user = userEvent.setup();
    rendered.length = 0;
    renderPage();

    await user.click(screen.getByRole('tab', { name: /Predictability/ }));

    for (const viewId of ['velocity', 'sayDoRatio']) {
      const payload = lastPayloadFor(viewId);
      const distinct = new Set(
        payload!.series.filter((v): v is number => v !== null).map((v) => v.toFixed(4)),
      );
      expect(distinct.size, `${viewId} is too flat to teach from`).toBeGreaterThanOrEqual(4);
    }

    // The sprint goal is binary, so it gets a binary criterion: the learner
    // has to see it both met and missed.
    const goal = lastPayloadFor('sprintGoal')!.series;
    expect(new Set(goal.map(String))).toEqual(new Set(['0', '1']));
    expect(goal).not.toEqual(lastPayloadFor('sayDoRatio')!.series);
  });

  it('lets the steady state be reached by turning variation off', async () => {
    const user = userEvent.setup();
    rendered.length = 0;
    renderPage();

    await user.click(screen.getByRole('tab', { name: /Predictability/ }));
    const variation = screen.getByLabelText('Capacity variation');
    variation.focus();
    // Home jumps a MUI slider to its minimum in one keystroke.
    await user.keyboard('{Home}');

    expect(screen.getByText('0%')).toBeInTheDocument();
    const flat = lastPayloadFor('velocity');
    const tail = flat!.series.slice(4).filter((v): v is number => v !== null);
    expect(new Set(tail.map((v) => v.toFixed(4))).size).toBe(1);
  });
});
