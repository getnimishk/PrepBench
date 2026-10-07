// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Typography, useTheme } from '@mui/material';

export interface BrandLogoProps {
  /**
   * 'full' = 3D dimensional mark + PrepBench wordmark
   * 'mark' = 3D dimensional mark only
   * 'wordmark' = PrepBench text only
   */
  variant?: 'full' | 'mark' | 'wordmark';
  /**
   * Theme mode for colors. 'auto' follows theme.palette.mode
   */
  theme?: 'light' | 'dark' | 'auto' | 'monochrome';
  /**
   * Predefined or pixel size (height in px)
   */
  size?: 'sm' | 'md' | 'lg' | number;
  /**
   * Display official tagline 'Technical Capability, Proven.' beneath wordmark
   */
  withTagline?: boolean;
  /**
   * Optional link destination (e.g. '/')
   */
  to?: string;
  /**
   * Optional click handler
   */
  onClick?: () => void;
  className?: string;
}

/**
 * Authoritative 3D Dimensional Isometric Brand Mark:
 * Precision faceted polygonal geometry featuring the blue/cyan/purple isometric 'P'
 * representing Technical Rigor + Systematic Practice + Empirical Experimentation + Verifiable Proof.
 */
export const BrandMarkIcon: React.FC<{
  size?: number;
  idPrefix?: string;
  className?: string;
  monochrome?: boolean;
}> = ({ size = 32, idPrefix = 'pbm', className, monochrome = false }) => {
  const leftPillarId = `${idPrefix}-lp`;
  const roofLeftId = `${idPrefix}-rl`;
  const roofRightId = `${idPrefix}-rr`;
  const rightFlangeId = `${idPrefix}-rf`;
  const innerNavyId = `${idPrefix}-in`;
  const innerPurpleId = `${idPrefix}-ip`;
  const frontStemId = `${idPrefix}-fs`;

  if (monochrome) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 118 116"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={{ display: 'block', flexShrink: 0 }}
        aria-label="PrepBench Mark"
      >
        <path d="M 1 29 L 22 38 L 22 103 L 1 92 Z" fill="#000000" />
        <path d="M 1 29 L 58 0 L 58 25 L 22 38 Z" fill="#1F2937" />
        <path d="M 58 0 L 116 29 L 94 43 L 58 25 Z" fill="#374151" />
        <path d="M 116 29 L 116 59 L 94 72 L 94 43 Z" fill="#111827" />
        <path d="M 94 43 L 94 72 L 66 85 L 66 58 Z" fill="#000000" />
        <path d="M 38 70 L 66 55 L 66 85 L 38 85 Z" fill="#1F2937" />
        <path d="M 38 85 L 66 85 L 66 113 L 38 113 Z" fill="#000000" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 118 116"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'block', flexShrink: 0 }}
      aria-label="PrepBench Mark"
    >
      <defs>
        {/* Facet 1: Outer Left Vertical Face */}
        <linearGradient id={leftPillarId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0F93FA" />
          <stop offset="45%" stopColor="#0971F6" />
          <stop offset="100%" stopColor="#093196" />
        </linearGradient>

        {/* Facet 2: Left Roof Facet */}
        <linearGradient id={roofLeftId} x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#0A3CB8" />
          <stop offset="60%" stopColor="#1052CE" />
          <stop offset="100%" stopColor="#1374E5" />
        </linearGradient>

        {/* Facet 3: Right Roof Facet (Electric Blue to Radiant Cyan) */}
        <linearGradient id={roofRightId} x1="0%" y1="0%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#138CFB" />
          <stop offset="45%" stopColor="#15B8F4" />
          <stop offset="100%" stopColor="#16C6EF" />
        </linearGradient>

        {/* Facet 4: Outer Right Flange */}
        <linearGradient id={rightFlangeId} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#16C6EF" />
          <stop offset="35%" stopColor="#03A2D8" />
          <stop offset="100%" stopColor="#08287B" />
        </linearGradient>

        {/* Facet 5: Inner Loop Upper Navy Slope */}
        <linearGradient id={innerNavyId} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0A2F8F" />
          <stop offset="100%" stopColor="#10206B" />
        </linearGradient>

        {/* Facet 6: Inner Loop Purple / Violet Fold */}
        <linearGradient id={innerPurpleId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="45%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#3D33ED" />
        </linearGradient>

        {/* Facet 7: Front Stem (Vibrant Royal Blue) */}
        <linearGradient id={frontStemId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0356EC" />
          <stop offset="100%" stopColor="#0245D0" />
        </linearGradient>
      </defs>

      {/* 1. Left Vertical Pillar */}
      <path d="M 1 29 L 22 38 L 22 103 L 1 92 Z" fill={`url(#${leftPillarId})`} />

      {/* 2. Roof Left Facet */}
      <path d="M 1 29 L 58 0 L 58 25 L 22 38 Z" fill={`url(#${roofLeftId})`} />

      {/* 3. Roof Right Facet */}
      <path d="M 58 0 L 116 29 L 94 43 L 58 25 Z" fill={`url(#${roofRightId})`} />

      {/* 4. Outer Right Flange */}
      <path d="M 116 29 L 116 59 L 94 72 L 94 43 Z" fill={`url(#${rightFlangeId})`} />

      {/* 5. Inner Loop Upper Navy Slope */}
      <path d="M 94 43 L 94 72 L 66 85 L 66 58 Z" fill={`url(#${innerNavyId})`} />

      {/* 6. Inner Loop Purple Fold */}
      <path d="M 38 70 L 66 55 L 66 85 L 38 85 Z" fill={`url(#${innerPurpleId})`} />

      {/* 7. Front Stem */}
      <path d="M 38 85 L 66 85 L 66 113 L 38 113 Z" fill={`url(#${frontStemId})`} />
    </svg>
  );
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'full',
  theme = 'auto',
  size = 'md',
  withTagline = false,
  to,
  onClick,
  className,
}) => {
  const muiTheme = useTheme();
  const isDark = theme === 'auto' ? muiTheme.palette.mode === 'dark' : theme === 'dark';
  const isMonochrome = theme === 'monochrome';

  // Dimension mapping
  const heightPx = typeof size === 'number' ? size : size === 'sm' ? 26 : size === 'lg' ? 44 : 34;
  const markSize = heightPx;
  const fontSizePx = Math.round(heightPx * 0.64);
  const taglineSizePx = Math.max(9, Math.round(heightPx * 0.24));

  // Approved typography colors
  const prepColor = isMonochrome ? '#000000' : isDark ? '#FFFFFF' : '#0E1726';
  const benchColor = isMonochrome ? '#000000' : isDark ? '#00A3FF' : '#034FDF';
  const taglineColor = isMonochrome ? '#4B5563' : isDark ? '#94A3B8' : '#475569';

  const content = (
    <Box
      className={className}
      onClick={onClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${Math.max(8, Math.round(heightPx * 0.28))}px`,
        cursor: to || onClick ? 'pointer' : 'default',
        userSelect: 'none',
        lineHeight: 1,
      }}
    >
      {(variant === 'full' || variant === 'mark') && (
        <BrandMarkIcon
          size={markSize}
          idPrefix={`pbm-${isDark ? 'dark' : 'light'}`}
          monochrome={isMonochrome}
        />
      )}

      {(variant === 'full' || variant === 'wordmark') && (
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Typography
            component="span"
            sx={{
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              fontSize: (theme) => theme.typography.pxToRem(fontSizePx),
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: '-0.03em',
              color: prepColor,
            }}
          >
            Prep
            <Box
              component="span"
              sx={{
                fontWeight: 800,
                color: benchColor,
                letterSpacing: '-0.025em',
              }}
            >
              Bench
            </Box>
          </Typography>

          {withTagline && (
            <Typography
              component="span"
              sx={{
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace",
                fontSize: (theme) => theme.typography.pxToRem(taglineSizePx),
                fontWeight: 500,
                letterSpacing: '0.18em',
                color: taglineColor,
                textTransform: 'none',
                mt: '3px',
                lineHeight: 1.1,
              }}
            >
              Technical Capability, Proven.
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );

  if (to) {
    return (
      <RouterLink to={to} style={{ textDecoration: 'none', color: 'inherit', display: 'inline-flex' }}>
        {content}
      </RouterLink>
    );
  }

  return content;
};
