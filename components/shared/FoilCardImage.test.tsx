/**
 * FoilCardImage's shimmer rAF loop must stop once the card is at rest.
 *
 * It used to reschedule itself every frame forever — each foil card on screen
 * wrote ~20 CSS vars per frame while nobody touched it, which is what made
 * foil-heavy binders feel sluggish. The loop now runs only while the pointer
 * is on the card and until the springs settle back afterwards.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import FoilCardImage from './FoilCardImage';
import { writeFoilEffects } from '@/lib/ui/foil-effects-pref';

// Manual rAF queue so the test controls every frame.
let queue: Map<number, FrameRequestCallback>;
let nextId: number;

const runFrames = (n: number) => {
  act(() => {
    for (let i = 0; i < n && queue.size > 0; i++) {
      const pending = [...queue.entries()];
      queue.clear();
      for (const [, cb] of pending) cb(performance.now());
    }
  });
};

beforeEach(() => {
  queue = new Map();
  nextId = 1;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
    const id = nextId++;
    queue.set(id, cb);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => {
    queue.delete(id);
  });
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as any;
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

const renderFoil = () => {
  const { container } = render(<FoilCardImage foiling="R" src="/x.webp" alt="card" />);
  const card = container.querySelector('.card') as HTMLDivElement;
  vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(
    { left: 0, top: 0, width: 200, height: 280, right: 200, bottom: 280, x: 0, y: 0, toJSON: () => ({}) } as DOMRect,
  );
  return card;
};

describe('FoilCardImage shimmer loop', () => {
  beforeEach(() => {
    window.localStorage.setItem('fabb:foil-effects', '1');
  });

  it('does not keep scheduling frames while the card is untouched', () => {
    renderFoil();
    runFrames(600);
    expect(queue.size).toBe(0);
  });

  it('animates on hover and stops after the pointer leaves', () => {
    const card = renderFoil();
    runFrames(600);

    // jsdom's PointerEvent drops clientX/clientY, so dispatch a MouseEvent
    // under the pointermove type — React's onPointerMove still receives it.
    fireEvent(card, new MouseEvent('pointermove', { bubbles: true, clientX: 150, clientY: 60 }));
    runFrames(5);
    expect(queue.size).toBeGreaterThan(0);
    const tilt = parseFloat(card.style.getPropertyValue('--rotate-x'));
    expect(Number.isFinite(tilt) && tilt !== 0).toBe(true);

    fireEvent.pointerLeave(card);
    runFrames(5000);
    expect(queue.size).toBe(0);
  });
});

describe('FoilCardImage with foil effects off (the default)', () => {
  it('renders a foil printing as a plain image and never animates', () => {
    const card = renderFoil();
    expect(card.hasAttribute('data-rarity')).toBe(false);
    expect(card.querySelector('.card__shine')).toBeNull();

    fireEvent(card, new MouseEvent('pointermove', { bubbles: true, clientX: 150, clientY: 60 }));
    expect(queue.size).toBe(0);
  });

  it('turns the effect on when the preference is switched on', () => {
    const card = renderFoil();
    act(() => { writeFoilEffects(true); });
    expect(card.getAttribute('data-rarity')).toBe('rainbow foil');

    fireEvent(card, new MouseEvent('pointermove', { bubbles: true, clientX: 150, clientY: 60 }));
    expect(queue.size).toBeGreaterThan(0);
  });
});
