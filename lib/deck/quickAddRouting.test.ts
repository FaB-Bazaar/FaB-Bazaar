import { describe, it, expect } from 'vitest';
import { resolveQuickAddAction } from './quickAddRouting';

describe('resolveQuickAddAction', () => {
  it('routes to the inline Cards tab on mobile (no dialog)', () => {
    const action = resolveQuickAddAction(true, { category: 'maindeck' });
    expect(action).toEqual({ kind: 'switchTab', tab: 'search', target: { category: 'maindeck' } });
  });

  // The mobile Cards tab has no dialog to read the zone from, so the action
  // must carry it — dropping it here is how "add to bench" landed in the
  // maindeck on phones.
  it('keeps the bench target on the mobile switchTab action', () => {
    const action = resolveQuickAddAction(true, { category: 'benched' });
    expect(action).toEqual({ kind: 'switchTab', tab: 'search', target: { category: 'benched' } });
  });

  it('opens the QuickAdd dialog on desktop and preserves category + pitch', () => {
    const action = resolveQuickAddAction(false, { category: 'maindeck', pitch: 2 });
    expect(action).toEqual({
      kind: 'openDialog',
      target: { category: 'maindeck', pitch: 2 },
    });
  });

  it('opens the dialog on desktop with category-only target (no pitch)', () => {
    const action = resolveQuickAddAction(false, { category: 'inventory' });
    expect(action).toEqual({
      kind: 'openDialog',
      target: { category: 'inventory' },
    });
  });

  // Viewers of someone else's deck must never be routed anywhere: on mobile the
  // 'search' tab is canEdit-gated, so switching to it blanks the page.
  it('blocks quick-add on mobile when the viewer cannot edit', () => {
    const action = resolveQuickAddAction(true, { category: 'maindeck' }, false);
    expect(action).toEqual({ kind: 'blocked' });
  });

  it('blocks quick-add on desktop when the viewer cannot edit', () => {
    const action = resolveQuickAddAction(false, { category: 'maindeck', pitch: 1 }, false);
    expect(action).toEqual({ kind: 'blocked' });
  });

  it('treats omitted canEdit as editable (back-compat)', () => {
    const action = resolveQuickAddAction(true, { category: 'inventory' });
    expect(action).toEqual({ kind: 'switchTab', tab: 'search', target: { category: 'inventory' } });
  });
});
