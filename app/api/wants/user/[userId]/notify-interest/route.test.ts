/**
 * Unit tests for POST /api/wants/user/[userId]/notify-interest
 *
 * Mocked services/auth/webhook — mirrors the binder notify-trade route:
 * auth, self-notify skip, dedupe (shared window keyed on wants:<ownerId>),
 * payload mapping, fire-and-forget webhook semantics.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  userService: { findById: vi.fn() },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));

vi.mock('@/lib/discord/discord-webhooks', () => ({
  DiscordWebhooks: { sendWantsInterest: vi.fn() },
}));

import { POST } from './route';
import { userService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { DiscordWebhooks } from '@/lib/discord/discord-webhooks';
import { resetTradeInterestDedupe } from '@/lib/discord/trade-interest-dedupe';

const mockAuth = vi.mocked(authenticateRequest);
const mockFindById = vi.mocked(userService.findById);
const mockSend = vi.mocked(DiscordWebhooks.sendWantsInterest);

const OWNER_ID = 'owner-1';
const REQUESTER_ID = 'requester-1';

const makeRequest = (body: unknown = validBody()) =>
  new NextRequest(`http://localhost/api/wants/user/${OWNER_ID}/notify-interest`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

const params = { params: Promise.resolve({ userId: OWNER_ID }) };

function validBody() {
  return { cards: [{ name: 'Command and Conquer', quantity: 1, value: 25.5 }] };
}

const setAuth = (userId = REQUESTER_ID) =>
  mockAuth.mockResolvedValue({ success: true, userId } as any);

const setUsers = () =>
  mockFindById.mockImplementation(async (id: string) =>
    ({
      success: true,
      data:
        id === OWNER_ID
          ? { _id: OWNER_ID, username: 'dc_bob', discordId: '222' }
          : { _id: REQUESTER_ID, username: 'dc_alice', discordId: '111' },
    }) as any
  );

beforeEach(() => {
  vi.clearAllMocks();
  resetTradeInterestDedupe();
  mockSend.mockResolvedValue(true);
});

describe('auth & validation', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);

    const res = await POST(makeRequest(), params);

    expect(res.status).toBe(401);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns 400 for a body without a cards array', async () => {
    setAuth();
    setUsers();

    const res = await POST(makeRequest({ cards: 'nope' }), params);

    expect(res.status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns 404 when the wants list owner does not exist', async () => {
    setAuth();
    mockFindById.mockResolvedValue({ success: true, data: null } as any);

    const res = await POST(makeRequest(), params);

    expect(res.status).toBe(404);
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe('notification', () => {
  it('sends a webhook naming both users and linking the wants list', async () => {
    setAuth();
    setUsers();

    const res = await POST(makeRequest(), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true, data: { notified: true } });
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        requesterUsername: 'dc_alice',
        requesterDiscordId: '111',
        ownerUsername: 'dc_bob',
        ownerDiscordId: '222',
        wantsUrl: expect.stringContaining(`/wants/${OWNER_ID}`),
        cards: [{ name: 'Command and Conquer', quantity: 1, value: 25.5 }],
      })
    );
  });

  it('skips notifying your own wants list', async () => {
    setAuth(OWNER_ID);
    setUsers();

    const res = await POST(makeRequest(), params);

    expect((await res.json()).data.notified).toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('dedupes repeat notifications for the same requester+owner', async () => {
    setAuth();
    setUsers();

    const first = await POST(makeRequest(), params);
    const second = await POST(makeRequest(), params);

    expect((await first.json()).data.notified).toBe(true);
    expect((await second.json()).data.notified).toBe(false);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('still returns 200 when the webhook send fails (fire-and-forget)', async () => {
    setAuth();
    setUsers();
    mockSend.mockResolvedValue(false);

    const res = await POST(makeRequest(), params);

    expect(res.status).toBe(200);
  });

  it('caps forwarded cards at 10 and drops malformed entries', async () => {
    setAuth();
    setUsers();

    const cards = [
      ...Array.from({ length: 12 }, (_, i) => ({ name: `Card ${i + 1}`, quantity: 1, value: 1 })),
      { junk: true },
    ];
    await POST(makeRequest({ cards }), params);

    const sent = mockSend.mock.calls[0][0];
    expect(sent.cards).toHaveLength(10);
    expect(sent.cards.every((c: any) => typeof c.name === 'string')).toBe(true);
  });
});

describe('source (where the match was spotted)', () => {
  it('forwards a store source as a label, a fabbazaar store link and the next event', async () => {
    setAuth();
    setUsers();

    const res = await POST(
      makeRequest({
        ...validBody(),
        source: { storeId: 'store-1', storeName: 'Card Kingdom', eventName: 'Armory', eventDate: 'Sep 12, 2026' },
      }),
      params,
    );

    expect(res.status).toBe(200);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        source: {
          label: 'Card Kingdom',
          url: 'https://fabbazaar.app/stores/store-1',
          detail: 'Next event: Armory (Sep 12, 2026)',
        },
      }),
    );
  });

  it('omits the event line when the store has none, and drops a malformed source entirely', async () => {
    setAuth();
    setUsers();

    await POST(makeRequest({ ...validBody(), source: { storeId: 'store-1', storeName: 'Card Kingdom' } }), params);
    expect(mockSend).toHaveBeenLastCalledWith(
      expect.objectContaining({
        source: { label: 'Card Kingdom', url: 'https://fabbazaar.app/stores/store-1', detail: undefined },
      }),
    );

    resetTradeInterestDedupe();
    await POST(makeRequest({ ...validBody(), source: { storeName: 'no id', url: 'https://evil.example' } }), params);
    expect(mockSend.mock.calls.at(-1)![0].source).toBeUndefined();
  });
});
