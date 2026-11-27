import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/services', () => ({
  userService: { hasRole: vi.fn() },
  oauthFlowService: { listAllowlist: vi.fn(), listRecentClients: vi.fn(), addAllowlistEntry: vi.fn(), removeAllowlistEntry: vi.fn() },
}));

import { GET, POST } from './route';
import { DELETE } from './[id]/route';
import { auth } from '@/auth';
import { oauthFlowService, userService } from '@/lib/services';

const mockSession = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>;
const mockRole = vi.mocked(userService.hasRole);
const mockList = vi.mocked(oauthFlowService.listAllowlist);
const mockRecent = vi.mocked(oauthFlowService.listRecentClients);
const mockAdd = vi.mocked(oauthFlowService.addAllowlistEntry);
const mockRemove = vi.mocked(oauthFlowService.removeAllowlistEntry);

const NOW = new Date('2026-11-27T12:00:00Z');
const ENTRIES = [
  { id: 'e1', kind: 'redirect_host' as const, value: 'claude.ai', label: 'Claude', access: 'full' as const, createdAt: NOW },
  { id: 'e2', kind: 'client_id' as const, value: 'mcp_cintari', label: 'Cintari', access: 'partner' as const, createdAt: NOW },
];
const post = (body: unknown) => new Request('http://localhost/api/admin/oauth-apps', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});
const del = () => new Request('http://localhost/api/admin/oauth-apps/e1', { method: 'DELETE' });
const ctx = { params: Promise.resolve({ id: 'e1' }) };

describe('/api/admin/oauth-apps', () => {
  beforeEach(() => {
    for (const m of [mockSession, mockRole, mockList, mockRecent, mockAdd, mockRemove]) m.mockReset();
    mockSession.mockResolvedValue({ user: { id: 'admin-1' } });
    mockRole.mockResolvedValue({ success: true, data: true });
    mockList.mockResolvedValue({ success: true, data: ENTRIES });
    mockRecent.mockResolvedValue({
      success: true,
      data: [
        { clientId: 'mcp_cintari', clientName: 'Cintari', clientUri: 'https://cintari.gg', redirectUris: ['https://cintari.gg/cb'], createdAt: NOW, lastUsed: null },
        { clientId: 'mcp_claude1', clientName: 'Claude', clientUri: null, redirectUris: ['https://claude.ai/api/mcp/auth_callback'], createdAt: NOW, lastUsed: NOW },
        { clientId: 'mcp_fake', clientName: 'Cintari', clientUri: null, redirectUris: ['https://evil.example/cb'], createdAt: NOW, lastUsed: null },
      ],
    });
  });

  it('lists the allow-list and recent apps with what each is approved for', async () => {
    const body = await (await GET(new Request('http://localhost/api/admin/oauth-apps') as any)).json();
    expect(mockRole).toHaveBeenCalledWith('admin-1', 'isSuperAdmin');
    expect(body.data.entries).toEqual(ENTRIES.map(e => ({ ...e, createdAt: NOW.toISOString() })));
    expect(body.data.recentApps).toEqual([
      { clientId: 'mcp_cintari', name: 'Cintari', site: 'cintari.gg', returnHosts: ['cintari.gg'], registeredAt: NOW.toISOString(), lastUsed: null, approved: { full: false, partner: true } },
      { clientId: 'mcp_claude1', name: 'Claude', site: null, returnHosts: ['claude.ai'], registeredAt: NOW.toISOString(), lastUsed: NOW.toISOString(), approved: { full: true, partner: false } },
      { clientId: 'mcp_fake', name: 'Cintari', site: null, returnHosts: ['evil.example'], registeredAt: NOW.toISOString(), lastUsed: null, approved: { full: false, partner: false } },
    ]);
  });

  it('adds an entry, recording who added it', async () => {
    mockAdd.mockResolvedValue({ success: true, data: ENTRIES[1] });
    const response = await POST(post({ kind: 'client_id', value: 'mcp_cintari', label: 'Cintari', access: 'partner' }) as any);
    expect(response.status).toBe(201);
    expect(mockAdd).toHaveBeenCalledWith({ kind: 'client_id', value: 'mcp_cintari', label: 'Cintari', access: 'partner', createdBy: 'admin-1' });
  });

  it("passes the service's reason back when an entry is refused", async () => {
    mockAdd.mockResolvedValue({ success: false, error: 'That is already on the list' });
    const response = await POST(post({ kind: 'redirect_host', value: 'claude.ai', label: 'Claude', access: 'full' }) as any);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('That is already on the list');
  });

  it('rejects a malformed body', async () => {
    for (const body of [{}, { kind: 'other', value: 'x', label: 'x', access: 'full' }, { kind: 'client_id', value: 'x', label: 'x', access: 'admin' }, { kind: 'client_id', value: 5, label: 'x', access: 'full' }]) {
      expect((await POST(post(body) as any)).status).toBe(400);
    }
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('removes an entry', async () => {
    mockRemove.mockResolvedValue({ success: true, data: { removed: true } });
    const response = await DELETE(del() as any, ctx);
    expect(mockRemove).toHaveBeenCalledWith('e1');
    expect(response.status).toBe(200);
    mockRemove.mockResolvedValue({ success: true, data: { removed: false } });
    expect((await DELETE(del() as any, ctx)).status).toBe(404);
  });

  it('is for a signed-in superadmin session only', async () => {
    mockSession.mockResolvedValue(null);
    expect((await GET(new Request('http://localhost/x') as any)).status).toBe(401);
    mockSession.mockResolvedValue({ user: { id: 'u-2' } });
    mockRole.mockResolvedValue({ success: true, data: false });
    expect((await GET(new Request('http://localhost/x') as any)).status).toBe(403);
    expect((await POST(post({ kind: 'client_id', value: 'x', label: 'x', access: 'full' }) as any)).status).toBe(403);
    expect((await DELETE(del() as any, ctx)).status).toBe(403);
    expect(mockAdd).not.toHaveBeenCalled();
    expect(mockRemove).not.toHaveBeenCalled();
  });
});
