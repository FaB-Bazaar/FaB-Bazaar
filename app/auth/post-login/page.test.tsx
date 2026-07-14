import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock('@/lib/metafy/sync-tier', () => ({ syncSupporterTierIfStale: vi.fn() }));
vi.mock('@/lib/services', () => ({ userService: { getBasicInfo: vi.fn() } }));

import PostLoginPage from './page';
import { auth } from '@/auth';
import { userService } from '@/lib/services';

const mockAuth = vi.mocked(auth as unknown as () => Promise<any>);
const mockGetBasicInfo = vi.mocked(userService.getBasicInfo);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBasicInfo.mockResolvedValue({ success: true, data: { _id: 'u1' } } as any);
});

describe('PostLoginPage routing', () => {
  it('sends users without a landing preference to /volzar — the default logged-in home', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
    await expect(PostLoginPage()).rejects.toThrow('NEXT_REDIRECT:/volzar');
  });

  it('honors the landing page preference (collection)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
    mockGetBasicInfo.mockResolvedValue({ success: true, data: { _id: 'u1', landingPage: 'collection' } } as any);
    await expect(PostLoginPage()).rejects.toThrow('NEXT_REDIRECT:/collection');
  });

  it('honors the landing page preference (decks)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
    mockGetBasicInfo.mockResolvedValue({ success: true, data: { _id: 'u1', landingPage: 'decks' } } as any);
    await expect(PostLoginPage()).rejects.toThrow('NEXT_REDIRECT:/decks');
  });

  it('falls back to /volzar when the preference read fails', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
    mockGetBasicInfo.mockRejectedValue(new Error('db down'));
    await expect(PostLoginPage()).rejects.toThrow('NEXT_REDIRECT:/volzar');
  });

  it('falls back to /discord when somehow reached without a session', async () => {
    mockAuth.mockResolvedValue(null as any);
    await expect(PostLoginPage()).rejects.toThrow('NEXT_REDIRECT:/discord');
  });
});
