// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Box, Button, Checkbox, IconButton, Tooltip,
} from '@mui/material';
import { Edit2, Trash2 } from 'lucide-react';
import { Question, QuestionType } from '../../types/question';
import { Actions, Pill } from '../ui/primitives';
import { NARROW_QUERY } from '../../theme/tokens';

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

const TYPE_LABEL: Partial<Record<QuestionType, string>> = {
  single_choice: 'Single choice',
  multiple_choice: 'Multiple choice',
  true_false: 'True/false',
  scenario: 'Scenario',
  case_study: 'Case study',
  image: 'Image',
  code: 'Code',
  drag_and_drop: 'Drag and drop',
};

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * What the learner's answers say about a question, in the prototype's words:
 * Not attempted, Missed or Answered correctly, and Due when the schedule has
 * brought it round. Nothing when the listing carried no evidence.
 */
export const QuestionStatus: React.FC<{ question: Question }> = ({ question }) => {
  const e = question.evidence;
  if (!e) return <Box component="span" sx={{ color: 'text.secondary' }}>—</Box>;
  return (
    <Actions sx={{ gap: '4px' }}>
      {e.answered === 0
        ? <Pill>Not attempted</Pill>
        : e.missed ? <Pill tone="danger">Missed</Pill> : <Pill tone="success">Answered correctly</Pill>}
      {e.due && <Pill tone="warning">Due</Pill>}
    </Actions>
  );
};

/** Read by screen readers, not drawn. */
const VISUALLY_HIDDEN = {
  border: 0, clip: 'rect(0 0 0 0)', height: '1px', margin: '-1px', overflow: 'hidden',
  padding: 0, position: 'absolute', top: 0, left: 0, whiteSpace: 'nowrap', width: '1px',
} as const;

/** The prototype's bank table: the question, its topic, level, type and status, and a way in. */
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
  const bank = mode === 'bank';
  const allSelected = bank && questions.length > 0 && questions.every((q) => selectedIds?.has(q.id));
  const someSelected = bank && !allSelected && questions.some((q) => selectedIds?.has(q.id));

  return (
    <TableContainer sx={{ overflowX: 'auto', maxWidth: '100%', minWidth: 0 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {bank && (
              <TableCell padding="checkbox">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={() => onToggleSelectAll?.()}
                  slotProps={{ input: { 'aria-label': 'Select every question on this page' } }}
                />
              </TableCell>
            )}
            <TableCell>Question</TableCell>
            <TableCell sx={{ [NARROW_QUERY]: { display: 'none' } }}>Topic</TableCell>
            <TableCell>Level</TableCell>
            <TableCell sx={{ [NARROW_QUERY]: { display: 'none' } }}>Type</TableCell>
            {bank && <TableCell>Status</TableCell>}
            <TableCell sx={{ position: 'relative' }}>
              <Box component="span" sx={VISUALLY_HIDDEN}>Actions</Box>
            </TableCell>
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
                {bank && (
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    {/* Named per row. A column of identical unnamed
                        checkboxes is a column of "checkbox, checkbox,
                        checkbox" to anything not looking at it. */}
                    <Checkbox
                      checked={isSelected}
                      onChange={() => onToggleSelect?.(q.id)}
                      slotProps={{ input: { 'aria-label': `Select question ${q.id}` } }}
                    />
                  </TableCell>
                )}
                <TableCell sx={{ maxWidth: 380, minWidth: 220, [NARROW_QUERY]: { minWidth: 120 } }}>
                  {/* The row opens the question for the mouse; this is the same
                      action for the keyboard, which cannot click a row. */}
                  <Box
                    component="button"
                    type="button"
                    title={q.text}
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); onRowClick(q); }}
                    sx={{
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      p: 0, border: 0, minHeight: 24, width: '100%', bgcolor: 'transparent', color: 'inherit',
                      font: 'inherit', fontWeight: 700, textAlign: 'left', cursor: 'pointer',
                    }}
                  >
                    {q.text}
                  </Box>
                </TableCell>
                <TableCell sx={{ color: 'text.secondary', maxWidth: 260, [NARROW_QUERY]: { display: 'none' } }}>
                  {q.topic || q.domain}
                  {/* The area too: a topic name alone does not say which part of the syllabus it is. */}
                  {q.topic && q.domain && (
                    <Box component="span" sx={{ display: 'block', fontSize: (t) => t.typography.pxToRem(11), mt: '2px' }}>{q.domain}</Box>
                  )}
                </TableCell>
                <TableCell>{capitalise(q.difficulty)}</TableCell>
                <TableCell sx={{ [NARROW_QUERY]: { display: 'none' } }}>
                  {TYPE_LABEL[q.question_type] ?? q.question_type.replace(/_/g, ' ')}
                </TableCell>
                {bank && <TableCell><QuestionStatus question={q} /></TableCell>}
                <TableCell onClick={(e) => e.stopPropagation()} sx={{ whiteSpace: 'nowrap' }}>
                  <Actions sx={{ gap: '2px', flexWrap: 'nowrap' }}>
                    <Button variant="outlined" size="small" onClick={() => onRowClick(q)} aria-label={`Open question ${q.id}`}>
                      Open
                    </Button>
                    <Tooltip title="Edit question">
                      <IconButton size="small" onClick={() => onEdit(q)} aria-label={`Edit question ${q.id}`}>
                        <Edit2 size={15} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete question">
                      <IconButton size="small" color="error" onClick={() => onDelete(q.id)} aria-label={`Delete question ${q.id}`}>
                        <Trash2 size={15} />
                      </IconButton>
                    </Tooltip>
                  </Actions>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
