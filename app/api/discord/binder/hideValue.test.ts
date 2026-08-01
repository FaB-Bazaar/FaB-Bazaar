/**
 * Route unit tests for GET /api/discord/binder (list mode) — hideValue privacy.
 *
 * The bot's binder dropdown renders each binder's totalValue (💰 ~$X).
 * When a binder has hideValue set, its totalValue must be null for
 * NON-OWNER viewers; the owner still gets the real number.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  binderService: {
    getUserBindersWithStats: vi.fn(),
    findBinderByIdOrSlug: vi.fn(),
    getAllCardsForExport: vi.fn(),
  },
  userService: {
    findByDiscordId: vi.fn(),
  },
}));
vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));

import { GET } from './route';
import { binderService, userService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockGetWithStats = vi.mocked(binderService.getUserBindersWithStats);
const mockFindByDiscordId = vi.mocked(userService.findByDiscordId);
const mockAuth = vi.mocked(authenticateRequest);

const OWNER = { userId: 'owner-1', discordId: 'd-owner' };
const VIEWER = { userId: 'viewer-2', discordId: 'd-viewer' };

const binderRow = (overrides: Record<string, unknown> = {}) => ({
  _id: 'b1',
  userId: OWNER.userId,
  name: 'Pricey',
  slug: 'pricey',
  isPublic: true,
  visibility: { level: 'public', allowDiscordCommands: true },
  stats: {
    totalQuantity: 10,
    totalValue: { tcg_low: 5000, tcg_market: 6000, tcg_mid: 5500, tcg_high: 7000 },
  },
  ...overrides,
});

const listBinders = async (asViewer: boolean) => {
  mockAuth.mockResolvedValue({
    success: true,
    authMethod: 'discordId',
    userId: asViewer ? VIEWER.userId : OWNER.userId,
    discordId: asViewer ? VIEWER.discordId : OWNER.discordId,
  } as any);
  mockFindByDiscordId.mockResolvedValue({
    success: true,
    data: { _id: OWNER.userId, username: 'owner' },
  } as any);

  const req = new NextRequest(`http://localhost/api/discord/binder?targetDiscordId=${OWNER.discordId}`);
  const res = await GET(req);
  return { res, data: await res.json() };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/discord/binder (list) — hideValue', () => {
  it('nulls totalValue for non-owner viewers when hideValue is set', async () => {
    mockGetWithStats.mockResolvedValue({
      success: true,
      data: [binderRow({ hideValue: true })],
    } as any);

    const { res, data } = await listBinders(true);

    expect(res.status).toBe(200);
    expect(data.binders).toHaveLength(1);
    expect(data.binders[0].totalValue).toBeNull();
    expect(data.binders[0].cardCount).toBe(10);
  });

  it('keeps totalValue for the owner even when hideValue is set', async () => {
    mockGetWithStats.mockResolvedValue({
      success: true,
      data: [binderRow({ hideValue: true })],
    } as any);

    const { data } = await listBinders(false);

    expect(data.binders[0].totalValue).toBe(5000);
  });

  it('keeps totalValue for non-owners when hideValue is not set', async () => {
    mockGetWithStats.mockResolvedValue({
      success: true,
      data: [binderRow()],
    } as any);

    const { data } = await listBinders(true);

    expect(data.binders[0].totalValue).toBe(5000);
  });
});
