import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmptyDeckHero from '../EmptyDeckHero';

const sampleKits = [
  {
    id: 'k1',
    name: 'Equipment & Weapons',
    description: 'Gear',
    cards: [
      { printingId: 'a', imageUrl: 'https://img.example/a.png' },
      { printingId: 'b', imageUrl: 'https://img.example/b.png' },
      { printingId: 'c', imageUrl: 'https://img.example/c.png' },
      { printingId: 'd', imageUrl: 'https://img.example/d.png' },
    ],
  },
  { id: 'k2', name: 'Attack Actions', description: 'Attacks', cards: Array.from({ length: 24 }, (_, i) => ({ printingId: `c${i}`, imageUrl: `https://img.example/c${i}.png` })) },
  { id: 'k3', name: 'Blocks', description: 'Defense', cards: Array.from({ length: 10 }, (_, i) => ({ printingId: `d${i}`, imageUrl: `https://img.example/d${i}.png` })) },
];

describe('EmptyDeckHero', () => {
  it('renders a "Get started" headline with the deck name', () => {
    render(<EmptyDeckHero deckName="maxx" kits={sampleKits} onKitClick={() => {}} />);
    expect(screen.getByText(/maxx/i)).toBeInTheDocument();
    expect(screen.getByText(/get started/i)).toBeInTheDocument();
  });

  it('renders a tile per starter kit', () => {
    render(<EmptyDeckHero deckName="maxx" kits={sampleKits} onKitClick={() => {}} />);
    sampleKits.forEach((k) => {
      expect(screen.getByRole('button', { name: new RegExp(k.name, 'i') })).toBeInTheDocument();
    });
  });

  it('shows the card count on each kit tile', () => {
    render(<EmptyDeckHero deckName="maxx" kits={sampleKits} onKitClick={() => {}} />);
    // Use exact text on the count line to avoid "4 cards" matching "24 cards"
    expect(screen.getByText('4 cards')).toBeInTheDocument();
    expect(screen.getByText('24 cards')).toBeInTheDocument();
    expect(screen.getByText('10 cards')).toBeInTheDocument();
  });

  it('renders mini card-art previews from the kit (up to 4 thumbnails)', () => {
    render(<EmptyDeckHero deckName="maxx" kits={sampleKits} onKitClick={() => {}} />);
    // Equipment kit has 4 cards → 4 thumbnails
    const equipKit = screen.getByRole('button', { name: /equipment & weapons/i });
    expect(equipKit.querySelectorAll('img[data-kit-thumb]')).toHaveLength(4);

    // Attack Actions has 24 cards → capped at 4 thumbnails
    const attackKit = screen.getByRole('button', { name: /attack actions/i });
    expect(attackKit.querySelectorAll('img[data-kit-thumb]')).toHaveLength(4);
  });

  it('calls onKitClick with the full kit when a tile is clicked', async () => {
    const onKitClick = vi.fn();
    render(<EmptyDeckHero deckName="maxx" kits={sampleKits} onKitClick={onKitClick} />);

    await userEvent.click(screen.getByRole('button', { name: /equipment & weapons/i }));

    expect(onKitClick).toHaveBeenCalledWith(sampleKits[0]);
  });

  it('renders a "browse all" / search escape hatch', () => {
    render(
      <EmptyDeckHero
        deckName="maxx"
        kits={sampleKits}
        onKitClick={() => {}}
        onSearchClick={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  it('shows an empty-state message when no kits exist for this hero', () => {
    render(<EmptyDeckHero deckName="maxx" kits={[]} onKitClick={() => {}} onSearchClick={() => {}} />);
    expect(screen.getByText(/no starter kits/i)).toBeInTheDocument();
    // Search escape hatch must still be present
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  it('shows skeleton placeholder tiles while kits are loading (does NOT show "no kits" message)', () => {
    const { container } = render(
      <EmptyDeckHero deckName="maxx" kits={[]} loading onKitClick={() => {}} onSearchClick={() => {}} />
    );
    expect(screen.queryByText(/no starter kits/i)).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-kit-skeleton]').length).toBeGreaterThan(0);
  });

  it('does not show skeletons once kits have loaded', () => {
    const { container } = render(
      <EmptyDeckHero deckName="maxx" kits={sampleKits} onKitClick={() => {}} />
    );
    expect(container.querySelectorAll('[data-kit-skeleton]')).toHaveLength(0);
  });
});
