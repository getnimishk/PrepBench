import React from 'react';
import {
  Typography, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Select, MenuItem, Paper, Tooltip, IconButton, Chip,
} from '@mui/material';
import { FileText } from 'lucide-react';
import { RoadmapPhase, RoadmapTopic, RoadmapTopicStatus } from '../../types/roadmap';

interface Props {
  phases: RoadmapPhase[];
  onStatusChange: (topic: RoadmapTopic, status: RoadmapTopicStatus) => void;
  onOpenNotes: (topic: RoadmapTopic) => void;
  busyTopicId?: number | null;
}

const STATUS_LABELS: Record<RoadmapTopicStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  skipped: 'Skipped',
};

const STATUS_COLOR: Record<RoadmapTopicStatus, 'default' | 'warning' | 'success'> = {
  not_started: 'default',
  in_progress: 'warning',
  completed: 'success',
  skipped: 'default',
};

/** The work surface: every topic, with status editable in place. */
export const RoadmapTableView: React.FC<Props> = ({ phases, onStatusChange, onOpenNotes, busyTopicId }) => {
  if (phases.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
        No phases yet. Import a syllabus or add a phase to get started.
      </Typography>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3, mt: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Topic</TableCell>
            <TableCell sx={{ fontWeight: 700, width: 110 }}>Hours</TableCell>
            <TableCell sx={{ fontWeight: 700, width: 190 }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 700, width: 70, textAlign: 'center' }}>Notes</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {phases.map((phase) => (
            <React.Fragment key={phase.id}>
              <TableRow>
                <TableCell colSpan={4} sx={{ bgcolor: 'action.hover' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {phase.name}
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      {phase.topics.length} topic{phase.topics.length === 1 ? '' : 's'}
                    </Typography>
                  </Typography>
                </TableCell>
              </TableRow>

              {phase.topics.map((topic) => (
                <TableRow key={topic.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{topic.title}</Typography>
                    {topic.learning_objective && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {topic.learning_objective}
                      </Typography>
                    )}
                    {topic.status === 'in_progress' && topic.progress_percentage > 0 && (
                      <Chip size="small" sx={{ mt: 0.5 }} label={`${topic.progress_percentage}%`} color="warning" variant="outlined" />
                    )}
                  </TableCell>

                  <TableCell>
                    {/* Em-dash, not 0 -- "no estimate" and "zero hours" are
                        different claims, and only one of them is true here. */}
                    <Typography variant="body2" color={topic.estimated_hours == null ? 'text.secondary' : 'text.primary'}>
                      {topic.estimated_hours == null ? '—' : `${topic.estimated_hours}h`}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Select
                      size="small"
                      fullWidth
                      value={topic.status}
                      disabled={busyTopicId === topic.id}
                      onChange={(e) => onStatusChange(topic, e.target.value as RoadmapTopicStatus)}
                      inputProps={{ 'aria-label': `Status for ${topic.title}` }}
                      renderValue={(value) => (
                        <Chip
                          size="small"
                          label={STATUS_LABELS[value as RoadmapTopicStatus]}
                          color={STATUS_COLOR[value as RoadmapTopicStatus]}
                          variant={value === 'completed' ? 'filled' : 'outlined'}
                        />
                      )}
                    >
                      {(Object.keys(STATUS_LABELS) as RoadmapTopicStatus[]).map((status) => (
                        <MenuItem key={status} value={status}>{STATUS_LABELS[status]}</MenuItem>
                      ))}
                    </Select>
                  </TableCell>

                  <TableCell sx={{ textAlign: 'center' }}>
                    <Tooltip title={topic.evidence_notes ? 'Edit notes' : 'Add notes'}>
                      <IconButton
                        size="small"
                        onClick={() => onOpenNotes(topic)}
                        aria-label={`Notes for ${topic.title}`}
                        color={topic.evidence_notes ? 'primary' : 'default'}
                      >
                        <FileText size={16} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
