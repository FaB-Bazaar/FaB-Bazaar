// components/deck/editor/tests/MobileBuildToolsPanel.test.tsx

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MobileBuildToolsPanel from '../MobileBuildToolsPanel';

const baseProps = {
  modKey: '⌘',
  ownershipFilter: 'all' as const,
  onClose: vi.fn(),
  onScrollToTop: vi.fn(),
  onScrollToSection: vi.fn(),
  onAddCards: vi.fn(),
  onOwnershipFilter: vi.fn(),
};

describe('MobileBuildToolsPanel', () => {
  it('renders header with mod key and a close button', () => {
    render(<MobileBuildToolsPanel {...baseProps} />);
    expect(screen.getByText(/build tools/i)).toBeInTheDocument();
    expect(screen.getByText('⌘K', { selector: 'kbd' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });

  it('renders Add Cards buttons for maindeck, inventory, and bench', () => {
    render(<MobileBuildToolsPanel {...baseProps} />);
    expect(screen.getByRole('button', { name: /add to maindeck/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add to inventory/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add to bench/i })).toBeInTheDocument();
  });

  it('hides the Add Cards group when the viewer cannot edit the deck', () => {
    render(<MobileBuildToolsPanel {...baseProps} canAddCards={false} />);
    expect(screen.queryByText(/add cards/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add to maindeck/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add to inventory/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add to bench/i })).not.toBeInTheDocument();
    // Navigation still available for read-only viewers
    expect(screen.getByRole('button', { name: /jump to red/i })).toBeInTheDocument();
  });

  it('renders Jump To buttons for top, red, yellow, blue', () => {
    render(<MobileBuildToolsPanel {...baseProps} />);
    expect(screen.getByRole('button', { name: /scroll to top/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /jump to red/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /jump to yellow/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /jump to blue/i })).toBeInTheDocument();
  });

  it('renders ownership filter as a tri-state with the current selection pressed', () => {
    render(<MobileBuildToolsPanel {...baseProps} ownershipFilter="owned" />);
    const ownedBtn = screen.getByRole('button', { name: 'Owned only' });
    const allBtn = screen.getByRole('button', { name: 'Show all cards' });
    const unownedBtn = screen.getByRole('button', { name: 'Unowned only' });
    expect(ownedBtn).toHaveAttribute('aria-pressed', 'true');
    expect(allBtn).toHaveAttribute('aria-pressed', 'false');
    expect(unownedBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('does NOT render filter-by-stat options (filtering is desktop-only)', () => {
    render(<MobileBuildToolsPanel {...baseProps} />);
    expect(screen.queryByText(/attack power/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/card cost/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/keyword/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/arcane damage/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/name search/i)).not.toBeInTheDocument();
  });

  it('does NOT render Switch View tab options (bottom nav handles this on mobile)', () => {
    render(<MobileBuildToolsPanel {...baseProps} />);
    expect(screen.queryByRole('button', { name: /matchups tab/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /deck tab/i })).not.toBeInTheDocument();
  });

  it('fires onAddCards("maindeck") when + Maindeck is clicked', async () => {
    const user = userEvent.setup();
    const onAddCards = vi.fn();
    render(<MobileBuildToolsPanel {...baseProps} onAddCards={onAddCards} />);
    await user.click(screen.getByRole('button', { name: /add to maindeck/i }));
    expect(onAddCards).toHaveBeenCalledWith('maindeck');
  });

  it('fires onAddCards("inventory") when + Inventory is clicked', async () => {
    const user = userEvent.setup();
    const onAddCards = vi.fn();
    render(<MobileBuildToolsPanel {...baseProps} onAddCards={onAddCards} />);
    await user.click(screen.getByRole('button', { name: /add to inventory/i }));
    expect(onAddCards).toHaveBeenCalledWith('inventory');
  });

  it('fires onAddCards("benched") when + Bench is clicked', async () => {
    const user = userEvent.setup();
    const onAddCards = vi.fn();
    render(<MobileBuildToolsPanel {...baseProps} onAddCards={onAddCards} />);
    await user.click(screen.getByRole('button', { name: /add to bench/i }));
    expect(onAddCards).toHaveBeenCalledWith('benched');
  });

  it('fires onScrollToTop when Top is clicked', async () => {
    const user = userEvent.setup();
    const onScrollToTop = vi.fn();
    render(<MobileBuildToolsPanel {...baseProps} onScrollToTop={onScrollToTop} />);
    await user.click(screen.getByRole('button', { name: /scroll to top/i }));
    expect(onScrollToTop).toHaveBeenCalledTimes(1);
  });

  it('fires onScrollToSection with the right pitch color', async () => {
    const user = userEvent.setup();
    const onScrollToSection = vi.fn();
    render(<MobileBuildToolsPanel {...baseProps} onScrollToSection={onScrollToSection} />);
    await user.click(screen.getByRole('button', { name: /jump to red/i }));
    expect(onScrollToSection).toHaveBeenCalledWith('red');
    await user.click(screen.getByRole('button', { name: /jump to yellow/i }));
    expect(onScrollToSection).toHaveBeenCalledWith('yellow');
    await user.click(screen.getByRole('button', { name: /jump to blue/i }));
    expect(onScrollToSection).toHaveBeenCalledWith('blue');
  });

  it('fires onOwnershipFilter with the chosen filter', async () => {
    const user = userEvent.setup();
    const onOwnershipFilter = vi.fn();
    render(<MobileBuildToolsPanel {...baseProps} onOwnershipFilter={onOwnershipFilter} />);
    await user.click(screen.getByRole('button', { name: 'Owned only' }));
    expect(onOwnershipFilter).toHaveBeenCalledWith('owned');
    await user.click(screen.getByRole('button', { name: 'Unowned only' }));
    expect(onOwnershipFilter).toHaveBeenCalledWith('unowned');
    await user.click(screen.getByRole('button', { name: 'Show all cards' }));
    expect(onOwnershipFilter).toHaveBeenCalledWith('all');
  });

  it('does NOT render a tile-size stepper (mobile defaults to Compact, screen space is precious)', () => {
    render(<MobileBuildToolsPanel {...baseProps} />);
    expect(screen.queryByText(/tile size/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /smaller tile/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /larger tile/i })).not.toBeInTheDocument();
  });

  it('fires onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<MobileBuildToolsPanel {...baseProps} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('every interactive button has a focus-visible ring class for accessibility', () => {
    render(<MobileBuildToolsPanel {...baseProps} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    for (const btn of buttons) {
      expect(btn.className).toMatch(/focus-visible:ring/);
    }
  });
});
