// components/deck/editor/tests/DeckRightRail.test.tsx

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import DeckRightRail from '../DeckRightRail';

describe('DeckRightRail', () => {
  const baseProps = {
    ownedCount: 5,
    totalCount: 80,
  };

  it('renders an aside landmark labelled "Deck overview"', () => {
    render(<DeckRightRail {...baseProps} />);
    expect(screen.getByRole('complementary', { name: /deck overview/i })).toBeInTheDocument();
  });

  it('renders the CollectionProgressBar with owned/total summary', () => {
    const { container } = render(<DeckRightRail {...baseProps} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '5');
    expect(container.textContent).toMatch(/5 \/ 80 cards owned/i);
  });

  it('hides on small screens via responsive class on the aside', () => {
    render(<DeckRightRail {...baseProps} />);
    const aside = screen.getByRole('complementary', { name: /deck overview/i });
    // Desktop-only sidebar: hidden by default, shown at xl breakpoint
    expect(aside.className).toMatch(/hidden/);
    expect(aside.className).toMatch(/(xl|lg):block/);
  });

  it('renders an extra slot when provided (e.g. matchups / results panels)', () => {
    render(
      <DeckRightRail {...baseProps} extra={<div data-testid="extra-panel">Matchups</div>} />
    );
    expect(screen.getByTestId('extra-panel')).toBeInTheDocument();
  });

  it('renders a hovered card preview when hoveredCard is provided', () => {
    render(
      <DeckRightRail
        {...baseProps}
        hoveredCard={{ url: 'https://example.com/blast.png', name: 'Blast to Oblivion' }}
      />
    );
    const img = screen.getByAltText(/blast to oblivion/i) as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toContain('blast.png');
  });

  it('does not render a card preview when hoveredCard is null', () => {
    render(<DeckRightRail {...baseProps} hoveredCard={null} />);
    expect(screen.queryByLabelText(/card preview/i)).not.toBeInTheDocument();
  });
});
