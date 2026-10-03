// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Box, useTheme } from '@mui/material';
import { usePb } from '../../theme/usePb';
import { monthOf, type FactoryConfig, type FactoryRun } from '../../services/lakehouse/factoryModel';
import { timelineSummary } from '../../services/lakehouse/present';

const W = 640;
const LEFT = 150;
const RIGHT = 24;
const ROW_H = 44;
const TOP = 46;

/**
 * Station F's timeline (mockup A8): one bar per plan, ending where the programme
 * really ended, with a tick where that plan said it would. Both are always drawn,
 * because the comparison is the lesson. Events and incidents sit on the axis above.
 *
 * All colours come from the theme's tokens, and every text size scales with the
 * Large-text setting (`textScale`), as the Home chart's does.
 */
export const FactoryTimeline: React.FC<{ run: FactoryRun; config: FactoryConfig }> = ({ run, config }) => {
  const theme = useTheme();
  const pb = usePb();
  const textScale = theme.typography.fontSize / 14;
  const size = (n: number) => Math.round(n * textScale);

  const maxMonth = Math.max(12, Math.ceil(Math.max(run.count.plannedEnd, run.weighted.plannedEnd, run.count.actualEnd)) + 1);
  const x = (m: number) => LEFT + (m / maxMonth) * (W - LEFT - RIGHT);
  const H = TOP + ROW_H * 2 + 36;
  const freeze = config.changeFreeze;

  const rows: { label: string; plan: FactoryRun['count']; y: number }[] = [
    { label: 'Plan by job count', plan: run.count, y: TOP },
    { label: 'Weighted by complexity', plan: run.weighted, y: TOP + ROW_H },
  ];
  const ticks = Array.from({ length: Math.floor(maxMonth / 2) + 1 }, (_, i) => i * 2);

  return (
    // On a phone the picture scrolls inside its own box at a size the text can be read at,
    // instead of shrinking to a fraction of it. The page itself never scrolls sideways.
    <Box tabIndex={0} role="region" aria-label="Programme timeline, scrollable" sx={{ width: '100%', minWidth: 0, mt: '12px', overflowX: 'auto' }}>
      <Box
        component="svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={timelineSummary(run)}
        sx={{ width: '100%', minWidth: 560, height: 'auto', display: 'block' }}
      >
        {/* The change-freeze window: no cutover lands inside it. */}
        <rect x={x(freeze.fromMonth)} y={TOP - 12} width={x(freeze.toMonth) - x(freeze.fromMonth)} height={ROW_H * 2 + 8} fill={pb.warningSoft} />
        <text x={x(freeze.fromMonth) + 3} y={H - 20} fontSize={size(10)} fill={pb.muted}>freeze</text>

        {ticks.map((m) => (
          <g key={m}>
            <line x1={x(m)} x2={x(m)} y1={TOP - 12} y2={TOP + ROW_H * 2 - 4} stroke={pb.line} strokeWidth={1} />
            <text x={x(m)} y={H - 6} textAnchor="middle" fontSize={size(10)} fill={pb.muted}>{m}</text>
          </g>
        ))}
        <text x={LEFT - 10} y={H - 6} textAnchor="end" fontSize={size(10)} fill={pb.muted}>month</text>

        {rows.map(({ label, plan, y }) => {
          const late = plan.lateness > 1;
          const barEnd = x(plan.actualEnd);
          const promised = x(plan.plannedEnd);
          return (
            <g key={label}>
              <text x={LEFT - 10} y={y + 14} textAnchor="end" fontSize={size(11)} fontWeight={600} fill={pb.text}>{label}</text>
              <rect x={x(0)} y={y} width={barEnd - x(0)} height={14} rx={3} fill={late ? pb.danger : pb.success} opacity={0.85} />
              {/* Where this plan said it would end. */}
              <line x1={promised} x2={promised} y1={y - 5} y2={y + 19} stroke={pb.text} strokeWidth={2} />
              <text x={Math.max(promised, barEnd) + 6} y={y + 12} fontSize={size(10)} fill={pb.muted}>
                {late ? `promised ${monthOf(plan.plannedEnd)}, ended ${monthOf(plan.actualEnd)}` : `ended ${monthOf(plan.actualEnd)}, on plan`}
              </text>
            </g>
          );
        })}

        {/* Events on the axis: the scheduled ones, then what went wrong. */}
        {run.events.filter((e) => e.id !== 'pilot-velocity').map((e) => (
          <g key={e.id}>
            <path d={`M ${x(e.month)} ${TOP - 26} l -5 9 h 10 z`} fill={pb.warning} />
            <text x={x(e.month) + 8} y={TOP - 18} fontSize={size(10)} fill={pb.muted}>{`M${e.month}`}</text>
          </g>
        ))}
        {run.incidents.map((i) => (
          <g key={`${i.id}-${i.wave}`}>
            <path d={`M ${x(i.month)} ${TOP - 26} l -5 9 h 10 z`} fill={pb.danger} />
            <text x={x(i.month) + 8} y={TOP - 18} fontSize={size(10)} fontWeight={700} fill={pb.danger}>{`M${i.month}`}</text>
          </g>
        ))}
      </Box>
    </Box>
  );
};
