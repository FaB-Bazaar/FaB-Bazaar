import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import KitPoolCard from './KitPoolCard';
import type { PoolCard } from '@/lib/utils/card-pool';

function poolCard(overrides: Partial<PoolCard> = {}): PoolCard {
  return {
    cardUniqueId: 'cu1',
    displayName: 'Surging Strike',
    rarity: 'Rare',
    rarityCode: 'r',
    types: ['action', 'attack'],
    keywords: [],
    printingId: 'p1',
    comment: null,
    rawCount: 3,
    cappedCount: 3,
    cap: 3,
    sources: [{ listId: 'l1', listName: 'Core', heroName: 'katsu, the wanderer', count: 3 }],
    facetTags: [],
    ...overrides,
  };
}

const FACET_DEFS = {
  'combo-enabler': { label: 'Combo enabler', def: 'Sets up multi-card turns.', dim: 'strategic' },
  'go-again': { label: 'Go again', def: 'Grants an extra action point.', dim: 'mechanical' },
};

describe('KitPoolCard facet tags', () => {
  it('renders a chip per facet tag using the vocabulary label', () => {
    render(
      <KitPoolCard
        card={poolCard({ facetTags: ['combo-enabler', 'go-again'] })}
        formatSlug="cc"
        facetDefs={FACET_DEFS}
      />
    );
    expect(screen.getByText('Combo enabler')).toBeInTheDocument();
    expect(screen.getByText('Go again')).toBeInTheDocument();
  });

  it('exposes the tag definition as a tooltip so users see WHY the card is in the kit', () => {
    render(
      <KitPoolCard
        card={poolCard({ facetTags: ['combo-enabler'] })}
        formatSlug="cc"
        facetDefs={FACET_DEFS}
      />
    );
    expect(screen.getByText('Combo enabler')).toHaveAttribute('title', 'Sets up multi-card turns.');
  });

  it('falls back to the raw tag id when the vocabulary has no entry', () => {
    render(
      <KitPoolCard
        card={poolCard({ facetTags: ['unmapped-tag'] })}
        formatSlug="cc"
        facetDefs={FACET_DEFS}
      />
    );
    expect(screen.getByText('unmapped-tag')).toBeInTheDocument();
  });

  it('renders no chip region for a card without facet tags', () => {
    render(<KitPoolCard card={poolCard()} formatSlug="cc" facetDefs={FACET_DEFS} />);
    expect(screen.queryByText('Combo enabler')).not.toBeInTheDocument();
  });

  it('renders tags even when no vocabulary map is provided', () => {
    render(<KitPoolCard card={poolCard({ facetTags: ['combo-enabler'] })} formatSlug="cc" />);
    expect(screen.getByText('combo-enabler')).toBeInTheDocument();
  });
});

describe('KitPoolCard pricing', () => {
  const priced = () =>
    poolCard({ tcgMarket: 107.18, tcgHigh: 209.0, tcgMid: 129.99, tcgLow: 108.68 });

  it('shows only the TCG Low price', () => {
    render(<KitPoolCard card={priced()} formatSlug="cc" />);
    expect(screen.getByText('TCG Low:')).toBeInTheDocument();
    expect(screen.getByText('$108.68')).toBeInTheDocument();
    expect(screen.queryByText('Market:')).not.toBeInTheDocument();
    expect(screen.queryByText('High:')).not.toBeInTheDocument();
    expect(screen.queryByText('Mid:')).not.toBeInTheDocument();
  });

  it('renders no price line when tcgLow is missing', () => {
    render(<KitPoolCard card={poolCard()} formatSlug="cc" />);
    expect(screen.queryByText('TCG Low:')).not.toBeInTheDocument();
  });
});

describe('KitPoolCard image sizing', () => {
  // The image gets an explicit card-aspect box (63/88) filled with w/h-full.
  // Relying on max-h percentage resolution rendered foil and non-foil cards
  // differently on iOS Safari (foil path: cropped full-width; non-foil:
  // letterboxed) — explicit box dimensions behave identically in both paths.
  it('constrains the card image to an explicit 63/88 aspect box', () => {
    render(<KitPoolCard card={poolCard()} formatSlug="cc" />);
    const img = screen.getByAltText('Surging Strike');
    expect(img.className).toContain('object-contain');
    expect(img.className).toContain('w-full');
    expect(img.className).toContain('h-full');
    const aspectBox = img.closest('[class*="aspect-[63/88]"]');
    expect(aspectBox).not.toBeNull();
  });
});
