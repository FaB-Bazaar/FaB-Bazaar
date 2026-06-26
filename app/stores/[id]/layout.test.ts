import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  locationService: { getLocationById: vi.fn() },
  eventService: { getEventsAtLocation: vi.fn() },
}));

import { generateMetadata } from './layout';
import { locationService, eventService } from '@/lib/services';

const mockGetLocation = vi.mocked(locationService.getLocationById);
const mockGetEvents = vi.mocked(eventService.getEventsAtLocation);

function makeLocation(overrides = {}) {
  return {
    id: 'NTKHSe2T13EdPLc5ZVEAA',
    category: 'venue' as const,
    name: 'Las Vegas Convention Center',
    addressLine1: '3150 Paradise Rd',
    addressCity: 'Las Vegas',
    addressState: 'NV',
    addressCountry: 'US',
    tags: [],
    active: true,
    images: [],
    followerCount: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeEvent(overrides = {}) {
  return {
    id: 'nYPpsUZmneIwMgkivPrlA',
    locationId: 'NTKHSe2T13EdPLc5ZVEAA',
    locationName: 'Las Vegas Convention Center',
    name: 'Pro Tour: Las Vegas',
    type: 'pro_tour' as const,
    format: 'Classic Constructed & Booster Draft',
    startDate: new Date('2026-07-16T00:00:00Z'),
    endDate: new Date('2026-07-19T00:00:00Z'),
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const params = (id: string) => Promise.resolve({ id });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('stores/[id] generateMetadata', () => {
  it('uses the upcoming event name + dates for a venue with an upcoming event', async () => {
    mockGetLocation.mockResolvedValue({ success: true, data: makeLocation() } as any);
    mockGetEvents.mockResolvedValue({ success: true, data: [makeEvent()] } as any);

    const meta = await generateMetadata({ params: params('NTKHSe2T13EdPLc5ZVEAA') });

    expect(meta.title).toContain('Pro Tour: Las Vegas');
    expect(meta.title).toContain('Las Vegas Convention Center');
    expect(meta.description).toContain('Jul 16–19, 2026');
    expect(meta.description).toContain('Classic Constructed & Booster Draft');
    expect(meta.openGraph?.title).toContain('Pro Tour: Las Vegas');
    expect((meta.openGraph as any)?.url).toContain('/stores/NTKHSe2T13EdPLc5ZVEAA');
  });

  it('falls back to the venue name + place when there are no upcoming events', async () => {
    mockGetLocation.mockResolvedValue({ success: true, data: makeLocation() } as any);
    mockGetEvents.mockResolvedValue({ success: true, data: [] } as any);

    const meta = await generateMetadata({ params: params('NTKHSe2T13EdPLc5ZVEAA') });

    expect(meta.title).toBe('Las Vegas Convention Center');
    expect(meta.description).toContain('Las Vegas');
    expect(meta.description).toContain('NV');
  });

  it('ignores past events and picks the soonest future event', async () => {
    const past = makeEvent({
      id: 'past',
      name: 'Old Open',
      startDate: new Date('2020-01-01T00:00:00Z'),
      endDate: new Date('2020-01-02T00:00:00Z'),
    });
    const soon = makeEvent({ id: 'soon', name: 'Pro Tour: Las Vegas' });
    const later = makeEvent({
      id: 'later',
      name: 'Future Calling',
      startDate: new Date('2030-01-01T00:00:00Z'),
      endDate: new Date('2030-01-02T00:00:00Z'),
    });
    mockGetLocation.mockResolvedValue({ success: true, data: makeLocation() } as any);
    mockGetEvents.mockResolvedValue({ success: true, data: [later, past, soon] } as any);

    const meta = await generateMetadata({ params: params('NTKHSe2T13EdPLc5ZVEAA') });

    expect(meta.title).toContain('Pro Tour: Las Vegas');
    expect(meta.title).not.toContain('Future Calling');
    expect(meta.title).not.toContain('Old Open');
  });

  it('describes a store (non-venue) using its notes when present', async () => {
    mockGetLocation.mockResolvedValue({
      success: true,
      data: makeLocation({
        category: 'store',
        name: 'Card Kingdom',
        notes: 'Your friendly local game store with weekly Armory events.',
      }),
    } as any);
    mockGetEvents.mockResolvedValue({ success: true, data: [] } as any);

    const meta = await generateMetadata({ params: params('store1') });

    expect(meta.title).toBe('Card Kingdom');
    expect(meta.description).toBe('Your friendly local game store with weekly Armory events.');
  });

  it('returns fallback metadata when the location is not found', async () => {
    mockGetLocation.mockResolvedValue({ success: true, data: null } as any);

    const meta = await generateMetadata({ params: params('missing') });

    expect(meta.title).toBeDefined();
    expect(mockGetEvents).not.toHaveBeenCalled();
  });

  it('returns fallback metadata when the service errors', async () => {
    mockGetLocation.mockRejectedValue(new Error('db down'));

    const meta = await generateMetadata({ params: params('boom') });

    expect(meta.title).toBeDefined();
  });
});
