import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  userService: { updateProfile: vi.fn() },
}));
vi.mock('@/auth', () => ({ auth: vi.fn() }));

// Import AFTER mocks (vi.mock is hoisted)
import { POST } from './route';
import { userService } from '@/lib/services';
import { auth } from '@/auth';

const mockAuth = vi.mocked(auth as unknown as () => Promise<{ user?: { id: string } } | null>);
const mockUpdate = vi.mocked(userService.updateProfile);

const post = (body: unknown) =>
  POST(new Request('http://test/api/user/language', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as never);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'u1' } });
  mockUpdate.mockResolvedValue({ success: true, data: undefined });
});

describe('POST /api/user/language', () => {
  it('saves a supported language code', async () => {
    const res = await post({ language: 'ja' });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith('u1', { preferredLanguage: 'ja' });
  });

  it('saves explicit English (a real choice, not "unset")', async () => {
    const res = await post({ language: 'en' });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith('u1', { preferredLanguage: 'en' });
  });

  it('clears the preference when given an empty string', async () => {
    const res = await post({ language: '' });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith('u1', { preferredLanguage: '' });
  });

  it('rejects unsupported codes', async () => {
    for (const bad of ['xx', 'FRA', 'zz', null, 42]) {
      const res = await post({ language: bad });
      expect(res.status).toBe(400);
    }
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('401s when signed out', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await post({ language: 'fr' });
    expect(res.status).toBe(401);
  });

  it('surfaces service failures as 500', async () => {
    mockUpdate.mockResolvedValue({ success: false, error: 'db down' });
    const res = await post({ language: 'fr' });
    expect(res.status).toBe(500);
  });
});
