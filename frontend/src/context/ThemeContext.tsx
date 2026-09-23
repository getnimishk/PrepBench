// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { createContext, useCallback, useContext, useState, useMemo, useEffect, useRef } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { getSettings, updateSettings } from '../services/api';
import { AppSettings, ThemePreference } from '../types/settings';
import { buildTheme } from '../theme/theme';

type ThemeMode = 'dark' | 'light';

/** The display and behaviour preferences, as applied. */
export interface Preferences {
  theme: ThemePreference;
  textSize: 'standard' | 'large';
  reduceMotion: 'system' | 'always';
  shortcutsEnabled: boolean;
}

interface ThemeContextType {
  /** The mode actually on screen: `system` resolved against the OS. */
  mode: ThemeMode;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemePreference) => void;
  preferences: Preferences;
  /**
   * Apply preferences now and save them. Rejects when the server refuses, having
   * put the previous values back -- a preference that looks applied and was not
   * saved would silently undo itself on the next reload.
   */
  updatePreferences: (changes: Partial<Preferences>) => Promise<void>;
  /** Whether the saved preferences have been read from the server yet. */
  preferencesStatus: 'loading' | 'ready' | 'failed';
  reloadPreferences: () => void;
}

const DEFAULT_PREFERENCES: Preferences = {
  theme: 'light',
  textSize: 'standard',
  reduceMotion: 'system',
  shortcutsEnabled: true,
};

// The last preferences applied in this browser, so the first paint of a page
// already uses them. They are the server's to keep; this copy only stops a
// dark-mode learner getting a flash of white on every load while the settings
// request is on its way -- a flash that is also a problem for anyone light
// sensitive. The server's answer always wins when it arrives.
const PREFERENCES_CACHE_KEY = 'prepbench.displayPreferences';

function cachedPreferences(): Preferences {
  try {
    const raw = globalThis.localStorage?.getItem(PREFERENCES_CACHE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      theme: parsed.theme === 'dark' || parsed.theme === 'system' ? parsed.theme : 'light',
      textSize: parsed.textSize === 'large' ? 'large' : 'standard',
      reduceMotion: parsed.reduceMotion === 'always' ? 'always' : 'system',
      shortcutsEnabled: parsed.shortcutsEnabled !== false,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function cachePreferences(p: Preferences): void {
  try {
    globalThis.localStorage?.setItem(PREFERENCES_CACHE_KEY, JSON.stringify(p));
  } catch {
    // A browser that refuses storage just paints the default first.
  }
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  toggleTheme: () => {},
  setThemeMode: () => {},
  preferences: DEFAULT_PREFERENCES,
  updatePreferences: async () => {},
  // Outside a provider there is nothing to wait for.
  preferencesStatus: 'ready',
  reloadPreferences: () => {},
});

export const useThemeMode = () => useContext(ThemeContext);

const toWire = (p: Partial<Preferences>): Partial<AppSettings> => ({
  ...(p.theme !== undefined ? { theme: p.theme } : {}),
  ...(p.textSize !== undefined ? { text_size: p.textSize } : {}),
  ...(p.reduceMotion !== undefined ? { reduce_motion: p.reduceMotion } : {}),
  ...(p.shortcutsEnabled !== undefined ? { shortcuts_enabled: p.shortcutsEnabled } : {}),
});

const fromWire = (s: AppSettings): Preferences => ({
  theme: s.theme === 'dark' || s.theme === 'system' ? s.theme : 'light',
  textSize: s.text_size === 'large' ? 'large' : 'standard',
  reduceMotion: s.reduce_motion === 'always' ? 'always' : 'system',
  shortcutsEnabled: s.shortcuts_enabled !== false,
});

/** Whether the OS asks for dark, followed as it changes. */
function useSystemDark(): boolean {
  const query = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;
  const [dark, setDark] = useState(query?.matches ?? false);
  useEffect(() => {
    if (!query) return undefined;
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, [query]);
  return dark;
}

export const CustomThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<Preferences>(cachedPreferences);
  useEffect(() => { cachePreferences(preferences); }, [preferences]);
  const systemDark = useSystemDark();
  const mode: ThemeMode = preferences.theme === 'system'
    ? (systemDark ? 'dark' : 'light')
    : preferences.theme;



  const [preferencesStatus, setPreferencesStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const reloadPreferences = useCallback(() => {
    setPreferencesStatus('loading');
    getSettings()
      .then((s) => {
        if (s) setPreferences(fromWire(s));
        setPreferencesStatus('ready');
      })
      .catch((err) => {
        console.error(err);
        setPreferencesStatus('failed');
      });
  }, []);

  useEffect(() => {
    reloadPreferences();
  }, [reloadPreferences]);

  const current = useRef(preferences);
  useEffect(() => { current.current = preferences; }, [preferences]);

  const updatePreferences = useCallback(async (changes: Partial<Preferences>) => {
    // What these keys held before, so a refusal puts back exactly them and
    // not a change made to something else in the meantime.
    const before = Object.fromEntries(
      (Object.keys(changes) as (keyof Preferences)[]).map((k) => [k, current.current[k]]),
    ) as Partial<Preferences>;
    setPreferences((now) => ({ ...now, ...changes }));
    try {
      // Only what changed is sent; the server changes only what it is sent.
      await updateSettings(toWire(changes));
    } catch (err) {
      setPreferences((now) => ({ ...now, ...before }));
      throw err;
    }
  }, []);

  /**
   * Switch the theme, and remember it.
   *
   * The toggle in the app bar used to change `mode` and nothing else, so the
   * choice survived until the next reload and was then silently replaced by
   * whatever Settings had stored. A control that undoes itself on refresh is
   * worse than no control: the reader has no way to tell whether they were
   * ignored or misremembered pressing it. Settings has always persisted on
   * Save; the two now agree.
   */
  // The toggle picks the opposite of what is on screen, as an explicit choice:
  // flipping while following the system means "not what the system says".
  const toggleTheme = () => {
    updatePreferences({ theme: mode === 'dark' ? 'light' : 'dark' }).catch(console.error);
  };

  // For a screen that has already saved the theme itself: applies it without a
  // second write.
  const setThemeMode = (newMode: ThemePreference) => {
    setPreferences((current) => ({ ...current, theme: newMode }));
  };

  // The prototype's stylesheet, as a theme: its tokens, its type scale and the
  // shapes of its controls. See theme/theme.ts.
  const theme = useMemo(
    () => buildTheme({ mode, textSize: preferences.textSize, reduceMotion: preferences.reduceMotion }),
    [mode, preferences.textSize, preferences.reduceMotion],
  );

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, setThemeMode, preferences, updatePreferences, preferencesStatus, reloadPreferences }}>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
};