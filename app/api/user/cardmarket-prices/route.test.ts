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
  POST(new Request('http://test/api/user/cardmarket-prices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as never);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'u1' } });
  mockUpdate.mockResolvedValue({ success: true, data: undefined });
});

describe('POST /api/user/cardmarket-prices', () => {
  it('turns Cardmarket prices on for the signed-in user', async () => {
    const res = await post({ enabled: true });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith('u1', { cardmarketPrices: true });
  });

  it('turns them off', async () => {
    const res = await post({ enabled: false });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith('u1', { cardmarketPrices: false });
  });

  it('rejects a non-boolean', async () => {
    const res = await post({ enabled: 'yes' });
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('requires a signed-in user', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await post({ enabled: true });
    expect(res.status).toBe(401);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
