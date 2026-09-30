// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useContext } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Box, Typography } from '@mui/material';
import { MONO_STACK } from '../../theme/tokens';
import { MermaidDiagram } from './MermaidDiagram';
import { SafeSvg } from './SafeSvg';
import { DIAGRAM_MIN_WIDTH_PX, GUIDE_IMAGE_MAP, PreContext } from './guideUtils';

const MarkdownCode: React.FC<{ className?: string; children?: React.ReactNode }> = ({ className, children }) => {
  const inPre = useContext(PreContext);
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : '';
  const textContent = String(children ?? '').replace(/\n$/, '');

  if (inPre && lang === 'mermaid') {
    return <MermaidDiagram source={textContent} />;
  }

  if (inPre && lang === 'svg') {
    return <SafeSvg source={textContent} />;
  }

  if (inPre) {
    return (
      <Box
        component="pre"
        tabIndex={0}
        sx={{
          my: '12px',
          p: '11px 12px',
          borderRadius: '9px',
          bgcolor: 'pb.surface2',
          border: '1px solid',
          borderColor: 'divider',
          fontFamily: MONO_STACK,
          fontSize: (t) => t.typography.pxToRem(12),
          color: 'text.secondary',
          overflowX: 'auto',
          whiteSpace: 'pre',
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'pb.accent',
          },
        }}
      >
        <code>{textContent}</code>
      </Box>
    );
  }

  return (
    <Box
      component="code"
      sx={{
        fontFamily: MONO_STACK,
        fontSize: '0.9em',
        bgcolor: 'action.hover',
        px: 0.5,
        py: 0.25,
        borderRadius: '4px',
        color: 'text.primary',
      }}
    >
      {children}
    </Box>
  );
};

export interface GuideMarkdownProps {
  text: string;
}

/**
 * Renders study-guide Markdown client-side and offline.
 *
 * Supports:
 * - CommonMark & GFM tables/lists/links/emphasis
 * - Headings rendered as h3 and h4 only (since section title is h2)
 * - Fenced ```mermaid blocks via MermaidDiagram
 * - Fenced ```svg blocks via SafeSvg
 * - Inline images ![alt](guide:filename.ext) from bundled assets
 * - Safe links (http/https open in new tab with noopener noreferrer; other schemes not linked)
 * - Raw HTML rendered as plain text
 */
export const GuideMarkdown: React.FC<GuideMarkdownProps> = ({ text }) => {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      urlTransform={(url) => url}
      components={{
        h1: ({ children }) => (
          <Typography
            variant="h6"
            component="h3"
            sx={{ mt: '20px', mb: '8px', fontWeight: 700, fontSize: (t) => t.typography.pxToRem(18) }}
          >
            {children}
          </Typography>
        ),
        h2: ({ children }) => (
          <Typography
            variant="h6"
            component="h3"
            sx={{ mt: '18px', mb: '8px', fontWeight: 700, fontSize: (t) => t.typography.pxToRem(17) }}
          >
            {children}
          </Typography>
        ),
        h3: ({ children }) => (
          <Typography
            variant="subtitle1"
            component="h3"
            sx={{ mt: '16px', mb: '6px', fontWeight: 700, fontSize: (t) => t.typography.pxToRem(16) }}
          >
            {children}
          </Typography>
        ),
        h4: ({ children }) => (
          <Typography
            variant="subtitle2"
            component="h4"
            sx={{ mt: '14px', mb: '4px', fontWeight: 700, fontSize: (t) => t.typography.pxToRem(14) }}
          >
            {children}
          </Typography>
        ),
        h5: ({ children }) => (
          <Typography
            variant="subtitle2"
            component="h4"
            sx={{ mt: '12px', mb: '4px', fontWeight: 700, fontSize: (t) => t.typography.pxToRem(13) }}
          >
            {children}
          </Typography>
        ),
        h6: ({ children }) => (
          <Typography
            variant="subtitle2"
            component="h4"
            sx={{ mt: '12px', mb: '4px', fontWeight: 700, fontSize: (t) => t.typography.pxToRem(12) }}
          >
            {children}
          </Typography>
        ),
        p: ({ children, node }) => {
          const hasImage = Boolean(
            node?.children?.some(
              (child) => child.type === 'element' && (child as { tagName?: string }).tagName === 'img',
            ),
          );
          if (hasImage) {
            return (
              <Box sx={{ mt: '10px', mb: '10px', lineHeight: 1.7 }}>
                {children}
              </Box>
            );
          }
          return (
            <Typography
              component="p"
              variant="body1"
              sx={{
                mt: '10px',
                mb: '10px',
                lineHeight: 1.7,
                fontSize: (t) => t.typography.pxToRem(14),
                whiteSpace: 'pre-line',
              }}
            >
              {children}
            </Typography>
          );
        },
        ul: ({ children }) => (
          <Box component="ul" sx={{ my: '8px', pl: '24px', lineHeight: 1.7, fontSize: (t) => t.typography.pxToRem(14) }}>
            {children}
          </Box>
        ),
        ol: ({ children }) => (
          <Box component="ol" sx={{ my: '8px', pl: '24px', lineHeight: 1.7, fontSize: (t) => t.typography.pxToRem(14) }}>
            {children}
          </Box>
        ),
        li: ({ children }) => (
          <Box component="li" sx={{ my: '3px' }}>
            {children}
          </Box>
        ),
        blockquote: ({ children }) => (
          <Box
            component="blockquote"
            sx={{
              my: '12px',
              ml: 0,
              mr: 0,
              pl: '14px',
              borderLeft: '3px solid',
              borderColor: 'pb.line',
              color: 'text.secondary',
              fontStyle: 'italic',
            }}
          >
            {children}
          </Box>
        ),
        a: ({ href, children }) => {
          if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
            return (
              <Box
                component="a"
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  color: 'pb.accent',
                  textDecoration: 'underline',
                  '&:focus-visible': {
                    outline: '2px solid',
                    outlineColor: 'pb.accent',
                    borderRadius: '2px',
                  },
                }}
              >
                {children}
              </Box>
            );
          }
          // Schemes other than http/https are not links - render plain text span
          return <span>{children}</span>;
        },
        img: ({ src, alt }) => {
          if (!alt || !alt.trim()) {
            return (
              <Typography
                component="span"
                sx={{ color: 'text.secondary', fontStyle: 'italic', fontSize: (t) => t.typography.pxToRem(13) }}
              >
                Image is missing a description
              </Typography>
            );
          }

          const cleanAlt = alt.trim();
          const cleanSrc = (src || '').trim();

          if (!cleanSrc.startsWith('guide:')) {
            return (
              <Typography
                component="span"
                sx={{ color: 'text.secondary', fontStyle: 'italic', fontSize: (t) => t.typography.pxToRem(13) }}
              >
                Image not shown: only bundled guide images are allowed ({cleanAlt})
              </Typography>
            );
          }

          const filename = cleanSrc.slice('guide:'.length).trim();
          const resolvedUrl = GUIDE_IMAGE_MAP[filename];

          if (!resolvedUrl) {
            return (
              <Typography
                component="span"
                sx={{ color: 'text.secondary', fontStyle: 'italic', fontSize: (t) => t.typography.pxToRem(13) }}
              >
                Image not shown: only bundled guide images are allowed ({cleanAlt})
              </Typography>
            );
          }

          return (
            <Box component="figure" sx={{ m: 0, my: '14px', maxWidth: '100%' }}>
              <Box
                tabIndex={0}
                role="region"
                aria-label={cleanAlt}
                sx={{
                  overflowX: 'auto',
                  maxWidth: '100%',
                  borderRadius: '8px',
                  '&:focus-visible': {
                    outline: '2px solid',
                    outlineColor: 'pb.accent',
                  },
                }}
              >
                <Box
                  component="img"
                  src={resolvedUrl}
                  alt={cleanAlt}
                  sx={filename.toLowerCase().endsWith('.svg')
                    // A vector figure has no size of its own: fill the box, but scroll rather than shrink below readable.
                    ? { display: 'block', width: '100%', minWidth: `${DIAGRAM_MIN_WIDTH_PX}px`, height: 'auto' }
                    : { display: 'block', maxWidth: '100%', height: 'auto' }}
                />
              </Box>
            </Box>
          );
        },
        pre: ({ children }) => <PreContext.Provider value={true}>{children}</PreContext.Provider>,
        code: MarkdownCode,
        table: ({ children }) => (
          <Box
            tabIndex={0}
            role="region"
            aria-label="Table"
            sx={{
              overflowX: 'auto',
              my: '14px',
              maxWidth: '100%',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: 'divider',
              '&:focus-visible': {
                outline: '2px solid',
                outlineColor: 'pb.accent',
              },
            }}
          >
            <Box
              component="table"
              sx={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: (t) => t.typography.pxToRem(13),
              }}
            >
              {children}
            </Box>
          </Box>
        ),
        thead: ({ children }) => (
          <Box component="thead" sx={{ bgcolor: 'pb.surface2' }}>
            {children}
          </Box>
        ),
        tbody: ({ children }) => <Box component="tbody">{children}</Box>,
        tr: ({ children }) => (
          <Box
            component="tr"
            sx={{
              borderBottom: '1px solid',
              borderColor: 'divider',
              '&:last-child': { borderBottom: 0 },
            }}
          >
            {children}
          </Box>
        ),
        th: ({ children }) => (
          <Box
            component="th"
            sx={{
              p: '8px 12px',
              textAlign: 'left',
              fontWeight: 700,
              borderRight: '1px solid',
              borderColor: 'divider',
              '&:last-child': { borderRight: 0 },
            }}
          >
            {children}
          </Box>
        ),
        td: ({ children }) => (
          <Box
            component="td"
            sx={{
              p: '8px 12px',
              borderRight: '1px solid',
              borderColor: 'divider',
              '&:last-child': { borderRight: 0 },
            }}
          >
            {children}
          </Box>
        ),
      }}
    >
      {text}
    </Markdown>
  );
};
