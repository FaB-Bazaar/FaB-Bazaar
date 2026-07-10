import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock('@/lib/metafy/sync-tier', () => ({ syncSupporterTierIfStale: vi.fn() }));

import PostLoginPage from './page';
import { auth } from '@/auth';

const mockAuth = vi.mocked(auth as unknown as () => Promise<any>);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PostLoginPage routing', () => {
  it('sends every signed-in user to /volzar — the logged-in home', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
    await expect(PostLoginPage()).rejects.toThrow('NEXT_REDIRECT:/volzar');
  });

  it('falls back to /discord when somehow reached without a session', async () => {
    mockAuth.mockResolvedValue(null as any);
    await expect(PostLoginPage()).rejects.toThrow('NEXT_REDIRECT:/discord');
  });
});
