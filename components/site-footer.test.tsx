import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockPathname = vi.fn(() => '/');
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

// CookieSettingsButton pulls in the cookie-consent context; stub it so the
// footer renders in isolation.
vi.mock('@/components/cookie/cookie-settings-button', () => ({
  CookieSettingsButton: () => <button type="button">Cookie Settings</button>,
}));

import { SiteFooter } from './site-footer';

describe('SiteFooter', () => {
  beforeEach(() => mockPathname.mockReturnValue('/'));

  it('renders the footer landmark + disclaimer on a normal route', () => {
    mockPathname.mockReturnValue('/decks');
    render(<SiteFooter />);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByText(/no way affiliated with Legend Story Studios/i)).toBeInTheDocument();
  });

  it('renders on the homepage', () => {
    mockPathname.mockReturnValue('/');
    render(<SiteFooter />);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('hides the footer on /opt (full-height app-shell route)', () => {
    mockPathname.mockReturnValue('/opt');
    const { container } = render(<SiteFooter />);
    expect(container).toBeEmptyDOMElement();
  });

  it('hides the footer on /search (full-height app-shell route)', () => {
    mockPathname.mockReturnValue('/search');
    const { container } = render(<SiteFooter />);
    expect(container).toBeEmptyDOMElement();
  });
});
