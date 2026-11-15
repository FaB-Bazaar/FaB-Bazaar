/**
 * Unit tests for POST /api/user/socials — save the signed-in user's social handles.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/services', () => ({ userService: { updateProfile: vi.fn() } }));
vi.mock('@/lib/profile/public-profile-cache', () => ({ invalidatePublicProfile: vi.fn() }));

import { POST } from './route';
import { auth } from '@/auth';
import { userService } from '@/lib/services';
import { invalidatePublicProfile } from '@/lib/profile/public-profile-cache';

const mockAuth = vi.mocked(auth) as any;
const mockUpdate = vi.mocked(userService.updateProfile);

const post = (body: unknown) =>
  POST(new Request('https://fabbazaar.app/api/user/socials', { method: 'POST', body: JSON.stringify(body) }));

describe('POST /api/user/socials', () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockUpdate.mockReset();
    mockAuth.mockResolvedValue({ user: { id: 'user-1', username: 'someone' } });
    mockUpdate.mockResolvedValue({ success: true, data: undefined } as any);
  });

  it('requires sign-in', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await post({ socials: {} });
    expect(res.status).toBe(401);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('saves normalized handles for the signed-in user and returns them', async () => {
    const res = await post({ socials: { nanza: 'https://nanza.app/danielwang', x: '@fabtcg', youtube: '' } });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith('user-1', { socialLinks: { nanza: 'danielwang', x: 'fabtcg' } });
    expect(await res.json()).toEqual({ success: true, data: { socials: { nanza: 'danielwang', x: 'fabtcg' } } });
  });

  it('rejects a bad handle without saving', async () => {
    const res = await post({ socials: { instagram: 'https://evil.example/x' } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Instagram');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rejects a body without socials', async () => {
    expect((await post({})).status).toBe(400);
  });
  it('drops the cached public profile so the new links show immediately', async () => {
    await post({ socials: { x: 'fabtcg' } });
    expect(invalidatePublicProfile).toHaveBeenCalledWith('someone');
  });
});
