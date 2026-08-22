import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// The shared card-details lightbox renders the Wants-style TCGplayer purchase
// link, which needs the cookie-consent provider + app router — not part of
// this component's contract, so stub it.
vi.mock('@/components/wants/utils', () => ({ renderPurchaseLink: vi.fn(() => null) }));

import { ImagesView } from './ImagesView';

const printing = {
  printing_id: 'p1',
  name: 'Arknight Shard',
  display_name: 'Arknight Shard',
  collector_number: 'CRU000',
  edition: 'U',
  foiling: 'S',
  image_url: 'https://img.example/arknight.png',
};

function renderView(overrides: Record<string, unknown> = {}) {
  const props = {
    printings: [printing],
    onToggleSelection: vi.fn(),
    isCardSelected: vi.fn(() => false),
    getCardQuantity: vi.fn(() => 1),
    onUpdateQuantity: vi.fn(),
    ...overrides,
  };
  render(<ImagesView {...(props as any)} />);
  return props;
}

describe('ImagesView card tile selection', () => {
  it('does not render a checkbox overlay on the card', () => {
    renderView();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('toggles selection when the card itself is clicked', async () => {
    const props = renderView();
    await userEvent.click(screen.getByRole('button', { name: /select arknight shard/i }));
    expect(props.onToggleSelection).toHaveBeenCalledTimes(1);
    expect(props.onToggleSelection).toHaveBeenCalledWith(printing);
  });

  it('does not open any dialog when the card is clicked (no flip popover)', async () => {
    renderView();
    await userEvent.click(screen.getByRole('button', { name: /select arknight shard/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('toggles selection from the keyboard with Enter and Space', async () => {
    const props = renderView();
    const tile = screen.getByRole('button', { name: /select arknight shard/i });
    tile.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(props.onToggleSelection).toHaveBeenCalledTimes(2);
  });

  it('exposes selected state via aria-pressed and a visible check badge', () => {
    renderView({ isCardSelected: vi.fn(() => true) });
    const tile = screen.getByRole('button', { name: /select arknight shard/i });
    expect(tile).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('selected-badge')).toBeInTheDocument();
  });

  it('shows no check badge and aria-pressed=false when not selected', () => {
    renderView();
    const tile = screen.getByRole('button', { name: /select arknight shard/i });
    expect(tile).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('selected-badge')).not.toBeInTheDocument();
  });

  it('renders no selection target when selection callbacks are absent', () => {
    renderView({
      onToggleSelection: undefined,
      isCardSelected: undefined,
      getCardQuantity: undefined,
      onUpdateQuantity: undefined,
    });
    expect(screen.queryByRole('button', { name: /select arknight shard/i })).not.toBeInTheDocument();
  });
});

describe('ImagesView card preview', () => {
  it('opens a preview dialog from the magnifier button without toggling selection', async () => {
    const props = renderView();
    await userEvent.click(screen.getByRole('button', { name: /preview arknight shard/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(props.onToggleSelection).not.toHaveBeenCalled();
  });

  it('closes the preview with Escape', async () => {
    renderView();
    await userEvent.click(screen.getByRole('button', { name: /preview arknight shard/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the preview when the backdrop is clicked', async () => {
    renderView();
    await userEvent.click(screen.getByRole('button', { name: /preview arknight shard/i }));
    await userEvent.click(screen.getByTestId('card-lightbox'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('still offers the preview when selection is disabled', async () => {
    renderView({
      onToggleSelection: undefined,
      isCardSelected: undefined,
      getCardQuantity: undefined,
      onUpdateQuantity: undefined,
    });
    await userEvent.click(screen.getByRole('button', { name: /preview arknight shard/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('ImagesView info badge edition', () => {
  it('abbreviates the Normal edition to N so it fits narrow mobile tiles', () => {
    renderView({ printings: [{ ...printing, edition: 'N' }] });
    expect(screen.queryByText('Normal')).not.toBeInTheDocument();
    expect(screen.getByTitle('Normal')).toHaveTextContent(/^N$/);
  });

  it('keeps abbreviating First Edition and Unlimited', () => {
    renderView({
      printings: [
        { ...printing, printing_id: 'p-first', edition: 'F' },
        { ...printing, printing_id: 'p-unl', edition: 'U' },
      ],
    });
    expect(screen.getByText('1st')).toBeInTheDocument();
    expect(screen.getByText('UNL')).toBeInTheDocument();
  });
});

describe('ImagesView language flag', () => {
  it('shows flag + code for a localized printing in the info badge', () => {
    renderView({ printings: [{ ...printing, language: 'fr' }] });
    expect(screen.getByText('FR')).toBeInTheDocument();
    expect(screen.getByText('🇫🇷')).toBeInTheDocument();
  });

  it('treats a missing language as English', () => {
    renderView({ printings: [{ ...printing, language: undefined }] });
    expect(screen.getByText('EN')).toBeInTheDocument();
    expect(screen.getByText('🇬🇧')).toBeInTheDocument();
  });
});
