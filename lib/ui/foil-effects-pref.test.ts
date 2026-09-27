/**
 * "Card foil effects" preference — per-device, localStorage-backed, OFF by
 * default (the tilt/shine read as "too many animations" to new visitors).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FOIL_EFFECTS_KEY,
  readFoilEffects,
  writeFoilEffects,
  subscribeFoilEffects,
} from './foil-effects-pref';

// Node project: provide a minimal browser surface.
let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  const target = new EventTarget();
  vi.stubGlobal('window', Object.assign(target, {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    },
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('foil effects preference', () => {
  it('is off when nothing is stored', () => {
    expect(readFoilEffects()).toBe(false);
  });

  it('is on only when stored as "1"', () => {
    store.set(FOIL_EFFECTS_KEY, '1');
    expect(readFoilEffects()).toBe(true);
    store.set(FOIL_EFFECTS_KEY, 'true');
    expect(readFoilEffects()).toBe(false);
  });

  it('round-trips through write', () => {
    writeFoilEffects(true);
    expect(readFoilEffects()).toBe(true);
    writeFoilEffects(false);
    expect(readFoilEffects()).toBe(false);
  });

  it('notifies subscribers in the same tab on write, until unsubscribed', () => {
    const cb = vi.fn();
    const unsubscribe = subscribeFoilEffects(cb);
    writeFoilEffects(true);
    expect(cb).toHaveBeenCalledTimes(1);
    unsubscribe();
    writeFoilEffects(false);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('falls back to off when storage throws (private mode)', () => {
    (window as any).localStorage.getItem = () => { throw new Error('denied'); };
    expect(readFoilEffects()).toBe(false);
    expect(() => writeFoilEffects(true)).not.toThrow();
  });

  it('is off during SSR (no window)', () => {
    vi.unstubAllGlobals();
    vi.stubGlobal('window', undefined);
    expect(readFoilEffects()).toBe(false);
  });
});
