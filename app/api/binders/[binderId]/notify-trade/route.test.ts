/**
 * Unit tests for POST /api/binders/[binderId]/notify-trade
 *
 * Mocked services/auth/webhook — tests HTTP concerns: auth, access
 * control, self-notify skip, dedupe, payload mapping, fire-and-forget
 * semantics (webhook failure never fails the request).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mocks must be declared before importing the module under test.
// vi.mock is hoisted, so factories cannot reference outer variables.
vi.mock('@/lib/services', () => ({
  binderService: { getBinder: vi.fn() },
  userService: { findById: vi.fn() },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));

vi.mock('@/lib/discord/discord-webhooks', () => ({
  DiscordWebhooks: { sendTradeInterest: vi.fn() },
}));

// Import after mocks are declared so we can use vi.mocked()
import { POST } from './route';
import { binderService, userService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { DiscordWebhooks } from '@/lib/discord/discord-webhooks';
import { resetTradeInterestDedupe } from '@/lib/discord/trade-interest-dedupe';

const mockAuth = vi.mocked(authenticateRequest);
const mockGetBinder = vi.mocked(binderService.getBinder);
const mockFindById = vi.mocked(userService.findById);
const mockSend = vi.mocked(DiscordWebhooks.sendTradeInterest);

const BINDER_ID = 'binder-1';
const OWNER_ID = 'owner-1';
const REQUESTER_ID = 'requester-1';

const makeRequest = (body: unknown = validBody()) =>
  new NextRequest(`http://localhost/api/binders/${BINDER_ID}/notify-trade`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

const params = { params: Promise.resolve({ binderId: BINDER_ID }) };

function validBody() {
  return {
    cards: [{ name: 'Command and Conquer', quantity: 1, value: 25.5 }],
    totalValue: 25.5,
  };
}

const setAuth = (userId = REQUESTER_ID) =>
  mockAuth.mockResolvedValue({ success: true, userId } as any);

const setBinder = (overrides: Record<string, unknown> = {}) =>
  mockGetBinder.mockResolvedValue({
    success: true,
    data: { _id: BINDER_ID, userId: OWNER_ID, name: 'Trade Binder', ...overrides },
  } as any);

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

describe('auth & access', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);

    const res = await POST(makeRequest(), params);

    expect(res.status).toBe(401);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns 404 when the binder does not exist or is not accessible', async () => {
    setAuth();
    mockGetBinder.mockResolvedValue({ success: true, data: null } as any);

    const res = await POST(makeRequest(), params);

    expect(res.status).toBe(404);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('passes the requesting user to getBinder for access control', async () => {
    setAuth();
    setBinder();
    setUsers();

    await POST(makeRequest(), params);

    expect(mockGetBinder).toHaveBeenCalledWith(BINDER_ID, REQUESTER_ID);
  });
});

describe('notification', () => {
  it('sends a webhook naming both users with their discordIds', async () => {
    setAuth();
    setBinder();
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
        binderName: 'Trade Binder',
        binderUrl: expect.stringContaining(`/binder/${BINDER_ID}`),
        cards: [{ name: 'Command and Conquer', quantity: 1, value: 25.5 }],
      })
    );
  });

  it('skips notifying when viewing your own binder', async () => {
    setAuth(OWNER_ID);
    setBinder();
    setUsers();

    const res = await POST(makeRequest(), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.notified).toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('dedupes repeat notifications for the same requester+binder', async () => {
    setAuth();
    setBinder();
    setUsers();

    const first = await POST(makeRequest(), params);
    const second = await POST(makeRequest(), params);

    expect((await first.json()).data.notified).toBe(true);
    expect((await second.json()).data.notified).toBe(false);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('still returns 200 when the webhook send fails (fire-and-forget)', async () => {
    setAuth();
    setBinder();
    setUsers();
    mockSend.mockResolvedValue(false);

    const res = await POST(makeRequest(), params);

    expect(res.status).toBe(200);
  });

  it('caps forwarded cards at 10 and coerces malformed entries away', async () => {
    setAuth();
    setBinder();
    setUsers();

    const cards = [
      ...Array.from({ length: 12 }, (_, i) => ({
        name: `Card ${i + 1}`,
        quantity: 1,
        value: 1,
      })),
      { junk: true },
    ];
    await POST(makeRequest({ cards }), params);

    const sent = mockSend.mock.calls[0][0];
    expect(sent.cards).toHaveLength(10);
    expect(sent.cards.every((c: any) => typeof c.name === 'string')).toBe(true);
  });

  it('returns 400 for a body without a cards array', async () => {
    setAuth();
    setBinder();
    setUsers();

    const res = await POST(makeRequest({ cards: 'nope' }), params);

    expect(res.status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
