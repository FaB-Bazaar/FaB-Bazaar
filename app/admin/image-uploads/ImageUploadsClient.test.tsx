// app/admin/image-uploads/ImageUploadsClient.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/components/shared/FoilCardImage', () => ({ default: () => null }));

import { FoilMaskEditor } from './ImageUploadsClient';

const ROW = {
  printingId: 'test-printing-id-0001',
  name: 'Herald of Protection',
  set: 'fab',
  edition: 'n',
  foiling: 'r',
  rarity: 'p',
  collectorNumber: 'FAB030',
  pitch: 2,
  isExtendedArt: true,
  artVariations: null,
  foilInsetTop: null,
  foilInsetRight: null,
  foilInsetBottom: null,
  foilInsetLeft: null,
  foilInsetRound: null,
  foilInsetLocked: false,
  tcgplayerProductId: null,
  tcgplayerUrl: null,
  tcgplayerSubtypeName: null,
} as any;

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FoilMaskEditor inset number inputs', () => {
  it('accepts a multi-digit value typed key by key (e.g. "10") without losing focus', async () => {
    const user = userEvent.setup();
    render(<FoilMaskEditor row={ROW} onClose={vi.fn()} onSaved={vi.fn()} />);

    const topInput = screen.getAllByRole('spinbutton')[0];
    await user.click(topInput);
    await user.clear(topInput);
    // Type via the keyboard (goes to whatever is focused) — a remounting
    // input drops focus after the first digit, so "0" would go nowhere.
    await user.keyboard('10');

    const topInputNow = screen.getAllByRole('spinbutton')[0];
    expect(topInputNow).toHaveValue(10);
    expect(topInputNow).toHaveFocus();
  });
});

describe('FoilMaskEditor bulk actions', () => {
  it('offers only unset-only bulk applies — no destructive overwrite button', () => {
    render(<FoilMaskEditor row={ROW} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByRole('button', { name: /apply to unset cards/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /apply globally/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /overwrite/i })).not.toBeInTheDocument();
  });
});
