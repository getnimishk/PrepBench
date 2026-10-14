// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Explanation } from './Explanation';

describe('Explanation links', () => {
  it('renders an https link as an anchor that opens safely in a new tab', () => {
    render(<Explanation text="See [the intro](https://learn.microsoft.com/en-us/azure/data-factory/introduction) first." />);
    const link = screen.getByRole('link', { name: 'the intro' });
    expect(link).toHaveAttribute('href', 'https://learn.microsoft.com/en-us/azure/data-factory/introduction');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('never turns a non-https target into a link', () => {
    render(<Explanation text="[x](javascript:alert(1)) and [y](http://example.com) and [z](data:text/html,hi)" />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('keeps bold and code working next to a link', () => {
    render(<Explanation text="**Bold** `code` [docs](https://learn.microsoft.com/) end" />);
    expect(screen.getByText('Bold').tagName).toBe('STRONG');
    expect(screen.getByText('code').tagName).toBe('CODE');
    expect(screen.getByRole('link', { name: 'docs' })).toBeInTheDocument();
  });
});
