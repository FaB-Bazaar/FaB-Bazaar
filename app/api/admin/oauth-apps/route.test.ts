import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/services', () => ({
  userService: { hasRole: vi.fn() },
  oauthFlowService: { listAllowlist: vi.fn(), listRegisteredClients: vi.fn(), addAllowlistEntry: vi.fn(), removeAllowlistEntry: vi.fn(), deleteUnusedClient: vi.fn() },
}));

import { GET, POST } from './route';
import { DELETE } from './[id]/route';
import { DELETE as DELETE_CLIENT } from './clients/[clientId]/route';
import { auth } from '@/auth';
import { oauthFlowService, userService } from '@/lib/services';

const mockSession = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>;
const mockRole = vi.mocked(userService.hasRole);
const mockList = vi.mocked(oauthFlowService.listAllowlist);
const mockRecent = vi.mocked(oauthFlowService.listRegisteredClients);
const mockDeleteClient = vi.mocked(oauthFlowService.deleteUnusedClient);
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
    for (const m of [mockSession, mockRole, mockList, mockRecent, mockAdd, mockRemove, mockDeleteClient]) m.mockReset();
    mockSession.mockResolvedValue({ user: { id: 'admin-1' } });
    mockRole.mockResolvedValue({ success: true, data: true });
    mockList.mockResolvedValue({ success: true, data: ENTRIES });
    mockRecent.mockResolvedValue({
      success: true,
      data: [
        { clientId: 'mcp_cintari', clientName: 'Cintari', clientUri: 'https://cintari.gg', redirectUris: ['https://cintari.gg/cb'], createdAt: NOW, lastUsed: null, liveConnections: 0 },
        { clientId: 'mcp_claude1', clientName: 'Claude', clientUri: null, redirectUris: ['https://claude.ai/api/mcp/auth_callback'], createdAt: NOW, lastUsed: NOW, liveConnections: 2 },
        { clientId: 'mcp_fake', clientName: 'Cintari', clientUri: null, redirectUris: ['https://evil.example/cb'], createdAt: NOW, lastUsed: null, liveConnections: 0 },
      ],
    });
  });

  const get = (query = '') => GET(new Request(`http://localhost/api/admin/oauth-apps${query}`) as any);

  it('lists the allow-list and, by default, only registrations waiting for a decision', async () => {
    const body = await (await get()).json();
    expect(mockRole).toHaveBeenCalledWith('admin-1', 'isSuperAdmin');
    expect(body.data.entries).toEqual(ENTRIES.map(e => ({ ...e, createdAt: NOW.toISOString() })));
    expect(body.data.view).toBe('waiting');
    expect(body.data.waitingCount).toBe(1);
    expect(body.data.registrations).toEqual([
      { clientId: 'mcp_fake', name: 'Cintari', site: null, returnHosts: ['evil.example'], registeredAt: NOW.toISOString(), lastUsed: null, liveConnections: 0, approved: { full: false, partner: false }, canDelete: true },
    ]);
    expect(body.data.pagination).toEqual({ page: 1, pageSize: 20, total: 1, totalPages: 1 });
  });

  it('shows every registration with view=all, with what each is approved for and whether it can be deleted', async () => {
    const body = await (await get('?view=all')).json();
    expect(body.data.view).toBe('all');
    expect(body.data.registrations.map((r: any) => [r.clientId, r.approved, r.canDelete])).toEqual([
      ['mcp_cintari', { full: false, partner: true }, false], // approved by client id: remove it from Allowed first
      ['mcp_claude1', { full: true, partner: false }, false], // players connected
      ['mcp_fake', { full: false, partner: false }, true],
    ]);
  });

  it('pages 20 at a time', async () => {
    const many = Array.from({ length: 45 }, (_, i) => ({
      clientId: `mcp_${i}`, clientName: `App ${i}`, clientUri: null, redirectUris: [`https://a${i}.example/cb`],
      createdAt: NOW, lastUsed: null, liveConnections: 0,
    }));
    mockRecent.mockResolvedValue({ success: true, data: many });
    const page3 = (await (await get('?page=3')).json()).data;
    expect(page3.registrations.map((r: any) => r.clientId)).toEqual(['mcp_40', 'mcp_41', 'mcp_42', 'mcp_43', 'mcp_44']);
    expect(page3.pagination).toEqual({ page: 3, pageSize: 20, total: 45, totalPages: 3 });
    // Past the end → the last page; nonsense → the first.
    expect((await (await get('?page=99')).json()).data.pagination.page).toBe(3);
    expect((await (await get('?page=abc')).json()).data.pagination.page).toBe(1);
  });

  it('deletes an unused registration, and says why it refused one', async () => {
    const ctxClient = { params: Promise.resolve({ clientId: 'mcp_fake' }) };
    const delClient = () => new Request('http://localhost/api/admin/oauth-apps/clients/mcp_fake', { method: 'DELETE' });
    mockDeleteClient.mockResolvedValue({ success: true, data: { deleted: true } });
    expect((await DELETE_CLIENT(delClient() as any, ctxClient)).status).toBe(200);
    expect(mockDeleteClient).toHaveBeenCalledWith('mcp_fake');

    mockDeleteClient.mockResolvedValue({ success: false, error: 'This app still has players connected' });
    const refused = await DELETE_CLIENT(delClient() as any, ctxClient);
    expect(refused.status).toBe(409);
    expect((await refused.json()).error).toBe('This app still has players connected');

    mockDeleteClient.mockResolvedValue({ success: true, data: { deleted: false } });
    expect((await DELETE_CLIENT(delClient() as any, ctxClient)).status).toBe(404);

    mockRole.mockResolvedValue({ success: true, data: false });
    mockDeleteClient.mockClear();
    expect((await DELETE_CLIENT(delClient() as any, ctxClient)).status).toBe(403);
    expect(mockDeleteClient).not.toHaveBeenCalled();
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
