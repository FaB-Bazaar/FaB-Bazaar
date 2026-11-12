import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  binderService: {
    getBinder: vi.fn(),
    createBinder: vi.fn(),
    listUserBindersSummary: vi.fn(),
    addCardsToBinder: vi.fn(),
  },
  printingsService: { searchPrintings: vi.fn() },
}));
vi.mock('@/lib/partner-api/auth', () => ({ authenticatePartner: vi.fn() }));

import { POST } from './route';
import { binderService, printingsService } from '@/lib/services';
import { authenticatePartner } from '@/lib/partner-api/auth';
import { CALLER, ctx, post } from '../../_test/helpers';

const mockAuth = vi.mocked(authenticatePartner);
const mockGetBinder = vi.mocked(binderService.getBinder);
const mockCreate = vi.mocked(binderService.createBinder);
const mockSummary = vi.mocked(binderService.listUserBindersSummary);
const mockAdd = vi.mocked(binderService.addCardsToBinder);
const mockSearch = vi.mocked(printingsService.searchPrintings);

const printing = (over: Record<string, unknown>) => ({
  printing_id: 'p-1',
  collector_number: 'WTR167',
  edition: 'u',
  foiling: 's',
  language: 'en',
  art_variations: [],
  is_front_face: true,
  ...over,
});

function searchReturns(rows: unknown[]) {
  mockSearch.mockResolvedValue({ success: true, data: { printings: rows } } as never);
}

function addSucceeds(added: number, failed = 0) {
  mockAdd.mockResolvedValue({
    success: true,
    data: { summary: { total: added + failed, added, updated: 0, failed, filtered: 0 }, results: [] },
  } as never);
}

describe('POST /api/partner/v1/collection/import', () => {
  beforeEach(() => {
    for (const m of [mockAuth, mockGetBinder, mockCreate, mockSummary, mockAdd, mockSearch]) m.mockReset();
    mockAuth.mockResolvedValue(CALLER);
    mockSummary.mockResolvedValue({ success: true, data: [] } as never);
    mockCreate.mockImplementation(async (_userId, data) =>
      ({ success: true, data: { _id: 'b-new', name: data.name, userId: 'user-1' } }) as never,
    );
  });

  it('creates a private binder and adds the resolved cards', async () => {
    searchReturns([printing({})]);
    addSucceeds(1);

    const response = await POST(
      post('/collection/import', {
        binder_name: 'From Nanza',
        items: [{ collector_number: 'WTR167', foiling: 'standard', quantity: 2, for_trade: true }],
      }),
      ctx({}),
    );

    expect(mockAuth).toHaveBeenCalledWith(expect.anything(), 'collection:write');
    expect(mockSearch).toHaveBeenCalledWith({ collectorNumber: ['WTR167'] }, expect.anything());
    expect(mockCreate).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        name: 'From Nanza',
        visibility: expect.objectContaining({ level: 'private', allowWhoHas: false }),
      }),
    );
    expect(mockAdd).toHaveBeenCalledWith('b-new', 'user-1', [
      { printingId: 'p-1', quantity: 2, condition: 'NM', language: 'EN', forTrade: true },
    ]);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: {
        binder: { id: 'b-new', name: 'From Nanza', created: true },
        imported: 1,
        failed: 0,
        unresolved: [],
      },
    });
  });

  it('picks a free binder name when the requested one is taken', async () => {
    mockSummary.mockResolvedValue({
      success: true,
      data: [{ _id: 'b-0', name: 'from nanza' }, { _id: 'b-1', name: 'From Nanza 2' }],
    } as never);
    searchReturns([printing({})]);
    addSucceeds(1);

    await POST(post('/collection/import', { binder_name: 'From Nanza', items: [{ printing_id: 'p-1' }] }), ctx({}));

    expect(mockCreate).toHaveBeenCalledWith('user-1', expect.objectContaining({ name: 'From Nanza 3' }));
  });

  it("adds to the caller's existing binder when binder_id is given", async () => {
    mockGetBinder.mockResolvedValue({ success: true, data: { _id: 'b-9', name: 'Mine', userId: 'user-1' } } as never);
    searchReturns([printing({})]);
    addSucceeds(1);

    const response = await POST(
      post('/collection/import', { binder_id: 'b-9', items: [{ printing_id: 'p-1' }] }),
      ctx({}),
    );

    expect(mockSearch).toHaveBeenCalledWith({ printingIds: ['p-1'] }, expect.anything());
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockAdd).toHaveBeenCalledWith('b-9', 'user-1', expect.any(Array));
    expect((await response.json()).data.binder).toEqual({ id: 'b-9', name: 'Mine', created: false });
  });

  it("answers 404 for a binder_id that is not the caller's, adding nothing", async () => {
    mockGetBinder.mockResolvedValue({ success: true, data: { _id: 'b-9', userId: 'other' } } as never);
    searchReturns([printing({})]);

    const response = await POST(
      post('/collection/import', { binder_id: 'b-9', items: [{ printing_id: 'p-1' }] }),
      ctx({}),
    );

    expect(response.status).toBe(404);
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('imports what it can and reports the rest by position', async () => {
    searchReturns([printing({}), printing({ printing_id: 'p-rf', foiling: 'r' })]);
    addSucceeds(1);

    const response = await POST(
      post('/collection/import', {
        items: [
          { collector_number: 'WTR167' },
          { collector_number: 'WTR167', foiling: 'rainbow' },
          { collector_number: 'NOPE001' },
        ],
      }),
      ctx({}),
    );

    const body = await response.json();
    expect(mockAdd.mock.calls[0][2]).toEqual([
      { printingId: 'p-rf', quantity: 1, condition: 'NM', language: 'EN', forTrade: false },
    ]);
    expect(body.data.unresolved).toEqual([
      { index: 0, reason: 'ambiguous', candidates: ['p-1', 'p-rf'] },
      { index: 2, reason: 'not_found' },
    ]);
  });

  it('creates no binder when nothing resolves', async () => {
    searchReturns([]);

    const response = await POST(post('/collection/import', { items: [{ printing_id: 'ghost' }] }), ctx({}));

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe('nothing_resolved');
    expect(body.error.details.unresolved).toEqual([{ index: 0, reason: 'not_found' }]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('answers 400 for a body that is not JSON or has no usable items', async () => {
    expect((await POST(post('/collection/import', '{not json'), ctx({}))).status).toBe(400);
    expect((await POST(post('/collection/import', { items: [] }), ctx({}))).status).toBe(400);
    expect(mockSearch).not.toHaveBeenCalled();
  });
});
