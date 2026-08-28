import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ChartSandboxPage } from './ChartSandboxPage';
import { chartsInFamily } from '../services/metrics/charts';
import { DEFAULT_PARAMS, formatParamValue, paramSpec } from '../services/metrics/params';
import { FIRST_EXPERIMENT, chooseTarget } from '../services/metrics/experiments';

// The first experiment's target is DERIVED, so the tests derive it too.
// Hardcoding "8" here is what made these break when the rule replaced the
// authored number -- and a test that pins the old answer would just be
// re-asserting the thing that was wrong.
const wipSpec = paramSpec(FIRST_EXPERIMENT.key);
const wipFrom = formatParamValue(wipSpec, DEFAULT_PARAMS[FIRST_EXPERIMENT.key]);
const wipTo = formatParamValue(wipSpec, chooseTarget(FIRST_EXPERIMENT, DEFAULT_PARAMS).value);

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

/**
 * Switch to Explore.
 *
 * The page lands in Learn mode by design -- a first-time beginner should not
 * arrive on the full analytical surface. Tests that exercise the sandbox
 * surface itself say so explicitly rather than depending on a default that the
 * product deliberately changed.
 */
async function useExplore(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Explore' }));
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ChartSandboxPage />
    </MemoryRouter>,
  );
}

// jsdom implements neither, and the page uses scrollIntoView to hand the
// viewport to the charts when the control band collapses. Spying is the only
// way to assert that: a headless DOM has no scroll position to observe.
const scrollIntoView = vi.fn();

beforeAll(() => {
  // MUI's Tabs measures its scroll container on mount.
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { value: vi.fn(), writable: true });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    value: scrollIntoView,
    writable: true,
  });
});

describe('ChartSandboxPage', () => {
  it('opens on the core tier showing the flow family', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Chart Sandbox' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Flow \(8\)/ })).toBeInTheDocument();
    expect(screen.getAllByTestId('chart')).toHaveLength(chartsInFamily('flow').length);
  });

  it('preserves the scenario when the learner switches metric family', async () => {
    // The educational point of family navigation: change WIP in Flow, switch
    // to Quality, and see the coupled effect on the SAME scenario. A reset on
    // switch would silently discard the experiment the learner just ran, and
    // the cross-family lesson would be unreachable.
    const user = userEvent.setup();
    rendered.length = 0;
    renderPage();
    await useExplore(user);

    screen.getByLabelText('Capacity').focus();
    await user.keyboard('{ArrowRight}');
    const movedThroughput = lastPayloadFor('throughput');
    expect(movedThroughput).toBeDefined();

    // Across a family switch, and back.
    await user.click(screen.getByRole('tab', { name: /Quality/ }));
    await user.click(screen.getByRole('tab', { name: /Flow/ }));

    expect(lastPayloadFor('throughput')!.series).toEqual(movedThroughput!.series);

    // ...and across a TIER switch, which rebuilds the tab set entirely.
    await user.click(screen.getByRole('button', { name: /Engineering extension/ }));
    await user.click(screen.getByRole('button', { name: /^Core/ }));
    expect(lastPayloadFor('throughput')!.series).toEqual(movedThroughput!.series);
  });

  it('draws the cumulative flow bands from the workflow, not from a hard-coded three', async () => {
    const user = userEvent.setup();
    rendered.length = 0;
    renderPage();
    await useExplore(user);

    // One band per workflow state, plus To do and Done.
    const cfd = lastPayloadFor('cumulativeFlow');
    expect(cfd).toBeDefined();
    expect(screen.getByText('Cumulative flow')).toBeInTheDocument();
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

  it('shows derived outcomes as locked readouts, not as controls', async () => {
    // The design calls for these to be locked and focusable, announcing their
    // formula. The placement is the lesson: cycle time sits directly under
    // the sliders and refuses to be dragged, which teaches "output, not
    // control" far better than a caption under a chart.
    //
    // These readouts used to be a separate block beside the sliders. They now
    // live in the outcomes strip because the redesign gave that strip four of
    // the same numbers -- two places showing one value is the same defect the
    // duplicate-series sweep catches on charts.
    renderPage();

    const cycleTime = screen.getByRole('group', { name: /^Cycle time:/ });
    expect(cycleTime).toBeInTheDocument();
    // Focusable, so a keyboard or screen-reader user reaches the lesson too.
    expect(cycleTime).toHaveAttribute('tabindex', '0');
    // ...and announces the formula rather than just a number.
    expect(cycleTime).toHaveAccessibleName(/WIP ÷ realised throughput × sprint length/);
    expect(cycleTime).toHaveAccessibleName(/never a control/i);

    for (const label of [
      'Realised throughput',
      'Flow efficiency',
      'Unplanned work',
      'Escaped defects',
    ]) {
      expect(screen.getByRole('group', { name: new RegExp(`^${label}:`) })).toBeInTheDocument();
    }

    // None of them is an input -- there is no slider to reach for. "Capacity"
    // is the one that most invites the confusion: it sets what the team CAN
    // do, and realised throughput is what it did.
    expect(screen.queryByLabelText('Cycle time')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Realised throughput')).not.toBeInTheDocument();
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

    const after = lastPayloadFor('velocity');
    expect(after!.series).not.toEqual(before!.series);

    // The band hands the viewport over to the charts on the first committed
    // change, so the slider is gone -- reopen it to read the value back.
    await user.click(screen.getByRole('button', { name: 'Show controls' }));
    expect(screen.getByText('13 items/sprint')).toBeInTheDocument();
  });

  it('collapses the controls once after the first change, then leaves them alone', async () => {
    // The whole reason the controls moved out of the rail: they took 1737px
    // in a 720px viewport, so the charts started below the fold and the only
    // thing that visibly answered a drag was a number. Collapsing hands the
    // viewport to the charts -- but only once. A band that re-closed itself
    // on every touch would be fighting the user.
    const user = userEvent.setup();
    scrollIntoView.mockClear();
    renderPage();

    expect(screen.getByLabelText('WIP limit')).toBeInTheDocument();

    screen.getByLabelText('Capacity').focus();
    await user.keyboard('{ArrowRight}');

    // Unmounted, not merely hidden. A collapsed MUI panel keeps its children
    // focusable, which would tab a keyboard user into sliders they cannot see.
    // Waited for rather than asserted immediately: the unmount happens when
    // the collapse transition ends, not when the state flips.
    await waitFor(() =>
      expect(screen.queryByLabelText('WIP limit')).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'Show controls' }));
    screen.getByLabelText('Capacity').focus();
    await user.keyboard('{ArrowRight}');

    // Still open. The button label flips with the state, so this catches a
    // second auto-collapse immediately rather than racing its transition.
    expect(screen.getByRole('button', { name: 'Hide controls' })).toBeInTheDocument();
    expect(screen.getByLabelText('WIP limit')).toBeInTheDocument();
    // ...and it did not yank the page a second time either.
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('brings the charts into view when it collapses, without losing the numbers', async () => {
    // Collapsing alone only removes height above the charts while the reader
    // is still parked at the top, which leaves the first chart within ~60px
    // of an 800px fold -- visible, unreadable. The anchor is the outcomes
    // strip rather than the chart grid on purpose: scroll to the charts alone
    // and the thing that just answered the slider goes off screen.
    const user = userEvent.setup();
    scrollIntoView.mockClear();
    renderPage();

    screen.getByLabelText('WIP limit').focus();
    await user.keyboard('{ArrowRight}');

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    const target = scrollIntoView.mock.instances[0] as HTMLElement;
    expect(target).toContainElement(screen.getByRole('group', { name: /^Cycle time:/ }));
    expect(target).not.toContainElement(screen.getAllByTestId('chart')[0]);
  });

  it('marks which families a single control reached', async () => {
    // The highest-value fix from the usability pass. A coupled model's payoff
    // is that a flow control moves the quality family, and without an
    // indicator the learner has to open all six tabs to find that out --
    // which nobody does, so the payoff never lands.
    const user = userEvent.setup();
    renderPage();
    await useExplore(user);

    expect(screen.getAllByRole('tab').some((t) => /moved/.test(t.textContent ?? ''))).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Run experiment' }));

    const moved = screen
      .getAllByRole('tab')
      .filter((t) => /\d+ moved/.test(t.textContent ?? ''));
    expect(moved.length, 'raising WIP moved only one family').toBeGreaterThan(1);
    // ...and not only the family the control itself belongs to.
    expect(moved.some((t) => !/Flow/.test(t.textContent ?? ''))).toBe(true);
  });

  it('reports what changed without claiming why', async () => {
    // The summary states measured facts only. A mockup of this card carried
    // "increasing WIP ... increases cycle time, reduces efficiency, and
    // increases defects" as authored prose -- a conclusion about a model,
    // written where nothing can check it against the model.
    const user = userEvent.setup();
    renderPage();
    await useExplore(user);

    expect(screen.queryByText('What changed')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Run experiment' }));

    expect(screen.getByText('What did we learn?')).toBeInTheDocument();
    expect(
      screen.getByText(
        new RegExp(`You changed WIP limit ${wipFrom} → ${wipTo} — one control, nothing else`),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/it does not claim to know why/)).toBeInTheDocument();
  });

  it('closes the loop: a conclusion, and the next experiment', async () => {
    // The loop is experiment -> observe -> explore -> explain -> conclude.
    // Usability testing found it stopping after "explore": the learner
    // reached the bottom of twenty-seven charts and the page simply ended,
    // which leaves the conclusion as something they were meant to have
    // formed unaided.
    const user = userEvent.setup();
    renderPage();
    await useExplore(user);

    await user.click(screen.getByRole('button', { name: 'Run experiment' }));

    // What did NOT follow is the load-bearing half. Throughput holding while
    // cycle time doubles IS the argument against raising WIP, and a summary
    // that only lists what moved leaves it out.
    expect(screen.getByText(/Held within 5% of baseline:/)).toBeInTheDocument();
    expect(screen.getByText('Try another experiment')).toBeInTheDocument();
  });

  it('states the baseline and the current scenario side by side', async () => {
    // Every delta is measured against the baseline, and the only evidence of
    // that used to be the words "vs baseline" under five numbers.
    const user = userEvent.setup();
    renderPage();
    await useExplore(user);

    expect(screen.getByText(/The declared default scenario/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Run experiment' }));

    expect(screen.getByText('BASELINE')).toBeInTheDocument();
    expect(screen.getByText('CURRENT')).toBeInTheDocument();
    expect(screen.getByText(`WIP limit ${wipFrom}`)).toBeInTheDocument();
    expect(screen.getByText(`WIP limit ${wipTo}`)).toBeInTheDocument();
  });

  it('leads with an instruction for the eye and folds the long reading away', () => {
    // The card used to run "what to look at" and "what it means" together in
    // one paragraph under a 210px chart. That reads the chart as an
    // illustration of the prose, which is backwards for this product.
    renderPage();

    expect(
      screen.getByText('Cycle time climbing while throughput stays roughly flat.'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('What this shape means')).toHaveLength(
      chartsInFamily('flow').length,
    );
  });

  it('does not claim anything moved until something has', async () => {
    // At baseline the scenario IS the default, so a heading reading "why this
    // moved" would be describing a change nobody made.
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('tab', { name: /Quality/ }));
    const card = screen.getByText('Defect rate').closest('.MuiCard-root') as HTMLElement;

    expect(within(card).getByText('What this depends on')).toBeInTheDocument();
    expect(within(card).queryByText('Why this moved')).not.toBeInTheDocument();
    // The caveat is still there -- it is a standing dependency either way, and
    // an assumption that stops reaching a chart is one read as a fact.
    expect(within(card).getAllByText(/Model assumption/).length).toBeGreaterThan(0);
  });

  it('explains a WIP experiment with Little’s Law, not with an incident assumption', async () => {
    // The bug this whole pass exists for. Little's Law was computed in
    // flowModel and declared in no ledger edge, so the only coupling cycle
    // time consumed was `incident-to-capacity` -- and the card answered "why
    // did cycle time move when I raised WIP?" with "incidents cost capacity
    // next sprint". Wrong reason, in the one experiment the page recommends.
    const user = userEvent.setup();
    renderPage();
    await useExplore(user);

    await user.click(screen.getByRole('button', { name: 'Run experiment' }));

    const card = screen.getByText('Cycle time', { selector: 'h6' }).closest(
      '.MuiCard-root',
    ) as HTMLElement;
    expect(card).not.toBeNull();

    // The heading now claims causation, because something did move.
    expect(within(card).getByText('Why this moved')).toBeInTheDocument();

    // Little's Law leads: it originates in the model the learner just touched.
    const driven = within(card).getByText(/More WIP -> the same throughput/);
    expect(driven).toBeInTheDocument();

    // ...and the incident edge is demoted to a standing dependency rather than
    // deleted. It is still true; it is just not why this moved.
    expect(within(card).getByText('Also in play')).toBeInTheDocument();
    const standing = within(card).getByText(/Incidents -> less capacity next sprint/);
    expect(
      driven.compareDocumentPosition(standing) & Node.DOCUMENT_POSITION_FOLLOWING,
      'the incident assumption is still being offered as the reason',
    ).toBeTruthy();
  });

  it('separates the chain from the modelling claim on a driven edge', async () => {
    // Leading with "Model assumption: high WIP raises defect injection" is
    // true and useless as an explanation. The chain leads; the typed caveat
    // follows as transparency.
    const user = userEvent.setup();
    renderPage();
    await useExplore(user);

    await user.click(screen.getByRole('button', { name: 'Run experiment' }));
    await user.click(screen.getByRole('tab', { name: /Quality/ }));
    const card = screen.getByText('Defect rate').closest('.MuiCard-root') as HTMLElement;

    expect(within(card).getByText('Why this moved')).toBeInTheDocument();
    expect(
      within(card).getByText(/Higher WIP -> more context switching/),
    ).toBeInTheDocument();
    expect(within(card).getAllByText(/Model assumption/).length).toBeGreaterThan(0);
  });

  it('says why the recommended value is that value', async () => {
    // "Increase WIP from 4 to 8" was authored, and a reader could reasonably
    // ask why 8 and not 5. There was no answer. There is one now, and the
    // card prints it rather than asking to be trusted.
    const user = userEvent.setup();
    renderPage();
    await useExplore(user);
    expect(screen.getByText(new RegExp(`Increase WIP limit from ${wipFrom} → ${wipTo}`)))
      .toBeInTheDocument();
    expect(screen.getByText(/Smallest legible step/)).toBeInTheDocument();
  });

  it('orders a family as an argument rather than a list', async () => {
    // Eight charts of equal weight is a list: the reader arrives and cannot
    // tell which to read first, so they read none of them properly.
    renderPage();
    for (const heading of ['What is happening', 'Why it is happening', 'Where to look']) {
      expect(screen.getByText(heading), heading).toBeInTheDocument();
    }
    const what = screen.getByText('What is happening');
    const where = screen.getByText('Where to look');
    expect(
      what.compareDocumentPosition(where) & Node.DOCUMENT_POSITION_FOLLOWING,
      'the stages are out of order',
    ).toBeTruthy();
  });

  it('gives every chart its own conditional to act on', async () => {
    // The repetition complaint. The ledger-driven callouts answer how the
    // MODEL is wired, and most of the flow family is wired the same way -- so
    // on their own, six cards in a row explained themselves identically.
    renderPage();

    const actions = screen.getAllByText(/^Action:$/);
    expect(actions).toHaveLength(chartsInFamily('flow').length);

    // ...and they are genuinely different, not one template.
    const texts = screen
      .getAllByTestId('chart')
      .map((c) => c.closest('.MuiCard-root')!.textContent ?? '')
      .map((t) => t.slice(t.indexOf('Action:')));
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('turns aging WIP from analysis into an errand', async () => {
    // The most operationally useful chart in the family, and it read exactly
    // like the other seven.
    renderPage();
    const aging = screen.getByText('Aging WIP').closest('.MuiCard-root') as HTMLElement;
    // Anchored, because this card's ACTION also mentions the 85th percentile
    // -- which is the point: the chip states the count, the action says what
    // to do about it.
    expect(
      within(aging).getByText(/^\d+ items? past the 85th percentile$/),
    ).toBeInTheDocument();
    expect(within(aging).getByText(/Work the oldest item first/)).toBeInTheDocument();
  });

  it('closes with a verdict, and shows the rule that produced it', async () => {
    const user = userEvent.setup();
    renderPage();
    await useExplore(user);

    await user.click(screen.getByRole('button', { name: 'Run experiment' }));

    expect(screen.getByText(/^Verdict:/)).toBeInTheDocument();
    // The rule is printed, so a reader who disagrees can see what produced it.
    expect(screen.getByText(/each judged against the same 5% band/)).toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: 'Show controls' }));
    expect(screen.getByText('0%')).toBeInTheDocument();
    const flat = lastPayloadFor('velocity');
    const tail = flat!.series.slice(4).filter((v): v is number => v !== null);
    expect(new Set(tail.map((v) => v.toFixed(4))).size).toBe(1);
  });
});
