// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import type { CompareData } from '../../types/lakehouse';
import { reconciliationFacts } from '../../services/lakehouse/stationC';
import { Detail, Metric, MetricRow, Note, Pill } from '../ui/primitives';

const n = (value: number) => value.toLocaleString('en-GB');
const show = (v?: string | null) => (v == null ? '—' : v);

/**
 * What compare_tables found, as the engine returned it (design §4.4, mockup A5).
 *
 * Every figure is read from the result. The note under the table is built from
 * the same result -- which columns differ only at row level -- so it says what
 * happened this time rather than what the lesson would like to have happened.
 */
export const CompareResult: React.FC<{ data: CompareData; left: string; right: string }> = ({ data, left, right }) => {
  const facts = reconciliationFacts(data);
  const differingRows = Object.values(facts.mismatchedRows).reduce((a, b) => a + b, 0);
  const differingColumns = Object.keys(facts.mismatchedRows).length;
  const { row_counts: rc } = data;
  const heading = `${left} vs ${right}`;

  return (
    <>
      <MetricRow sx={{ mt: '12px' }}>
        <Metric
          label="Rows"
          value={rc.left === rc.right ? `${n(rc.left)} = ${n(rc.right)}` : `${n(rc.left)} ≠ ${n(rc.right)}`}
          detail={rc.left === rc.right ? 'Counts match' : 'Counts differ'}
        />
        <Metric
          label="Row-level mismatches"
          value={n(differingRows)}
          detail={`In ${differingColumns} column${differingColumns === 1 ? '' : 's'} · tolerance ${data.tolerance}`}
        />
        <Metric
          label="Keys in one table only"
          value={n(data.only_in_left + data.only_in_right)}
          detail={`${n(data.only_in_left)} in ${left} · ${n(data.only_in_right)} in ${right}`}
        />
      </MetricRow>

      <TableContainer tabIndex={0} role="region" aria-label={`Column comparison for ${heading}, scrollable`} sx={{ mt: '12px' }}>
        <Table size="small" aria-label={`Column comparison for ${heading}`}>
          <TableHead>
            <TableRow>
              <TableCell>Column</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>{left} sum</TableCell>
              <TableCell>{right} sum</TableCell>
              <TableCell>Nulls (left / right)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.columns_compared.map((column) => {
              const agg = data.aggregates[column];
              const count = data.mismatches[column]?.count ?? 0;
              const largest = data.mismatches[column]?.largest_difference;
              return (
                <TableRow key={column}>
                  <TableCell>{column}</TableCell>
                  <TableCell>
                    {count > 0
                      ? <Pill tone="danger">{`${n(count)} row${count === 1 ? '' : 's'} differ`}</Pill>
                      : <Pill tone="success">Match</Pill>}
                    {count > 0 && largest != null && (
                      <Detail component="span" sx={{ ml: '8px' }}>
                        largest {largest}{data.mismatches[column]?.difference_unit ? ` ${data.mismatches[column]?.difference_unit}` : ''}
                      </Detail>
                    )}
                  </TableCell>
                  <TableCell>{show(agg?.left.sum)}</TableCell>
                  <TableCell>{show(agg?.right.sum)}</TableCell>
                  <TableCell>{agg ? `${agg.left.nulls} / ${agg.right.nulls}` : '—'}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {facts.rowLevelOnly.length > 0 && (
        <Note sx={{ mt: '12px' }}>
          In {facts.rowLevelOnly.join(', ')}, the totals are identical and rows still differ. Only the comparison by key finds
          them: row-count parity, or matching totals, isn’t enough.
        </Note>
      )}
      {facts.rowLevelOnly.length === 0 && differingRows > 0 && (
        <Detail sx={{ mt: '12px' }}>
          Every column with differing rows also shows a difference in its totals this time. The comparison by key is what names
          the rows.
        </Detail>
      )}
    </>
  );
};
