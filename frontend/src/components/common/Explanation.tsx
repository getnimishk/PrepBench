// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Box, Link, Typography } from '@mui/material';

/**
 * Question explanations, rendered rather than printed.
 *
 * Every one of the 709 explanations in the bank is written in Markdown --
 * bold lead-ins and a bulleted "why the other options are wrong" list -- and
 * every surface displayed it raw, so the most carefully written text in the
 * product read as `**Why the incorrect options are wrong:**`. That is the
 * paragraph review exists to deliver.
 *
 * This handles the four constructs the bank actually contains, plus https links
 * (the study guides cite their sources), and nothing else. It builds React elements rather than HTML, so a question imported
 * from somewhere untrusted cannot inject markup; and it is fifteen lines
 * rather than a dependency, because the alternative is shipping a general
 * Markdown engine to render bold text.
 */

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https:\/\/[^)\s]+\))/g;
const LINK = /^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/;

/** Bold and code spans, and https links, within a line. */
const inline = (text: string): React.ReactNode[] =>
  text.split(INLINE).filter(Boolean).map((part, i) => {
    const link = part.match(LINK);
    if (link) {
      // Only https targets are matched, so a guide can cite its sources but never smuggle in
      // a javascript: or data: URL.
      return (
        <Link key={i} href={link[2]} target="_blank" rel="noopener noreferrer">
          {link[1]}
        </Link>
      );
    }
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

        // A line that is only `![alt](/assets/...)` is a figure. Only the app's own /assets
        // folder is accepted, so a guide cannot pull in an image from elsewhere.
        const image = line.match(/^!\[([^\]]*)\]\((\/assets\/[^)\s]+)\)$/);
        if (image) {
          return (
            <Box key={i} component="figure" sx={{ m: 0, my: 1 }}>
              <Link href={image[2]} target="_blank" rel="noopener noreferrer" aria-label={`${image[1]} (opens full size)`}>
                <Box
                  component="img"
                  src={image[2]}
                  alt={image[1]}
                  sx={{ display: 'block', maxWidth: '100%', height: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}
                />
              </Link>
            </Box>
          );
        }

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
