import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/services', () => ({
  oauthService: { listAuthorizedApps: vi.fn(), revokeAppAccess: vi.fn() },
}));

import { GET } from './route';
import { DELETE } from './[clientId]/route';
import { auth } from '@/auth';
import { oauthService } from '@/lib/services';

const mockSession = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>;
const mockList = vi.mocked(oauthService.listAuthorizedApps);
const mockRevoke = vi.mocked(oauthService.revokeAppAccess);

const ctx = (clientId: string) => ({ params: Promise.resolve({ clientId }) });
const del = () => new Request('http://localhost/api/user/authorized-apps/x', { method: 'DELETE' });

describe('/api/user/authorized-apps', () => {
  beforeEach(() => {
    mockSession.mockReset();
    mockList.mockReset();
    mockRevoke.mockReset();
    mockSession.mockResolvedValue({ user: { id: 'user-1' } });
  });

  describe('GET', () => {
    it('lists the apps the signed-in user authorized, in plain words', async () => {
      mockList.mockResolvedValue({
        success: true,
        data: [
          {
            client_id: 'mcp_nanza',
            client_name: 'Nanza',
            client_uri: 'https://nanza.example/about',
            scopes: ['decks:read', 'collection:write'],
            authorized_at: new Date('2026-11-01T00:00:00Z'),
          },
          {
            client_id: 'mcp_claude',
            client_name: 'Claude',
            scopes: ['read write'],
            authorized_at: new Date('2026-10-01T00:00:00Z'),
          },
        ],
      });

      const response = await GET();

      expect(mockList).toHaveBeenCalledWith('user-1');
      expect(await response.json()).toEqual({
        success: true,
        data: [
          {
            client_id: 'mcp_nanza',
            name: 'Nanza',
            site: 'nanza.example',
            full_access: false,
            permissions: ['See your binders, and add, change and remove cards in them', 'See your decks'],
            authorized_at: '2026-11-01T00:00:00.000Z',
          },
          {
            client_id: 'mcp_claude',
            name: 'Claude',
            site: null,
            full_access: true,
            permissions: [expect.stringMatching(/full access/i)],
            authorized_at: '2026-10-01T00:00:00.000Z',
          },
        ],
      });
    });

    it('answers 401 when signed out', async () => {
      mockSession.mockResolvedValue(null);

      expect((await GET()).status).toBe(401);
      expect(mockList).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /{clientId}', () => {
    it("removes the signed-in user's access to that app", async () => {
      mockRevoke.mockResolvedValue({ success: true, data: undefined });

      const response = await DELETE(del(), ctx('mcp_nanza'));

      expect(mockRevoke).toHaveBeenCalledWith('user-1', 'mcp_nanza');
      expect(await response.json()).toEqual({ success: true });
    });

    it('answers 404 when there was nothing to remove', async () => {
      mockRevoke.mockResolvedValue({ success: false, error: 'No access to revoke' });

      expect((await DELETE(del(), ctx('mcp_other'))).status).toBe(404);
    });

    it('answers 401 when signed out', async () => {
      mockSession.mockResolvedValue(null);

      expect((await DELETE(del(), ctx('mcp_nanza'))).status).toBe(401);
      expect(mockRevoke).not.toHaveBeenCalled();
    });
  });
});
