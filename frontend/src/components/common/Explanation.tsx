// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Box, Link, Typography } from '@mui/material';

/**
 * Question explanations and guide text, rendered rather than printed.
 *
 * Handles bold lead-ins, inline code, bullets, numbered lists, markdown links
 * [label](url), and bare URLs safely without dangerouslySetInnerHTML.
 */

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((?:https?:\/\/[^\s)]+|\/[^\s)]+)\)|https?:\/\/[^\s)\]]+)/g;

/** Bold, code spans, and links within a line. */
const inline = (text: string): React.ReactNode[] =>
  text.split(INLINE).filter(Boolean).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <Box
          key={i}
          component="code"
          sx={{ fontFamily: 'monospace', fontSize: '0.9em', bgcolor: 'action.hover', px: 0.5, borderRadius: 0.5 }}
        >
          {part.slice(1, -1)}
        </Box>
      );
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      const isExternal = href.startsWith('http://') || href.startsWith('https://');
      return (
        <Link
          key={i}
          href={href}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          sx={{
            color: 'primary.main',
            textDecoration: 'underline',
            textUnderlineOffset: '2px',
            '&:hover': { textDecoration: 'none' },
          }}
        >
          {label}
        </Link>
      );
    }
    if (part.startsWith('http://') || part.startsWith('https://')) {
      const cleanUrl = part.replace(/[.,;:)]+$/, '');
      const trailing = part.slice(cleanUrl.length);
      return (
        <React.Fragment key={i}>
          <Link
            href={cleanUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              color: 'primary.main',
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
              wordBreak: 'break-all',
              '&:hover': { textDecoration: 'none' },
            }}
          >
            {cleanUrl}
          </Link>
          {trailing}
        </React.Fragment>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });

export const Explanation: React.FC<{ text: string; variant?: 'body1' | 'body2' }> = ({
  text,
  variant = 'body2',
}) => {
  const lines = text.split('\n');

  return (
    <Box>
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return <Box key={i} sx={{ height: 10 }} />;

        const bullet = line.match(/^\s*[-*]\s+(.*)$/);
        const numbered = line.match(/^\s*(\d+)\.\s+(.*)$/);

        if (bullet || numbered) {
          return (
            <Box key={i} sx={{ display: 'flex', gap: 1, pl: 0.5, mt: 0.4 }}>
              <Typography variant={variant} sx={{ color: 'text.secondary', flexShrink: 0 }}>
                {numbered ? `${numbered[1]}.` : '·'}
              </Typography>
              <Typography variant={variant} sx={{ lineHeight: 1.65 }}>
                {inline(numbered ? numbered[2] : bullet![1])}
              </Typography>
            </Box>
          );
        }

        return (
          <Typography key={i} variant={variant} sx={{ lineHeight: 1.7 }}>
            {inline(line)}
          </Typography>
        );
      })}
    </Box>
  );
};
