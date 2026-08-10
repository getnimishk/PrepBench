import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { ThemeProvider, createTheme, CssBaseline, alpha } from '@mui/material';
import { getSettings } from '../services/api';

type ThemeMode = 'dark' | 'light';

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  toggleTheme: () => {},
  setThemeMode: () => {},
});

export const useThemeMode = () => useContext(ThemeContext);

export const CustomThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>('light');

  useEffect(() => {
    getSettings()
      .then((s) => {
        if (s?.theme && (s.theme === 'dark' || s.theme === 'light')) {
          setMode(s.theme as ThemeMode);
        }
      })
      .catch(console.error);
  }, []);

  const toggleTheme = () => {
    setMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setThemeMode = (newMode: ThemeMode) => {
    setMode(newMode);
  };

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: mode === 'dark' ? '#A8C7FA' : '#0B57D0',
            dark: mode === 'dark' ? '#0B57D0' : '#001D35',
          },
          secondary: {
            main: mode === 'dark' ? '#93CCFF' : '#00639B',
          },
          background: {
            default: mode === 'dark' ? '#131314' : '#F8F9FA',
            paper: mode === 'dark' ? '#1E1F22' : '#FFFFFF',
          },
          text: {
            primary: mode === 'dark' ? '#E3E3E3' : '#1F1F1F',
            secondary: mode === 'dark' ? '#C4C7C5' : '#444746',
          },
          success: {
            main: mode === 'dark' ? '#8FDF8D' : '#146C2E',
          },
          error: {
            main: mode === 'dark' ? '#F2B8B5' : '#B3261E',
          },
          warning: {
            main: mode === 'dark' ? '#FFB4A1' : '#8F4C38',
          },
          info: {
            main: mode === 'dark' ? '#93CCFF' : '#00639B',
          },
          divider: mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
        },
        typography: {
          fontFamily: "'Roboto', 'Helvetica', 'Arial', sans-serif",
          button: { textTransform: 'none', fontWeight: 500 },
        },
        shape: {
          borderRadius: 12,
        },
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              body: {
                minHeight: '100vh',
                backgroundColor: mode === 'dark' ? '#131314' : '#F8F9FA',
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                textTransform: 'none',
                fontWeight: 500,
                borderRadius: 100, // Pill shaped MD3
                boxShadow: 'none',
                transition: 'background-color 0.2s ease',
                '&:hover': {
                  boxShadow: 'none',
                },
              },
              containedPrimary: {
                boxShadow: 'none',
                '&:hover': {
                  boxShadow: 'none',
                },
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                borderRadius: 12,
                boxShadow: 'none',
                border: `1px solid ${mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)'}`,
                backgroundImage: 'none',
                backgroundColor: mode === 'dark' ? '#1E1F22' : '#FFFFFF',
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
              },
            },
          },
          MuiChip: {
            styleOverrides: {
              root: {
                borderRadius: 8,
                fontWeight: 500,
              },
            },
          },
          MuiTooltip: {
            styleOverrides: {
              tooltip: {
                backgroundColor: mode === 'dark' ? '#1E1F22' : '#FFFFFF',
                border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                borderRadius: 8,
                color: mode === 'dark' ? '#E3E3E3' : '#1F1F1F',
                boxShadow: '0px 1px 2px rgba(0,0,0,0.1)',
              },
            },
          },
          MuiLinearProgress: {
            styleOverrides: {
              root: {
                borderRadius: 10,
                height: 8,
                backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
              },
            },
          },
          MuiAccordion: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
                borderRadius: '12px !important',
                border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                '&:before': {
                  display: 'none',
                },
              },
            },
          },
          MuiDialog: {
            styleOverrides: {
              paper: {
                borderRadius: 28,
                border: 'none',
                backgroundImage: 'none',
                backgroundColor: mode === 'dark' ? '#1E1F22' : '#FFFFFF',
                boxShadow: '0px 4px 24px rgba(0,0,0,0.1)',
              },
            },
          },
          MuiTableRow: {
            styleOverrides: {
              root: {
                '&:hover': {
                  backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                },
              },
            },
          },
          MuiOutlinedInput: {
            styleOverrides: {
              root: {
                borderRadius: 12,
              },
            },
          },
          MuiMenuItem: {
            styleOverrides: {
              root: {
                borderRadius: 8,
              },
            },
          },
        },
      }),
    [mode]
  );

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, setThemeMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
};