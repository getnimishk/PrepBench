import type {
  ChartViewId,
  ScenarioParams,
  SprintResult,
} from '../../types/agileMetrics';
import { CHART_BY_ID } from './charts';

// Model output -> chart-ready data.
//
// This is the only place that knows what each of the twenty-seven views
// actually plots. The renderers below it are dumb on purpose: a line chart
// does not know what a burndown is, and a burndown is not a component. That
// separation is what keeps four primitives covering twenty-seven views
// instead of twenty-seven components slowly growing their own quirks.
//
// Every payload carries its own axis labels and unit, because a chart whose
// y-axis says "0.12" without saying "share of deployments" is a chart the
// learner has to guess at -- and guessing is exactly what this sandbox is
// supposed to replace.

export interface ChartSeries {
  label: string;
  data: (number | null)[];
  /**
   * A target, ideal or threshold line rather than measured data. Drawn dashed
   * so the eye does not read a commitment as an observation.
   */
  reference?: boolean;
}

export interface ScatterPoint {
  x: number;
  y: number;
}

export type ChartUnit = 'count' | 'days' | 'hours' | 'percent' | 'rating' | 'perDay';

export interface ChartPayload {
  viewId: ChartViewId;
  title: string;
  xLabel: string;
  yLabel: string;
  unit: ChartUnit;
  labels: string[];
  series: ChartSeries[];
  /** Scatter views only. */
  points?: ScatterPoint[];
  /** Percentile markers for scatter views. */
  percentiles?: { label: string; value: number }[];
  yMax?: number;
  /** Stacked-area bands, listed bottom to top. */
  stacked?: boolean;
  /**
   * Shown under the chart. Says what to look at -- the sandbox exists to make
   * a shape mean something, and a shape with no reading is decoration.
   */
  reading: string;
}

const sprintLabels = (sprints: SprintResult[]): string[] =>
  sprints.map((s) => `S${s.sprint}`);

/** Percentile of a sorted-on-demand sample. Nearest-rank, no interpolation. */
function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[rank];
}

export function buildChartPayload(
  viewId: ChartViewId,
  sprints: SprintResult[],
  p: ScenarioParams,
): ChartPayload {
  const meta = CHART_BY_ID.get(viewId);
  if (!meta) throw new Error(`Unknown chart view "${viewId}"`);

  const labels = sprintLabels(sprints);
  const base = { viewId, title: meta.canonicalName, labels, series: [] as ChartSeries[] };
  const last = sprints[sprints.length - 1];

  switch (viewId) {
    // ---------------------------- FLOW ------------------------------------
    case 'throughput':
      return {
        ...base,
        xLabel: 'Sprint',
        yLabel: 'Items completed',
        unit: 'count',
        series: [
          { label: 'Delivered', data: sprints.map((s) => s.flow.deliveredItems) },
          { label: 'Net new (after rework)', data: sprints.map((s) => s.quality.netNewItems) },
        ],
        reading:
          'The gap between the two lines is the rework tax -- work the team did that ' +
          'produced nothing new. A velocity chart shows only the upper line.',
      };

    case 'cycleTime':
      return {
        ...base,
        xLabel: 'Sprint',
        yLabel: 'Days',
        unit: 'days',
        series: [{ label: 'Cycle time', data: sprints.map((s) => s.flow.cycleTimeDays) }],
        reading:
          'Cycle time is an output, never a control. It is WIP divided by throughput -- ' +
          'raise WIP and this rises in exact proportion while delivery does not move.',
      };

    case 'cycleTimeDistribution': {
      // One point per completed batch, across every sprint. In a deterministic
      // sandbox the spread comes only from structural change between sprints,
      // which is itself the reading: a perfectly predictable system draws a
      // flat band, and a real one never does.
      const points: ScatterPoint[] = [];
      sprints.forEach((s) => {
        const batches = s.flow.batchIntervalDays > 0
          ? Math.round(p.sprintLengthDays / s.flow.batchIntervalDays)
          : 0;
        for (let b = 1; b <= batches; b++) {
          points.push({
            x: (s.sprint - 1) * p.sprintLengthDays + b * s.flow.batchIntervalDays,
            y: s.flow.cycleTimeDays,
          });
        }
      });
      const ys = points.map((pt) => pt.y);
      return {
        ...base,
        xLabel: 'Completion day',
        yLabel: 'Cycle time (days)',
        unit: 'days',
        points,
        percentiles: [
          { label: '50th', value: percentile(ys, 50) },
          { label: '85th', value: percentile(ys, 85) },
        ],
        reading:
          'The 85th percentile is what you can actually promise. Quoting the average ' +
          'instead is how teams end up missing half their commitments.',
      };
    }

    case 'deliveryLeadTime':
      return {
        ...base,
        xLabel: 'Sprint',
        yLabel: 'Days',
        unit: 'days',
        series: [
          { label: 'Delivery lead time', data: sprints.map((s) => s.flow.deliveryLeadTimeDays) },
          { label: 'Cycle time', data: sprints.map((s) => s.flow.cycleTimeDays) },
        ],
        reading:
          'Lead time starts when the customer asks; cycle time starts when the team ' +
          'begins. The gap is queue -- invisible to the team, and all the customer feels.',
      };

    case 'flowEfficiency':
      return {
        ...base,
        xLabel: 'Sprint',
        yLabel: 'Share of cycle time spent working',
        unit: 'percent',
        yMax: 1,
        series: [{ label: 'Flow efficiency', data: sprints.map((s) => s.flow.flowEfficiency) }],
        reading:
          'At WIP 1 an item is worked on the whole time it is open. Raise WIP and this ' +
          'collapses -- the work is not slower, it is just waiting more.',
      };

    case 'cumulativeFlow': {
      // Across every sprint's days, so the bands accumulate the way a real CFD
      // does rather than resetting each sprint.
      const dayLabels: string[] = [];
      const done: number[] = [];
      const started: number[] = [];
      const committed: number[] = [];
      let carriedDone = 0;
      let carriedCommitted = 0;
      sprints.forEach((s) => {
        s.flow.burnup.forEach((value, day) => {
          if (day === 0 && s.sprint > 1) return; // avoid duplicating the boundary
          dayLabels.push(`S${s.sprint}·D${day}`);
          done.push(carriedDone + value);
          started.push(carriedDone + s.flow.started[day]);
          committed.push(carriedCommitted + s.flow.committedItems);
        });
        carriedDone += s.flow.deliveredItems;
        carriedCommitted += s.flow.committedItems;
      });
      return {
        ...base,
        labels: dayLabels,
        xLabel: 'Day',
        yLabel: 'Items (cumulative)',
        unit: 'count',
        stacked: false,
        series: [
          { label: 'Committed', data: committed },
          { label: 'Started', data: started },
          { label: 'Done', data: done },
        ],
        reading:
          'The vertical gap between Started and Done is WIP; the horizontal gap is ' +
          'cycle time. Widening bands mean work is entering faster than it leaves.',
      };
    }

    case 'agingWip': {
      // Items currently open, spread across the ages they have reached.
      const points: ScatterPoint[] = [];
      sprints.forEach((s) => {
        const open = Math.round(Math.min(p.wip, s.flow.deliveredItems));
        for (let i = 0; i < open; i++) {
          const age = open > 1 ? (s.flow.cycleTimeDays * (i + 1)) / open : s.flow.cycleTimeDays;
          points.push({ x: s.sprint, y: age });
        }
      });
      const ys = points.map((pt) => pt.y);
      return {
        ...base,
        xLabel: 'Sprint',
        yLabel: 'Age of open items (days)',
        unit: 'days',
        points,
        percentiles: [{ label: '85th', value: percentile(ys, 85) }],
        reading:
          'Aging WIP is the only flow chart that tells you about work still in flight. ' +
          'Everything else here is a post-mortem on work already finished.',
      };
    }

    case 'wipOverTime':
      return {
        ...base,
        xLabel: 'Sprint',
        yLabel: 'Items in flight',
        unit: 'count',
        series: [{ label: 'WIP limit', data: sprints.map(() => p.wip), reference: true }],
        reading:
          'A flat line, because WIP is a control here, not an outcome. Every other ' +
          'chart in this family is downstream of where you set it.',
      };

    // ------------------------ PREDICTABILITY ------------------------------
    case 'burndown': {
      const ideal = last.flow.burndown.map(
        (_, day, arr) => last.flow.committedItems * (1 - day / (arr.length - 1 || 1)),
      );
      return {
        ...base,
        labels: last.flow.burndown.map((_, day) => `Day ${day}`),
        xLabel: `Day of sprint ${last.sprint}`,
        yLabel: 'Items remaining',
        unit: 'count',
        series: [
          { label: 'Remaining', data: last.flow.burndown },
          { label: 'Ideal', data: ideal, reference: true },
        ],
        reading:
          'The shape is set by batch size, not by effort. At WIP 1 this tracks the ideal; ' +
          'at high WIP it stays flat and then falls off a cliff on the last day.',
      };
    }

    case 'burnup':
      return {
        ...base,
        labels: last.flow.burnup.map((_, day) => `Day ${day}`),
        xLabel: `Day of sprint ${last.sprint}`,
        yLabel: 'Items completed',
        unit: 'count',
        series: [
          { label: 'Completed', data: last.flow.burnup },
          {
            label: 'Scope',
            data: last.flow.burnup.map(() => last.flow.committedItems),
            reference: true,
          },
        ],
        reading:
          'Same data as the burndown, but scope is its own line. When a burndown flattens ' +
          'you cannot tell whether work stopped or scope grew; here you can.',
      };

    case 'velocity':
      return {
        ...base,
        xLabel: 'Sprint',
        yLabel: 'Items completed',
        unit: 'count',
        series: [
          { label: 'Velocity', data: sprints.map((s) => s.flow.deliveredItems) },
          { label: 'Committed', data: sprints.map((s) => s.flow.committedItems), reference: true },
        ],
        reading:
          'Velocity is a capacity forecast, not a productivity score. It cannot be ' +
          'compared between teams, and pushing on it directly just changes how items ' +
          'are sized.',
      };

    case 'sayDoRatio':
      return {
        ...base,
        xLabel: 'Sprint',
        yLabel: 'Delivered ÷ committed',
        unit: 'percent',
        yMax: 1.2,
        series: [
          {
            label: 'Say/do ratio',
            data: sprints.map((s) => s.flow.deliveredItems / s.flow.committedItems),
          },
          { label: '100%', data: sprints.map(() => 1), reference: true },
        ],
        reading:
          'A sustained 100% is not a good sign -- it usually means the team is ' +
          'under-committing. Consistency matters more than the level.',
      };

    case 'sprintGoal': {
      // Deliberately BINARY, and not the say/do ratio with a line drawn on it.
      //
      // Both are computed from delivered over committed, and an earlier
      // version plotted exactly that on both charts -- two of the eight
      // metrics rendering identical numbers, so nothing distinguished them
      // and a learner had no way to say what the difference was.
      //
      // The difference is the whole lesson: a ratio is continuous and tells
      // you BY HOW MUCH, a sprint goal is met or it is not. A team can drop
      // items and still achieve its goal, or deliver everything it committed
      // and miss it. Rendering the goal as full-or-empty bars beside the
      // continuous ratio makes the pair complementary instead of redundant.
      const GOAL_THRESHOLD = 0.8;
      return {
        ...base,
        xLabel: 'Sprint',
        yLabel: 'Goal met',
        unit: 'percent',
        yMax: 1,
        series: [
          {
            label: `Goal met (delivered ≥ ${GOAL_THRESHOLD * 100}% of commitment)`,
            data: sprints.map((s) =>
              s.flow.deliveredItems / s.flow.committedItems >= GOAL_THRESHOLD ? 1 : 0,
            ),
          },
        ],
        reading:
          'Met or not met — never "87% of a goal". Read it against the say/do ratio ' +
          'above: that one tells you by how much, this one tells you whether it ' +
          'counted. A team can drop items and still achieve its goal, or deliver ' +
          'everything it committed and miss it. No standard chart exists for this, ' +
          'and the threshold is a sandbox convention, not a standard.',
      };
    }

    // ---------------------------- QUALITY ---------------------------------
    case 'defectRate':
      return {
        ...base,
        xLabel: 'Sprint',
        yLabel: 'Defects per item',
        unit: 'count',
        series: [{ label: 'Defect rate', data: sprints.map((s) => s.quality.defectRate) }],
        reading:
          'Rises with WIP in this model. That coupling is a teaching assumption, not a ' +
          'measured law -- the callout below says so, and it should stay said.',
      };

    case 'escapedDefects':
      return {
        ...base,
        xLabel: 'Sprint',
        yLabel: 'Defects reaching production',
        unit: 'count',
        series: [
          { label: 'Escaped', data: sprints.map((s) => s.quality.escapedDefects) },
          { label: 'Caught in sprint', data: sprints.map((s) => s.quality.reworkItems) },
        ],
        reading:
          'The only quality metric your users actually experience. Everything caught ' +
          'inside the sprint cost time; this cost trust.',
      };

    case 'defectDensity':
      return {
        ...base,
        xLabel: 'Sprint',
        yLabel: 'Defects per story point',
        unit: 'count',
        series: [{ label: 'Defect density', data: sprints.map((s) => s.quality.defectDensity) }],
        reading:
          'Per POINT, where the rate above is per item — the difference is the whole ' +
          'reason to keep both. At a fixed average item size they move together. ' +
          'Change item size and they separate, which is how a team that quietly ' +
          'inflates its estimates watches density fall while nothing improves.',
      };

    // -------------------------- TEAM HEALTH -------------------------------
    case 'teamHappiness':
      return {
        ...base,
        xLabel: 'Sprint',
        yLabel: 'Happiness (1-5)',
        unit: 'rating',
        yMax: 5,
        series: [{ label: 'Team happiness', data: sprints.map((s) => s.team.happiness) }],
        reading:
          'Modelled here, surveyed in real life. It is the only one of these that ' +
          'moves before the delivery charts do, which is why it is worth asking about.',
      };

    case 'unplannedWorkShare':
      return {
        ...base,
        xLabel: 'Sprint',
        yLabel: 'Share of sprint capacity',
        unit: 'percent',
        yMax: 1,
        series: [
          {
            label: 'Unplanned work',
            data: sprints.map((s) => s.flow.unplannedWorkDays / p.sprintLengthDays),
          },
        ],
        reading:
          'Rises a sprint AFTER the incidents that caused it. That lag is why teams ' +
          'blame the wrong sprint for a bad one.',
      };

    // ----------------------------- DORA -----------------------------------
    case 'deploymentFrequency':
      return {
        ...base,
        xLabel: 'Sprint',
        yLabel: 'Deployments per day',
        unit: 'perDay',
        series: [
          {
            label: 'Deployment frequency',
            data: sprints.map((s) => s.deployment.deploymentFrequencyPerDay),
          },
        ],
        reading:
          'Counts every change event, corrective ones included. A frequency that rises ' +
          'because things keep breaking is not the improvement it looks like.',
      };

    case 'changeLeadTime':
      return {
        ...base,
        xLabel: 'Sprint',
        yLabel: 'Days from commit to production',
        unit: 'days',
        series: [
          { label: 'Change lead time', data: sprints.map((s) => s.deployment.changeLeadTimeDays) },
          { label: 'Cycle time', data: sprints.map((s) => s.flow.cycleTimeDays), reference: true },
        ],
        reading:
          'The gap above cycle time is batch wait -- how long a finished change sits ' +
          'before it ships. Larger batches widen it without anyone working slower.',
      };

    case 'changeFailRate':
      return {
        ...base,
        xLabel: 'Sprint',
        yLabel: 'Share of deployments needing intervention',
        unit: 'percent',
        yMax: 1,
        series: [
          { label: 'Change fail rate', data: sprints.map((s) => s.deployment.changeFailRate) },
        ],
        reading:
          'A failed change deployment is NOT a production incident. Most are caught by a ' +
          'canary or rolled back before anyone notices -- the reliability family picks up ' +
          'the ones that were not.',
      };

    case 'failedDeploymentRecoveryTime':
      return {
        ...base,
        xLabel: 'Sprint',
        yLabel: 'Hours to restore after a failed deployment',
        unit: 'hours',
        series: [
          {
            label: 'Failed deployment recovery time',
            data: sprints.map((s) => s.deployment.failedDeploymentRecoveryHours),
          },
        ],
        reading:
          'DORA renamed this from MTTR in 2024, and the rename matters: it is scoped to ' +
          'recovery from a DEPLOYMENT, not from any production incident. The reliability ' +
          'family has a separate clock for those.',
      };

    case 'deploymentReworkRate':
      return {
        ...base,
        xLabel: 'Sprint',
        yLabel: 'Share of deployments that were corrective',
        unit: 'percent',
        yMax: 1,
        series: [
          {
            label: 'Deployment rework rate',
            data: sprints.map((s) => s.deployment.deploymentReworkRate),
          },
        ],
        reading:
          "DORA's fifth metric, and the one most people cannot name. It is zero in " +
          'sprint 1 because corrective work always arrives from the sprint before.',
      };

    // -------------------------- RELIABILITY -------------------------------
    case 'incidentsPerSprint':
      return {
        ...base,
        xLabel: 'Sprint',
        yLabel: 'Incidents per sprint',
        unit: 'count',
        series: [
          {
            label: 'From our deployments',
            data: sprints.map((s) => s.reliability.deploymentCausedIncidents),
          },
          { label: 'External', data: sprints.map((s) => s.reliability.externalIncidents) },
        ],
        reading:
          'Two sources, and only one of them is yours. Set change fail rate to zero and ' +
          'availability still falls -- reliability is not purely a function of how you deploy.',
      };

    case 'incidentDuration':
      return {
        ...base,
        xLabel: 'Sprint',
        yLabel: 'Hours',
        unit: 'hours',
        series: [
          { label: 'Total downtime', data: sprints.map((s) => s.reliability.downtimeHours) },
          {
            label: 'Per incident',
            data: sprints.map(() => p.incidentDurationHours),
            reference: true,
          },
        ],
        reading:
          'Total downtime assumes incidents do not overlap, so it is an upper bound. ' +
          'Real incidents overlap and real downtime is lower.',
      };

    case 'availabilityVsSlo':
      return {
        ...base,
        xLabel: 'Sprint',
        yLabel: 'Availability',
        unit: 'percent',
        yMax: 1,
        series: [
          { label: 'Availability', data: sprints.map((s) => s.reliability.availability) },
          { label: 'SLO', data: sprints.map(() => p.slo), reference: true },
        ],
        reading:
          'The distance above the SLO line is the error budget. Being far above it is not ' +
          'free -- it usually means you are shipping too slowly.',
      };

    case 'errorBudgetBurn':
      return {
        ...base,
        xLabel: 'Sprint',
        yLabel: 'Share of error budget consumed',
        unit: 'percent',
        series: [
          { label: 'Budget burn', data: sprints.map((s) => s.reliability.errorBudgetBurn) },
          { label: 'Budget exhausted', data: sprints.map(() => 1), reference: true },
        ],
        reading:
          'Above the line means the budget is spent and the next conversation is about ' +
          'slowing down, not shipping harder. Deliberately not capped.',
      };
  }
}
