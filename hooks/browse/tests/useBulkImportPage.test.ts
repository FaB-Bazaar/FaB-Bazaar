// hooks/browse/tests/useBulkImportPage.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBulkImportPage } from '../useBulkImportPage';

// Mock dependencies
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
  }),
}));

vi.mock('@/lib/browse/parsers/bulk-input-parser', () => ({
  parseBulkInput: vi.fn((input: string) => [
    { name: 'Command and Conquer', quantity: 1, isPartialMatch: false },
  ]),
}));

vi.mock('@/lib/browse/utils', () => ({
  selectDefaultPrinting: vi.fn(({ printings }) => printings[0]),
}));

vi.mock('@/lib/fab-formatters', () => ({
  getSetName: vi.fn((code: string) => code),
}));

global.fetch = vi.fn();

describe('useBulkImportPage Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockReset();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useBulkImportPage());

    expect(result.current.state.bulkInput).toBe('');
    expect(result.current.state.bulkResults).toEqual([]);
    expect(result.current.state.loading).toBe(false);
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.isImporting).toBe(false);
  });

  it('should update bulk input when setBulkInput is called', () => {
    const { result } = renderHook(() => useBulkImportPage());

    act(() => {
      result.current.handlers.setBulkInput('Command and Conquer');
    });

    expect(result.current.state.bulkInput).toBe('Command and Conquer');
  });

  it('should toggle staged status of a card', () => {
    const { result } = renderHook(() => useBulkImportPage());

    // Setup initial state with a card
    act(() => {
      result.current.state.bulkResults = [
        {
          instanceId: 'card-1',
          isStaged: false,
          card_unique_id: 'unique-1',
          quantity: 1,
        },
      ];
    });

    act(() => {
      result.current.handlers.toggleStagedStatus('card-1');
    });

    const card = result.current.state.bulkResults.find(c => c.instanceId === 'card-1');
    expect(card?.isStaged).toBe(true);
  });

  it('should update card quantity', () => {
    const { result } = renderHook(() => useBulkImportPage());

    // Manually set initial state
    result.current.state.bulkResults = [
      {
        instanceId: 'card-1',
        quantity: 1,
        card_unique_id: 'unique-1',
      },
    ];

    act(() => {
      result.current.handlers.updateCardQuantity('card-1', 5);
    });

    const card = result.current.state.bulkResults.find(c => c.instanceId === 'card-1');
    expect(card?.quantity).toBe(5);
  });

  it('should enforce minimum quantity of 1', () => {
    const { result } = renderHook(() => useBulkImportPage());

    result.current.state.bulkResults = [
      {
        instanceId: 'card-1',
        quantity: 2,
        card_unique_id: 'unique-1',
      },
    ];

    act(() => {
      result.current.handlers.updateCardQuantity('card-1', -5);
    });

    const card = result.current.state.bulkResults.find(c => c.instanceId === 'card-1');
    expect(card?.quantity).toBe(1);
  });

  it('should toggle forTrade status', () => {
    const { result } = renderHook(() => useBulkImportPage());

    result.current.state.bulkResults = [
      {
        instanceId: 'card-1',
        forTrade: true,
        card_unique_id: 'unique-1',
      },
    ];

    act(() => {
      result.current.handlers.toggleForTrade('card-1');
    });

    const card = result.current.state.bulkResults.find(c => c.instanceId === 'card-1');
    expect(card?.forTrade).toBe(false);
  });

  it('should remove card from results', () => {
    const { result } = renderHook(() => useBulkImportPage());

    result.current.state.bulkResults = [
      { instanceId: 'card-1', card_unique_id: 'unique-1' },
      { instanceId: 'card-2', card_unique_id: 'unique-2' },
    ];

    act(() => {
      result.current.handlers.removeCard('card-1');
    });

    expect(result.current.state.bulkResults).toHaveLength(1);
    expect(result.current.state.bulkResults[0].instanceId).toBe('card-2');
  });

  it('should duplicate card with new instanceId', () => {
    const { result } = renderHook(() => useBulkImportPage());

    result.current.state.bulkResults = [
      {
        instanceId: 'card-1',
        card_unique_id: 'unique-1',
        quantity: 3,
        isStaged: true,
      },
    ];

    act(() => {
      result.current.handlers.duplicateCard('card-1');
    });

    expect(result.current.state.bulkResults).toHaveLength(2);

    const duplicate = result.current.state.bulkResults[1];
    expect(duplicate.instanceId).not.toBe('card-1');
    expect(duplicate.card_unique_id).toBe('unique-1');
    expect(duplicate.quantity).toBe(1); // Duplicates start with quantity 1
    expect(duplicate.isStaged).toBe(false); // Duplicates are not staged
  });

  it('should clear staged status for all cards', () => {
    const { result } = renderHook(() => useBulkImportPage());

    result.current.state.bulkResults = [
      { instanceId: 'card-1', isStaged: true, card_unique_id: 'unique-1' },
      { instanceId: 'card-2', isStaged: true, card_unique_id: 'unique-2' },
    ];

    act(() => {
      result.current.handlers.clearStaged();
    });

    result.current.state.bulkResults.forEach(card => {
      expect(card.isStaged).toBe(false);
    });
  });

  it('should update card printing', () => {
    const { result } = renderHook(() => useBulkImportPage());

    const newPrinting = {
      printing_id: 'new-printing',
      display_name: 'New Printing',
      set: 'arc',
    };

    result.current.state.bulkResults = [
      {
        instanceId: 'card-1',
        selectedPrinting: { printing_id: 'old-printing' },
        card_unique_id: 'unique-1',
      },
    ];

    act(() => {
      result.current.handlers.updateCardPrinting('card-1', newPrinting);
    });

    const card = result.current.state.bulkResults.find(c => c.instanceId === 'card-1');
    expect(card?.selectedPrinting.printing_id).toBe('new-printing');
  });

  it('should set selected binder slug', () => {
    const { result } = renderHook(() => useBulkImportPage());

    act(() => {
      result.current.handlers.setSelectedBinderSlug('my-binder');
    });

    expect(result.current.state.selectedBinderSlug).toBe('my-binder');
  });
});
