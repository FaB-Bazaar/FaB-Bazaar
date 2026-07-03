// app/api/users/me/route.test.ts
// Identity endpoint for OAuth clients (e.g. play.fabbazaar.app): given a
// valid credential (session or bearer), returns who the caller is.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  userService: { findById: vi.fn() },
}));
vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));

// Import AFTER mocks (vi.mock is hoisted)
import { GET } from './route';
import { userService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockAuth = vi.mocked(authenticateRequest);
const mockFindById = vi.mocked(userService.findById);

const makeRequest = () =>
  new NextRequest('http://localhost:3000/api/users/me');

describe('GET /api/users/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when authentication fails', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('allows OAuth bearer credentials', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);
    await GET(makeRequest());
    expect(mockAuth).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ allowOAuth: true })
    );
  });

  it('returns the authenticated user identity with display username', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockFindById.mockResolvedValue({
      success: true,
      data: { _id: 'u1', username: 'dc_someone' },
    } as any);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.userId).toBe('u1');
    expect(body.data.username).toBe('dc_someone');
    // dc_ prefix is internal; rendered name must be stripped
    expect(body.data.displayUsername).toBe('someone');
  });

  it('falls back to discordUsername when username is unset', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u2' } as any);
    mockFindById.mockResolvedValue({
      success: true,
      data: { _id: 'u2', discordUsername: 'discord_person' },
    } as any);
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.userId).toBe('u2');
    expect(body.data.displayUsername).toBe('discord_person');
  });

  it('returns the Discord avatar URL when the user has a Discord avatar', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u3' } as any);
    mockFindById.mockResolvedValue({
      success: true,
      data: { _id: 'u3', username: 'someone', discordId: '123456789', discordAvatar: 'abcdef' },
    } as any);
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.avatar).toBe(
      'https://cdn.discordapp.com/avatars/123456789/abcdef.png?size=64'
    );
  });

  it('returns a null avatar when the user has no Discord avatar', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u4' } as any);
    mockFindById.mockResolvedValue({
      success: true,
      data: { _id: 'u4', username: 'someone', avatarUrl: 'https://example.com/pic.png' },
    } as any);
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    // Discord-only per product decision: a non-Discord avatarUrl is not surfaced here
    expect(body.data.avatar).toBeNull();
  });

  it('returns 404 when the user record no longer exists', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'ghost' } as any);
    mockFindById.mockResolvedValue({ success: true, data: null } as any);
    const res = await GET(makeRequest());
    expect(res.status).toBe(404);
  });

  it('never caches identity responses', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockFindById.mockResolvedValue({
      success: true,
      data: { _id: 'u1', username: 'someone' },
    } as any);
    const res = await GET(makeRequest());
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});
