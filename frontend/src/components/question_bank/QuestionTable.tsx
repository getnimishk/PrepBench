// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Checkbox, Chip, IconButton, Tooltip, Typography, Card
} from '@mui/material';
import { Edit2, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { Question, QuestionDifficulty } from '../../types/question';

const DIFFICULTY_COLOR: Record<QuestionDifficulty, 'success' | 'warning' | 'error'> = {
  easy: 'success',
  medium: 'warning',
  hard: 'error',
};

interface QuestionTableProps {
  questions: Question[];
  mode: 'bank' | 'staging';
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
  onToggleSelectAll?: () => void;
  onRowClick: (q: Question) => void;
  onEdit: (q: Question) => void;
  onDelete: (id: number) => void;
}

export const QuestionTable: React.FC<QuestionTableProps> = ({
  questions,
  mode,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onRowClick,
  onEdit,
  onDelete,
}) => {
  const showCheckbox = mode === 'bank';
  const showReviewed = mode === 'bank';

  const allSelected = showCheckbox && questions.length > 0 && questions.every((q) => selectedIds?.has(q.id));
  const someSelected = showCheckbox && !allSelected && questions.some((q) => selectedIds?.has(q.id));

  return (
    <TableContainer component={Card}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {showCheckbox && (
              <TableCell padding="checkbox">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={() => onToggleSelectAll?.()}
                />
              </TableCell>
            )}
            <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Question</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Domain / Topic</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Certification</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Difficulty</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
            {showReviewed && <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>Reviewed</TableCell>}
            <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {questions.map((q) => {
            const isSelected = !!selectedIds?.has(q.id);
            return (
              <TableRow
                key={q.id}
                hover
                selected={isSelected}
                onClick={() => onRowClick(q)}
                sx={{ cursor: 'pointer' }}
              >
                {showCheckbox && (
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={isSelected} onChange={() => onToggleSelect?.(q.id)} />
                  </TableCell>
                )}
                <TableCell>
                  <Typography variant="caption" color="text.secondary">#{q.id}</Typography>
                </TableCell>
                <TableCell sx={{ maxWidth: 360 }}>
                  <Tooltip title={q.text}>
                    <Typography variant="body2" sx={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 340 }}>
                      {q.text}
                    </Typography>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{q.domain}</Typography>
                  <Typography variant="caption" color="text.secondary">{q.topic}</Typography>
                </TableCell>
                <TableCell>
                  <Chip label={q.certification} size="small" variant="outlined" sx={{ maxWidth: 180 }} />
                </TableCell>
                <TableCell>
                  <Chip
                    label={q.difficulty.toUpperCase()}
                    size="small"
                    color={DIFFICULTY_COLOR[q.difficulty]}
                  />
                </TableCell>
                <TableCell>
                  <Chip label={q.question_type.replace('_', ' ')} size="small" sx={{ bgcolor: 'action.hover', textTransform: 'capitalize' }} />
                </TableCell>
                {showReviewed && (
                  <TableCell sx={{ textAlign: 'center' }}>
                    {q.is_reviewed ? (
                      <Tooltip title="Reviewed">
                        <CheckCircle2 size={18} color="#34D399" />
                      </Tooltip>
                    ) : (
                      <Tooltip title="Not reviewed">
                        <Circle size={18} color="#9CA3AF" />
                      </Tooltip>
                    )}
                  </TableCell>
                )}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Tooltip title="Edit Question">
                    <IconButton size="small" color="primary" onClick={() => onEdit(q)}>
                      <Edit2 size={16} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete Question">
                    <IconButton size="small" color="error" onClick={() => onDelete(q.id)}>
                      <Trash2 size={16} />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
