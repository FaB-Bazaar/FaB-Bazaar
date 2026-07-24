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
