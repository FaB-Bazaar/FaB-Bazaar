// app/auth/login/actions.test.ts
// The Discord sign-in action must forward a validated callbackUrl as
// redirectTo, and fall back to /auth/post-login otherwise.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/auth', () => ({ signIn: vi.fn() }));

import { loginWithDiscord } from './actions';
import { signIn } from '@/auth';

const mockSignIn = vi.mocked(signIn);

function formDataWith(callbackUrl?: string): FormData {
  const fd = new FormData();
  if (callbackUrl !== undefined) fd.set('callbackUrl', callbackUrl);
  return fd;
}

describe('loginWithDiscord', () => {
  beforeEach(() => {
    mockSignIn.mockReset();
  });

  it('redirects to the submitted internal callbackUrl', async () => {
    await loginWithDiscord(formDataWith('/binder/abc123'));
    expect(mockSignIn).toHaveBeenCalledWith('discord', {
      redirectTo: '/binder/abc123',
    });
  });

  it('falls back to /auth/post-login when no callbackUrl is submitted', async () => {
    await loginWithDiscord(formDataWith());
    expect(mockSignIn).toHaveBeenCalledWith('discord', {
      redirectTo: '/auth/post-login',
    });
  });

  it('falls back to /auth/post-login when called without form data', async () => {
    await loginWithDiscord();
    expect(mockSignIn).toHaveBeenCalledWith('discord', {
      redirectTo: '/auth/post-login',
    });
  });

  it('ignores external callbackUrls (open-redirect guard)', async () => {
    await loginWithDiscord(formDataWith('https://evil.com/phish'));
    expect(mockSignIn).toHaveBeenCalledWith('discord', {
      redirectTo: '/auth/post-login',
    });
  });

  it('ignores protocol-relative callbackUrls', async () => {
    await loginWithDiscord(formDataWith('//evil.com'));
    expect(mockSignIn).toHaveBeenCalledWith('discord', {
      redirectTo: '/auth/post-login',
    });
  });
});
