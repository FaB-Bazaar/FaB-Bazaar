// app/admin/image-uploads/ImageUploadsClient.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/components/shared/FoilCardImage', () => ({ default: () => null }));

import { FoilMaskEditor } from './FoilMaskEditor';

const ROW = {
  printingId: 'test-printing-id-0001',
  name: 'Herald of Protection',
  set: 'fab',
  edition: 'n',
  foiling: 'r',
  rarity: 'p',
  collectorNumber: 'FAB030',
  imageUrl: null,
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

const rowWith = (overrides: Record<string, unknown>) => ({ ...ROW, ...overrides });

const TEMPLATES = [
  { id: 't1', name: 'Standard frame — WTR', top: 12, right: 9.5, bottom: 39.5, left: 9.5, round: '1.5%', notes: null, sortOrder: 10 },
  { id: 't2', name: 'Full art / hero', top: 0, right: 0, bottom: 0, left: 0, round: '1.5%', notes: null, sortOrder: 80 },
];

/** Records every fetch and answers by URL so assertions can inspect calls. */
function stubFetch() {
  const calls: Array<{ url: string; body: any }> = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ url, body });

    if (url.includes('/foil-mask/bulk') && body?.dryRun) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: { wouldUpdate: 11383, skippedLocked: 9, skippedAlreadySet: 1810, setCount: 74, sample: [] },
        }),
      } as any;
    }
    return { ok: true, json: async () => ({ success: true, updated: 3, data: { opId: 'op1', updated: 3, skippedLocked: 0 } }) } as any;
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

const applyCalls = (calls: Array<{ url: string; body: any }>) =>
  calls.filter(c => c.url.includes('/foil-mask/bulk') && !c.body?.dryRun);

beforeEach(() => {
  stubFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FoilMaskEditor inset number inputs', () => {
  it('accepts a multi-digit value typed key by key (e.g. "10") without losing focus', async () => {
    const user = userEvent.setup();
    render(<FoilMaskEditor rows={[ROW]} templates={[]} onClose={vi.fn()} onSaved={vi.fn()} />);

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

describe('FoilMaskEditor — single card', () => {
  it('offers only unset-only bulk applies — no destructive overwrite button', () => {
    render(<FoilMaskEditor rows={[ROW]} templates={[]} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByRole('button', { name: /apply to unset cards/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /apply globally/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /overwrite/i })).not.toBeInTheDocument();
  });

  it('dry-runs a broad apply and waits for confirmation before writing anything', async () => {
    const user = userEvent.setup();
    const calls = stubFetch();
    render(<FoilMaskEditor rows={[ROW]} templates={[]} onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /apply to unset cards/i }));

    // The count from the dry run must be on screen before any write happens.
    await screen.findByRole('button', { name: /apply to 11,383 printings/i });
    expect(calls.some(c => c.body?.dryRun === true)).toBe(true);
    expect(applyCalls(calls)).toHaveLength(0);
  });

  it('applies only after the operator confirms the previewed count', async () => {
    const user = userEvent.setup();
    const calls = stubFetch();
    render(<FoilMaskEditor rows={[ROW]} templates={[]} onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /apply to unset cards/i }));
    await screen.findByRole('button', { name: /apply to 11,383 printings/i });
    await user.click(screen.getByRole('button', { name: /apply to 11,383 printings/i }));

    await waitFor(() => expect(applyCalls(calls)).toHaveLength(1));
  });

  it('abandons the apply when the operator cancels the preview', async () => {
    const user = userEvent.setup();
    const calls = stubFetch();
    render(<FoilMaskEditor rows={[ROW]} templates={[]} onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /apply to unset cards/i }));
    await screen.findByRole('button', { name: /apply to 11,383 printings/i });
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(applyCalls(calls)).toHaveLength(0);
  });
});

describe('FoilMaskEditor — selected cards', () => {
  const ROWS = [
    rowWith({ printingId: 'p1', name: 'Card One' }),
    rowWith({ printingId: 'p2', name: 'Card Two' }),
    rowWith({ printingId: 'p3', name: 'Card Three', foilInsetLocked: true }),
  ];

  it('targets exactly the selected printings, with no criteria sweep on offer', async () => {
    const user = userEvent.setup();
    const calls = stubFetch();
    render(<FoilMaskEditor rows={ROWS} templates={[]} onClose={vi.fn()} onSaved={vi.fn()} />);

    // Blast radius is on screen, so a criteria sweep would only add ambiguity.
    expect(screen.queryByRole('button', { name: /apply globally/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /apply to 3 selected/i }));

    await waitFor(() => expect(applyCalls(calls)).toHaveLength(1));
    expect(applyCalls(calls)[0].body.printingIds).toEqual(['p1', 'p2', 'p3']);
  });

  it('warns that a locked card in the selection will be skipped', () => {
    render(<FoilMaskEditor rows={ROWS} templates={[]} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByText(/1 locked card will be skipped/i)).toBeInTheDocument();
  });
});

describe('FoilMaskEditor — template rail', () => {
  it('loads a template’s values into the inset controls', async () => {
    const user = userEvent.setup();
    render(<FoilMaskEditor rows={[ROW]} templates={TEMPLATES} onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /full art \/ hero/i }));

    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs[0]).toHaveValue(0);
    expect(inputs[2]).toHaveValue(0);
  });

  it('keeps the rail out of the way when no templates exist yet', () => {
    render(<FoilMaskEditor rows={[ROW]} templates={[]} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.queryByText(/^templates$/i)).not.toBeInTheDocument();
  });
});
