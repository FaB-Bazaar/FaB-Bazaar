import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock('@/lib/services', () => ({
  userService: { getVolzarAccess: vi.fn() },
}));
vi.mock('@/lib/metafy/sync-tier', () => ({ syncSupporterTierIfStale: vi.fn() }));
vi.mock('./VolzarChat', () => ({ VolzarChat: () => null }));

import VolzarPage from './page';
import { AccessGate } from './AccessGate';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { userService } from '@/lib/services';

const mockAuth = vi.mocked(auth);
const mockGetVolzarAccess = vi.mocked(userService.getVolzarAccess);
const mockRedirect = vi.mocked(redirect);

const emptySearchParams = () => Promise.resolve({});

/** Depth-first walk of a plain React element tree collecting matches. */
function findElements(
  node: unknown,
  predicate: (el: ReactElement) => boolean,
  found: ReactElement[] = [],
): ReactElement[] {
  if (node == null || typeof node !== 'object') return found;
  if (Array.isArray(node)) {
    node.forEach((child) => findElements(child, predicate, found));
    return found;
  }
  const el = node as ReactElement;
  if (el.type !== undefined && predicate(el)) found.push(el);
  const props = (el as any).props;
  if (props?.children) findElements(props.children, predicate, found);
  return found;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('VolzarPage signed-out handling', () => {
  it('renders the access gate for signed-out visitors instead of redirecting (crawlers must see OG tags)', async () => {
    mockAuth.mockResolvedValue(null as any);

    const result = await VolzarPage({ searchParams: emptySearchParams() });

    expect(mockRedirect).not.toHaveBeenCalled();
    expect((result as ReactElement).type).toBe(AccessGate);
  });

  it('renders the chat for any signed-in user — Volzar is standard, no supporter gate', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', name: 'bob' } } as any);
    mockGetVolzarAccess.mockResolvedValue({
      success: true,
      data: { isSuperAdmin: false, metafySupporterTier: null, volzarAccess: false },
    } as any);

    const result = await VolzarPage({ searchParams: emptySearchParams() });

    expect((result as ReactElement).type).not.toBe(AccessGate);
    const chats = findElements(result, (el) => (el.props as any)?.username === 'bob');
    expect(chats.length).toBe(1);
  });
});

describe('AccessGate (signed-out gate)', () => {
  it('offers a sign-in link that returns to /volzar after login', () => {
    const tree = AccessGate();

    const signInLinks = findElements(
      tree,
      (el) => typeof (el.props as any)?.href === 'string'
        && (el.props as any).href.includes('/auth/login')
        && (el.props as any).href.includes('callbackUrl=%2Fvolzar'),
    );
    expect(signInLinks.length).toBeGreaterThan(0);
  });
});
