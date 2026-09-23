// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { alpha, createTheme, type Theme } from '@mui/material';
import { FONT_STACK, MONO_STACK, NARROW_QUERY, TOKENS, type Tokens } from './tokens';

declare module '@mui/material/styles' {
  interface Palette {
    surfaceContainerLow: Palette['primary'];
    surfaceContainer: Palette['primary'];
    surfaceContainerHigh: Palette['primary'];
    /** The prototype's "primary" button: ink on the page, the surface as its text. */
    ink: Palette['primary'];
    /** Every token of the prototype's stylesheet, for the few places a role does not name. */
    pb: Tokens;
  }
  interface PaletteOptions {
    surfaceContainerLow?: PaletteOptions['primary'];
    surfaceContainer?: PaletteOptions['primary'];
    surfaceContainerHigh?: PaletteOptions['primary'];
    ink?: PaletteOptions['primary'];
    pb?: Tokens;
  }
}

declare module '@mui/material/Button' {
  interface ButtonPropsColorOverrides {
    ink: true;
  }
}

export type ThemeMode = 'light' | 'dark';

interface BuildOptions {
  mode: ThemeMode;
  textSize: 'standard' | 'large';
  reduceMotion: 'system' | 'always';
}

// What "reduce motion" removes: animation and transition, everywhere, and smooth
// scrolling. Applied under the OS media query by default, and unconditionally
// when the learner asks for it.
const NO_MOTION = {
  '*, *::before, *::after': {
    animationDuration: '0.01ms !important',
    animationIterationCount: '1 !important',
    transitionDuration: '0.01ms !important',
    scrollBehavior: 'auto !important',
  },
};

/**
 * The theme, built from the prototype's stylesheet.
 *
 * Type: Inter at the prototype's 14px base, and its scale -- a 42px page title,
 * 22px panel titles, 16px row titles, 12px detail, 10px spaced capitals for the
 * labels over everything. MUI's variants are mapped onto those roles:
 *
 *   h1, h4     page title (h4 is what every page already renders as its <h1>)
 *   h2         a display number: a score that is the page's point
 *   h3         the prototype's `.big` figure
 *   h5         panel title (the prototype's h2)
 *   h6, subtitle1  row title (the prototype's h3)
 *   subtitle2  bold body
 *   body1      body and the page's sub-line
 *   body2      detail: the muted line under a title, a table cell
 *   caption    the label under a metric
 *   overline   the eyebrow
 *
 * Every size is in rem computed from the text-size preference, so "Large"
 * still scales the whole interface from one number.
 */
export function buildTheme({ mode, textSize, reduceMotion }: BuildOptions): Theme {
  const t = TOKENS[mode];
  const base = textSize === 'large' ? 16 : 14;
  const coef = base / 14;
  const rem = (px: number) => `${Number(((px / 16) * coef).toFixed(4))}rem`;

  const pageTitle = {
    fontSize: rem(42), fontWeight: 700, lineHeight: 1.03, letterSpacing: '-0.045em',
    [NARROW_QUERY]: { fontSize: rem(34) },
  };

  return createTheme({
    palette: {
      mode,
      primary: {
        main: t.accent,
        dark: mode === 'dark' ? '#a9bbff' : '#2747b5',
        light: t.accentSoft,
        // White on the dark theme's light blue reads at 2.3:1; the page's own ink does not.
        contrastText: mode === 'dark' ? t.bg : '#ffffff',
      },
      secondary: { main: t.muted, contrastText: t.surface },
      ink: { main: t.text, dark: t.text, light: t.muted, contrastText: t.surface },
      error: { main: t.danger, light: t.dangerSoft, contrastText: mode === 'dark' ? t.bg : '#ffffff' },
      warning: { main: t.warning, light: t.warningSoft, contrastText: mode === 'dark' ? t.bg : '#ffffff' },
      success: { main: t.success, light: t.successSoft, contrastText: mode === 'dark' ? t.bg : '#ffffff' },
      info: { main: t.accent, light: t.accentSoft, contrastText: mode === 'dark' ? t.bg : '#ffffff' },
      background: { default: t.bg, paper: t.surface },
      text: { primary: t.text, secondary: t.muted, disabled: alpha(t.faint, 0.75) },
      divider: t.line,
      surfaceContainerLow: { main: t.nav },
      surfaceContainer: { main: t.surface },
      surfaceContainerHigh: { main: t.surface2 },
      pb: t,
      action: {
        hover: alpha(t.text, 0.04),
        hoverOpacity: 0.04,
        selected: t.accentSoft,
        selectedOpacity: 0.08,
        focusOpacity: 0.12,
      },
    },
    shape: { borderRadius: 4 },
    typography: {
      fontFamily: FONT_STACK,
      fontSize: base,
      htmlFontSize: 16,
      fontWeightLight: 300,
      fontWeightRegular: 400,
      fontWeightMedium: 600,
      fontWeightBold: 700,
      h1: pageTitle,
      h2: { fontSize: rem(42), fontWeight: 750, lineHeight: 1.05, letterSpacing: '-0.04em' },
      h3: { fontSize: rem(38), fontWeight: 820, lineHeight: 1.1, letterSpacing: '-0.05em' },
      h4: pageTitle,
      h5: { fontSize: rem(22), fontWeight: 700, lineHeight: 1.3, letterSpacing: '-0.025em' },
      h6: { fontSize: rem(16), fontWeight: 700, lineHeight: 1.35, letterSpacing: 'normal' },
      subtitle1: { fontSize: rem(16), fontWeight: 700, lineHeight: 1.35 },
      subtitle2: { fontSize: rem(14), fontWeight: 700, lineHeight: 1.48 },
      body1: { fontSize: rem(14), fontWeight: 400, lineHeight: 1.48 },
      body2: { fontSize: rem(12), fontWeight: 400, lineHeight: 1.48 },
      caption: { fontSize: rem(11), fontWeight: 400, lineHeight: 1.48 },
      overline: {
        fontSize: rem(10), fontWeight: 800, lineHeight: 1.48, letterSpacing: '0.11em',
        textTransform: 'uppercase', color: t.faint,
      },
      button: { fontSize: rem(13), fontWeight: 700, lineHeight: 1.48, textTransform: 'none' },
    },
    ...(reduceMotion === 'always' ? { transitions: { create: () => 'none' } } : {}),
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            minHeight: '100vh',
            backgroundColor: t.bg,
            color: t.text,
          },
          'code, pre, kbd, samp': { fontFamily: MONO_STACK },
          ...(reduceMotion === 'always' ? NO_MOTION : { '@media (prefers-reduced-motion: reduce)': NO_MOTION }),
        },
      },
      // Where the keyboard is. ButtonBase is the one place worth saying it:
      // Button, IconButton, Tab, clickable Chip, ListItemButton, MenuItem and
      // ToggleButton all render through it. :focus-visible, so a click leaves
      // no ring behind.
      MuiButtonBase: {
        styleOverrides: {
          root: {
            '&:focus-visible': { outline: `2px solid ${t.accent}`, outlineOffset: 2 },
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          // The prototype's .btn: 13px bold, 9px corners, one line of border on
          // every kind so a filled and an outlined button stand the same height.
          root: {
            textTransform: 'none',
            fontSize: rem(13),
            fontWeight: 700,
            lineHeight: 1.48,
            borderRadius: 9,
            padding: '9px 13px',
            minWidth: 24,
            minHeight: 24,
            border: '1px solid transparent',
            boxShadow: 'none',
            whiteSpace: 'nowrap',
            transition: 'background-color .15s ease, border-color .15s ease, color .15s ease',
            '&:hover': { boxShadow: 'none' },
          },
          sizeSmall: { fontSize: rem(12), borderRadius: 7, padding: '6px 11px', minHeight: 24, minWidth: 24 },
          sizeLarge: { fontSize: rem(14), padding: '10px 16px' },
          // The prototype's plain .btn: the surface, a line, the page's ink.
          outlined: {
            backgroundColor: t.surface,
            borderColor: t.line,
            color: t.text,
            '&:hover': { backgroundColor: t.surface, borderColor: t.accent },
            '&.Mui-disabled': { borderColor: t.line },
          },
          // .btn.link
          text: { padding: '4px 6px', border: 0, minHeight: 24, minWidth: 24 },
        },
        variants: [
          {
            props: { variant: 'outlined', color: 'error' },
            style: {
              color: t.danger,
              borderColor: t.danger,
              '&:hover': { backgroundColor: t.dangerSoft, borderColor: t.danger },
            },
          },
          { props: { variant: 'outlined', color: 'success' }, style: { color: t.success, borderColor: t.goodLine } },
          { props: { variant: 'outlined', color: 'warning' }, style: { color: t.warning, borderColor: t.noteLine } },
          {
            // .btn.blue
            props: { variant: 'contained', color: 'primary' },
            style: {
              borderColor: t.accent,
              '&:hover': { borderColor: mode === 'dark' ? '#a9bbff' : '#2747b5' },
            },
          },
          { props: { variant: 'text', size: 'small' }, style: { padding: '3px 5px' } },
          {
            // .btn.primary: the page's ink, used for the one heaviest action.
            props: { variant: 'contained', color: 'ink' },
            style: {
              backgroundColor: t.text,
              borderColor: t.text,
              color: t.surface,
              '&:hover': { backgroundColor: alpha(t.text, 0.86), borderColor: alpha(t.text, 0.86) },
            },
          },
        ],
      },
      MuiIconButton: {
        styleOverrides: { root: { borderRadius: 9 } },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
          rounded: { borderRadius: 13 },
          outlined: { borderColor: t.line },
          elevation1: { boxShadow: 'none', border: `1px solid ${t.line}` },
        },
      },
      // The prototype's .panel.
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            borderRadius: 13,
            boxShadow: 'none',
            border: `1px solid ${t.line}`,
            backgroundImage: 'none',
            backgroundColor: t.surface,
          },
        },
      },
      MuiCardContent: {
        styleOverrides: { root: { padding: 20, '&:last-child': { paddingBottom: 20 } } },
      },
      MuiCardHeader: {
        styleOverrides: { root: { padding: '20px 20px 0' } },
      },
      // The prototype's .pill: 10px, heavy, fully rounded, tabular figures.
      MuiChip: {
        styleOverrides: {
          root: {
            height: 'auto',
            minHeight: 21,
            borderRadius: 20,
            fontSize: rem(10),
            fontWeight: 760,
            lineHeight: 1.48,
            fontVariantNumeric: 'tabular-nums',
            backgroundColor: t.chip,
            color: t.chipText,
            maxWidth: '100%',
          },
          label: { padding: '3px 8px' },
          // A pill you can press is a control, and a control is 24px at least.
          clickable: {
            minHeight: 24,
            '&:hover': { backgroundColor: alpha(t.text, 0.08) },
          },
          outlined: { backgroundColor: 'transparent', borderColor: t.line, color: t.muted },
          icon: { marginLeft: 6, marginRight: -4, fontSize: rem(12), color: 'inherit' },
          deleteIcon: { fontSize: rem(14), marginRight: 4 },
        },
        // The prototype's pill tones: .b accent, .g success, .a warning, .r danger.
        variants: [
          { props: { variant: 'filled', color: 'primary' }, style: { backgroundColor: t.accentSoft, color: t.accent } },
          { props: { variant: 'filled', color: 'info' }, style: { backgroundColor: t.accentSoft, color: t.accent } },
          { props: { variant: 'filled', color: 'secondary' }, style: { backgroundColor: t.chip, color: t.chipText } },
          { props: { variant: 'filled', color: 'success' }, style: { backgroundColor: t.successSoft, color: t.success } },
          { props: { variant: 'filled', color: 'warning' }, style: { backgroundColor: t.warningSoft, color: t.warning } },
          { props: { variant: 'filled', color: 'error' }, style: { backgroundColor: t.dangerSoft, color: t.danger } },
          { props: { variant: 'outlined', color: 'primary' }, style: { borderColor: alpha(t.accent, 0.4), color: t.accent } },
          { props: { variant: 'outlined', color: 'success' }, style: { borderColor: t.goodLine, color: t.success } },
          { props: { variant: 'outlined', color: 'warning' }, style: { borderColor: t.noteLine, color: t.warning } },
          { props: { variant: 'outlined', color: 'error' }, style: { borderColor: alpha(t.danger, 0.4), color: t.danger } },
        ],
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: t.text,
            color: t.surface,
            borderRadius: 7,
            fontSize: rem(11),
            fontWeight: 600,
            padding: '5px 8px',
          },
          arrow: { color: t.text },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 8, height: 7, backgroundColor: t.track },
          bar: { borderRadius: 8 },
          colorPrimary: { backgroundColor: t.track },
        },
      },
      MuiAccordion: {
        defaultProps: { elevation: 0, disableGutters: true },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            borderRadius: '13px !important',
            border: `1px solid ${t.line}`,
            '&:before': { display: 'none' },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 14,
            border: `1px solid ${t.line}`,
            backgroundImage: 'none',
            backgroundColor: t.surface,
            boxShadow: t.shadow,
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: { root: { fontSize: rem(22), fontWeight: 700, letterSpacing: '-0.025em', padding: '22px 22px 10px' } },
      },
      MuiDialogContent: {
        styleOverrides: { root: { padding: '10px 22px' } },
      },
      MuiDialogActions: {
        styleOverrides: { root: { padding: '12px 22px 22px', gap: 9 } },
      },
      MuiPopover: {
        styleOverrides: {
          paper: { borderRadius: 12, border: `1px solid ${t.line}`, boxShadow: t.shadow },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: { borderRadius: 12, border: `1px solid ${t.line}`, boxShadow: t.shadow },
          list: { padding: 8 },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontSize: rem(14),
            padding: '8px 10px',
            '&.Mui-selected': { backgroundColor: t.accentSoft },
            '&.Mui-selected:hover': { backgroundColor: t.accentSoft },
          },
        },
      },
      MuiListSubheader: {
        styleOverrides: {
          root: {
            fontSize: rem(10), fontWeight: 800, letterSpacing: '0.1em', color: t.faint,
            textTransform: 'uppercase', lineHeight: 2.4, backgroundColor: 'transparent',
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&.MuiTableRow-hover:hover': { backgroundColor: alpha(t.text, 0.03) },
          },
        },
      },
      // The prototype's .table: 12px cells, 10px spaced headings.
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottom: `1px solid ${t.line}`, padding: '11px 8px', fontSize: rem(12), fontVariantNumeric: 'tabular-nums' },
          head: {
            color: t.faint, fontSize: rem(10), fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', lineHeight: 1.48,
          },
          sizeSmall: { padding: '8px 8px' },
        },
      },
      MuiTextField: { defaultProps: { size: 'small' } },
      MuiFormControl: { defaultProps: { size: 'small' } },
      MuiSelect: { defaultProps: { size: 'small' } },
      MuiAutocomplete: {
        defaultProps: { size: 'small' },
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              padding: '2px 8px !important',
              // The height of the plain inputs beside it (10px padding around a 20px line).
              minHeight: 40,
              display: 'flex',
              alignItems: 'center',
            },
            '& .MuiOutlinedInput-root .MuiAutocomplete-input': {
              padding: '4px 4px !important',
            },
          },
          popper: {
            zIndex: 1300,
          },
          paper: {
            borderRadius: 10,
            border: `1px solid ${t.line}`,
            boxShadow: t.shadow,
            marginTop: 4,
          },
          listbox: {
            padding: 6,
            fontSize: rem(13),
            maxHeight: 280,
            '& .MuiAutocomplete-option': {
              borderRadius: 6,
              padding: '6px 10px',
              '&[aria-selected="true"]': {
                backgroundColor: t.accentSoft,
              },
              '&.Mui-focused': {
                backgroundColor: alpha(t.accent, 0.08),
              },
            },
          },
        },
      },
      // The prototype's .input: a plain box -- no notch cut into its border,
      // because its label sits above it rather than on it.
      MuiOutlinedInput: {
        defaultProps: { notched: false },
        styleOverrides: {
          root: {
            borderRadius: 9,
            backgroundColor: t.surface,
            fontSize: rem(14),
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: t.rule },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: t.accent, borderWidth: 2 },
          },
          input: { padding: '10px 11px' },
          multiline: { padding: '10px 11px', '& .MuiOutlinedInput-input': { padding: 0 } },
          notchedOutline: { borderColor: t.line },
        },
      },
      // The prototype's .formblock label: 11px, bold, muted, above the box.
      // Always "shrunk", so a placeholder shows beneath it from the start.
      MuiInputLabel: {
        defaultProps: { shrink: true },
        styleOverrides: {
          root: {
            position: 'relative',
            transform: 'none',
            maxWidth: '100%',
            whiteSpace: 'normal',
            overflow: 'visible',
            fontSize: rem(11),
            fontWeight: 700,
            lineHeight: 1.48,
            color: t.muted,
            marginBottom: 5,
            pointerEvents: 'auto',
            '&.Mui-focused': { color: t.text },
            '&.Mui-error': { color: t.danger },
            '&.Mui-disabled': { color: t.faint },
          },
        },
      },
      MuiFormHelperText: {
        styleOverrides: { root: { fontSize: rem(11), marginLeft: 2 } },
      },
      MuiFormControlLabel: {
        styleOverrides: { label: { fontSize: rem(14) } },
      },
      // The prototype's .tabs: an underline in the page's ink, the chosen one heavy.
      MuiTabs: {
        styleOverrides: {
          root: { minHeight: 40 },
          indicator: { backgroundColor: t.text, height: 2 },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            minHeight: 40,
            minWidth: 0,
            padding: '10px 13px',
            fontSize: rem(14),
            fontWeight: 400,
            lineHeight: 1.48,
            color: t.muted,
            '&.Mui-selected': { color: t.text, fontWeight: 800 },
          },
        },
      },
      // The prototype's segmented control (.ivseg).
      MuiToggleButtonGroup: {
        styleOverrides: {
          root: { borderRadius: 9, border: `1px solid ${t.line}`, overflow: 'hidden', backgroundColor: t.surface },
          grouped: {
            border: 0,
            borderRadius: 0,
            margin: 0,
            '&:not(:first-of-type)': { borderLeft: `1px solid ${t.line}`, marginLeft: 0 },
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontSize: rem(12),
            fontWeight: 720,
            lineHeight: 1.48,
            color: t.muted,
            padding: '8px 13px',
            border: 0,
            '&:hover': { color: t.text, backgroundColor: t.surface },
            '&.Mui-selected': {
              backgroundColor: t.text,
              color: t.surface,
              '&:hover': { backgroundColor: t.text },
            },
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 9,
            padding: '4px 13px',
            fontSize: rem(14),
            lineHeight: 1.48,
            border: '1px solid',
            alignItems: 'flex-start',
          },
          icon: { color: 'inherit !important', paddingTop: 9, opacity: 0.9 },
          message: { padding: '8px 0' },
          action: { paddingTop: 4 },
        },
        // The prototype's .note (warning) and .good (success), and the same
        // treatment for the two tones it has no box for.
        variants: [
          { props: { variant: 'standard', severity: 'warning' }, style: { backgroundColor: t.warningSoft, color: t.warning, borderColor: t.noteLine } },
          { props: { variant: 'standard', severity: 'success' }, style: { backgroundColor: t.successSoft, color: t.success, borderColor: t.goodLine } },
          { props: { variant: 'standard', severity: 'error' }, style: { backgroundColor: t.dangerSoft, color: t.danger, borderColor: alpha(t.danger, 0.3) } },
          { props: { variant: 'standard', severity: 'info' }, style: { backgroundColor: t.accentSoft, color: t.text, borderColor: alpha(t.accent, 0.25) } },
          { props: { variant: 'outlined', severity: 'warning' }, style: { color: t.warning, borderColor: t.noteLine } },
          { props: { variant: 'outlined', severity: 'success' }, style: { color: t.success, borderColor: t.goodLine } },
          { props: { variant: 'outlined', severity: 'error' }, style: { color: t.danger } },
          { props: { variant: 'outlined', severity: 'info' }, style: { color: t.text, borderColor: t.line } },
        ],
      },
      MuiAlertTitle: {
        styleOverrides: { root: { fontSize: rem(14), fontWeight: 700, marginBottom: 2 } },
      },
      MuiSnackbarContent: {
        styleOverrides: { root: { backgroundColor: t.text, color: t.surface, borderRadius: 9, fontSize: rem(14) } },
      },
      MuiDivider: {
        styleOverrides: { root: { borderColor: t.line } },
      },
      MuiLink: {
        styleOverrides: { root: { color: t.accent } },
      },
      MuiBadge: {
        styleOverrides: { badge: { fontSize: rem(10), fontWeight: 760, fontVariantNumeric: 'tabular-nums' } },
      },
      MuiAvatar: {
        styleOverrides: { root: { fontWeight: 800 } },
      },
      MuiSwitch: {
        styleOverrides: {
          track: { backgroundColor: t.rule, opacity: 1 },
        },
      },
      MuiStepLabel: {
        styleOverrides: { label: { fontSize: rem(12) } },
      },
    },
  });
}
