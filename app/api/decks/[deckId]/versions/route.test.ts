import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({ deckService: { saveDeckVersion: vi.fn(), listDeckVersions: vi.fn() } }));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

import { GET, POST } from './route';
import { deckService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { DECK_VERSION_EMPTY, DECK_VERSION_NOT_EDITABLE } from '@/lib/deck/deck-versions';

const saveDeckVersion = vi.mocked(deckService.saveDeckVersion);
const listDeckVersions = vi.mocked(deckService.listDeckVersions);
const auth = vi.mocked(authenticateRequest);
const params = Promise.resolve({ deckId: 'deck123' });
const url = 'http://localhost/api/decks/deck123/versions';
const post = (body?: unknown) => new NextRequest(url, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
const get = () => new NextRequest(url);

const COUNTS = { hero: 1, equipment: 5, maindeck: 60, inventory: 14, benched: 0, tokens: 0 };
const VERSION = { versionNumber: 2, label: 'Before the Calling', createdAt: '2026-11-26T12:00:00.000Z', counts: COUNTS };

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ success: true, userId: 'u1' } as any);
});

describe('GET /api/decks/[deckId]/versions', () => {
  it('401s when not signed in', async () => {
    auth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);
    const res = await GET(get(), { params });
    expect(res.status).toBe(401);
    expect(listDeckVersions).not.toHaveBeenCalled();
  });

  it('returns the deck\'s versions', async () => {
    listDeckVersions.mockResolvedValue({ success: true, data: [VERSION] });
    const res = await GET(get(), { params });
    expect(res.status).toBe(200);
    expect(listDeckVersions).toHaveBeenCalledWith('deck123', 'u1');
    expect(await res.json()).toEqual({ success: true, data: { versions: [VERSION] } });
  });

  it('403s when the caller cannot edit the deck', async () => {
    listDeckVersions.mockResolvedValue({ success: false, error: DECK_VERSION_NOT_EDITABLE });
    expect((await GET(get(), { params })).status).toBe(403);
  });

  it('500s without passing a database error through', async () => {
    listDeckVersions.mockResolvedValue({ success: false, error: 'Failed query: select "id" from "decks" … params: abc,123' });
    const res = await GET(get(), { params });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/query|select|params/i);
  });

  it('accepts OAuth / MCP callers (allowOAuth)', async () => {
    listDeckVersions.mockResolvedValue({ success: true, data: [] });
    await GET(get(), { params });
    expect(auth).toHaveBeenCalledWith(expect.anything(), expect.anything(), { allowOAuth: true });
  });
});

describe('POST /api/decks/[deckId]/versions', () => {
  it('401s when not signed in', async () => {
    auth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);
    const res = await POST(post({}), { params });
    expect(res.status).toBe(401);
    expect(saveDeckVersion).not.toHaveBeenCalled();
  });

  it('saves a version with the note and answers 201', async () => {
    saveDeckVersion.mockResolvedValue({ success: true, data: { version: VERSION, created: true } });
    const res = await POST(post({ label: 'Before the Calling' }), { params });
    expect(res.status).toBe(201);
    expect(saveDeckVersion).toHaveBeenCalledWith('deck123', 'u1', { label: 'Before the Calling' });
    expect(await res.json()).toEqual({ success: true, data: { version: VERSION, created: true } });
  });

  it('answers 200 when nothing changed since the latest version', async () => {
    saveDeckVersion.mockResolvedValue({ success: true, data: { version: VERSION, created: false } });
    const res = await POST(post({}), { params });
    expect(res.status).toBe(200);
    expect((await res.json()).data.created).toBe(false);
  });

  it('works with no body at all', async () => {
    saveDeckVersion.mockResolvedValue({ success: true, data: { version: VERSION, created: true } });
    const res = await POST(post(), { params });
    expect(res.status).toBe(201);
    expect(saveDeckVersion).toHaveBeenCalledWith('deck123', 'u1', { label: undefined });
  });

  it('403s when the caller cannot edit the deck', async () => {
    saveDeckVersion.mockResolvedValue({ success: false, error: DECK_VERSION_NOT_EDITABLE });
    expect((await POST(post({}), { params })).status).toBe(403);
  });

  it('400s for an empty deck, with the reason', async () => {
    saveDeckVersion.mockResolvedValue({ success: false, error: DECK_VERSION_EMPTY });
    const res = await POST(post({}), { params });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: DECK_VERSION_EMPTY });
  });

  it('500s without passing a database error through', async () => {
    saveDeckVersion.mockResolvedValue({ success: false, error: 'Failed query: insert into "deck_versions" … params: abc,123' });
    const res = await POST(post({}), { params });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/query|insert|params/i);
  });

  it('accepts OAuth / MCP callers (allowOAuth)', async () => {
    saveDeckVersion.mockResolvedValue({ success: true, data: { version: VERSION, created: true } });
    await POST(post({}), { params });
    expect(auth).toHaveBeenCalledWith(expect.anything(), expect.anything(), { allowOAuth: true });
  });
});
