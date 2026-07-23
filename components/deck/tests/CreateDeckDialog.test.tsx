// components/deck/tests/CreateDeckDialog.test.tsx
//
// Mobile keyboard behavior for the hero picker (step 1):
// - On touch devices the search input must NOT be auto-focused when the dialog
//   opens — auto-focus summons the on-screen keyboard, covering the hero list
//   the user is trying to scroll.
// - On fine-pointer (desktop) devices auto-focus is kept: type-to-search is the
//   expected flow there.
// - If the user did tap into search, touch-scrolling the hero list blurs it so
//   the keyboard gets out of the way.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CreateDeckDialog from '../CreateDeckDialog';

vi.mock('@/hooks/banned-cards/useExcludedHeroes', () => ({
  useExcludedHeroes: () => new Map(),
}));

const HEROES = [
  {
    cardUniqueId: 'hero-brutus',
    displayName: 'Brutus, Summa Rudis',
    klass: 'adjudicator',
    types: ['adjudicator'],
    imageUrl: null,
    ccLegal: true,
  },
  {
    cardUniqueId: 'hero-taipanis',
    displayName: 'Taipanis, Dracai of Judgement',
    klass: 'adjudicator',
    types: ['adjudicator', 'draconic'],
    imageUrl: null,
    ccLegal: true,
  },
];

const mockMatchMedia = (coarsePointer: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(pointer: coarse)' ? coarsePointer : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as any;
};

// cmdk scrolls the selected item into view and observes list size; jsdom has
// neither scrollIntoView nor ResizeObserver.
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true, data: HEROES }),
    })
  ) as any;
});

/**
 * Mount closed, then open — mirrors real usage, where the dialog component is
 * mounted with the page (so useIsTouchDevice has already resolved) and only
 * later opened by the "Create New Deck" button.
 */
async function openDialog() {
  const props = {
    onOpenChange: vi.fn(),
    onCreateDeck: vi.fn().mockResolvedValue(undefined),
  };
  const view = render(<CreateDeckDialog open={false} {...props} />);
  view.rerender(<CreateDeckDialog open={true} {...props} />);
  // Heroes fetched + rendered
  await waitFor(() => {
    expect(screen.getByText('Brutus, Summa Rudis')).toBeInTheDocument();
  });
  return screen.getByPlaceholderText(/Search by name, class, or talent/i);
}

describe('CreateDeckDialog hero search keyboard behavior', () => {
  it('does not auto-focus the search input on touch devices', async () => {
    mockMatchMedia(true);
    const input = await openDialog();
    expect(input).not.toHaveFocus();
  });

  it('auto-focuses the search input on fine-pointer (desktop) devices', async () => {
    mockMatchMedia(false);
    const input = await openDialog();
    expect(input).toHaveFocus();
  });

  it('blurs the search input when the hero list is touch-scrolled', async () => {
    mockMatchMedia(true);
    const input = await openDialog();

    // User taps into search — keyboard up — then drags the list to scroll.
    input.focus();
    expect(input).toHaveFocus();
    // react-remove-scroll (Radix scroll lock) reads touch coordinates from
    // document-level listeners — give the synthetic event a real touch point.
    fireEvent.touchMove(screen.getByRole('listbox'), {
      touches: [{ clientX: 10, clientY: 40 }],
      changedTouches: [{ clientX: 10, clientY: 40 }],
    });

    expect(input).not.toHaveFocus();
  });
});
