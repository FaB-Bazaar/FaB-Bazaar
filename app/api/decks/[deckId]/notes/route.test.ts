import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  deckService: { findByPublicId: vi.fn(), updateDeck: vi.fn() },
}));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

import { GET, PUT } from './route';
import { deckService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockAuth = vi.mocked(authenticateRequest);
const mockFind = vi.mocked(deckService.findByPublicId);
const mockUpdate = vi.mocked(deckService.updateDeck);

const ctx = (deckId = 'pub1') => ({ params: Promise.resolve({ deckId }) });
const getReq = () => ({} as Parameters<typeof GET>[0]);
const putReq = (notes: unknown) => ({ json: async () => ({ notes }) } as Parameters<typeof PUT>[0]);
const putBody = (body: unknown) => ({ json: async () => body } as Parameters<typeof PUT>[0]);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'owner1' } as never);
  mockFind.mockResolvedValue({ success: true, data: { _id: 'd', userId: 'owner1', metadata: { matchups: [{ heroId: 'kassai' }], gamePlan: 'stabilize then combo' } } } as never);
  mockUpdate.mockResolvedValue({ success: true, data: {} } as never);
});

describe('GET /api/decks/[deckId]/notes', () => {
  it('401s when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'no auth' } as never);
    expect((await GET(getReq(), ctx())).status).toBe(401);
  });

  it('404s when the deck is not owned/visible to the caller', async () => {
    mockFind.mockResolvedValue({ success: true, data: null } as never);
    expect((await GET(getReq(), ctx())).status).toBe(404);
  });

  it('returns the stored game-plan notes for the owner', async () => {
    const res = await GET(getReq(), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.notes).toBe('stabilize then combo');
    expect(body.data.cardNotes).toEqual({});
  });

  it('returns per-card notes when present', async () => {
    mockFind.mockResolvedValue({ success: true, data: { _id: 'd', userId: 'owner1', metadata: { cardNotes: { 'sink below|1': 'block vs aggro' } } } } as never);
    const res = await GET(getReq(), ctx());
    const body = await res.json();
    expect(body.data.cardNotes['sink below|1']).toBe('block vs aggro');
  });
});

describe('PUT /api/decks/[deckId]/notes', () => {
  it('rejects a non-string body', async () => {
    expect((await PUT(putReq(42), ctx())).status).toBe(400);
  });

  it('saves notes without clobbering other metadata (matchups preserved)', async () => {
    const res = await PUT(putReq('new plan: race Kassai'), ctx());
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      'pub1',
      'owner1',
      { metadata: { matchups: [{ heroId: 'kassai' }], gamePlan: 'new plan: race Kassai' } }
    );
  });

  it('404s for a non-owner', async () => {
    mockFind.mockResolvedValue({ success: true, data: null } as never);
    expect((await PUT(putReq('x'), ctx())).status).toBe(404);
  });

  it('saves matchup notes keyed by opponent hero, preserving other metadata', async () => {
    const res = await PUT(
      putBody({ matchupNotes: { kassai_of_the_golden_sand: '  race the gold engine  ', dorinthea: '   ' } }),
      ctx()
    );
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith('pub1', 'owner1', {
      metadata: {
        matchups: [{ heroId: 'kassai' }],
        gamePlan: 'stabilize then combo',
        matchupNotes: { kassai_of_the_golden_sand: 'race the gold engine' }, // empty dorinthea dropped, trimmed
      },
    });
  });

  it('saves deduped per-card notes (trimmed, empties dropped), preserving other metadata', async () => {
    const res = await PUT(
      putBody({ cardNotes: { 'command and conquer|1': '  vs control  ', 'big bertha|3': '   ' } }),
      ctx()
    );
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith('pub1', 'owner1', {
      metadata: {
        matchups: [{ heroId: 'kassai' }],
        gamePlan: 'stabilize then combo',
        cardNotes: { 'command and conquer|1': 'vs control' }, // empty 'big bertha' dropped, value trimmed
      },
    });
  });
});
