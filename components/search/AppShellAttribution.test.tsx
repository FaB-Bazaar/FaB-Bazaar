import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppShellAttribution } from './AppShellAttribution';

describe('AppShellAttribution', () => {
  it('is a footer landmark', () => {
    render(<AppShellAttribution />);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('keeps the Legend Story Studios non-affiliation + trademark disclaimer', () => {
    render(<AppShellAttribution />);
    expect(
      screen.getByText(/not affiliated with Legend Story Studios/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/trademark/i)).toBeInTheDocument();
  });

  it('keeps the affiliate-commission disclosure (priced links shown here)', () => {
    render(<AppShellAttribution />);
    expect(screen.getByText(/commission/i)).toBeInTheDocument();
  });

  it('links to Privacy and Terms', () => {
    render(<AppShellAttribution />);
    expect(screen.getByRole('link', { name: /privacy/i })).toHaveAttribute('href', '/privacy-policy');
    expect(screen.getByRole('link', { name: /terms/i })).toHaveAttribute('href', '/terms-of-service');
  });
});
