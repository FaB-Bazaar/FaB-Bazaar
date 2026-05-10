/**
 * Unit tests for <LeagueCard>.
 *
 * Pure presentational tile rendered on the /leagues directory page.
 * Tests follow TDD discipline — each `it` was added before the
 * corresponding rendering branch existed.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LeagueCard from '../LeagueCard';
import type { LeagueWithNextEventDTO } from '@/lib/services/contracts/ILeagueService';

const base: LeagueWithNextEventDTO = {
  id: 'lg-1',
  slug: 'inkblade',
  name: 'InkBlade League',
  description: 'Weekly Silver Age league',
  format: 'Silver Age',
  bannerUrl: null,
  discordGuildId: null,
  discordInviteUrl: null,
  ownerId: 'u-1',
  public: true,
  scheduleSummary: 'Every Sunday, 7pm UTC',
  metadata: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  nextEvent: null,
};

describe('LeagueCard', () => {
  it('renders the league name as the primary heading', () => {
    render(<LeagueCard league={base} />);
    expect(
      screen.getByRole('heading', { name: /inkblade league/i }),
    ).toBeInTheDocument();
  });

  it('renders the format label', () => {
    render(<LeagueCard league={base} />);
    expect(screen.getByText('Silver Age')).toBeInTheDocument();
  });

  it('renders the schedule summary', () => {
    render(<LeagueCard league={base} />);
    expect(screen.getByText('Every Sunday, 7pm UTC')).toBeInTheDocument();
  });

  it('renders the banner image when bannerUrl is set', () => {
    render(<LeagueCard league={{ ...base, bannerUrl: 'https://example.com/banner.jpg' }} />);
    const img = screen.getByRole('img', { name: /inkblade league/i });
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toBe('https://example.com/banner.jpg');
  });

  it('omits the banner image when bannerUrl is null', () => {
    render(<LeagueCard league={base} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders a Join Discord link when discordInviteUrl is set', () => {
    render(
      <LeagueCard league={{ ...base, discordInviteUrl: 'https://discord.gg/abc' }} />,
    );
    const link = screen.getByRole('link', { name: /join discord/i });
    expect(link).toHaveAttribute('href', 'https://discord.gg/abc');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('omits the Discord link when discordInviteUrl is null', () => {
    render(<LeagueCard league={base} />);
    expect(screen.queryByRole('link', { name: /join discord/i })).not.toBeInTheDocument();
  });

  it('links the card title to the league detail page via the slug', () => {
    render(<LeagueCard league={base} />);
    const title = screen.getByRole('link', { name: /inkblade league/i });
    expect(title).toHaveAttribute('href', '/leagues/inkblade');
  });

  it('renders the next event name and date when one is provided', () => {
    const next = {
      id: 'evt-1',
      leagueId: 'lg-1',
      name: 'Week 12',
      description: null,
      scheduledFor: new Date('2026-06-07T19:00:00Z'),
      status: 'upcoming' as const,
      format: null,
      public: true,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<LeagueCard league={{ ...base, nextEvent: next }} />);
    expect(screen.getByText(/week 12/i)).toBeInTheDocument();
    // Date string contains the year — exact format depends on locale but month/year should be present
    expect(screen.getByText(/jun(?:e)?/i)).toBeInTheDocument();
  });

  it('renders an "Upcoming event" empty hint when nextEvent is null', () => {
    render(<LeagueCard league={base} />);
    expect(screen.getByText(/no upcoming event/i)).toBeInTheDocument();
  });

  it('marks the card as private with a visible Private label when public=false', () => {
    render(<LeagueCard league={{ ...base, public: false }} />);
    expect(screen.getByText(/private/i)).toBeInTheDocument();
  });

  it('every interactive element has a focus-visible ring class for accessibility', () => {
    render(
      <LeagueCard league={{ ...base, discordInviteUrl: 'https://discord.gg/x' }} />,
    );
    const links = screen.getAllByRole('link');
    for (const link of links) {
      expect(link.className).toMatch(/focus-visible:ring/);
    }
  });
});
