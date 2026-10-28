// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { usePreparation } from '../../context/PreparationContext';
import { Actions, Note } from '../ui/primitives';

/**
 * Said when the roadmap on screen belongs to a different preparation from the one picked in
 * the header -- most often right after switching while a roadmap is open. A roadmap page is
 * reached by its id, so it does not follow the picker; without this, the header would name one
 * preparation while the page offered another's next topic as if it were that one's.
 *
 * Nothing is switched for the learner (rule 12): the note says whose roadmap this is and offers
 * the two ways out -- back to its own preparation, or to the picked one's roadmaps.
 * A roadmap linked to no preparation, or no preparation picked, makes no claim, so says nothing.
 */
export const RoadmapOwnerNotice: React.FC<{ ownerId: number | null | undefined }> = ({ ownerId }) => {
  const { selectedId, preparations, select } = usePreparation();
  if (ownerId == null || selectedId == null || ownerId === selectedId) return null;
  const owner = preparations.find((p) => p.id === ownerId) ?? null;
  const picked = preparations.find((p) => p.id === selectedId) ?? null;
  return (
    <Note role="status" sx={{ mb: '16px' }}>
      <Box component="span" sx={{ fontWeight: 700 }}>
        This roadmap belongs to {owner ? owner.name : 'another preparation'}, not {picked ? picked.name : 'the preparation you picked'}.
      </Box>{' '}
      Its topics and progress are {owner ? `${owner.name}'s` : 'that preparation’s'}; nothing here counts toward {picked ? picked.name : 'the one you picked'}.
      <Actions sx={{ mt: '10px' }}>
        {owner && (
          <Button variant="outlined" size="small" onClick={() => select(owner.id)}>
            Switch to {owner.name}
          </Button>
        )}
        <Button variant="outlined" size="small" component={RouterLink} to="/roadmaps">
          {picked ? `Open ${picked.name}'s roadmaps` : 'Open your roadmaps'}
        </Button>
      </Actions>
    </Note>
  );
};
