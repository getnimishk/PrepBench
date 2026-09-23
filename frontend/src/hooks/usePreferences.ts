// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { useThemeMode } from '../context/ThemeContext';

/** The display and behaviour preferences as applied, and how to change them. */
export const usePreferences = () => {
  const { preferences, updatePreferences, preferencesStatus, reloadPreferences } = useThemeMode();
  return { ...preferences, updatePreferences, preferencesStatus, reloadPreferences };
};
