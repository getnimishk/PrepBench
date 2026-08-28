// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Alert, Button, ToggleButton, ToggleButtonGroup, Chip, Tooltip,
} from '@mui/material';
import { RoadmapSchedule, ScheduleStatus } from '../../types/roadmap';

interface Props {
  schedule: RoadmapSchedule;
  onConfigureSchedule: () => void;
}

/**
 * Why the schedule can't be drawn, in the user's terms plus the fix.
 *
 * An empty chart with no explanation is the failure mode this avoids: the
 * backend already knows exactly which input is missing, so say it rather than
 * rendering blank axes or, worse, inventing a default pace.
 */
const UNAVAILABLE_COPY: Record<string, { message: string; action?: string }> = {
  no_topics: { message: 'This roadmap has no topics yet, so there is nothing to schedule.' },
  no_start_date: {
    message: 'Set a start date to project a timeline.',
    action: 'Set schedule',
  },
  no_weekly_budget: {
    message: 'Set how many hours a week you plan to study to project a timeline.',
    action: 'Set schedule',
  },
  no_time_estimates: {
    message:
      'None of the topics have an hours estimate, so a timeline cannot be projected. '
      + 'Add estimated hours to topics to see a schedule.',
  },
};

const BAR_COLOR: Record<ScheduleStatus, string> = {
  actual: 'success.main',
  projected: 'primary.main',
  unschedulable: 'transparent',
  skipped: 'transparent',
};

/**
 * Parse a `YYYY-MM-DD` string as LOCAL midnight.
 *
 * `new Date('2026-08-13')` is specified to parse a date-only string as *UTC*
 * midnight, while `new Date()` reports local time. Mixing the two silently
 * shifts every bar by a day in any timezone that isn't UTC, and hides the
 * "today" marker entirely when the offset pushes local-midnight-today before
 * a bar that starts today. Building the date from its parts keeps every date
 * in this chart on the same (local) footing.
 */
function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function startOfToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export const RoadmapGanttView: React.FC<Props> = ({ schedule, onConfigureSchedule }) => {
  const [granularity, setGranularity] = useState<'phase' | 'topic'>('phase');

  const rows = useMemo(() => {
    if (granularity === 'phase') {
      return schedule.phases.map((p) => ({
        key: `phase-${p.phase_id}`,
        label: p.phase_name,
        start: p.start,
        end: p.end,
        status: p.schedule_status,
      }));
    }
    return schedule.items.map((i) => ({
      key: `topic-${i.topic_id}`,
      label: i.title,
      start: i.start,
      end: i.end,
      status: i.schedule_status,
    }));
  }, [granularity, schedule]);

  const bounds = useMemo(() => {
    const dates = rows
      .flatMap((r) => [r.start, r.end])
      .filter((d): d is string => !!d)
      .map(parseLocalDate);
    if (dates.length === 0) return null;
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    const today = startOfToday();
    // The marker is only drawn when today actually falls inside the charted
    // range; outside it there is no honest place to put it.
    const todayInRange = today >= min && today <= max;
    return {
      min,
      max,
      total: Math.max(1, daysBetween(min, max) + 1),
      today: todayInRange ? today : null,
    };
  }, [rows]);

  if (!schedule.schedule_available) {
    const copy = UNAVAILABLE_COPY[schedule.reason || ''] || {
      message: 'A timeline cannot be projected for this roadmap yet.',
    };
    return (
      <Alert
        severity="info"
        sx={{ mt: 2 }}
        action={
          copy.action ? (
            <Button color="inherit" size="small" onClick={onConfigureSchedule}>
              {copy.action}
            </Button>
          ) : undefined
        }
      >
        {copy.message}
      </Alert>
    );
  }

  const monthTicks: { label: string; offset: number }[] = [];
  if (bounds) {
    const cursor = new Date(bounds.min.getFullYear(), bounds.min.getMonth(), 1);
    while (cursor <= bounds.max) {
      const offset = daysBetween(bounds.min, cursor);
      if (offset >= 0) monthTicks.push({ label: formatMonth(cursor), offset });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip size="small" label={`Projected finish: ${schedule.projected_end_date ?? '—'}`} />
          <Chip size="small" variant="outlined" label={`${schedule.weekly_hours_budget}h / week`} />
          {schedule.unschedulable_topic_count > 0 && (
            <Chip
              size="small" color="warning" variant="outlined"
              label={`${schedule.unschedulable_topic_count} topic(s) have no hours estimate`}
            />
          )}
        </Box>
        <ToggleButtonGroup
          size="small" exclusive value={granularity}
          onChange={(_, value) => value && setGranularity(value)}
        >
          <ToggleButton value="phase">Phases</ToggleButton>
          <ToggleButton value="topic">Topics</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {!bounds ? (
        <Alert severity="info">No dated work to plot yet.</Alert>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Box sx={{ minWidth: 640 }}>
            {/* Month scale */}
            <Box sx={{ display: 'flex', mb: 0.5 }}>
              <Box sx={{ width: 200, flexShrink: 0 }} />
              <Box sx={{ position: 'relative', flexGrow: 1, height: 20 }}>
                {monthTicks.map((tick) => (
                  <Typography
                    key={tick.label}
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      position: 'absolute',
                      left: `${(tick.offset / bounds.total) * 100}%`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tick.label}
                  </Typography>
                ))}
              </Box>
            </Box>

            {rows.map((row) => {
              const hasBar = !!row.start && !!row.end;
              const leftPct = hasBar ? (daysBetween(bounds.min, parseLocalDate(row.start!)) / bounds.total) * 100 : 0;
              const widthPct = hasBar
                ? Math.max(
                    1,
                    ((daysBetween(parseLocalDate(row.start!), parseLocalDate(row.end!)) + 1) / bounds.total) * 100
                  )
                : 0;

              return (
                <Box key={row.key} sx={{ display: 'flex', alignItems: 'center', mb: 0.75 }}>
                  <Tooltip title={row.label}>
                    <Typography
                      variant="body2"
                      sx={{
                        width: 200, flexShrink: 0, pr: 2, whiteSpace: 'nowrap',
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        color: hasBar ? 'text.primary' : 'text.secondary',
                      }}
                    >
                      {row.label}
                    </Typography>
                  </Tooltip>

                  <Box sx={{
                    position: 'relative', flexGrow: 1, height: 22,
                    bgcolor: 'action.hover', borderRadius: 1,
                  }}>
                    {bounds.today && (
                      <Box sx={{
                        position: 'absolute', top: 0, bottom: 0,
                        left: `${(daysBetween(bounds.min, bounds.today) / bounds.total) * 100}%`,
                        width: '2px', bgcolor: 'error.main', opacity: 0.7, zIndex: 2,
                      }} />
                    )}

                    {hasBar ? (
                      <Tooltip title={`${row.start} → ${row.end} (${row.status})`}>
                        <Box sx={{
                          position: 'absolute', top: 3, bottom: 3,
                          left: `${leftPct}%`, width: `${widthPct}%`,
                          bgcolor: BAR_COLOR[row.status], borderRadius: 1,
                          // Projected work is a forecast, not a commitment --
                          // drawn lighter than recorded actuals so the two are
                          // never mistaken for each other.
                          opacity: row.status === 'projected' ? 0.75 : 1,
                        }} />
                      </Tooltip>
                    ) : (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ position: 'absolute', left: 8, top: 2 }}
                      >
                        {row.status === 'skipped' ? 'Skipped' : 'No hours estimate'}
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            })}

            <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
              <LegendSwatch color="success.main" label="Completed (actual dates)" />
              <LegendSwatch color="primary.main" label="Projected" opacity={0.75} />
              <LegendSwatch color="error.main" label="Today" width={2} />
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

const LegendSwatch: React.FC<{ color: string; label: string; opacity?: number; width?: number }> = ({
  color, label, opacity = 1, width = 16,
}) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
    <Box sx={{ width, height: 10, bgcolor: color, opacity, borderRadius: 0.5 }} />
    <Typography variant="caption" color="text.secondary">{label}</Typography>
  </Box>
);
