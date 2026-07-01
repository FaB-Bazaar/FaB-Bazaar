/**
 * Tests for the mount-guarded client-environment hooks.
 *
 * These exist to fix React #418 hydration mismatches on the deck page: reading
 * `matchMedia`/`navigator` during render makes the server (no browser globals)
 * emit different HTML than the client's first paint. Both hooks MUST return the
 * SSR-safe default (false) on the first render, then update after mount.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIsTouchDevice, useIsMac } from './use-client-env';

const mockMatchMedia = (matches: boolean) => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    media: '(pointer: coarse)',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as any;
};

const setPlatform = (platform: string) =>
  Object.defineProperty(window.navigator, 'platform', { value: platform, configurable: true });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useIsTouchDevice', () => {
  it('returns false on the first render so it matches the server-rendered HTML', () => {
    mockMatchMedia(true); // coarse pointer — would be `true` if read during render
    const renders: boolean[] = [];
    renderHook(() => {
      const v = useIsTouchDevice();
      renders.push(v);
      return v;
    });
    expect(renders[0]).toBe(false);
  });

  it('reports true after mount on a coarse-pointer (touch) device', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useIsTouchDevice());
    expect(result.current).toBe(true);
  });

  it('stays false after mount on a fine-pointer device', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useIsTouchDevice());
    expect(result.current).toBe(false);
  });
});

describe('useIsMac', () => {
  it('returns false on the first render so it matches the server-rendered HTML', () => {
    setPlatform('MacIntel'); // would be `true` if read during render
    const renders: boolean[] = [];
    renderHook(() => {
      const v = useIsMac();
      renders.push(v);
      return v;
    });
    expect(renders[0]).toBe(false);
  });

  it('detects a Mac platform after mount', () => {
    setPlatform('MacIntel');
    const { result } = renderHook(() => useIsMac());
    expect(result.current).toBe(true);
  });

  it('stays false after mount on a non-Mac platform', () => {
    setPlatform('Win32');
    const { result } = renderHook(() => useIsMac());
    expect(result.current).toBe(false);
  });
});
