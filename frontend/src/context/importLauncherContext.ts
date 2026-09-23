// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { createContext, useContext } from 'react';
import type { Question } from '../types/question';

/** Dispatched on window after questions are written, so a screen listing them can reload. */
export const QUESTIONS_IMPORTED = 'prepbench:questions-imported';

/** Router state the Question Bank reads to open its audit studio on arrival. */
export interface StagedImportState {
  stagedQuestions: Question[];
}

export const ImportLauncherContext = createContext<{ openImport: () => void }>({ openImport: () => {} });

/** Open the question import dialog over whatever screen is showing. */
export const useImportLauncher = () => useContext(ImportLauncherContext);
