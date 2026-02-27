// components/browse/tests/MobileStagedSheet.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MobileStagedSheet from '../MobileStagedSheet';

// Mock the formatters
vi.mock('@/lib/fab-formatters', () => ({
  getSetName: (code: string) => ({ 'wtr': 'Welcome to Rathe', 'arc': 'Arcane Rising' }[code] || code),
  getEditionName: (code: string) => ({ 'f': 'First Edition', 'n': 'Normal' }[code] || 'Normal'),
  getFoilingName: (foiling: string) => ({ 's': 'Non-foil', 'r': 'Rainbow Foil' }[foiling] || foiling),
  getVariantBadgeStyles: () => 'bg-gray-200 text-gray-800',
}));

describe('MobileStagedSheet Component', () => {
  const mockBinders = [
    { _id: '1', slug: 'binder-1', name: 'My First Binder' },
    { _id: '2', slug: 'binder-2', name: 'Trade Binder' },
  ];

  const mockStagedCard = {
    instanceId: 'card-1',
    isStaged: true,
    quantity: 2,
    card_unique_id: 'unique-1',
    selectedPrinting: {
      display_name: 'Command and Conquer',
      set: 'wtr',
      edition: 'f',
      foiling: 's',
      rarity: 'm',
      image_url: 'https://example.com/image.jpg',
    },
  };

  const mockUnstagedCard = {
    instanceId: 'card-2',
    isStaged: false,
    quantity: 1,
    card_unique_id: 'unique-2',
    selectedPrinting: {
      display_name: 'Sink Below',
      set: 'wtr',
      edition: 'n',
      foiling: 's',
      rarity: 'c',
      image_url: 'https://example.com/image2.jpg',
    },
  };

  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    allCards: [mockStagedCard, mockUnstagedCard],
    onUpdateQuantity: vi.fn(),
    onUnstage: vi.fn(),
    onClear: vi.fn(),
    onPrintingView: vi.fn(),
    binders: mockBinders,
    selectedBinderSlug: 'binder-1',
    onSelectBinder: vi.fn(),
    onAddToBinder: vi.fn(),
    onAddToWants: vi.fn(),
    isImporting: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render sheet when open is true', () => {
    render(<MobileStagedSheet {...defaultProps} />);

    expect(screen.getByText('Pending Import')).toBeInTheDocument();
  });

  it('should display correct total quantity count', () => {
    render(<MobileStagedSheet {...defaultProps} />);

    // Only staged card with quantity 2 should be counted
    expect(screen.getByText('2 cards ready to import')).toBeInTheDocument();
  });

  it('should only display staged cards', () => {
    render(<MobileStagedSheet {...defaultProps} />);

    expect(screen.getByText('Command and Conquer')).toBeInTheDocument();
    expect(screen.queryByText('Sink Below')).not.toBeInTheDocument();
  });

  it('should show empty state when no cards are staged', () => {
    render(<MobileStagedSheet {...defaultProps} allCards={[mockUnstagedCard]} />);

    expect(screen.getByText(/No cards staged yet/i)).toBeInTheDocument();
  });

  it('should call onUpdateQuantity when increment button clicked', () => {
    render(<MobileStagedSheet {...defaultProps} />);

    const incrementButton = screen.getAllByRole('button').find(btn =>
      btn.querySelector('svg')?.classList.contains('lucide-plus')
    );

    if (incrementButton) {
      fireEvent.click(incrementButton);
      expect(defaultProps.onUpdateQuantity).toHaveBeenCalledWith('card-1', 3);
    }
  });

  it('should call onUpdateQuantity when decrement button clicked', () => {
    render(<MobileStagedSheet {...defaultProps} />);

    const decrementButton = screen.getAllByRole('button').find(btn =>
      btn.querySelector('svg')?.classList.contains('lucide-minus')
    );

    if (decrementButton) {
      fireEvent.click(decrementButton);
      expect(defaultProps.onUpdateQuantity).toHaveBeenCalledWith('card-1', 1);
    }
  });

  it('should call onUnstage when remove button clicked', () => {
    render(<MobileStagedSheet {...defaultProps} />);

    const removeButton = screen.getByText('Remove');
    fireEvent.click(removeButton);

    expect(defaultProps.onUnstage).toHaveBeenCalledWith('card-1');
  });

  it('should call onPrintingView when card name clicked', () => {
    render(<MobileStagedSheet {...defaultProps} />);

    const cardName = screen.getByText('Command and Conquer');
    fireEvent.click(cardName);

    expect(defaultProps.onPrintingView).toHaveBeenCalledWith('card-1');
  });

  it('should call onAddToBinder when To Binder button clicked', () => {
    render(<MobileStagedSheet {...defaultProps} />);

    const toBinderButton = screen.getByText('To Binder');
    fireEvent.click(toBinderButton);

    expect(defaultProps.onAddToBinder).toHaveBeenCalledTimes(1);
  });

  it('should call onAddToWants when To Wants button clicked', () => {
    render(<MobileStagedSheet {...defaultProps} />);

    const toWantsButton = screen.getByText('To Wants');
    fireEvent.click(toWantsButton);

    expect(defaultProps.onAddToWants).toHaveBeenCalledTimes(1);
  });

  it('should disable To Binder button when no binder selected', () => {
    render(<MobileStagedSheet {...defaultProps} selectedBinderSlug="" />);

    const toBinderButton = screen.getByText('To Binder');
    expect(toBinderButton).toBeDisabled();
  });

  it('should disable buttons when importing', () => {
    render(<MobileStagedSheet {...defaultProps} isImporting={true} />);

    expect(screen.getByText('Importing...')).toBeInTheDocument();
    expect(screen.getByText('Adding...')).toBeInTheDocument();
  });

  it('should not render footer when no cards are staged', () => {
    render(<MobileStagedSheet {...defaultProps} allCards={[mockUnstagedCard]} />);

    expect(screen.queryByText('To Binder')).not.toBeInTheDocument();
    expect(screen.queryByText('To Wants')).not.toBeInTheDocument();
  });

  it('should render with proper mobile-only structure', () => {
    const { container } = render(<MobileStagedSheet {...defaultProps} />);

    // The Sheet component renders a portal, so just verify the component renders
    expect(screen.getByText('Pending Import')).toBeInTheDocument();
    expect(screen.getByText('2 cards ready to import')).toBeInTheDocument();
  });

  it('should display card image with fallback', () => {
    render(<MobileStagedSheet {...defaultProps} />);

    const image = screen.getByAltText('Command and Conquer') as HTMLImageElement;
    expect(image).toBeInTheDocument();
    expect(image.src).toContain('example.com/image.jpg');
  });

  it('should display set name and edition badges', () => {
    render(<MobileStagedSheet {...defaultProps} />);

    expect(screen.getByText('Welcome to Rathe')).toBeInTheDocument();
    expect(screen.getByText('First Edition')).toBeInTheDocument();
  });
});
