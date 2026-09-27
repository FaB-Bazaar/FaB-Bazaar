/**
 * Compact set / foiling / rarity markers for dense rows (selected-cards
 * sidebar, transfer dialog) — replaces raw DB codes like "dtd", "s", "l".
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PrintingMetaChips, SetLogo } from './PrintingMetaChips';

describe('PrintingMetaChips', () => {
  it('shows the set icon, named for the set', () => {
    render(<PrintingMetaChips set="dtd" foiling="s" rarity="l" />);
    const img = screen.getByRole('img', { name: 'DTD' });
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('src')).toMatch(/\/public$/);
    expect(img.getAttribute('title')).toBe('Dusk till Dawn');
  });

  it('shows the foiling as NF / RF / CF, not the raw code', () => {
    const { rerender } = render(<PrintingMetaChips set="dtd" foiling="s" />);
    expect(screen.getByRole('img', { name: 'Non-foil' }).textContent).toBe('NF');
    rerender(<PrintingMetaChips set="dtd" foiling="r" />);
    expect(screen.getByRole('img', { name: 'Rainbow Foil' }).textContent).toBe('RF');
    rerender(<PrintingMetaChips set="dtd" foiling="c" />);
    expect(screen.getByRole('img', { name: 'Cold Foil' }).textContent).toBe('CF');
  });

  it('shows the rarity icon, labelled with the rarity name', () => {
    render(<PrintingMetaChips set="dtd" rarity="l" />);
    expect(screen.getByTitle('Legendary')).toBeTruthy();
    expect(screen.queryByText('l')).toBeNull();
  });

  it('falls back to the upper-cased set code when the set has no icon', () => {
    render(<PrintingMetaChips set="zzz" />);
    expect(screen.queryByRole('img', { name: 'ZZZ' })).toBeNull();
    expect(screen.getByText('ZZZ')).toBeTruthy();
  });

  it('can leave the set out, for layouts that show a large SetLogo instead', () => {
    render(<PrintingMetaChips set="dtd" foiling="s" showSet={false} />);
    expect(screen.queryByRole('img', { name: 'DTD' })).toBeNull();
    expect(screen.getByRole('img', { name: 'Non-foil' })).toBeTruthy();
  });
});

describe('SetLogo', () => {
  it('renders the large set logo', () => {
    render(<SetLogo set="dtd" size="lg" />);
    const img = screen.getByRole('img', { name: 'DTD' });
    expect(img.getAttribute('title')).toBe('Dusk till Dawn');
    expect(img.className).toMatch(/h-12/);
  });
});
