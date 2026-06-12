// app/admin/sets/SetsOrderClient.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SetsOrderClient } from './SetsOrderClient';

const SETS = [
  {
    code: 'arc', displayCode: 'ARC', name: 'Arcane Rising', releaseDate: '2020-03-27',
    releaseOrder: 30, displayOrder: 20, category: 'standard', tier: 1, isCore: true,
    hasFirstEdition: true, unlimitedBeforeFirst: true, defaultRarity: null, imageId: null,
  },
  {
    code: 'wtr', displayCode: 'WTR', name: 'Welcome to Rathe', releaseDate: '2019-10-11',
    releaseOrder: 20, displayOrder: 10, category: 'standard', tier: 1, isCore: true,
    hasFirstEdition: true, unlimitedBeforeFirst: true, defaultRarity: null, imageId: null,
  },
  {
    code: 'asr', displayCode: 'ASR', name: 'Armory Deck: Ira', releaseDate: '2025-07-11',
    releaseOrder: 990, displayOrder: 1040, category: 'armory', tier: 4, isCore: false,
    hasFirstEdition: false, unlimitedBeforeFirst: false, defaultRarity: null, imageId: null,
  },
] as any[];

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const rowNames = () =>
  screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[2].textContent);

describe('SetsOrderClient', () => {
  it('renders sets sorted by displayOrder regardless of input order', () => {
    render(<SetsOrderClient initialSets={SETS} />);
    expect(rowNames()).toEqual(['Welcome to Rathe', 'Arcane Rising', 'Armory Deck: Ira']);
  });

  it('moves a set down one position and enables saving', () => {
    render(<SetsOrderClient initialSets={SETS} />);
    const save = screen.getByRole('button', { name: /save order/i });
    expect(save).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /move welcome to rathe down/i }));

    expect(rowNames()).toEqual(['Arcane Rising', 'Welcome to Rathe', 'Armory Deck: Ira']);
    expect(save).toBeEnabled();
  });

  it('saves the full renumbered order (spaced by 10) via PUT', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { updated: 3 } }),
    } as any);

    render(<SetsOrderClient initialSets={SETS} />);
    fireEvent.click(screen.getByRole('button', { name: /move welcome to rathe down/i }));
    fireEvent.click(screen.getByRole('button', { name: /save order/i }));

    expect(mockFetch).toHaveBeenCalledWith('/api/admin/sets/order', expect.objectContaining({ method: 'PUT' }));
    const body = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
    expect(body.orders).toEqual([
      { code: 'arc', displayOrder: 10 },
      { code: 'wtr', displayOrder: 20 },
      { code: 'asr', displayOrder: 30 },
    ]);
    // Saved state disables the button again
    expect(await screen.findByRole('button', { name: /save order/i })).toBeDisabled();
  });

  it('shows the regenerate-snapshot reminder', () => {
    render(<SetsOrderClient initialSets={SETS} />);
    expect(screen.getByText(/generate-set-constants/)).toBeInTheDocument();
  });
});
