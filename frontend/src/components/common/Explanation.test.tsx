// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Explanation } from './Explanation';

describe('Explanation component: inline markdown and links', () => {
  it('renders bold and inline code spans', () => {
    render(<Explanation text="Here is **bold text** and `inline_code` in a sentence." />);

    const bold = screen.getByText('bold text');
    expect(bold.tagName).toBe('STRONG');

    const code = screen.getByText('inline_code');
    expect(code.tagName).toBe('CODE');
  });

  it('renders bullet lists and numbered lists', () => {
    const markdown = `- First bullet\n- Second bullet\n1. Numbered item\n2. Another numbered item`;
    render(<Explanation text={markdown} />);

    expect(screen.getByText('First bullet')).toBeInTheDocument();
    expect(screen.getByText('Second bullet')).toBeInTheDocument();
    expect(screen.getByText('Numbered item')).toBeInTheDocument();
    expect(screen.getByText('Another numbered item')).toBeInTheDocument();
  });

  it('renders markdown links with label, href, target and rel', () => {
    const text = 'Read the [Microsoft Learn — Copy activity](https://learn.microsoft.com/en-us/azure/data-factory/copy-activity-overview) for details.';
    render(<Explanation text={text} />);

    const link = screen.getByRole('link', { name: 'Microsoft Learn — Copy activity' });
    expect(link).toHaveAttribute('href', 'https://learn.microsoft.com/en-us/azure/data-factory/copy-activity-overview');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders bare URLs as clickable links with security attributes', () => {
    const text = 'Direct reference: https://learn.microsoft.com/en-us/azure/data-factory/introduction.';
    render(<Explanation text={text} />);

    const link = screen.getByRole('link', { name: 'https://learn.microsoft.com/en-us/azure/data-factory/introduction' });
    expect(link).toHaveAttribute('href', 'https://learn.microsoft.com/en-us/azure/data-factory/introduction');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
