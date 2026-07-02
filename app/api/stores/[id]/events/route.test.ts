/**
 * Unit tests for POST /api/stores/[id]/events
 *
 * Uses mocked eventService, locationService, and auth — tests HTTP concerns:
 * permission gating and that JSON ISO-string dates are coerced to Date
 * instances before reaching the service (Drizzle timestamp columns expect Date).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mocks must be declared before importing the module under test.
// vi.mock is hoisted, so factories cannot reference outer variables.
vi.mock('@/lib/services', () => ({
  eventService: {
    createEvent: vi.fn(),
  },
  locationService: {
    canManageLocation: vi.fn(),
  },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));

// Import after mocks are declared so we can use vi.mocked()
import { POST } from './route';
import { eventService, locationService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockCreateEvent = vi.mocked(eventService.createEvent);
const mockCanManage = vi.mocked(locationService.canManageLocation);
const mockAuth = vi.mocked(authenticateRequest);

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

const LOCATION_ID = 'loc-abc';

const makeRequest = (body: unknown) =>
  new NextRequest(`http://localhost/api/stores/${LOCATION_ID}/events`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

const params = Promise.resolve({ id: LOCATION_ID });

const validBody = {
  name: 'Pro Tour: Las Vegas',
  type: 'pro_tour',
  startDate: '2026-08-14T00:00:00.000Z',
  endDate: '2026-08-16T00:00:00.000Z',
  registrationUrl: 'https://fabtcg.com/en/organised-play/2026/pro-tour-las-vegas/',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'admin-1' } as any);
  mockCanManage.mockResolvedValue({ success: true, data: true } as any);
  mockCreateEvent.mockResolvedValue({ success: true, data: { id: 'evt-1' } } as any);
});

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe('POST /api/stores/[id]/events', () => {
  it('opts into OAuth bearer auth so MCP tools (create_event) can call it', async () => {
    await POST(makeRequest(validBody), { params });

    expect(mockAuth).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ allowOAuth: true })
    );
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'nope' } as any);
    const res = await POST(makeRequest(validBody), { params });
    expect(res.status).toBe(401);
    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  it('returns 403 when the user cannot manage the location', async () => {
    mockCanManage.mockResolvedValue({ success: true, data: false } as any);
    const res = await POST(makeRequest(validBody), { params });
    expect(res.status).toBe(403);
    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  it('coerces ISO-string startDate/endDate to Date and sets locationId from the route param', async () => {
    const res = await POST(makeRequest(validBody), { params });
    expect(res.status).toBe(201);

    expect(mockCreateEvent).toHaveBeenCalledTimes(1);
    const [payload, createdBy] = mockCreateEvent.mock.calls[0];
    expect(payload.locationId).toBe(LOCATION_ID);
    expect(payload.startDate).toBeInstanceOf(Date);
    expect(payload.endDate).toBeInstanceOf(Date);
    expect((payload.startDate as Date).toISOString()).toBe(validBody.startDate);
    expect((payload.endDate as Date).toISOString()).toBe(validBody.endDate);
    expect(payload.name).toBe(validBody.name);
    expect(createdBy).toBe('admin-1');
  });

  it('returns 201 with the created event on success', async () => {
    const res = await POST(makeRequest(validBody), { params });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.id).toBe('evt-1');
  });
});
