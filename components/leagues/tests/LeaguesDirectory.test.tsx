import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LeaguesDirectory from '../LeaguesDirectory';
import type { LeagueWithNextEventDTO } from '@/lib/services/contracts/ILeagueService';

const makeLeague = (overrides: Partial<LeagueWithNextEventDTO>): LeagueWithNextEventDTO => ({
  id: 'lg-' + Math.random(),
  slug: 'slug-' + Math.random(),
  name: 'Untitled',
  description: null,
  format: null,
  bannerUrl: null,
  discordGuildId: null,
  discordInviteUrl: null,
  ownerId: null,
  public: true,
  scheduleSummary: null,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  nextEvent: null,
  ...overrides,
});

describe('LeaguesDirectory', () => {
  it('renders an empty-state message when given no leagues', () => {
    render(<LeaguesDirectory leagues={[]} />);
    expect(screen.getByText(/no leagues yet/i)).toBeInTheDocument();
  });

  it('renders one card per league in the input', () => {
    const leagues = [
      makeLeague({ name: 'InkBlade League', slug: 'inkblade' }),
      makeLeague({ name: 'Pit Fighter League', slug: 'pit' }),
      makeLeague({ name: 'Casual Sunday', slug: 'casual' }),
    ];
    render(<LeaguesDirectory leagues={leagues} />);
    expect(screen.getByRole('heading', { name: /inkblade league/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /pit fighter league/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /casual sunday/i })).toBeInTheDocument();
  });

  it('uses a grid layout (multiple cards align in a grid wrapper)', () => {
    const leagues = [makeLeague({ name: 'A' }), makeLeague({ name: 'B' })];
    const { container } = render(<LeaguesDirectory leagues={leagues} />);
    const grid = container.querySelector('[data-testid="leagues-grid"]');
    expect(grid).not.toBeNull();
    expect(grid!.className).toMatch(/grid/);
  });

  it('renders a heading identifying the directory', () => {
    render(<LeaguesDirectory leagues={[]} />);
    expect(screen.getByRole('heading', { name: /leagues/i, level: 1 })).toBeInTheDocument();
  });
});
