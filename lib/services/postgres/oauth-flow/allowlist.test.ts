/**
 * Integration tests: the OAuth app allow-list (migration 0136) — managing it,
 * the approval check, and a refresh refused once an app is taken off.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local. Every row
 * it writes uses a unique `*.alw-test.example` host or a client it registered,
 * and is removed afterwards; the seeded rows are never touched.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq, inArray, like } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, oauthClients, oauthAccessTokens, oauthAllowlist } from '@/lib/postgres/schema';
import { PostgresOAuthFlowService } from './PostgresOAuthFlowService';

let service: PostgresOAuthFlowService;
let userId: string;
let tag: string;
const clientIds: string[] = [];

async function register(host: string) {
  const r = await service.registerClient({ client_name: `alw ${tag}`, redirect_uris: [`https://${host}/cb`] });
  if (!r.success) throw new Error(r.error);
  clientIds.push(r.data.client_id);
  return r.data;
}

beforeEach(async () => {
  service = new PostgresOAuthFlowService();
  userId = crypto.randomUUID();
  tag = Math.random().toString(36).slice(2, 10);
  await db.insert(users).values({ id: userId, username: `test-${userId}` });
});

afterEach(async () => {
  await db.delete(oauthAllowlist).where(like(oauthAllowlist.value, '%.alw-test.example'));
  if (clientIds.length) {
    await db.delete(oauthAllowlist).where(inArray(oauthAllowlist.value, clientIds));
    await db.delete(oauthAccessTokens).where(inArray(oauthAccessTokens.clientId, clientIds));
    await db.delete(oauthClients).where(inArray(oauthClients.clientId, clientIds));
  }
  clientIds.length = 0;
  await db.delete(users).where(eq(users.id, userId));
});

describe('managing the allow-list', () => {
  it('lists the seeded assistants', async () => {
    const r = await service.listAllowlist();
    expect(r.success).toBe(true);
    const values = (r as any).data.map((e: any) => e.value);
    expect(values).toEqual(expect.arrayContaining(['claude.ai', 'chatgpt.com', 'agent.meta.ai', 'callback.mistral.ai', 'localhost', '127.0.0.1']));
  });

  it('adds a host as typed (normalized) and refuses a duplicate', async () => {
    const host = `${tag}.alw-test.example`;
    const added = await service.addAllowlistEntry({ kind: 'redirect_host', value: ` https://${host.toUpperCase()}/callback `, label: 'Test AI', access: 'full', createdBy: userId });
    expect(added).toMatchObject({ success: true, data: { kind: 'redirect_host', value: host, label: 'Test AI', access: 'full' } });

    const again = await service.addAllowlistEntry({ kind: 'redirect_host', value: host, label: 'x', access: 'full', createdBy: userId });
    expect(again.success).toBe(false);
  });

  it('refuses a value that is not a host, and a client id that is not registered', async () => {
    expect((await service.addAllowlistEntry({ kind: 'redirect_host', value: '*.claude.ai', label: 'x', access: 'full', createdBy: userId })).success).toBe(false);
    expect((await service.addAllowlistEntry({ kind: 'client_id', value: `mcp_nope_${tag}`, label: 'x', access: 'partner', createdBy: userId })).success).toBe(false);
  });

  it('adds a registered app by client id and removes an entry', async () => {
    const app = await register(`${tag}.alw-test.example`);
    const added = await service.addAllowlistEntry({ kind: 'client_id', value: app.client_id, label: 'Cintari', access: 'partner', createdBy: userId });
    expect(added.success).toBe(true);

    const id = (added as any).data.id;
    expect(await service.removeAllowlistEntry(id)).toEqual({ success: true, data: { removed: true } });
    expect(await service.removeAllowlistEntry(id)).toEqual({ success: true, data: { removed: false } });
  });

  it('lists every registered app, newest first, with how many live connections it has', async () => {
    const app = await register(`${tag}.alw-test.example`);
    const r = await service.listRegisteredClients();
    expect(r.success).toBe(true);
    const all = (r as any).data;
    const mine = all.find((c: any) => c.clientId === app.client_id);
    expect(mine).toMatchObject({ clientName: `alw ${tag}`, redirectUris: [`https://${tag}.alw-test.example/cb`], liveConnections: 0 });
    expect(mine.createdAt).toBeInstanceOf(Date);
    const times = all.map((c: any) => c.createdAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });
});

describe('deleteUnusedClient', () => {
  async function connect(app: { client_id: string; client_secret?: string }, host: string) {
    const redirectUri = `https://${host}/cb`;
    const code = await service.createAuthorizationCode({ clientId: app.client_id, userId, redirectUri, scope: 'read write' });
    if (!code.success) throw new Error(code.error);
    const tokens = await service.exchangeAuthorizationCode({ code: code.data.code, clientId: app.client_id, clientSecret: app.client_secret, redirectUri });
    if (!tokens.success) throw new Error(tokens.error);
  }

  it('deletes a registration nobody is connected through', async () => {
    const app = await register(`${tag}.alw-test.example`);
    expect(await service.deleteUnusedClient(app.client_id)).toEqual({ success: true, data: { deleted: true } });
    expect(await db.select().from(oauthClients).where(eq(oauthClients.clientId, app.client_id))).toEqual([]);
    expect(await service.deleteUnusedClient(app.client_id)).toEqual({ success: true, data: { deleted: false } });
  });

  it('refuses one with a live connection, so a working player connection is never cut', async () => {
    const host = `${tag}.alw-test.example`;
    const app = await register(host);
    await connect(app, host);
    const r = await service.deleteUnusedClient(app.client_id);
    expect(r).toEqual({ success: false, error: 'This app still has players connected' });
    const listed = ((await service.listRegisteredClients()) as any).data.find((c: any) => c.clientId === app.client_id);
    expect(listed.liveConnections).toBe(1);
  });

  it('refuses one approved by client id — take it off Allowed first', async () => {
    const app = await register(`${tag}.alw-test.example`);
    await service.addAllowlistEntry({ kind: 'client_id', value: app.client_id, label: 'x', access: 'partner', createdBy: userId });
    expect(await service.deleteUnusedClient(app.client_id)).toEqual({ success: false, error: 'This app is on the Allowed list; remove it there first' });
  });
});

describe('isClientApproved', () => {
  it('follows the list, by host or by client id, per kind of access', async () => {
    const host = `${tag}.alw-test.example`;
    const app = await register(host);
    expect(await service.isClientApproved(app.client_id, 'full')).toEqual({ success: true, data: false });

    await service.addAllowlistEntry({ kind: 'redirect_host', value: host, label: 'Test', access: 'full', createdBy: userId });
    expect(await service.isClientApproved(app.client_id, 'full')).toEqual({ success: true, data: true });
    expect(await service.isClientApproved(app.client_id, 'partner')).toEqual({ success: true, data: false });

    await service.addAllowlistEntry({ kind: 'client_id', value: app.client_id, label: 'Test', access: 'partner', createdBy: userId });
    expect(await service.isClientApproved(app.client_id, 'partner')).toEqual({ success: true, data: true });
  });

  it('checks a given return address instead of the registered ones when asked', async () => {
    const app = await register(`${tag}.alw-test.example`);
    expect(await service.isClientApproved(app.client_id, 'full', ['https://claude.ai/api/mcp/auth_callback'])).toEqual({ success: true, data: true });
  });

  it('an unknown client is not approved', async () => {
    expect(await service.isClientApproved(`mcp_nope_${tag}`, 'full')).toEqual({ success: true, data: false });
  });
});

describe('refreshAccessToken', () => {
  it('stops refreshing once the app is taken off the list', async () => {
    const host = `${tag}.alw-test.example`;
    const app = await register(host);
    const added = await service.addAllowlistEntry({ kind: 'redirect_host', value: host, label: 'Test', access: 'all', createdBy: userId });
    const redirectUri = `https://${host}/cb`;

    const code = await service.createAuthorizationCode({ clientId: app.client_id, userId, redirectUri, scope: 'decks:read' });
    if (!code.success) throw new Error(code.error);
    const tokens = await service.exchangeAuthorizationCode({ code: code.data.code, clientId: app.client_id, clientSecret: app.client_secret, redirectUri });
    if (!tokens.success) throw new Error(tokens.error);

    const refreshed = await service.refreshAccessToken(tokens.data.refresh_token!, app.client_id);
    expect(refreshed.success).toBe(true);

    await service.removeAllowlistEntry((added as any).data.id);
    const refused = await service.refreshAccessToken((refreshed as any).data.refresh_token, app.client_id);
    expect(refused).toEqual({ success: false, error: 'This app is not approved to connect to FaB Bazaar' });
  });
});
