import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock('@/lib/services', () => ({
  userService: { getVolzarAccess: vi.fn(), getBasicInfo: vi.fn().mockResolvedValue({ success: true, data: null }) },
}));
vi.mock('@/lib/metafy/sync-tier', () => ({ syncSupporterTierIfStale: vi.fn() }));
vi.mock('@/lib/ai/volzar-suggestions', () => ({ getVolzarSuggestedPrompts: vi.fn(), resolveUserLanguage: vi.fn().mockReturnValue('en') }));
vi.mock('./VolzarChat', () => ({ VolzarChat: () => null }));

import VolzarPage from './page';
import { AccessGate } from './AccessGate';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { userService } from '@/lib/services';
import { syncSupporterTierIfStale } from '@/lib/metafy/sync-tier';
import { getVolzarSuggestedPrompts } from '@/lib/ai/volzar-suggestions';

const mockAuth = vi.mocked(auth);
const mockGetVolzarAccess = vi.mocked(userService.getVolzarAccess);
const mockRedirect = vi.mocked(redirect);
const mockSync = vi.mocked(syncSupporterTierIfStale);
const mockGetSuggestions = vi.mocked(getVolzarSuggestedPrompts);

/** Resolves 'rendered' if the page render wins, 'timed-out' if it hangs. */
const raceRender = (render: Promise<unknown>, ms = 100) =>
  Promise.race([
    render.then(() => 'rendered'),
    new Promise((resolve) => setTimeout(() => resolve('timed-out'), ms)),
  ]);

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

describe('VolzarPage model list', () => {
  it('sends the stealth bake-off model for superadmins (models[0] = stealth/ox-alpha)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', name: 'bob' } } as any);
    mockGetVolzarAccess.mockResolvedValue({
      success: true,
      data: { isSuperAdmin: true, metafySupporterTier: null, volzarAccess: true },
    } as any);
    mockGetSuggestions.mockResolvedValue([] as any);
    const prevKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = 'test-key';
    try {
      const result = await VolzarPage({ searchParams: emptySearchParams() });
      const chats = findElements(result, (el) => Array.isArray((el.props as any)?.models));
      expect(chats.length).toBe(1);
      expect((chats[0].props as any).models[0]).toBe('stealth/ox-alpha');
    } finally {
      if (prevKey === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = prevKey;
    }
  });

  it('sends the standard model for everyone else (models[0] = openai/gpt-oss-120b)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', name: 'bob' } } as any);
    mockGetVolzarAccess.mockResolvedValue({
      success: true,
      data: { isSuperAdmin: false, metafySupporterTier: null, volzarAccess: true },
    } as any);
    mockGetSuggestions.mockResolvedValue([] as any);
    const prevKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = 'test-key';
    try {
      const result = await VolzarPage({ searchParams: emptySearchParams() });
      const chats = findElements(result, (el) => Array.isArray((el.props as any)?.models));
      expect(chats.length).toBe(1);
      expect((chats[0].props as any).models[0]).toBe('openai/gpt-oss-120b');
    } finally {
      if (prevKey === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = prevKey;
    }
  });
});

describe('VolzarPage suggested prompts', () => {
  it('passes the state-aware suggested prompts to the chat', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', name: 'bob' } } as any);
    mockGetVolzarAccess.mockResolvedValue({
      success: true,
      data: { isSuperAdmin: false, metafySupporterTier: null, volzarAccess: false },
    } as any);
    const prompts = [{ icon: 'trending', text: 'What are the top decks in the meta right now?' }];
    mockGetSuggestions.mockResolvedValue(prompts as any);

    const result = await VolzarPage({ searchParams: emptySearchParams() });

    expect(mockGetSuggestions).toHaveBeenCalledWith('u1');
    const chats = findElements(result, (el) => (el.props as any)?.suggestedPrompts === prompts);
    expect(chats.length).toBe(1);
  });
});

describe('VolzarPage first-paint latency (no server waterfall)', () => {
  it('renders without waiting for the Metafy tier sync (fire-and-forget)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', name: 'bob' } } as any);
    mockGetVolzarAccess.mockResolvedValue({
      success: true,
      data: { isSuperAdmin: false, metafySupporterTier: null, volzarAccess: false },
    } as any);
    mockGetSuggestions.mockResolvedValue([] as any);
    // A hung Metafy round-trip (the fetch has no timeout) must not hold the page.
    mockSync.mockReturnValue(new Promise(() => {}) as any);

    const outcome = await raceRender(VolzarPage({ searchParams: emptySearchParams() }));

    expect(outcome).toBe('rendered');
    expect(mockSync).toHaveBeenCalledWith('u1');
  });

  it('starts the access and suggested-prompts reads in parallel', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', name: 'bob' } } as any);
    // Access resolves only once the prompts read has ALSO started: a
    // sequential await chain deadlocks here, a parallel kickoff passes.
    let releaseAccess!: () => void;
    const accessGate = new Promise<void>((resolve) => { releaseAccess = resolve; });
    mockGetVolzarAccess.mockImplementation((async () => {
      await accessGate;
      return { success: true, data: { isSuperAdmin: false, metafySupporterTier: null, volzarAccess: false } };
    }) as any);
    mockGetSuggestions.mockImplementation((async () => {
      releaseAccess();
      return [];
    }) as any);

    const outcome = await raceRender(VolzarPage({ searchParams: emptySearchParams() }));

    expect(outcome).toBe('rendered');
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
