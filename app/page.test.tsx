import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock('@/lib/services', () => ({
  articleService: { listArticles: vi.fn() },
  userService: { getBasicInfo: vi.fn() },
}));
vi.mock('@/components/home/HomePageClient', () => ({ default: () => null }));

import HomePage from './page';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { articleService, userService } from '@/lib/services';

const mockAuth = vi.mocked(auth as unknown as () => Promise<any>);
const mockListArticles = vi.mocked(articleService.listArticles);
const mockGetBasicInfo = vi.mocked(userService.getBasicInfo);
const mockRedirect = vi.mocked(redirect);

beforeEach(() => {
  vi.clearAllMocks();
  mockListArticles.mockResolvedValue({ success: true, data: { articles: [] } } as any);
  mockGetBasicInfo.mockResolvedValue({ success: true, data: { _id: 'u1' } } as any);
});

describe('HomePage routing', () => {
  it('sends any signed-in user to /volzar — the logged-in home', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', roles: {} } } as any);

    await expect(HomePage()).rejects.toThrow('NEXT_REDIRECT:/volzar');
    expect(mockRedirect).toHaveBeenCalledWith('/volzar');
  });

  it('sends superadmins to /volzar too — no operator carve-out on the homepage', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin', roles: { isSuperAdmin: true } } } as any);

    await expect(HomePage()).rejects.toThrow('NEXT_REDIRECT:/volzar');
  });

  it('honors the landing page preference (collection)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', roles: {} } } as any);
    mockGetBasicInfo.mockResolvedValue({ success: true, data: { _id: 'u1', landingPage: 'collection' } } as any);

    await expect(HomePage()).rejects.toThrow('NEXT_REDIRECT:/collection');
  });

  it('honors the landing page preference (decks)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', roles: {} } } as any);
    mockGetBasicInfo.mockResolvedValue({ success: true, data: { _id: 'u1', landingPage: 'decks' } } as any);

    await expect(HomePage()).rejects.toThrow('NEXT_REDIRECT:/decks');
  });

  it('falls back to /volzar when the preference read fails', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', roles: {} } } as any);
    mockGetBasicInfo.mockRejectedValue(new Error('db down'));

    await expect(HomePage()).rejects.toThrow('NEXT_REDIRECT:/volzar');
  });

  it('renders the marketing home for signed-out visitors', async () => {
    mockAuth.mockResolvedValue(null as any);

    const result = await HomePage();

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(result).toBeTruthy();
    expect(mockListArticles).toHaveBeenCalled();
  });
});
