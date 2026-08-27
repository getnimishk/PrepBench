import React, { useMemo } from 'react';
import { Box, Button, Chip, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { ArrowRight, Check, Circle, Lock } from 'lucide-react';
import type { Attempt, ConceptId } from '../../types/learning';
import { CONCEPTS, conceptOrder } from '../../services/learning/concepts';
import { masteryMap, type ConceptMastery } from '../../services/learning/mastery';
import { reachableConcepts } from '../../services/learning/placement';
import { challengesForConcept } from '../../services/learning/challenges';

// The concept map: what there is to learn, in dependency order, with the state
// of each and what evidence is still missing.
//
// NOTHING HERE IS A GATE. A concept whose prerequisites are unmet is shown
// with an open padlock and a note about what it builds on, and it is still
// clickable. The padlock is a recommendation, not a permission: a
// practitioner who already knows Little's Law should be able to jump straight
// to the bottleneck work, and the map's job is to tell them what they are
// skipping rather than to stop them.
//
// The alternative -- greying it out -- reads as "you have not earned this
// yet", which is the single fastest way to lose the experienced user this
// product most wants.

const STATE_STYLE: Record<
  ConceptMastery['state'],
  { label: string; color: 'default' | 'primary' | 'success' | 'warning' }
> = {
  notStarted: { label: 'Not started', color: 'default' },
  introduced: { label: 'Introduced', color: 'default' },
  practiced: { label: 'Practised', color: 'warning' },
  developing: { label: 'Developing', color: 'warning' },
  demonstrated: { label: 'Demonstrated', color: 'primary' },
  transferDemonstrated: { label: 'Transfer shown', color: 'primary' },
  mastered: { label: 'Mastered', color: 'success' },
};

interface Props {
  attempts: Attempt[];
  /** The concept the recommender is pointing at. */
  focusConceptId?: ConceptId;
  /** Jump to a concept's first unsettled challenge. Never blocked. */
  onSelect: (conceptId: ConceptId) => void;
}

export const ConceptMap: React.FC<Props> = ({ attempts, focusConceptId, onSelect }) => {
  const mastery = useMemo(() => masteryMap(attempts), [attempts]);
  const reachable = useMemo(
    () => new Set(reachableConcepts(attempts).map((c) => c.id)),
    [attempts],
  );
  const order = useMemo(() => conceptOrder(), []);

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          What there is to learn
        </Typography>
        <Typography variant="caption" color="text.secondary">
          in the order each one builds on the last — everything is open, whatever the order
        </Typography>
      </Stack>

      <Stack spacing={1}>
        {order.map((id) => {
          const concept = CONCEPTS[id];
          const state = mastery[id];
          const style = STATE_STYLE[state.state];
          const isFocus = id === focusConceptId;
          const prerequisitesMet = reachable.has(id);
          const total = challengesForConcept(id).length;

          return (
            <Box
              key={id}
              sx={{
                p: 1.25,
                borderRadius: 1,
                border: 1,
                borderColor: isFocus ? 'primary.main' : 'divider',
                bgcolor: (t) => (isFocus ? t.palette.primary.main + '0A' : 'transparent'),
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.75 }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    color: state.state === 'mastered' ? 'success.main' : 'text.disabled',
                  }}
                >
                  {state.state === 'mastered' ? <Check size={15} /> : <Circle size={9} />}
                </Box>

                <Typography variant="body2" sx={{ fontWeight: isFocus ? 700 : 500, flexGrow: 1 }}>
                  {concept.canonicalName}
                </Typography>

                {!prerequisitesMet && (
                  <Tooltip
                    arrow
                    title={
                      `Builds on ${concept.prerequisites
                        .map((p) => CONCEPTS[p].canonicalName)
                        .join(', ')}. You can start here anyway — this is a ` +
                      `recommendation, not a lock.`
                    }
                  >
                    <Box sx={{ display: 'flex', color: 'text.disabled' }}>
                      <Lock size={13} />
                    </Box>
                  </Tooltip>
                )}

                <Chip
                  size="small"
                  color={style.color}
                  variant={state.state === 'mastered' ? 'filled' : 'outlined'}
                  label={style.label}
                  sx={{ height: 20, fontSize: '0.62rem' }}
                />

                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontVariantNumeric: 'tabular-nums', minWidth: 58, textAlign: 'right' }}
                >
                  {state.unaidedCorrect}/{total} unaided
                </Typography>

                <Button
                  size="small"
                  endIcon={<ArrowRight size={13} />}
                  onClick={() => onSelect(id)}
                  sx={{ textTransform: 'none', flexShrink: 0 }}
                >
                  {state.state === 'notStarted' ? 'Start' : 'Practise'}
                </Button>
              </Stack>

              {state.nextEvidenceNeeded.length > 0 && (
                // Named evidence rather than a percentage. "73% complete" is
                // not something a learner can act on; "still needs a transfer
                // case" is.
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 0.5, pl: 3 }}
                >
                  Still needs: {state.nextEvidenceNeeded.join('; ')}.
                </Typography>
              )}
            </Box>
          );
        })}
      </Stack>
    </Paper>
  );
};
