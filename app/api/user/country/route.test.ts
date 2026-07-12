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
  POST(new Request('http://test/api/user/country', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as never);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'u1' } });
  mockUpdate.mockResolvedValue({ success: true, data: undefined });
});

describe('POST /api/user/country', () => {
  it('saves a valid ISO2 country code (uppercased)', async () => {
    const res = await post({ country: 'fr' });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith('u1', { country: 'FR' });
  });

  it('clears the country when given an empty string', async () => {
    const res = await post({ country: '' });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith('u1', { country: '' });
  });

  it('rejects malformed codes', async () => {
    for (const bad of ['FRA', 'F', '12', null, 42]) {
      const res = await post({ country: bad });
      expect(res.status).toBe(400);
    }
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('401s when signed out', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await post({ country: 'FR' });
    expect(res.status).toBe(401);
  });

  it('surfaces service failures as 500', async () => {
    mockUpdate.mockResolvedValue({ success: false, error: 'db down' });
    const res = await post({ country: 'FR' });
    expect(res.status).toBe(500);
  });
});
