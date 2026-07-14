/**
 * Route unit tests: POST /api/user/complete-profile — landingPage handling.
 * Service mocked; proves validation and passthrough, not persistence.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({ userService: { updateProfile: vi.fn() } }));
vi.mock('@/auth', () => ({ auth: vi.fn() }));

import { POST } from './route';
import { userService } from '@/lib/services';
import { auth } from '@/auth';

const mockAuth = vi.mocked(auth as unknown as () => Promise<any>);
const mockUpdateProfile = vi.mocked(userService.updateProfile);

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/user/complete-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
  mockUpdateProfile.mockResolvedValue({ success: true, data: undefined } as any);
});

describe('POST /api/user/complete-profile — landingPage', () => {
  it('passes a valid landingPage through to updateProfile', async () => {
    const res = await POST(makeRequest({ username: 'bob', landingPage: 'collection' }));
    expect(res.status).toBe(200);
    expect(mockUpdateProfile).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ landingPage: 'collection' })
    );
  });

  it('passes an empty string through (clears back to the /volzar default)', async () => {
    const res = await POST(makeRequest({ username: 'bob', landingPage: '' }));
    expect(res.status).toBe(200);
    expect(mockUpdateProfile).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ landingPage: '' })
    );
  });

  it('rejects an unknown landingPage with 400 and no write', async () => {
    const res = await POST(makeRequest({ username: 'bob', landingPage: 'garbage' }));
    expect(res.status).toBe(400);
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it('omits landingPage from the update when the body omits it', async () => {
    const res = await POST(makeRequest({ username: 'bob' }));
    expect(res.status).toBe(200);
    const updates = mockUpdateProfile.mock.calls[0][1] as Record<string, unknown>;
    expect('landingPage' in updates).toBe(false);
  });
});
