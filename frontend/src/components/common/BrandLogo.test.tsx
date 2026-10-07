// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BrandLogo, BrandMarkIcon } from './BrandLogo';

describe('BrandLogo', () => {
  it('renders full logo by default with mark and wordmark text', () => {
    render(
      <MemoryRouter>
        <BrandLogo />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('PrepBench Mark')).toBeInTheDocument();
    expect(screen.getByText('Prep')).toBeInTheDocument();
    expect(screen.getByText('Bench')).toBeInTheDocument();
  });

  it('renders mark-only variant', () => {
    render(
      <MemoryRouter>
        <BrandLogo variant="mark" />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('PrepBench Mark')).toBeInTheDocument();
    expect(screen.queryByText('Prep')).not.toBeInTheDocument();
    expect(screen.queryByText('Bench')).not.toBeInTheDocument();
  });

  it('renders wordmark-only variant', () => {
    render(
      <MemoryRouter>
        <BrandLogo variant="wordmark" />
      </MemoryRouter>,
    );

    expect(screen.queryByLabelText('PrepBench Mark')).not.toBeInTheDocument();
    expect(screen.getByText('Prep')).toBeInTheDocument();
    expect(screen.getByText('Bench')).toBeInTheDocument();
  });

  it('renders tagline when withTagline is set', () => {
    render(
      <MemoryRouter>
        <BrandLogo withTagline />
      </MemoryRouter>,
    );

    expect(screen.getByText('Technical Capability, Proven.')).toBeInTheDocument();
  });

  it('renders as a RouterLink when to prop is provided', () => {
    render(
      <MemoryRouter>
        <BrandLogo to="/" />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/');
  });

  it('renders monochrome BrandMarkIcon with 7 solid path fills', () => {
    const { container } = render(<BrandMarkIcon monochrome size={40} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '40');
    expect(svg).toHaveAttribute('height', '40');
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBe(7);
  });
});
