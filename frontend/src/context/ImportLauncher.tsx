// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImportModal } from '../components/question_bank/ImportModal';
import { ImportLauncherContext, QUESTIONS_IMPORTED, type StagedImportState } from './importLauncherContext';

/**
 * Importing questions, from anywhere.
 *
 * The header and Settings both offer Import, and it used to live only on the
 * Question Bank, so bringing in a file meant first finding the screen that could
 * take it. This is the same audited import the bank has -- validate, repair,
 * review row by row, then write -- opened over whatever screen you are on.
 */
export const ImportLauncherProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const value = useMemo(() => ({ openImport: () => setOpen(true) }), []);

  return (
    <ImportLauncherContext.Provider value={value}>
      {children}
      <ImportModal
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={() => window.dispatchEvent(new Event(QUESTIONS_IMPORTED))}
        // Reviewing staged questions one by one is the Question Bank's own
        // screen, so that one choice goes there, carrying the rows with it.
        onOpenAuditStudio={(questions) => {
          const state: StagedImportState = { stagedQuestions: questions };
          navigate('/question-bank', { state });
        }}
      />
    </ImportLauncherContext.Provider>
  );
};
