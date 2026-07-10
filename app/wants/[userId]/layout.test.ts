import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  userService: { getBasicInfo: vi.fn() },
  wantsService: { getUserWants: vi.fn() },
}));

import { generateMetadata } from './layout';
import { userService, wantsService } from '@/lib/services';

const mockGetBasicInfo = vi.mocked(userService.getBasicInfo);
const mockGetUserWants = vi.mocked(wantsService.getUserWants);

const USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function makeUser(overrides = {}) {
  return {
    _id: USER_ID,
    username: 'dc_cardhunter',
    discordUsername: 'cardhunter#123',
    isStore: false,
    ...overrides,
  };
}

function makeItem(overrides = {}) {
  return {
    _id: crypto.randomUUID(),
    printingId: 'cLHGKMCjPb89zwNPmMFBp',
    name: 'enlightened strike',
    display_name: 'Enlightened Strike',
    quantity: 2,
    priority: 'high' as const,
    tcg_low: 30,
    image_url: 'https://imagedelivery.net/x/estrike/public',
    ...overrides,
  };
}

const params = (userId: string) => Promise.resolve({ userId });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('wants/[userId] generateMetadata', () => {
  it('titles the page with the display username (dc_/gh_ prefix stripped)', async () => {
    mockGetBasicInfo.mockResolvedValue({ success: true, data: makeUser() } as any);
    mockGetUserWants.mockResolvedValue({
      success: true,
      data: { items: [makeItem()], total: 1 },
    } as any);

    const meta = await generateMetadata({ params: params(USER_ID) });

    expect(meta.title).toContain("cardhunter's Wants List");
    expect(meta.title).not.toContain('dc_');
    expect(meta.openGraph?.title).toContain('FaB Bazaar');
  });

  it('describes the list with the card count and top wanted card names', async () => {
    mockGetBasicInfo.mockResolvedValue({ success: true, data: makeUser() } as any);
    mockGetUserWants.mockResolvedValue({
      success: true,
      data: {
        items: [
          makeItem({ display_name: 'Command and Conquer', tcg_low: 40 }),
          makeItem({ display_name: 'Enlightened Strike', tcg_low: 30 }),
          makeItem({ display_name: 'Sink Below', tcg_low: 1 }),
        ],
        total: 3,
      },
    } as any);

    const meta = await generateMetadata({ params: params(USER_ID) });

    expect(meta.description).toContain('3 cards');
    expect(meta.description).toContain('Command and Conquer');
    expect(meta.description).toContain('Enlightened Strike');
  });

  it('uses the highest-priced card image for the OG image and links the wants URL', async () => {
    mockGetBasicInfo.mockResolvedValue({ success: true, data: makeUser() } as any);
    mockGetUserWants.mockResolvedValue({
      success: true,
      data: {
        items: [
          makeItem({ display_name: 'Cheap Card', tcg_low: 1, image_url: 'https://img/cheap' }),
          makeItem({ display_name: 'Pricey Card', tcg_low: 99, image_url: 'https://img/pricey' }),
        ],
        total: 2,
      },
    } as any);

    const meta = await generateMetadata({ params: params(USER_ID) });

    const ogImages = (meta.openGraph as any)?.images;
    expect(ogImages?.[0]?.url).toBe('https://img/pricey');
    expect((meta.openGraph as any)?.url).toContain(`/wants/${USER_ID}`);
    expect((meta.alternates as any)?.canonical).toContain(`/wants/${USER_ID}`);
  });

  it('falls back to the site icon and a generic description for an empty list', async () => {
    mockGetBasicInfo.mockResolvedValue({ success: true, data: makeUser() } as any);
    mockGetUserWants.mockResolvedValue({
      success: true,
      data: { items: [], total: 0 },
    } as any);

    const meta = await generateMetadata({ params: params(USER_ID) });

    expect(meta.title).toContain("cardhunter's Wants List");
    const ogImages = (meta.openGraph as any)?.images;
    expect(ogImages?.[0]?.url).toContain('icon-512x512.png');
    expect(meta.description).toBeTruthy();
  });

  it('returns fallback metadata when the user is not found', async () => {
    mockGetBasicInfo.mockResolvedValue({ success: true, data: null } as any);

    const meta = await generateMetadata({ params: params('missing') });

    expect(meta.title).toBeDefined();
    expect(mockGetUserWants).not.toHaveBeenCalled();
  });

  it('returns fallback metadata when a service throws', async () => {
    mockGetBasicInfo.mockRejectedValue(new Error('db down'));

    const meta = await generateMetadata({ params: params('boom') });

    expect(meta.title).toBeDefined();
  });
});
