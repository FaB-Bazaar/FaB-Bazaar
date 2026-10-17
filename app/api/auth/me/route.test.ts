import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  userService: { getProfile: vi.fn(), getMetafyCommunities: vi.fn() },
}));
vi.mock('@/auth', () => ({ auth: vi.fn() }));

// Import AFTER mocks (vi.mock is hoisted)
import { GET } from './route';
import { userService } from '@/lib/services';
import { auth } from '@/auth';

const mockAuth = vi.mocked(auth as unknown as () => Promise<{ user?: { id: string } } | null>);
const mockProfile = vi.mocked(userService.getProfile);
const mockCommunities = vi.mocked(userService.getMetafyCommunities);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'u1' } });
  mockCommunities.mockResolvedValue({ success: true, data: [] });
});

describe('GET /api/auth/me', () => {
  it('tells the client whether the user wants Cardmarket prices', async () => {
    mockProfile.mockResolvedValue({
      success: true,
      data: { _id: 'u1', username: 'eu-player', cardmarketPrices: true } as never,
    });
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).user.cardmarketPrices).toBe(true);
  });
});
