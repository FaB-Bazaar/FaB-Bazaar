/**
 * Route unit tests for PATCH /api/decks/[deckId]/featured.
 *
 * Regression guard: this endpoint must accept OAuth / MCP bearer tokens so the
 * MCP create_deck / update_deck "Decks to Beat" flow can flag a deck. OAuth is
 * opt-in in authenticateRequest — the route MUST pass { allowOAuth: true }, or
 * MCP callers get a silent 401 "Authentication required".
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));
vi.mock('@/lib/services', () => ({
  deckService: {
    findByPublicId: vi.fn(),
    toggleSystemDeck: vi.fn(),
    toggleFeatured: vi.fn(),
  },
  userService: { hasRole: vi.fn() },
}));

import { PATCH } from './route';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService, userService } from '@/lib/services';

const mockAuth = vi.mocked(authenticateRequest);
const mockHasRole = vi.mocked(userService.hasRole);
const mockFindByPublicId = vi.mocked(deckService.findByPublicId);
const mockToggleSystemDeck = vi.mocked(deckService.toggleSystemDeck);

function patchRequest(body: any) {
  return new Request('http://localhost/api/decks/pub1/featured', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer eyJ.fake.jwt' },
    body: JSON.stringify(body),
  }) as any;
}

describe('PATCH /api/decks/[deckId]/featured — auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes { allowOAuth: true } to authenticateRequest so MCP/OAuth tokens work', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockHasRole.mockResolvedValue({ success: true, data: true } as any);
    mockFindByPublicId.mockResolvedValue({ success: true, data: { userId: 'u1', visibility: 'public' } } as any);
    mockToggleSystemDeck.mockResolvedValue({ success: true, data: true } as any);

    const res = await PATCH(patchRequest({ isSystemDeck: true }), { params: Promise.resolve({ deckId: 'pub1' }) });

    expect(res.status).toBe(200);
    // The 3rd arg controls OAuth acceptance — must be enabled here.
    expect(mockAuth).toHaveBeenCalledWith(expect.anything(), expect.anything(), { allowOAuth: true });
  });
});
