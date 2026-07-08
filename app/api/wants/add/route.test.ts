/**
 * Route unit tests for POST /api/wants/add — specifically the null-item edge:
 * the service can report success with a null item (a concurrent remove deleted
 * the row between the write and the re-read), and the route must degrade
 * gracefully instead of 500ing on `.display_name`. Seen live 2026-07-08.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({ wantsService: { addWantsItem: vi.fn(), getWantsStats: vi.fn() } }));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));
vi.mock('@/lib/discord/discord-webhooks', () => ({ DiscordWebhooks: { sendWantsUpdate: vi.fn() } }));

// Import AFTER mocks (vi.mock is hoisted)
import { POST } from './route';
import { wantsService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockAdd = vi.mocked(wantsService.addWantsItem);
const mockStats = vi.mocked(wantsService.getWantsStats);
const mockAuth = vi.mocked(authenticateRequest);

const request = (body: unknown) =>
  new Request('http://localhost/api/wants/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as any;

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'u1', username: 'tester' } as any);
  mockStats.mockResolvedValue({ success: false, error: 'skip' } as any);
});

describe('POST /api/wants/add', () => {
  it('adds a single printing and reports success', async () => {
    mockAdd.mockResolvedValue({
      success: true,
      data: { action: 'created', item: { display_name: 'Pummel', foiling: 's', tcg_market: 1 } },
    } as any);

    const res = await POST(request({ printingId: 'pr1', quantity: 1 }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockAdd).toHaveBeenCalledWith('u1', expect.objectContaining({ printingId: 'pr1', quantity: 1 }));
  });

  it('does not 500 when the service succeeds with a null item (row deleted concurrently)', async () => {
    mockAdd.mockResolvedValue({ success: true, data: { action: 'created', item: null } } as any);

    const res = await POST(request({ printingId: 'pr1', quantity: 1 }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('does not 500 on a null item in the batch path either', async () => {
    mockAdd.mockResolvedValue({ success: true, data: { action: 'created', item: null } } as any);

    const res = await POST(request({ printings: [{ printingId: 'pr1', quantity: 1 }] }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });
});
