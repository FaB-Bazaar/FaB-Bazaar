import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/services', () => ({
  deckService: { listDeckPartnerShares: vi.fn(), setDeckPartnerShare: vi.fn() },
  oauthService: { listAuthorizedApps: vi.fn() },
}));

import { GET, PUT } from './route';
import { auth } from '@/auth';
import { deckService, oauthService } from '@/lib/services';
import { DECK_VERSION_NOT_EDITABLE } from '@/lib/deck/deck-versions';

const mockSession = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>;
const mockShares = vi.mocked(deckService.listDeckPartnerShares);
const mockSet = vi.mocked(deckService.setDeckPartnerShare);
const mockApps = vi.mocked(oauthService.listAuthorizedApps);

const ctx = { params: Promise.resolve({ deckId: 'pub-1' }) };
const put = (body: unknown) => new Request('http://localhost/api/decks/pub-1/partner-shares', {
  method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});
const APPS = [
  { client_id: 'cintari', client_name: 'Cintari', client_uri: 'https://cintari.example', scopes: ['decks:read'], authorized_at: new Date() },
  { client_id: 'claude', client_name: 'Claude', scopes: ['read write'], authorized_at: new Date() },
];

describe('/api/decks/[deckId]/partner-shares', () => {
  beforeEach(() => {
    for (const m of [mockSession, mockShares, mockSet, mockApps]) m.mockReset();
    mockSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockApps.mockResolvedValue({ success: true, data: APPS });
    mockShares.mockResolvedValue({ success: true, data: ['cintari'] });
  });

  describe('GET', () => {
    it("lists the editor's connected apps that can receive decks, and which get this one", async () => {
      const response = await GET(new Request('http://localhost/api/decks/pub-1/partner-shares') as any, ctx);
      expect(mockShares).toHaveBeenCalledWith('pub-1', 'user-1');
      expect(await response.json()).toEqual({
        success: true,
        data: [{ client_id: 'cintari', name: 'Cintari', site: 'cintari.example', shared: true }],
      });
    });

    it('is for the signed-in session only', async () => {
      mockSession.mockResolvedValue(null);
      expect((await GET(new Request('http://localhost/x') as any, ctx)).status).toBe(401);
      expect(mockShares).not.toHaveBeenCalled();
    });

    it("refuses someone who can't edit the deck", async () => {
      mockShares.mockResolvedValue({ success: false, error: DECK_VERSION_NOT_EDITABLE });
      expect((await GET(new Request('http://localhost/x') as any, ctx)).status).toBe(403);
    });
  });

  describe('PUT', () => {
    it('sends the deck to one connected app', async () => {
      mockSet.mockResolvedValue({ success: true, data: { shared: true } });
      const response = await PUT(put({ client_id: 'cintari', shared: true }) as any, ctx);
      expect(mockSet).toHaveBeenCalledWith('pub-1', 'user-1', 'cintari', true);
      expect(await response.json()).toEqual({ success: true, data: { client_id: 'cintari', shared: true } });
    });

    it('only to an app the user connected with deck access', async () => {
      for (const client_id of ['claude', 'never-connected']) {
        const response = await PUT(put({ client_id, shared: true }) as any, ctx);
        expect(response.status).toBe(400);
      }
      expect(mockSet).not.toHaveBeenCalled();
    });

    it('can always stop sending, even to an app since disconnected', async () => {
      mockSet.mockResolvedValue({ success: true, data: { shared: false } });
      expect((await PUT(put({ client_id: 'never-connected', shared: false }) as any, ctx)).status).toBe(200);
      expect(mockSet).toHaveBeenCalledWith('pub-1', 'user-1', 'never-connected', false);
    });

    it('rejects a malformed body', async () => {
      for (const body of [{}, { client_id: 'cintari' }, { client_id: 5, shared: true }, { client_id: 'cintari', shared: 'yes' }]) {
        expect((await PUT(put(body) as any, ctx)).status).toBe(400);
      }
    });

    it('is for the signed-in session only', async () => {
      mockSession.mockResolvedValue(null);
      expect((await PUT(put({ client_id: 'cintari', shared: true }) as any, ctx)).status).toBe(401);
    });
  });
});
