// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Box, LinearProgress, Typography, type SxProps, type Theme } from '@mui/material';
import { NARROW_QUERY, RAIL_QUERY } from '../../theme/tokens';

/**
 * The prototype's building blocks, one component each.
 *
 * PrepBench_Unified_Prototype.html builds every screen from the same dozen
 * classes -- .pagehead, .panel, .head, .eyebrow, .pill, .metric, .big, .bar,
 * .note, .row, .grid -- and its screens agree with one another because of it.
 * These are those classes, measured against the prototype in a browser (the
 * page head's 7px and 14px, a panel's 20px, 28px between sections), so a screen
 * made of them can be held against its prototype screen and not differ.
 */

type Sx = SxProps<Theme>;

function mergeSx(...parts: (Sx | undefined | false)[]): Sx {
  return parts.flatMap((part) => (!part ? [] : Array.isArray(part) ? part : [part])) as Sx;
}

/** `.eyebrow`: the spaced capitals over a title. */
export const Eyebrow: React.FC<{
  children: React.ReactNode;
  component?: React.ElementType;
  id?: string;
  color?: string;
  sx?: Sx;
}> = ({ children, component = 'div', id, color, sx }) => (
  <Typography
    variant="overline"
    component={component}
    id={id}
    sx={mergeSx({ display: 'block', color: color ?? 'pb.faint' }, sx)}
  >
    {children}
  </Typography>
);

/**
 * `.pagehead`: eyebrow, the page's one h1, the sub-line, and the page's actions
 * on the right (under the title on a phone).
 */
export const PageHead: React.FC<{
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
  /** Something that belongs under the sub-line inside the title column. */
  children?: React.ReactNode;
  titleId?: string;
  sx?: Sx;
}> = ({ eyebrow, title, sub, actions, children, titleId, sx }) => (
  <Box
    sx={mergeSx(
      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '22px', flexWrap: 'wrap' },
      sx,
    )}
  >
    <Box sx={{ flex: '1 1 400px', minWidth: 0 }}>
      {eyebrow != null && eyebrow !== false && <Eyebrow>{eyebrow}</Eyebrow>}
      <Typography
        variant="h4"
        component="h1"
        id={titleId}
        sx={{ mt: '7px', mb: sub != null ? '14px' : '10px', overflowWrap: 'break-word' }}
      >
        {title}
      </Typography>
      {sub != null && sub !== false && (
        <Typography component="p" variant="body1" sx={{ color: 'text.secondary', maxWidth: 820, m: 0, mb: '14px' }}>
          {sub}
        </Typography>
      )}
      {children}
    </Box>
    {actions != null && actions !== false && (
      <Box
        sx={{
          display: 'flex', flexWrap: 'wrap', gap: '9px', alignItems: 'center', justifyContent: 'flex-end',
          flex: '0 0 auto', pt: '14px',
          [NARROW_QUERY]: { width: '100%', pt: '4px', justifyContent: 'flex-start' },
        }}
      >
        {actions}
      </Box>
    )}
  </Box>
);

/** `.section`: 28px from whatever is above it. */
export const Section: React.FC<{
  children: React.ReactNode;
  component?: React.ElementType;
  sx?: Sx;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}> = ({ children, component = 'div', sx, ...aria }) => (
  <Box component={component} sx={mergeSx({ mt: '28px' }, sx)} {...aria}>
    {children}
  </Box>
);

/** `.panel` and `.panel.soft`. */
export const Panel = React.forwardRef<HTMLDivElement, {
  children?: React.ReactNode;
  soft?: boolean;
  component?: React.ElementType;
  sx?: Sx;
  id?: string;
  role?: string;
  tabIndex?: number;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}>(({ children, soft = false, component = 'div', sx, ...rest }, ref) => (
  <Box
    ref={ref}
    component={component}
    sx={mergeSx(
      {
        bgcolor: soft ? 'surfaceContainerHigh.main' : 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '13px',
        p: '20px',
        minWidth: 0,
      },
      sx,
    )}
    {...rest}
  >
    {children}
  </Box>
));
Panel.displayName = 'Panel';

/** `.head`: a panel's eyebrow and title on the left, a pill or actions on the right. */
export const PanelHead: React.FC<{
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  titleComponent?: React.ElementType;
  titleId?: string;
  aside?: React.ReactNode;
  /** Under the title, inside the left column: a detail line. */
  children?: React.ReactNode;
  sx?: Sx;
}> = ({ eyebrow, title, titleComponent = 'h2', titleId, aside, children, sx }) => (
  <Box
    sx={mergeSx(
      {
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '14px', mb: '12px',
        // The title wraps within its column and the pill or actions keep the
        // right edge -- until a phone, where the actions go under the title.
        [NARROW_QUERY]: { flexWrap: 'wrap', alignItems: 'flex-start' },
      },
      sx,
    )}
  >
    <Box sx={{ minWidth: 0, flex: '1 1 auto' }}>
      {eyebrow != null && eyebrow !== false && <Eyebrow>{eyebrow}</Eyebrow>}
      {title != null && (
        <Typography variant="h5" component={titleComponent} id={titleId} sx={{ m: 0 }}>
          {title}
        </Typography>
      )}
      {children}
    </Box>
    {aside != null && aside !== false && (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '9px', alignItems: 'center', flex: '0 0 auto' }}>{aside}</Box>
    )}
  </Box>
);

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

const TONE: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: 'pb.chip', fg: 'pb.chipText' },
  accent: { bg: 'pb.accentSoft', fg: 'pb.accent' },
  success: { bg: 'pb.successSoft', fg: 'pb.success' },
  warning: { bg: 'pb.warningSoft', fg: 'pb.warning' },
  danger: { bg: 'pb.dangerSoft', fg: 'pb.danger' },
};

/** `.pill` (and .b, .g, .a, .r): a state in a word. Not a control. */
export const Pill: React.FC<{ tone?: Tone; children: React.ReactNode; sx?: Sx; title?: string }> = ({
  tone = 'neutral', children, sx, title,
}) => (
  <Box
    component="span"
    title={title}
    sx={mergeSx(
      {
        display: 'inline-block',
        borderRadius: '20px',
        bgcolor: TONE[tone].bg,
        color: TONE[tone].fg,
        px: '8px',
        py: '3px',
        fontSize: (t) => t.typography.pxToRem(10),
        fontWeight: 760,
        lineHeight: 1.48,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
      },
      sx,
    )}
  >
    {children}
  </Box>
);

/** `.metricrow`: figures side by side, 28px apart. */
export const MetricRow: React.FC<{ children: React.ReactNode; sx?: Sx }> = ({ children, sx }) => (
  <Box sx={mergeSx({ display: 'flex', gap: '28px', flexWrap: 'wrap', mt: '13px' }, sx)}>{children}</Box>
);

/** `.metric`: a 23px figure over an 11px label. */
export const Metric: React.FC<{ value: React.ReactNode; label: React.ReactNode; detail?: React.ReactNode; valueColor?: string; sx?: Sx }> = ({
  value, label, detail, valueColor, sx,
}) => (
  <Box sx={mergeSx({ minWidth: 0 }, sx)}>
    <Box
      component="strong"
      sx={{ display: 'block', fontSize: (t) => t.typography.pxToRem(23), fontWeight: 700, lineHeight: 1.48, fontVariantNumeric: 'tabular-nums', color: valueColor }}
    >
      {value}
    </Box>
    <Box component="span" sx={{ fontSize: (t) => t.typography.pxToRem(11), color: 'text.secondary' }}>{label}</Box>
    {detail != null && <Box component="span" sx={{ display: 'block', fontSize: (t) => t.typography.pxToRem(11), color: 'text.secondary' }}>{detail}</Box>}
  </Box>
);

/** `.big`: the figure a panel is about, with an optional detail beside it. */
export const BigFigure: React.FC<{
  children: React.ReactNode;
  detail?: React.ReactNode;
  size?: number;
  color?: string;
  component?: React.ElementType;
  sx?: Sx;
}> = ({ children, detail, size = 38, color, component = 'div', sx }) => (
  <Box
    component={component}
    sx={mergeSx(
      {
        // Through the theme, so the figure grows with Large text. It was
        // `${size / 16}rem`: a template literal, which the font-size guard's
        // quoted-string pattern could not see, so the most prominent numbers
        // in the app stayed at 38px while everything around them scaled.
        fontSize: (t) => t.typography.pxToRem(size), fontWeight: 820, letterSpacing: '-0.05em', lineHeight: 1.48,
        fontVariantNumeric: 'tabular-nums', color,
        // With a detail, a wrapping row: the detail sits beside the figure
        // when there is room and moves under it, as one piece, when there is
        // not. It was a nowrap span, which could do neither. On a 390px phone
        // Home's "· 85% to pass · -7.5 a mock" already ran 23px outside its
        // box at Standard -- invisible only because nothing clipped it -- and
        // at Large text it crossed the page edge and lost its last word.
        //
        // A flex row rather than an inline-block so the wrapped line sits
        // close under the figure: an inline-block's second line inherits the
        // figure's 38px strut and floated ~30px below it. Figures without a
        // detail -- 28 of the 29 in the app -- are left exactly as they were.
        ...(detail != null && {
          display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: '7px',
        }),
      },
      sx,
    )}
  >
    {detail != null ? <span>{children}</span> : children}
    {detail != null && (
      <Box
        component="span"
        sx={{ fontSize: (t) => t.typography.pxToRem(13), fontWeight: 600, letterSpacing: 'normal', color: 'text.secondary' }}
      >
        {detail}
      </Box>
    )}
  </Box>
);

/** `.bar`: a 7px track and its fill. Named, because it is a progress bar. */
export const Bar: React.FC<{ value: number; label: string; color?: 'primary' | 'success' | 'warning' | 'error'; sx?: Sx }> = ({
  value, label, color = 'primary', sx,
}) => (
  <LinearProgress
    variant="determinate"
    value={Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))}
    color={color}
    aria-label={label}
    sx={sx}
  />
);

/** `.note`: the warning-toned box. */
export const Note: React.FC<{ children: React.ReactNode; sx?: Sx; role?: string }> = ({ children, sx, role }) => (
  <Box
    role={role}
    sx={mergeSx(
      {
        p: '12px 13px', borderRadius: '9px', border: '1px solid', borderColor: 'pb.noteLine',
        bgcolor: 'pb.warningSoft', color: 'pb.warning',
      },
      sx,
    )}
  >
    {children}
  </Box>
);

/** `.good`: the success-toned box. */
export const Good: React.FC<{ children: React.ReactNode; sx?: Sx; role?: string }> = ({ children, sx, role }) => (
  <Box
    role={role}
    sx={mergeSx(
      {
        p: '12px 13px', borderRadius: '9px', border: '1px solid', borderColor: 'pb.goodLine',
        bgcolor: 'pb.successSoft', color: 'pb.success',
      },
      sx,
    )}
  >
    {children}
  </Box>
);

/** `.sub` inside a panel: a muted paragraph at body size, 14px above and below. */
export const Sub: React.FC<{ children: React.ReactNode; sx?: Sx; component?: React.ElementType }> = ({
  children, sx, component = 'p',
}) => (
  <Typography component={component} variant="body1" sx={mergeSx({ color: 'text.secondary', maxWidth: 820, my: '14px' }, sx)}>
    {children}
  </Typography>
);

/** `.detail`: the 12px muted line. */
export const Detail: React.FC<{ children: React.ReactNode; sx?: Sx; component?: React.ElementType; id?: string }> = ({
  children, sx, component = 'div', id,
}) => (
  <Typography component={component} variant="body2" id={id} sx={mergeSx({ color: 'text.secondary' }, sx)}>
    {children}
  </Typography>
);

/**
 * `.row`: a title and its detail, something in the middle, and an action on the
 * right. The middle gives way on a phone.
 */
export const Row: React.FC<{
  title: React.ReactNode;
  detail?: React.ReactNode;
  middle?: React.ReactNode;
  action?: React.ReactNode;
  titleComponent?: React.ElementType;
  columns?: string;
  component?: React.ElementType;
  sx?: Sx;
}> = ({ title, detail, middle, action, titleComponent = 'h3', columns, component = 'div', sx }) => (
  <Box
    component={component}
    sx={mergeSx(
      {
        display: 'grid',
        gridTemplateColumns: columns ?? 'minmax(0,1.45fr) minmax(0,1fr) auto',
        gap: '15px',
        alignItems: 'center',
        py: '14px',
        borderBottom: '1px solid',
        borderColor: 'divider',
        '&:last-child': { borderBottom: 0 },
        [NARROW_QUERY]: { gridTemplateColumns: 'minmax(0,1fr) auto', '& > .pb-row-middle': { display: 'none' } },
      },
      sx,
    )}
  >
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="h6" component={titleComponent} sx={{ m: 0, mb: detail != null ? '4px' : 0 }}>
        {title}
      </Typography>
      {detail != null && <Detail>{detail}</Detail>}
    </Box>
    {/* Grid cells, as in the prototype. A pill in the middle stretches the width
        of its column and reads as a labelled track; with nothing in the middle,
        the row's action takes that column and stretches the same way. */}
    {middle != null && <Box className="pb-row-middle" sx={{ minWidth: 0, display: 'grid' }}>{middle}</Box>}
    {middle == null
      ? (action != null
        ? <Box sx={{ minWidth: 0, display: 'grid', [NARROW_QUERY]: { justifySelf: 'end' } }}>{action}</Box>
        : <Box />)
      : (action != null ? <Box sx={{ justifySelf: 'end' }}>{action}</Box> : <Box />)}
  </Box>
);

/**
 * `.grid` with `.g2` (1.35fr 1fr), `.g3`, `.g4` or `.g5`, falling to one column
 * on a phone (and `.g5` to two below 1080px).
 */
export const Grid: React.FC<{
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 5;
  /** Replaces the column template, as the prototype does inline on some screens. */
  template?: string;
  gap?: string;
  component?: React.ElementType;
  sx?: Sx;
  'aria-label'?: string;
}> = ({ children, columns = 2, template, gap = '15px', component = 'div', sx, ...aria }) => {
  const base = template ?? (columns === 2 ? 'minmax(0,1.35fr) minmax(0,1fr)' : `repeat(${columns}, minmax(0,1fr))`);
  return (
    <Box
      component={component}
      sx={mergeSx(
        {
          display: 'grid',
          gap,
          gridTemplateColumns: base,
          ...(columns === 5 ? { [RAIL_QUERY]: { gridTemplateColumns: 'repeat(2, minmax(0,1fr))' } } : {}),
          [NARROW_QUERY]: { gridTemplateColumns: 'minmax(0,1fr)' },
        },
        sx,
      )}
      {...aria}
    >
      {children}
    </Box>
  );
};

/** `.check`: a mark, a line, and something on the right. */
export const CheckRow: React.FC<{ mark?: React.ReactNode; children: React.ReactNode; aside?: React.ReactNode; sx?: Sx }> = ({
  mark, children, aside, sx,
}) => (
  <Box
    sx={mergeSx(
      {
        display: 'grid', gridTemplateColumns: '20px minmax(0,1fr) auto', gap: '10px', alignItems: 'center', py: '11px',
        borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { borderBottom: 0 },
      },
      sx,
    )}
  >
    <Box sx={{ display: 'flex', justifyContent: 'center' }}>{mark}</Box>
    <Box sx={{ minWidth: 0 }}>{children}</Box>
    {aside != null ? <Box>{aside}</Box> : <Box />}
  </Box>
);

/** `.actions`: a row of buttons, 9px apart, wrapping. */
export const Actions: React.FC<{ children: React.ReactNode; sx?: Sx }> = ({ children, sx }) => (
  <Box sx={mergeSx({ display: 'flex', flexWrap: 'wrap', gap: '9px', alignItems: 'center' }, sx)}>{children}</Box>
);
