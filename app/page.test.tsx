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
  // article-image resolves printing-backed covers through this (lazy import)
  printingsService: { getPrintingsByIds: vi.fn() },
}));
vi.mock('@/components/home/HomePageClient', () => ({ default: () => null }));

import HomePage from './page';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { articleService, userService, printingsService } from '@/lib/services';

const mockAuth = vi.mocked(auth as unknown as () => Promise<any>);
const mockListArticles = vi.mocked(articleService.listArticles);
const mockGetBasicInfo = vi.mocked(userService.getBasicInfo);
const mockGetPrintingsByIds = vi.mocked(printingsService.getPrintingsByIds);
const mockRedirect = vi.mocked(redirect);

beforeEach(() => {
  vi.clearAllMocks();
  mockListArticles.mockResolvedValue({ success: true, data: { articles: [] } } as any);
  mockGetBasicInfo.mockResolvedValue({ success: true, data: { _id: 'u1' } } as any);
  mockGetPrintingsByIds.mockResolvedValue({ success: true, data: { printings: [] } } as any);
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

// `articles.image` stores a bare id: a Cloudflare upload UUID, or a PRINTING_ID
// nanoid when the cover was picked from a card. Printing_id-keyed CDN images
// were deleted 2026-07 — a printing_id must resolve through the printing row's
// stored image_url (lib/images/article-image), never be concatenated into
// `<CF_BASE>/<id>/public`. The homepage used to hand the raw id to
// HomePageClient, whose cfImageUrl() did exactly that — every card-cover
// thumbnail 404'd.
describe('HomePage article covers', () => {
  const PRINTING_ID = 'LqgbhgKQtqTGbKPJp7cLd'; // 21-char nanoid
  const UPLOAD_UUID = '707d9e0f-a50a-4453-3eae-7fd3a90d6200';
  const STORED_URL = 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/OUT093/public';

  const article = (over: Record<string, unknown> = {}) => ({
    publicId: 'abc123',
    title: 'Teklovossen - Feb 3 Armory',
    subtitle: 's',
    image: PRINTING_ID,
    contentType: 'tournament',
    ...over,
  });

  beforeEach(() => {
    mockAuth.mockResolvedValue(null as any); // signed out — marketing home
  });

  it('resolves a printing_id cover to the printing row stored image_url', async () => {
    mockGetPrintingsByIds.mockResolvedValue({
      success: true,
      data: { printings: [{ printing_id: PRINTING_ID, image_url: STORED_URL }] },
    } as any);
    mockListArticles.mockResolvedValue({ success: true, data: { articles: [article()] } } as any);

    const el: any = await HomePage();

    expect(el.props.articles[0].image).toBe(STORED_URL);
  });

  it('passes nothing renderable for a printing_id with no surviving image', async () => {
    mockListArticles.mockResolvedValue({ success: true, data: { articles: [article()] } } as any);

    const el: any = await HomePage();

    // Anything truthy here is rendered as <img src> — a raw nanoid would be
    // concatenated into a url that is known to 404.
    expect(el.props.articles[0].image ?? undefined).toBeUndefined();
  });

  it('leaves an admin-upload UUID cover renderable as a full url', async () => {
    mockListArticles.mockResolvedValue({
      success: true,
      data: { articles: [article({ image: UPLOAD_UUID })] },
    } as any);

    const el: any = await HomePage();

    const img = el.props.articles[0].image;
    expect(img).toContain(UPLOAD_UUID);
    expect(img).toMatch(/^https:\/\//); // a full url, not a bare id
  });
});
