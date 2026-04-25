// components/deck/editor/tests/CollectionProgressBar.test.tsx

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CollectionProgressBar from '../CollectionProgressBar';

describe('CollectionProgressBar', () => {
  it('renders "X / Y Cards Owned" summary text', () => {
    const { container } = render(<CollectionProgressBar ownedCount={5} totalCount={80} />);
    expect(container.textContent).toMatch(/5 \/ 80 cards owned/i);
  });

  it('exposes accessible progressbar with correct value/min/max', () => {
    render(<CollectionProgressBar ownedCount={20} totalCount={80} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '20');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '80');
  });

  it('renders the same number of segments as totalCount (clamped to a max for performance)', () => {
    const { container } = render(<CollectionProgressBar ownedCount={3} totalCount={10} />);
    expect(container.querySelectorAll('[data-segment]')).toHaveLength(10);
  });

  it('marks the first ownedCount segments as filled', () => {
    const { container } = render(<CollectionProgressBar ownedCount={3} totalCount={10} />);
    const filled = container.querySelectorAll('[data-segment="filled"]');
    const empty = container.querySelectorAll('[data-segment="empty"]');
    expect(filled).toHaveLength(3);
    expect(empty).toHaveLength(7);
  });

  it('handles empty deck without crashing', () => {
    const { container } = render(<CollectionProgressBar ownedCount={0} totalCount={0} />);
    expect(container.textContent).toMatch(/0 \/ 0 cards owned/i);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '0');
  });

  it('caps owned at totalCount even when input exceeds it', () => {
    const { container } = render(<CollectionProgressBar ownedCount={100} totalCount={10} />);
    expect(container.querySelectorAll('[data-segment="filled"]')).toHaveLength(10);
    expect(container.querySelectorAll('[data-segment="empty"]')).toHaveLength(0);
  });
});
